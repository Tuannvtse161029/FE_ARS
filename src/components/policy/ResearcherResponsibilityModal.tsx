/**
 * ResearcherResponsibilityModal — pre-submission policy gate.
 *
 * Loaded by the Researcher submission form right before the user clicks
 * "Submit to Admin". The modal:
 *
 *   1. Pulls the live `researcher_responsibility` policy from Firebase
 *      Firestore via `policyService.getOne()` (the same document admins
 *      edit on /admin/policies). The content falls back to the seed
 *      defaults when Firestore is unconfigured, so the modal is always
 *      usable in dev environments without Firebase credentials.
 *
 *   2. Forces the researcher to tick a checkbox before the "I agree"
 *      button is enabled. This is the whole point of the gate — admins
 *      can edit the policy text at any time and we want the researcher
 *      to actually have read THIS version, not a cached one.
 *
 *   3. Persists the agreement in the parent's state via the `onAgree`
 *      callback. The parent gates the actual `Submit to Admin` button on
 *      this flag, so a researcher who closes the modal without agreeing
 *      cannot submit the form.
 *
 * The modal intentionally does NOT call any BE endpoints. Reading the
 * policy text directly from Firestore keeps the FE self-sufficient and
 * avoids an extra round-trip for a document the admin team already
 * controls out-of-band.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, X } from 'lucide-react';
import { Button } from '../Button/Button';
import { ErrorBanner } from '../ErrorBanner';
import { useT } from '../../i18n/I18nContext';
import { policyService } from '../../services/policy.service';
import { POLICY_META, type PolicySnapshot } from '../../types/policy';
import styles from './ResearcherResponsibilityModal.module.css';

interface ResearcherResponsibilityModalProps {
  /** Whether the modal is visible. Parent controls this from local state. */
  isOpen: boolean;
  /**
   * Called when the researcher ticks the checkbox AND clicks "I agree".
   * The parent should flip its `responsibilityAgreed` flag here. The
   * modal auto-closes after this fires.
   */
  onAgree: () => void;
  /**
   * Called when the researcher dismisses the modal without agreeing
   * (Escape, backdrop click, or the Cancel button). The parent's
   * `responsibilityAgreed` flag MUST stay `false` here.
   */
  onClose: () => void;
}

type LoadState =
  | { stage: 'loading' }
  | { stage: 'ready'; snapshot: PolicySnapshot }
  | { stage: 'error'; message: string };

/**
 * Renders a plain-text policy body as a scrollable list of paragraphs
 * separated by blank lines. The admin-edited content is plain text
 * (see `src/services/policy.service.ts`), so we do a lightweight split
 * that respects the seed format (`\n\n` between sections, `\n` within
 * a section). This avoids pulling in a markdown parser for what is
 * effectively a one-paragraph-per-line document.
 */
const renderPolicyBody = (text: string): JSX.Element => {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return (
    <>
      {blocks.map((block, index) => {
        // Headings: lines that look like "1. Originality & Plagiarism"
        // (a digit + period + a short title). Render them as <h4> so the
        // scannable structure of the policy survives the plain-text
        // round-trip through Firestore.
        const lines = block.split('\n');
        const first = lines[0] ?? '';
        const isHeading = /^\d+\.\s+\S/.test(first) && lines.length > 1;
        if (isHeading) {
          return (
            <div key={index} className={styles.section}>
              <h4 className={styles.sectionTitle}>{first}</h4>
              {lines.slice(1).map((line, lineIndex) => (
                <p key={lineIndex} className={styles.paragraph}>
                  {renderInline(line)}
                </p>
              ))}
            </div>
          );
        }
        return (
          <p key={index} className={styles.paragraph}>
            {renderInline(block)}
          </p>
        );
      })}
    </>
  );
};

/**
 * Inline formatter — turns `**bold**` and `*italic*` markers into
 * <strong>/<em> elements. The seed content doesn't use these markers,
 * but admins editing the live policy might add them.
 */
