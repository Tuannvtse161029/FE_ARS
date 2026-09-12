import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { loadingTracker, type TaskOrigin } from '../../services/loadingTracker';
import { useI18n } from '../../i18n/I18nContext';
import styles from './LoadingTaskWidget.module.css';

/**
 * Header widget that surfaces a long-running background task (e.g. AI
 * seminar summarisation) so the user is free to navigate while the BE
 * finishes its work. Three visual states:
 *
 *  - `idle`     : no task in flight — render nothing
 *  - `loading`  : a long task is in flight — show a spinner with a
 *                 "still working — feel free to explore" tooltip
 *  - `completed`: the task finished — show a checkmark with a
 *                 "click to return" affordance that navigates back to
 *                 the originating route AND dispatches a
 *                 `ars:reopen-modal` event so any originating modal
 *                 (e.g. AI summary popup) re-opens in context
 *
 * The widget listens to `loadingTracker` directly via a manual
 * subscription — it doesn't need React context or any provider, so it
 * can be mounted anywhere in the tree (in our case the authenticated
 * `MainLayout` header).
 */
export const LoadingTaskWidget = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [origin, setOrigin] = useState<TaskOrigin | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const sync = () => {
      const snap = loadingTracker.getTaskSnapshot();
      // Only render if there's actually an in-flight task. We ignore
      // the brief moment where `completed` is true but `origin` is
      // about to be cleared — the success check should stay visible
      // long enough for the user to click it.
      setOrigin(snap.origin);
      setCompleted(snap.taskCompleted);
    };
    sync();
    const unsub = loadingTracker.subscribe(sync);
    // `Set.delete()` returns `boolean`, but `useEffect`'s cleanup must
    // return `void`, so coerce explicitly.
    return () => {
      unsub();
    };
  }, []);

  if (!origin) return null;

  const stillWorkingLabel = t('loadingWidget.stillWorking');
  const allDoneLabel = t('loadingWidget.allDone');
  const isCompleted = completed;

  const handleClick = () => {
    if (!isCompleted) return;
    // 1. Navigate back to the originating route. If the user has
    //    already moved off it (e.g. they're on /home), this brings
    //    them back to /seminar-workspace. React Router handles
    //    identical-path no-ops as a no-op, so this is safe to call
    //    even if the user is already on the originating page.
    navigate(origin.path);
    // 2. Fire the reopen event so the originating modal (AI summary,
    //    future long modals, etc.) can re-open with the right
    //    context. SeminarWorkspace already listens for this; any
    //    other originating surface can add its own listener.
    if (origin.modalKey) {
      window.dispatchEvent(
        new CustomEvent('ars:reopen-modal', { detail: { modalKey: origin.modalKey } }),
      );
    }
    // 3. Clear the tracker so the widget disappears and the next
    //    long task starts with a clean slate.
    loadingTracker.endTask();
  };

  const ariaLabel = isCompleted ? allDoneLabel : stillWorkingLabel;
  const title = isCompleted ? allDoneLabel : stillWorkingLabel;

  return (
    <button
      type="button"
      className={`${styles.widget} ${isCompleted ? styles.completed : styles.loading}`}
      onClick={isCompleted ? handleClick : undefined}
      aria-label={ariaLabel}
      title={title}
      aria-live="polite"
      data-state={isCompleted ? 'completed' : 'loading'}
      data-testid="loading-task-widget"
    >
      <span className={styles.iconWrap} aria-hidden>
        {isCompleted ? (
          <Check size={16} strokeWidth={2.5} className={styles.iconCheck} />
        ) : (
          <Loader2 size={16} className={styles.iconSpinner} />
        )}
      </span>
      {/* Screen-reader-only label keeps the affordance discoverable
          to assistive tech without forcing the visible chip to grow. */}
      <span className={styles.srOnly}>{ariaLabel}</span>
    </button>
  );
};

export default LoadingTaskWidget;
