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
  /**
   * @deprecated Eyebrow labels were removed from every authenticated page.
   * The prop is kept so callers that still pass `eyebrow=` continue to
   * compile, but the value is intentionally ignored. Remove the prop at
   * the call site on your next pass.
   */
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
  className?: string;
}

export const PageHeader = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  eyebrow: _eyebrow,
  title,
  titleAccessory,
  description,
  actions,
  accent,
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
        <div className={styles.titleCluster}>
          <h1 className={styles.title}>{title}</h1>
          {titleAccessory && (
            <div className={styles.titleAccessory} data-component="PageHeaderTitleAccessory">
              {titleAccessory}
            </div>
          )}
        </div>
        {description && <div className={styles.description}>{description}</div>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
};

export default PageHeader;
