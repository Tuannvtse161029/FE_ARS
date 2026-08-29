/**
 * PageHeader — standardized header for every authenticated page.
 *
 * Goal: replace the dozens of ad-hoc page-header patterns (eyebrow + serif
 * title + accent bar + decorative rule + buttons) with one consistent
 * surface. Pages compose actions via the `actions` slot. Role accent is
 * applied through a single CSS custom property `--ph-accent` so per-role
 * color flows through without touching this component.
 */
import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  /** Optional eyebrow label, e.g. "RESEARCHER WORKSPACE" */
  eyebrow?: string;
  /** Main page title — Inter, never serif */
  title: string;
  /** Optional supporting description shown under the title */
  description?: ReactNode;
  /** Right-side actions slot (buttons, badges, filters) */
  actions?: ReactNode;
  /** Role accent CSS variable or hex value. Defaults to ARS blue. */
  accent?: string;
  /** Optional breadcrumb row above the title */
  breadcrumbs?: ReactNode;
  className?: string;
}

export const PageHeader = ({
  eyebrow,
  title,
  description,
  actions,
  accent,
  breadcrumbs,
  className,
}: PageHeaderProps) => {
  const style = accent
    ? ({ '--ph-accent': accent } as React.CSSProperties)
    : undefined;
  return (
    <header
      className={`${styles.header} ${className ?? ''}`}
      style={style}
      data-component="PageHeader"
    >
      <div className={styles.left}>
        {breadcrumbs && <div className={styles.breadcrumbs}>{breadcrumbs}</div>}
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h1 className={styles.title}>{title}</h1>
        {description && <div className={styles.description}>{description}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
};

export default PageHeader;
