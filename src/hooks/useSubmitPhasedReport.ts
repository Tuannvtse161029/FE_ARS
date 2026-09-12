// useSubmitPhasedReport — orchestrates the two-phase submission flow:
//
//   1. PDF upload to Firebase Storage (via a per-call instance of
//      useFirebaseUpload so the folder path is `research-groups/{groupId}/
//      phased-reports/{phaseKey}/{timestamp}_{sanitizedFileName}` per the
//      contract §5).
//   2. POST /api/PhasedReport with the returned Firebase URL.
//
// The hook exposes a `submit(file, options)` function that drives both phases
// and surfaces every state the modal needs:
//
//   - isUploading        : Firebase upload in flight (progress + disable).
//   - isSubmittingToServer: BE POST in flight (duplicate-submit guard).
//   - postUploadFailure  : Firebase succeeded but BE POST failed. The
//                          modal renders a recoverable error with Retry.
//                          On Retry, the file is NOT re-uploaded — the
//                          previous Firebase URL is reused.
//   - submitError        : Top-level failure that is NOT recoverable.

import { useCallback, useRef, useState } from 'react';
import {
  submitPhasedReport,
  resubmitPhasedReport,
  type PhasedReportSubmitRequest,
  type PhasedReportResubmitRequest,
  type SubmittedPhasedReport,
} from '../services/phasedReport.service';
import { useFirebaseUpload } from './useFirebaseUpload';
import { notificationService } from '../services/notification.service';
import { researchTopicService } from '../services/researchTopic.service';
import { researchGroupService } from '../services/researchGroup.service';

const buildFolderPath = (researchGroupId: number, phaseKey: string): string =>
  `research-groups/${researchGroupId}/phased-reports/${phaseKey}/`;

export interface SubmitOptions {
  researchGroupId: number;
  phaseKey: string;
  groupMemberId?: number;
  phasedReportId?: number;
  topicId?: number;
  phaseNumber?: number;
  isResubmission?: boolean;
  previousReportId?: number;
}

export interface UseSubmitPhasedReportState {
  isUploading: boolean;
  uploadProgress: number;
  pdfUrl: string | null;
  postUploadFailure: { pdfUrl: string; errorMessage: string } | null;
  isSubmittingToServer: boolean;
  submitError: Error | null;
  lastSubmitted: SubmittedPhasedReport | null;
  reset: () => void;
  submit: (file: File, options: SubmitOptions) => Promise<SubmittedPhasedReport | null>;
}

