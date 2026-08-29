/**
 * WorkspaceHeader — Shared header component for role landing pages.
 * ARS Research Constellation design language.
 *
 * Features:
 * - Role-colored accent bar on the left
 * - Section marker (e.g. "01 / ACTIVE RESEARCH") above the title
 * - Editorial serif title + sans-serif subtitle
 * - Optional action slot on the right
 * - Thin bottom annotation line
 */
import type { ReactNode } from 'react';
import styles from './WorkspaceHeader.module.css';

export interface WorkspaceHeaderProps {
  /** Section marker text, e.g. "01 / MANUSCRIPT STUDIO" */
  marker: string;
  /** Main heading — uses serif for editorial accent */
  title: string;
  /** Subtitle in UI sans-serif */
  subtitle?: string;
  /** Accent color token — defaults to ars-blue */
  accent?: string;
  /** Optional right-side content (buttons, badges) */
  actions?: ReactNode;
  /** Optional annotation line below the header */
  annotation?: string;
  className?: string;
}

export const WorkspaceHeader = ({
  marker,
  title,
  subtitle,
  accent,
  actions,
  annotation,
  className,
}: WorkspaceHeaderProps) => {
  return (
    <header
      className={`${styles.header} ${className ?? ''}`}
      style={accent ? ({ '--header-accent': accent } as React.CSSProperties) : undefined}
    >
      <div className={styles.inner}>
        <div className={styles.textCol}>
          <span className={styles.marker} aria-hidden="true">{marker}</span>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {annotation && <p className={styles.annotation}>{annotation}</p>}
        </div>

        {actions && (
          <div className={styles.actions}>{actions}</div>
        )}
      </div>
    </header>
  );
};
