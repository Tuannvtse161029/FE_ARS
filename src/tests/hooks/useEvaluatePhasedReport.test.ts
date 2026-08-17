/**
 * Hook-level tests for src/hooks/useEvaluatePhasedReport.ts.
 *
 * Verifies the approve/reject dispatcher + error surfacing (BE error
 * messages pass through verbatim so the modal can show them inline).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { evaluateMock, rejectMock } = vi.hoisted(() => ({
  evaluateMock: vi.fn(),
  rejectMock: vi.fn(),
}));

vi.mock('../../services/phasedReport.service', () => ({
  evaluatePhasedReport: evaluateMock,
  rejectPhasedReport: rejectMock,
}));

import { useEvaluatePhasedReport } from '../../hooks/useEvaluatePhasedReport';

describe('useEvaluatePhasedReport', () => {
  beforeEach(() => {
    evaluateMock.mockReset();
    rejectMock.mockReset();
  });

  it('initial state is idle', () => {
    const { result } = renderHook(() => useEvaluatePhasedReport(5));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('submit("approve", ...) calls evaluatePhasedReport and returns the updated row', async () => {
    evaluateMock.mockResolvedValueOnce({
      id: 5,
      researchGroupId: 7,
      status: 'EVALUATED',
      lectureFeedback: 9,
    });
    const { result } = renderHook(() => useEvaluatePhasedReport(5));
    let updated: unknown = null;
    await act(async () => {
      updated = await result.current.submit('approve', {
        lectureFeedback: 9,
        finalOutcomeEvaluation: 'OK',
      });
    });
    expect(evaluateMock).toHaveBeenCalledWith(5, {
      lectureFeedback: 9,
      finalOutcomeEvaluation: 'OK',
    });
    expect(updated).toMatchObject({ id: 5, status: 'EVALUATED' });
    await waitFor(() => expect(result.current.result).not.toBeNull());
  });

  it('submit("reject", ...) calls rejectPhasedReport', async () => {
    rejectMock.mockResolvedValueOnce({
      id: 5,
      status: 'REJECTED',
      capacityEvaluation: 'needs more detail',
    });
    const { result } = renderHook(() => useEvaluatePhasedReport(5));
    await act(async () => {
      await result.current.submit('reject', {
        finalOutcomeEvaluation: 'overall',
        rejectionReason: 'needs more detail',
      });
    });
    expect(rejectMock).toHaveBeenCalled();
  });

  it('returns null and sets an error when reportId is null', async () => {
    const { result } = renderHook(() => useEvaluatePhasedReport(null));
    let updated: unknown = 'sentinel';
    await act(async () => {
      updated = await result.current.submit('approve', {
        finalOutcomeEvaluation: 'OK',
      });
    });
    expect(updated).toBeNull();
    expect(result.current.error?.message).toMatch(/no report selected/i);
  });

  it('surfaces BE 409 conflict messages verbatim', async () => {
    evaluateMock.mockRejectedValueOnce(
      new Error('Group locked by another topic (409)'),
    );
    const { result } = renderHook(() => useEvaluatePhasedReport(5));
    let updated: unknown = 'sentinel';
    await act(async () => {
      updated = await result.current.submit('approve', {
        finalOutcomeEvaluation: 'OK',
      });
    });
    expect(updated).toBeNull();
    expect(result.current.error?.message).toMatch(/locked by another topic/);
  });

  it('coerces non-Error rejections into a friendly message', async () => {
    evaluateMock.mockRejectedValueOnce('boom');
    const { result } = renderHook(() => useEvaluatePhasedReport(5));
    await act(async () => {
      await result.current.submit('approve', {
        finalOutcomeEvaluation: 'OK',
      });
    });
    expect(result.current.error?.message).toMatch(/Failed to submit evaluation/);
  });

  it('reset() returns the state to idle', async () => {
    evaluateMock.mockResolvedValueOnce({ id: 5, status: 'EVALUATED' });
    const { result } = renderHook(() => useEvaluatePhasedReport(5));
    await act(async () => {
      await result.current.submit('approve', {
        finalOutcomeEvaluation: 'OK',
      });
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});