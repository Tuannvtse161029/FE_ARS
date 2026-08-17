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

const buildFolderPath = (researchGroupId: number, phaseKey: string): string =>
  `research-groups/${researchGroupId}/phased-reports/${phaseKey}/`;

export interface SubmitOptions {
  researchGroupId: number;
  phaseKey: string;
  groupMemberId?: number;
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