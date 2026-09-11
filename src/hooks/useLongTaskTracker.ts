import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadingTracker, type TaskOrigin } from '../services/loadingTracker';

/**
 * Originator-side hook for long-running background tasks (e.g. AI
 * seminar summarisation, future long uploads). The matching consumer
 * is `<LoadingTaskWidget />` which lives in the global header and
 * subscribes to the tracker directly.
 *
 * Usage:
 *
 *   const { startTask, finishTask, cancelTask } = useLongTaskTracker();
 *
 *   const handleSummarize = async () => {
 *     startTask({ path: ROUTES.SEMINAR_WORKSPACE, modalKey: 'aiSummary|42', label: 'AI Summary' });
 *     try {
 *       await longRunningRequest();
 *       finishTask(true);
 *     } catch (err) {
 *       finishTask(false); // OR cancelTask() if you don't want the success badge
 *     }
 *   };
 *
 * The hook remembers the `origin` it started with so the consumer
 * widget can call `returnToOrigin()` on click without us re-passing
 * the metadata around. (The widget itself implements the click
 * handler — see `LoadingTaskWidget.tsx` — this hook only owns the
 * write side.)
 */
export const useLongTaskTracker = () => {
  const navigate = useNavigate();
  const originRef = useRef<TaskOrigin | null>(null);

  const startTask = useCallback((origin: TaskOrigin) => {
    originRef.current = origin;
    loadingTracker.beginTask(origin);
  }, []);

  const finishTask = useCallback((completed = true) => {
    if (completed) {
      loadingTracker.completeTask();
    } else {
      loadingTracker.endTask();
    }
    // Don't clear originRef here — the widget keeps the success state
    // visible until the user clicks the chip, then it calls endTask
    // itself to clean up.
  }, []);

  const cancelTask = useCallback(() => {
    originRef.current = null;
    loadingTracker.endTask();
  }, []);

  // Convenience: return to the originating route AND dispatch the
  // `ars:reopen-modal` event so any originating modal re-opens with
  // its original context. Used by `LoadingTaskWidget` on click.
  const returnToOrigin = useCallback(() => {
    const origin = originRef.current ?? loadingTracker.getTaskSnapshot().origin;
    if (!origin) return;
    navigate(origin.path);
    if (origin.modalKey) {
      window.dispatchEvent(
        new CustomEvent('ars:reopen-modal', { detail: { modalKey: origin.modalKey } }),
      );
    }
  }, [navigate]);

  // No unmount cleanup — orphaned tasks are intentionally left alive so
  // `loadingTracker.end()` (driven by the axios interceptor) can mark
  // them completed when the BE response arrives, even if the originating
  // component is gone. User-explicit dismissal flows through
  // `cancelTask()` instead, which clears immediately. This split lets
  // the "user navigated away mid-task" flow surface the success check
  // in the header widget when the BE eventually responds.

  return { startTask, finishTask, cancelTask, returnToOrigin };
};

export default useLongTaskTracker;
