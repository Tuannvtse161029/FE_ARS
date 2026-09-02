/**
 * ProfileExtrasSection — shared chrome for the Publications + Forum Posts
 * preview sections rendered beneath the main Profile view card.
 *
 * Owns the layout (card shell, header, body, empty/loading slots) so the
 * publications and forum sections stay visually identical and the parent
 * Profile page stays clean.
 */

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './ProfileExtrasSection.module.css';

export interface ProfileExtrasSectionProps {
  /** Section heading (e.g. "Published papers"). */
  title: string;
  /** One-line description shown under the title. */
  subtitle: string;
  /** Optional link target for the "View all" affordance. */
  viewAllHref?: string;
  /** Content (item list, skeleton, empty state) to render in the body. */
  children: ReactNode;
  /** Optional data-testid for testing. */
  'data-testid'?: string;
}

export const ProfileExtrasSection = ({
  title,
  subtitle,
  viewAllHref,
  children,
  'data-testid': testId,
}: ProfileExtrasSectionProps) => {
  return (
    <section
      className={styles.extrasCard}
      aria-label={title}
      data-testid={testId}
    >
      <header className={styles.extrasHeader}>
        <div className={styles.extrasTitleBlock}>
          <h2 className={styles.extrasTitle}>{title}</h2>
          <p className={styles.extrasSubtitle}>{subtitle}</p>
        </div>
        {viewAllHref ? (
          <Link
            to={viewAllHref}
            className={styles.viewAllLink}
            data-testid={testId ? `${testId}-view-all` : undefined}
          >
            View all
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
};

export default ProfileExtrasSection;