const renderInline = (text: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

export const ResearcherResponsibilityModal = ({
  isOpen,
  onAgree,
  onClose,
}: ResearcherResponsibilityModalProps) => {
  const t = useT();
  const [state, setState] = useState<LoadState>({ stage: 'loading' });
  const [agreed, setAgreed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Load the live policy each time the modal opens. We deliberately
  // re-fetch on every open so an admin who edited the policy in another
  // tab is reflected the next time a researcher opens the gate. The
  // Firestore SDK + the in-memory `policyService` cache keeps this
  // sub-second on repeat opens.
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setState({ stage: 'loading' });
    setAgreed(false);
    policyService
      .getOne('researcher_responsibility')
      .then((snapshot) => {
        if (!cancelled) setState({ stage: 'ready', snapshot });
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : t(
                'researcher.responsibility.error.loadFailed',
                'We could not load the Researcher Responsibility right now. Please try again.',
              );
        setState({ stage: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, t]);

  // Lock body scroll + auto-focus the cancel button when the modal opens,
  // mirroring the existing `PolicyModal` so the two modals feel like
  // siblings and screen-reader users get a predictable focus target.
  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = 'hidden';
    // Defer focus until after the modal paints so the focus call doesn't
    // race with the loading state mount.
    const focusTimer = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);
    return () => {
      document.body.style.overflow = '';
      window.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  // Esc closes the modal without agreeing. We deliberately do NOT call
  // `onAgree` here — closing should always be a non-agreement action so
  // the parent can keep its `responsibilityAgreed` flag false.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleAgree = useCallback(() => {
    if (!agreed || state.stage !== 'ready') return;
    onAgree();
  }, [agreed, state, onAgree]);

  if (!isOpen) return null;

  const meta = POLICY_META.researcher_responsibility;
  const body = state.stage === 'ready' ? state.snapshot.content : '';
  const versionLine =
    state.stage === 'ready' && state.snapshot.fromFirestore
      ? t('researcher.responsibility.versionActive', 'Active policy · v{version}', {
          version: state.snapshot.version,
        })
      : t('researcher.responsibility.versionDefault', 'Default policy (admin has not saved a custom version yet)');

  return (
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="researcher-responsibility-title"
      data-testid="researcher-responsibility-modal"
    >
      <div ref={dialogRef} className={styles.modal} role="document">
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <span className={styles.eyebrow}>
              <ShieldCheck size={14} aria-hidden /> {t('researcher.responsibility.eyebrow', 'Pre-submission gate')}
            </span>
            <h2 className={styles.title} id="researcher-responsibility-title">
              {meta.title}
            </h2>
            <p className={styles.summary}>{meta.summary}</p>
          </div>
          <button
            ref={cancelButtonRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            data-testid="researcher-responsibility-close"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.versionRow}>
          <span className={styles.versionBadge}>{versionLine}</span>
        </div>

        <div
          className={styles.content}
          data-testid="researcher-responsibility-content"
        >
          {state.stage === 'loading' && (
            <div className={styles.loadingState} role="status">
              <Loader2 size={20} className={styles.spinning} aria-hidden />
              <span>{t('researcher.responsibility.loading', 'Loading the Researcher Responsibility policy…')}</span>
            </div>
          )}
          {state.stage === 'error' && (
            <ErrorBanner
              tone="error"
              title={t('researcher.responsibility.errorTitle', 'Could not load the policy')}
              message={state.message}
            />
          )}
          {state.stage === 'ready' && renderPolicyBody(body)}
        </div>

        <div className={styles.agreeRow}>
          <label className={styles.agreeLabel}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              data-testid="researcher-responsibility-checkbox"
              disabled={state.stage !== 'ready'}
            />
            <span className={styles.agreeLabelText}>
              {t(
                'researcher.responsibility.agree',
                'I have read and agree to the Researcher Responsibility above.',
              )}
            </span>
          </label>
        </div>

        <div className={styles.footer}>
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            data-testid="researcher-responsibility-cancel"
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleAgree}
            disabled={!agreed || state.stage !== 'ready'}
            leftIcon={<CheckCircle2 size={14} aria-hidden />}
            data-testid="researcher-responsibility-agree"
          >
            {t('researcher.responsibility.agreeCta', 'I agree — continue to submit')}
          </Button>
        </div>

        {state.stage === 'ready' && !state.snapshot.fromFirestore && (
          <div className={styles.defaultNotice} role="status">
            <AlertTriangle size={14} aria-hidden />
            <span>
              {t(
                'researcher.responsibility.defaultNotice',
                'Admins have not published a custom Researcher Responsibility yet — the text below is the platform default and is still binding.',
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearcherResponsibilityModal;
