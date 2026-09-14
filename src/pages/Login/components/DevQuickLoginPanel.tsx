/**
 * DevQuickLoginPanel
 * ──────────────────
 * Local-only helper that lives on the Login page in development.
 *
 * Purpose:
 *   Saves developer / QA time when cycling through the seeded ARS role
 *   accounts. Each role pill pre-fills the email + password and submits
 *   the existing React Hook Form so we re-use the same AuthContext
 *   pipeline (login() → role routing → navigation) as a real user.
 *
 * Production safety:
 *   - Component returns `null` unless `import.meta.env.DEV` is true AND
 *     the current hostname is one of the local dev hosts. Vite statically
 *     replaces `import.meta.env.DEV` at build time, so the entire panel
 *     (component + CSS) is dead-code-eliminated from production bundles.
 *   - Credentials are intentionally hard-coded into the source file
 *     rather than read from `.env`: they are sandbox seed accounts only
 *     and never reach production code paths. They match the password
 *     policy documented in `.env.playwright.example`.
 *   - The panel is hidden from screen readers via `aria-hidden="true"`
 *     because it is purely a developer convenience, not an authenticated
 *     user feature.
 */
import { useMemo } from 'react';
import { Terminal } from 'lucide-react';
import { useT } from '../../../i18n/I18nContext';
import styles from './DevQuickLoginPanel.module.css';

export interface DevQuickLoginAccount {
  /** Short label rendered on the pill, e.g. "Admin", "Reviewer". */
  label: string;
  email: string;
  password: string;
}

interface DevQuickLoginPanelProps {
  /** Triggered with the chosen credentials when a pill is clicked. */
  onSelect: (account: DevQuickLoginAccount) => void;
  /** Optional busy flag — disables the pills while a login is in flight. */
  isLoading?: boolean;
}

/**
 * Hard-coded sandbox seed accounts. These are the dev fixtures used by
 * `.env.playwright.example`; updating the local fixtures should also
 * update the entries below so the dev panel stays useful.
 */
const DEV_ACCOUNTS: DevQuickLoginAccount[] = [
  { label: 'Admin', email: 'admin@arsplatform.com', password: 'Admin@123' },
  { label: 'Reviewer', email: 'reviewer@arsplatform.com', password: 'Password123!' },
  { label: 'Researcher', email: 'researcher@arsplatform.com', password: 'Password123!' },
  { label: 'Lecturer', email: 'lecturer@arsplatform.com', password: 'Password123!' },
  { label: 'G. Student', email: 'gradstudent@arsplatform.com', password: 'Password123!' },
];

const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
]);

/**
 * Resolves whether the dev panel should render in the current environment.
 * Exported for unit tests; production callers just check `shouldRenderDevQuickLogin()`.
 */
export const shouldRenderDevQuickLogin = (): boolean => {
  if (typeof import.meta === 'undefined') return false;
  if (!import.meta.env?.DEV) return false;
  if (typeof window === 'undefined') return false;
  const hostname = window.location?.hostname?.toLowerCase();
  if (!hostname) return false;
  return LOCAL_HOSTNAMES.has(hostname);
};

export const DevQuickLoginPanel = ({
  onSelect,
  isLoading = false,
}: DevQuickLoginPanelProps) => {
  const t = useT();
  // Recompute on every render — the value is stable in dev but allows
  // test harnesses to flip env/host state between cases.
  const isVisible = useMemo(() => shouldRenderDevQuickLogin(), []);
  if (!isVisible) return null;

  return (
    <section
      className={styles.panel}
      aria-hidden="true"
      data-testid="dev-quick-login-panel"
    >
      <header className={styles.header}>
        <Terminal size={14} aria-hidden="true" className={styles.headerIcon} />
        <span className={styles.eyebrow}>
          {t('login.devQuickLogin.eyebrow', 'DEV ONLY · LOCALHOST')}
        </span>
      </header>
      <div className={styles.pillRow}>
        {DEV_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            className={styles.pill}
            data-testid={`dev-quick-login-${account.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            disabled={isLoading}
            onClick={() => onSelect(account)}
            title={`${account.email}`}
          >
            <span className={styles.pillLabel}>{account.label}</span>
            <span className={styles.pillEmail}>{account.email}</span>
          </button>
        ))}
      </div>
      <p className={styles.hint}>
        {t(
          'login.devQuickLogin.hint',
          'Quick-fill a sandbox account. Visible only in dev on localhost.',
        )}
      </p>
    </section>
  );
};

export default DevQuickLoginPanel;
