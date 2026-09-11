/**
 * PublicSectionShell — shared section card used by every role-specific public
 * profile view. Provides a consistent visual rhythm (warm paper surface,
 * mono uppercase eyebrow, accent rule on the left) so the four role views
 * feel like siblings while each tells its own information story.
 *
 * Per role, the accent color flows in via `--profile-accent` (already set
 * by the parent Profile page). The shell never hardcodes a color.
 */
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import styles from './PublicSectionShell.module.css';

export interface PublicSectionShellProps {
  /** Mono-tracked uppercase eyebrow, e.g. "REVIEWER CONTRIBUTION". */
  eyebrow: string;
  /** Optional section heading rendered in serif. */
  title?: string;
  /** One-line description under the heading. */
  subtitle?: string;
  /** Action slot — typically a "View all" link. */
  action?: ReactNode;
  /** Body content. */
  children: ReactNode;
  /** Optional link target for the right-rail action. */
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Optional data-testid for testing. */
  'data-testid'?: string;
}

export const PublicSectionShell = ({
  eyebrow,
  title,
  subtitle,
  action,
  children,
  viewAllHref,
  viewAllLabel,
  'data-testid': testId,
}: PublicSectionShellProps) => {
  return (
    <section
      className={styles.shell}
      aria-labelledby={testId ? `${testId}-title` : undefined}
      data-testid={testId}
    >
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          {title ? (
            <h2 className={styles.title} id={testId ? `${testId}-title` : undefined}>
              {title}
            </h2>
          ) : null}
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {action ? <div className={styles.action}>{action}</div> : null}
        {viewAllHref && viewAllLabel ? (
          <a
            className={styles.viewAll}
            href={viewAllHref}
            data-testid={testId ? `${testId}-view-all` : undefined}
          >
            {viewAllLabel}
            <ChevronRight size={14} aria-hidden="true" />
          </a>
        ) : null}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
};

export default PublicSectionShell;
