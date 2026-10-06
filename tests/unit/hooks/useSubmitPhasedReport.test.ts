/**
 * Hook-level tests for src/hooks/useSubmitPhasedReport.ts.
 *
 * Covers:
 *   - Phase 1 (Firebase upload) success → Phase 2 (BE POST) success
 *   - Firebase failure short-circuits before BE POST
 *   - Firebase success + BE POST failure → sets `postUploadFailure`
 *     (preserves pdfUrl so Retry re-POSTs without re-uploading)
 *   - Retry uses the cached pdfUrl (uploadPdf is NOT called again)
 *   - Duplicate submit() invocations are dropped (re-entrancy guard)
 *   - isResubmission routes to resubmitPhasedReport with previousReportId
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// We re-mock useFirebaseUpload per test using vi.doMock + vi.resetModules so
// each test gets its own fresh module instance with a clean state. The mock
// uses real React state internally (pdfUrl / error) so the consumer hook
// sees a re-render when uploadPdf resolves.

const { uploadPdfMock, resetUploadMock, submitPhasedReportMock, resubmitPhasedReportMock, pdfUrlSetterRef, errorSetterRef, toastSuccessMock, notificationCreateMock, getGroupMock, getTopicMock } =
  vi.hoisted(() => ({
    uploadPdfMock: vi.fn(),
    resetUploadMock: vi.fn(),
    submitPhasedReportMock: vi.fn(),
    resubmitPhasedReportMock: vi.fn(),
    pdfUrlSetterRef: { current: null as ((v: string | null) => void) | null },
    errorSetterRef: { current: null as ((v: string | null) => void) | null },
    toastSuccessMock: vi.fn(),
    notificationCreateMock: vi.fn().mockResolvedValue(undefined),
    getGroupMock: vi.fn().mockResolvedValue(null),
    getTopicMock: vi.fn().mockResolvedValue(null),
  }));

const setupFirebaseMock = () => {
  vi.doMock('../../../src/hooks/useFirebaseUpload', () => {
    // Module-scoped mutable holder so the mock closure can flip pdfUrl
    // and let the consumer's captured `upload` object read the new value
    // via getters.
    const state = { pdfUrl: null as string | null, error: null as string | null };
    pdfUrlSetterRef.current = (v: string | null) => {
      state.pdfUrl = v;
    };
    errorSetterRef.current = (v: string | null) => {
      state.error = v;
    };
    return {
      useFirebaseUpload: () => ({
        uploadPdf: uploadPdfMock,
        resetUpload: resetUploadMock,
        progress: 0,
        isUploading: false,
        get error() {
          return state.error;
        },
        get pdfUrl() {
          return state.pdfUrl;
        },
      }),
    };
  });
};

const resetAll = () => {
  uploadPdfMock.mockReset();
  resetUploadMock.mockReset();
  submitPhasedReportMock.mockReset();
  resubmitPhasedReportMock.mockReset();
  toastSuccessMock.mockReset();
  notificationCreateMock.mockReset().mockResolvedValue(undefined);
  getGroupMock.mockReset().mockResolvedValue(null);
  getTopicMock.mockReset().mockResolvedValue(null);
};

const FILE = new File(['%PDF-1.4'], 'phase-1.pdf', { type: 'application/pdf' });
const FIREBASE_URL = 'https://fb.storage/phase-1.pdf';
const SUBMIT_OPTIONS = {
  researchGroupId: 7,
  phaseKey: 'phase-2-literature-review',
} as const;

const loadHook = async () => {
  vi.resetModules();
  setupFirebaseMock();
  vi.doMock('../../../src/services/phasedReport.service', () => ({
    submitPhasedReport: submitPhasedReportMock,
    resubmitPhasedReport: resubmitPhasedReportMock,
    evaluatePhasedReport: vi.fn(),
    rejectPhasedReport: vi.fn(),
  }));
  // Default mocks for the side-effect services the hook calls after a
  // successful submit (toast + lecturer notification fan-out). The
  // hoisted fns let each test configure the mocks via the public
  // .mockResolvedValueOnce / .mockReturnValueOnce APIs without having
  // to re-mock the module.
  vi.doMock('sonner', () => ({
    toast: {
      success: toastSuccessMock,
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    },
  }));
  vi.doMock('../../../src/services/notification.service', () => ({
    notificationService: {
      create: notificationCreateMock,
    },
  }));
  vi.doMock('../../../src/services/researchGroup.service', () => ({
    researchGroupService: {
      getById: getGroupMock,
    },
  }));
  vi.doMock('../../../src/services/researchTopic.service', () => ({
    researchTopicService: {
      getById: getTopicMock,
    },
  }));
  const mod = await import('../../../src/hooks/useSubmitPhasedReport');
  return mod.useSubmitPhasedReport;
};

beforeEach(() => resetAll());

describe('useSubmitPhasedReport', () => {
  it('happy path — Firebase success then BE POST and returns the submitted row', async () => {
    uploadPdfMock.mockImplementation(async () => {
      pdfUrlSetterRef.current?.(FIREBASE_URL);
      return FIREBASE_URL;
    });
    submitPhasedReportMock.mockResolvedValueOnce({
      id: 100,
      researchGroupId: 7,
      reportFileUrl: FIREBASE_URL,
      status: 'SUBMITTED',
    });

    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());

    let submitted: unknown = null;
    await act(async () => {
      submitted = await result.current.submit(FILE, SUBMIT_OPTIONS);
    });

    expect(submitted).toMatchObject({ id: 100, status: 'SUBMITTED' });
    expect(submitPhasedReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        researchGroupId: 7,
        reportFileUrl: FIREBASE_URL,
      }),
    );
    expect(result.current.lastSubmitted).not.toBeNull();
    expect(result.current.submitError).toBeNull();
  });

  it('Firebase failure surfaces a submitError and skips the BE POST', async () => {
    uploadPdfMock.mockImplementation(async () => {
      errorSetterRef.current?.('Storage quota exceeded');
    });

    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());

    let submitted: unknown = 'sentinel';
    await act(async () => {
      submitted = await result.current.submit(FILE, SUBMIT_OPTIONS);
    });

    expect(submitted).toBeNull();
    expect(submitPhasedReportMock).not.toHaveBeenCalled();
    expect(result.current.submitError?.message).toMatch(/Storage quota/);
    expect(result.current.postUploadFailure).toBeNull();
  });

  it('Firebase success + BE POST failure → postUploadFailure with the cached pdfUrl', async () => {
    uploadPdfMock.mockImplementation(async () => {
      pdfUrlSetterRef.current?.(FIREBASE_URL);
      return FIREBASE_URL;
    });
    submitPhasedReportMock.mockRejectedValueOnce(
      new Error('Server timeout while saving metadata'),
    );

    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());

    await act(async () => {
      await result.current.submit(FILE, SUBMIT_OPTIONS);
    });

    expect(result.current.postUploadFailure).not.toBeNull();
    expect(result.current.postUploadFailure?.pdfUrl).toBe(FIREBASE_URL);
    expect(result.current.postUploadFailure?.errorMessage).toMatch(/timeout/);
  });

  it('Retry after postUploadFailure uses the cached pdfUrl (no second uploadPdf)', async () => {
    uploadPdfMock.mockImplementation(async () => {
      pdfUrlSetterRef.current?.(FIREBASE_URL);
      return FIREBASE_URL;
    });
    submitPhasedReportMock
      .mockRejectedValueOnce(new Error('first POST failed'))
      .mockResolvedValueOnce({
        id: 200,
        researchGroupId: 7,
        reportFileUrl: FIREBASE_URL,
        status: 'SUBMITTED',
      });

    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());

    await act(async () => {
      await result.current.submit(FILE, SUBMIT_OPTIONS);
    });
    expect(result.current.postUploadFailure).not.toBeNull();

    await act(async () => {
      await result.current.submit(FILE, SUBMIT_OPTIONS);
    });

    expect(uploadPdfMock).toHaveBeenCalledTimes(1);
    expect(submitPhasedReportMock).toHaveBeenCalledTimes(2);
    expect(result.current.postUploadFailure).toBeNull();
    expect(result.current.lastSubmitted).toMatchObject({ id: 200 });
  });

  it('duplicate submit() invocations are dropped (re-entrancy guard)', async () => {
    uploadPdfMock.mockImplementation(async () => {
      pdfUrlSetterRef.current?.(FIREBASE_URL);
      return FIREBASE_URL;
    });
    submitPhasedReportMock.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                id: 999,
                researchGroupId: 7,
                reportFileUrl: FIREBASE_URL,
                status: 'SUBMITTED',
              }),
            20,
          ),
        ),
    );

    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());

    await act(async () => {
      const first = result.current.submit(FILE, SUBMIT_OPTIONS);
      const second = result.current.submit(FILE, SUBMIT_OPTIONS);
      await first;
      await second;
    });

    expect(submitPhasedReportMock).toHaveBeenCalledTimes(1);
  });

  it('isResubmission=true routes to resubmitPhasedReport and threads previousReportId', async () => {
    uploadPdfMock.mockImplementation(async () => {
      pdfUrlSetterRef.current?.(FIREBASE_URL);
      return FIREBASE_URL;
    });
    resubmitPhasedReportMock.mockResolvedValueOnce({
      id: 201,
      researchGroupId: 7,
      reportFileUrl: FIREBASE_URL,
      status: 'SUBMITTED',
    });

    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());

    await act(async () => {
      await result.current.submit(FILE, {
        researchGroupId: 7,
        phaseKey: 'phase-2-literature-review',
        isResubmission: true,
        previousReportId: 100,
      });
    });

    expect(resubmitPhasedReportMock).toHaveBeenCalledWith(
      expect.objectContaining({ previousReportId: 100 }),
    );
    expect(submitPhasedReportMock).not.toHaveBeenCalled();
  });

  it('reset() clears every transient field', async () => {
    uploadPdfMock.mockImplementation(async () => {
      pdfUrlSetterRef.current?.(FIREBASE_URL);
      return FIREBASE_URL;
    });
    submitPhasedReportMock.mockRejectedValueOnce(new Error('boom'));

    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());

    await act(async () => {
      await result.current.submit(FILE, SUBMIT_OPTIONS);
    });
    expect(result.current.postUploadFailure).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.postUploadFailure).toBeNull();
    expect(result.current.submitError).toBeNull();
    expect(result.current.lastSubmitted).toBeNull();
  });

  // Regression test — September 2026 student-submission bug:
  //
  // `uploadPdf()` already returns the Firebase download URL on success,
  // but the consumer (`useSubmitPhasedReport.submit`) used to read it
  // from `upload.pdfUrl` — which is captured React state at the
  // render where the submit callback was memoized. The state update
  // inside `uploadPdf` schedules a re-render, but it has NOT yet
  // flushed by the time `uploadPdf` resolves, so the closure sees the
  // pre-upload value (null). The hook then took the
  // "Upload completed but no PDF URL was returned" branch even though
  // the URL was right there in the return value, and the BE POST went
  // out with `reportFileUrl: undefined`. This test pins the fix:
  // the hook must trust the URL the upload function gave it, even if
  // the `upload.pdfUrl` state is still stale.
  it('uses the URL returned by uploadPdf, not the still-stale upload.pdfUrl state', async () => {
    uploadPdfMock.mockImplementation(async () => {
      // Simulate the real hook: set state AND return the URL.
      pdfUrlSetterRef.current?.(FIREBASE_URL);
      return FIREBASE_URL;
    });
    submitPhasedReportMock.mockResolvedValueOnce({
      id: 300,
      researchGroupId: 7,
      reportFileUrl: FIREBASE_URL,
      status: 'SUBMITTED',
    });

    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());

    let submitted: unknown = 'sentinel';
    await act(async () => {
      submitted = await result.current.submit(FILE, SUBMIT_OPTIONS);
    });

    expect(submitted).toMatchObject({ id: 300 });
    expect(submitPhasedReportMock).toHaveBeenCalledWith(
      expect.objectContaining({ reportFileUrl: FIREBASE_URL }),
    );
    expect(result.current.submitError).toBeNull();
    expect(result.current.postUploadFailure).toBeNull();
  });

  // Regression test — October 2026 "no notification on submit" bug.
  //
  // Before the fix, the submit hook did not surface any feedback to the
  // SUBMITTER (the student leader) — the modal's success card was the
  // only signal, and it disappeared the moment the modal unmounted.
  // The fix wires a Sonner toast.success call so the leader gets an
  // ephemeral confirmation that their upload round-tripped.
  it('fires a success toast on a successful submit', async () => {
    uploadPdfMock.mockImplementation(async () => {
      pdfUrlSetterRef.current?.(FIREBASE_URL);
      return FIREBASE_URL;
    });
    submitPhasedReportMock.mockResolvedValueOnce({
      id: 400,
      researchGroupId: 7,
      reportFileUrl: FIREBASE_URL,
      status: 'SUBMITTED',
      milestoneTitle: 'Phase 2 — Methodology',
    });

    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());

    await act(async () => {
      await result.current.submit(FILE, SUBMIT_OPTIONS);
    });

    expect(toastSuccessMock).toHaveBeenCalledTimes(1);
    const [title, options] = toastSuccessMock.mock.calls[0] as [string, { description: string }];
    expect(title.toLowerCase()).toContain('submitted');
    expect(options.description).toContain('Methodology');
  });

  it('fires a resubmit toast (different copy) on isResubmission=true', async () => {
    uploadPdfMock.mockImplementation(async () => {
      pdfUrlSetterRef.current?.(FIREBASE_URL);
      return FIREBASE_URL;
    });
    resubmitPhasedReportMock.mockResolvedValueOnce({
      id: 401,
      researchGroupId: 7,
      reportFileUrl: FIREBASE_URL,
      status: 'SUBMITTED',
      milestoneTitle: 'Phase 2 — Methodology',
    });

    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());

    await act(async () => {
      await result.current.submit(FILE, {
        researchGroupId: 7,
        phaseKey: 'phase-2-literature-review',
        isResubmission: true,
        previousReportId: 100,
      });
    });

    expect(toastSuccessMock).toHaveBeenCalledTimes(1);
    const [title] = toastSuccessMock.mock.calls[0] as [string];
    expect(title.toLowerCase()).toContain('resubmission');
  });

  // Regression test — October 2026 "lecturer was never notified" bug.
  //
  // The SubmitReport page used to pass `topicId={undefined}` to the
  // submit modal, which meant `options.topicId` was undefined when the
  // hook tried to fan out a notification to the topic's lecturer. The
  // original implementation gated the entire notification on a numeric
  // topicId, so a missing topicId silently dropped the lecturer
  // notification. The fix:
  //   1. Accept `topicId` from the page (so the call site can pass the
  //      group's topicId).
  //   2. Fall back to looking up the topic via the group when the
  //      caller didn't pass a topicId.
  it('still notifies the lecturer when topicId is omitted but the group has one', async () => {
    getGroupMock.mockResolvedValueOnce({
      id: 7,
      topicId: 42,
      lecturerId: 99,
    });
    getTopicMock.mockResolvedValueOnce({
      id: 42,
      lecturerId: 99,
    });
    uploadPdfMock.mockImplementation(async () => {
      pdfUrlSetterRef.current?.(FIREBASE_URL);
      return FIREBASE_URL;
    });
    submitPhasedReportMock.mockResolvedValueOnce({
      id: 500,
      researchGroupId: 7,
      reportFileUrl: FIREBASE_URL,
      status: 'SUBMITTED',
      milestoneTitle: 'Phase 1 — Seminar',
    });

    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());

    await act(async () => {
      await result.current.submit(FILE, {
        researchGroupId: 7,
        phaseKey: 'phase-1',
        // topicId deliberately omitted — the parent page forgot to
        // pass it (the original bug). The hook should still resolve
        // the lecturer via the group's topicId fallback.
      });
    });

    expect(getGroupMock).toHaveBeenCalledWith(7);
    expect(getTopicMock).toHaveBeenCalledWith(42);
    expect(notificationCreateMock).toHaveBeenCalledTimes(1);
    const [payload] = notificationCreateMock.mock.calls[0] as [{ userId: number; message: string }];
    expect(payload.userId).toBe(99);
    expect(payload.message).toContain('Seminar');
  });
});