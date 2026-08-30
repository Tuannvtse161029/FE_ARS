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
  /**
   * Optional inline accessory rendered immediately after the title, on the
   * same line (wrapping to a new line on narrow viewports). Use this for
   * contextual inline elements that belong with the title — e.g. a
   * `StatusBadge` showing the entity's current status — NOT for actions.
   * For right-side buttons / filters, use the `actions` slot.
   */
  titleAccessory?: ReactNode;
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
  titleAccessory,
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
        {/* === GSI LOCALE + STATUS BADGE RELOCATE (this worker) ===
            Title cluster wraps the title + optional `titleAccessory` in a
            single flex container so the accessory visually belongs with
            the title and wraps cleanly under it on narrow viewports. */}
        <div className={styles.titleCluster}>
          <h1 className={styles.title}>{title}</h1>
          {titleAccessory && (
            <div className={styles.titleAccessory} data-component="PageHeaderTitleAccessory">
              {titleAccessory}
            </div>
          )}
        </div>
        {/* === END GSI LOCALE + STATUS BADGE RELOCATE (this worker) === */}
        {description && <div className={styles.description}>{description}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
};

export default PageHeader;
