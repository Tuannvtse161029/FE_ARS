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
import { toast } from 'sonner';
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
import { useI18n } from '../i18n/I18nContext';

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
  const { t } = useI18n();
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
        // `uploadPdf` returns the download URL on success and `null` on
        // failure (with `upload.error` populated). We MUST use the
        // returned value rather than `upload.pdfUrl` because:
        //   - `upload.pdfUrl` is React state captured at the render where
        //     this `submit` callback was last memoized.
        //   - `setPdfUrl(url)` inside `uploadPdf` schedules a re-render,
        //     but it has NOT yet flushed by the time `uploadPdf` resolves.
        //   - Reading `upload.pdfUrl` here therefore sees the stale
        //     pre-upload value (null), the fallback error fires
        //     ("Upload completed but no PDF URL was returned."), and the
        //     BE POST receives `reportFileUrl: undefined`. That was the
        //     exact failure the user reported — the upload completed but
        //     the submission failed because the hook fell through to the
        //     "no pdfUrl" branch instead of using the URL `uploadPdf`
        //     already gave us.
        const uploadedUrl = await upload.uploadPdf(file);
        if (upload.error) {
          setSubmitError(new Error(upload.error));
          inFlightRef.current = false;
          return null;
        }
        if (!uploadedUrl) {
          setSubmitError(
            new Error('Upload completed but no PDF URL was returned.'),
          );
          inFlightRef.current = false;
          return null;
        }
        pdfUrl = uploadedUrl;
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

        // Toast feedback for the SUBMITTER (the student leader). The
        // modal already shows an in-modal "Submission recorded" card and
        // the page shows a "Your latest submission was recorded" banner,
        // but neither is visible to the user once the modal closes — the
        // toast is the ephemeral confirmation that their upload round-
        // tripped. Best-effort: we never throw out of the toast call.
        try {
          const toastTitle =
            result?.milestoneTitle?.trim() ||
            result?.topicTitle?.trim() ||
            (typeof options.phaseNumber === 'number'
              ? `Phase ${options.phaseNumber}`
              : '') ||
            (typeof result?.id === 'number' ? `Report #${result.id}` : '');
          if (options.isResubmission) {
            toast.success(
              t(
                'student.phaseReport.toast.resubmitSuccess',
                'Resubmission recorded — your lecturer has been notified.',
              ),
              {
                description: t(
                  'student.phaseReport.toast.resubmitSuccessDescription',
                  '"{title}" was resubmitted and is now back under review.',
                ).replace('{title}', toastTitle || '—'),
              },
            );
          } else {
            toast.success(
              t(
                'student.phaseReport.toast.submitSuccess',
                'Report submitted — your lecturer has been notified.',
              ),
              {
                description: t(
                  'student.phaseReport.toast.submitSuccessDescription',
                  '"{title}" is now under review. We\'ll refresh the table so you can see the status update.',
                ).replace('{title}', toastTitle || '—'),
              },
            );
          }
        } catch (toastErr) {
          console.warn('Failed to render submit-success toast:', toastErr);
        }

        // Defensive FE notification — fire a `[Lecturer] report submitted`
        // (first submission) or `[Lecturer] report resubmitted` (re-submit)
        // notification to the topic's lecturer. Best-effort: failures
        // never block the primary action. We resolve the lecturerId by
        // fetching the group → topic chain, falling back to the group
        // alone when the caller did not pass a topicId (the original
        // implementation gated this on topicId, which silently dropped
        // the notification whenever the page forgot to pass one through
        // — see the September 2026 Submit Report regression where the
        // lecturer was never told a leader had submitted a phase).
        try {
          const group = await researchGroupService
            .getById(options.researchGroupId)
            .catch(() => null);
          const topic =
            typeof options.topicId === 'number' && options.topicId > 0
              ? await researchTopicService
                  .getById(options.topicId)
                  .catch(() => null)
              : typeof group?.topicId === 'number' && group.topicId > 0
              ? await researchTopicService
                  .getById(group.topicId)
                  .catch(() => null)
              : null;
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
              (typeof options.phaseNumber === 'number'
                ? `Phase ${options.phaseNumber}`
                : '') ||
              (typeof result?.id === 'number' ? `Report #${result.id}` : '');
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
    [postUploadFailure, upload, t],
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