export function useSubmitPhasedReport(): UseSubmitPhasedReportState {
  const [activeFolder, setActiveFolder] = useState<string>(
    buildFolderPath(0, 'pending'),
  );
  const upload = useFirebaseUpload(activeFolder);

  const [isSubmittingToServer, setIsSubmittingToServer] =
    useState<boolean>(false);
  const [postUploadFailure, setPostUploadFailure] = useState<
    { pdfUrl: string; errorMessage: string } | null
  >(null);
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<SubmittedPhasedReport | null>(
    null,
  );

  // Re-entrancy guard. The shared hook tracks its own isUploading, but we
  // also need to block concurrent submit() invocations from the modal
  // (e.g. double-click on the submit button).
  const inFlightRef = useRef<boolean>(false);

  const submit = useCallback(
    async (file: File, options: SubmitOptions): Promise<SubmittedPhasedReport | null> => {
      if (inFlightRef.current) {
        return null;
      }
      inFlightRef.current = true;
      setSubmitError(null);
      setPostUploadFailure(null);

      // Re-bind the folder for THIS call so the shared hook writes to the
      // correct group/phase folder.
      setActiveFolder(buildFolderPath(options.researchGroupId, options.phaseKey));
      upload.resetUpload();

      // ----- Phase 1: Firebase upload -----
      let pdfUrl = postUploadFailure?.pdfUrl ?? null;
      if (!pdfUrl) {
        await upload.uploadPdf(file);
        if (upload.error) {
          setSubmitError(new Error(upload.error));
          inFlightRef.current = false;
          return null;
        }
        if (!upload.pdfUrl) {
          setSubmitError(
            new Error('Upload completed but no PDF URL was returned.'),
          );
          inFlightRef.current = false;
          return null;
        }
        pdfUrl = upload.pdfUrl;
      }

      // ----- Phase 2: BE POST -----
      setIsSubmittingToServer(true);
      try {
        const request: PhasedReportSubmitRequest = {
          researchGroupId: options.researchGroupId,
          reportFileUrl: pdfUrl,
          submittedAt: new Date().toISOString(),
          ...(typeof options.phasedReportId === 'number' ? { phasedReportId: options.phasedReportId } : {}),
          ...(typeof options.topicId === 'number' ? { topicId: options.topicId } : {}),
          ...(typeof options.phaseNumber === 'number' ? { phaseNumber: options.phaseNumber } : {}),
        };
        if (typeof options.groupMemberId === 'number') {
          request.groupMemberId = options.groupMemberId;
        }
        const result =
          options.isResubmission
            ? await resubmitPhasedReport({
                ...request,
                previousReportId: options.previousReportId,
              } as PhasedReportResubmitRequest)
            : await submitPhasedReport(request);

        setLastSubmitted(result);
        // Successful POST — clear the upload state so a follow-up call
        // starts with a clean slate.
        upload.resetUpload();
        setPostUploadFailure(null);
        // Defensive FE notification — fire a `[Lecturer] report submitted`
        // (first submission) or `[Lecturer] report resubmitted` (re-submit)
        // notification to the topic's lecturer. Best-effort: failures
        // never block the primary action. We resolve the lecturerId by
        // fetching the group → topic chain.
        try {
          if (typeof options.topicId === 'number' && options.topicId > 0) {
            const group = await researchGroupService.getById(options.researchGroupId).catch(() => null);
            const topic = await researchTopicService
              .getById(options.topicId)
              .catch(() => null);
            const lecturerId =
              typeof topic?.lecturerId === 'number'
                ? topic.lecturerId
                : typeof group?.lecturerId === 'number'
                  ? group.lecturerId
                  : null;
            if (lecturerId && lecturerId > 0) {
              const title =
                result?.milestoneTitle?.trim() ||
                result?.topicTitle?.trim() ||
                `Phase ${options.phaseNumber ?? ''}`.trim() ||
                `Report #${result?.id ?? ''}`;
              const message = options.isResubmission
                ? `[Lecturer] report resubmitted: "${title}" — student vừa nộp lại báo cáo.`
                : `[Lecturer] report submitted: "${title}" — student vừa nộp báo cáo.`;
              try {
                await notificationService.create({
                  userId: lecturerId,
                  message,
                });
              } catch (notifyErr) {
                console.warn('Failed to send report-submission notification:', notifyErr);
              }
            }
          }
        } catch (notifyFanoutErr) {
          console.warn('Failed to fan out report-submission notification:', notifyFanoutErr);
        }
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Server submission failed.';
        // BE POST failed but the binary is already in Firebase. Preserve
        // the URL so the modal's Retry button can re-try without
        // re-uploading.
        setPostUploadFailure({ pdfUrl, errorMessage: message });
        return null;
      } finally {
        setIsSubmittingToServer(false);
        inFlightRef.current = false;
      }
    },
    [postUploadFailure, upload],
  );

  const reset = useCallback(() => {
    upload.resetUpload();
    setIsSubmittingToServer(false);
    setPostUploadFailure(null);
    setSubmitError(null);
    setLastSubmitted(null);
  }, [upload]);

  return {
    isUploading: upload.isUploading,
    uploadProgress: upload.progress,
    pdfUrl: upload.pdfUrl,
    postUploadFailure,
    isSubmittingToServer,
    submitError,
    lastSubmitted,
    reset,
    submit,
  };
}

export default useSubmitPhasedReport;