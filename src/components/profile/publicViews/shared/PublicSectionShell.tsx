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
import { AvatarVisual } from '../../AvatarVisual';
import { SafeMedalBadge } from '../../../../features/admin/components/SafeMedalBadge';
import type { UserMedal } from '../../../../services/medal.service';
import styles from './PublicSectionShell.module.css';

export interface PublicSectionShellProps {
  /**
   * Mono-tracked uppercase eyebrow, e.g. "REVIEWER CONTRIBUTION".
   * Optional so callers can omit it when the heading already carries
   * the context — the inner `<p>` simply renders nothing when empty.
   */
  eyebrow?: string;
  /** Optional section heading rendered in serif. */
  title?: string;
  /** Profile avatar displayed beside the public identity heading. */
  avatarUrl?: string | null;
  /** Initials shown when no uploaded or symbolic avatar is available. */
  avatarInitials?: string;
  /** Up to three medals selected for the public identity header. */
  topMedals?: UserMedal[];
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
  avatarUrl,
  avatarInitials,
  topMedals,
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
        <div className={styles.identityHeading}>
          {title && (avatarUrl !== undefined || avatarInitials !== undefined) ? (
            <div className={styles.avatar} aria-label={`${title} avatar`} data-testid="public-profile-avatar">
              <AvatarVisual url={avatarUrl} initials={avatarInitials ?? ''} alt="" size={48} />
            </div>
          ) : null}
          <div className={styles.titleBlock}>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            {title ? (
              <h2 className={styles.title} id={testId ? `${testId}-title` : undefined}>
                {title}
              </h2>
            ) : null}
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            {topMedals && topMedals.length > 0 ? (
              <div className={styles.topMedals} aria-label="Top profile medals">
                {topMedals.slice(0, 3).map((item) => (
                  <span key={item.medal.id} className={styles.topMedal}>
                    <SafeMedalBadge
                      imageUrl={item.medal.imageUrl}
                      code={item.medal.code}
                      criteriaMetric={item.medal.criteriaMetric}
                      tier={item.medal.tier}
                      size={28}
                      alt={item.medal.title}
                    />
                  </span>
                ))}
              </div>
            ) : null}
          </div>
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
