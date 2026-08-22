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

const { uploadPdfMock, resetUploadMock, submitPhasedReportMock, resubmitPhasedReportMock, pdfUrlSetterRef, errorSetterRef } =
  vi.hoisted(() => ({
    uploadPdfMock: vi.fn(),
    resetUploadMock: vi.fn(),
    submitPhasedReportMock: vi.fn(),
    resubmitPhasedReportMock: vi.fn(),
    pdfUrlSetterRef: { current: null as ((v: string | null) => void) | null },
    errorSetterRef: { current: null as ((v: string | null) => void) | null },
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
  const mod = await import('../../../src/hooks/useSubmitPhasedReport');
  return mod.useSubmitPhasedReport;
};

beforeEach(() => resetAll());

describe('useSubmitPhasedReport', () => {
  it('happy path — Firebase success then BE POST and returns the submitted row', async () => {
    uploadPdfMock.mockImplementation(async () => {
      pdfUrlSetterRef.current?.(FIREBASE_URL);
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
});