import type { CSSProperties } from 'react';

export interface BackendGapBannerProps {
  /**
   * Backend field or endpoint that is not available in the live contract.
   * If the field IS present in Swagger and the FE just doesn't render it
   * yet, document that with `field` + `feature` and omit `demo` to keep
   * the banner honest about whether the gap is real or just unimplemented.
   */
  field: string;
  /**
   * Optional feature context, shown as supporting text.
   */
  feature?: string;
  /**
   * Set to true when the FE actually persists fake rows in a local store
   * to mask the missing backend field. False by default — the page must
   * not pretend the FE keeps the data alive.
   */
  demo?: boolean;
  className?: string;
}

const bannerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  padding: 'var(--space-3) var(--space-4)',
  border: '1px solid var(--status-warning-border, var(--border-strong))',
  borderRadius: 'var(--radius-md, 4px)',
  background: 'var(--status-warning-bg, var(--surface-paper-muted))',
  color: 'var(--status-warning-text, var(--ink-primary))',
  fontSize: 'var(--text-sm, 0.875rem)',
};

/**
 * Surfaces backend gaps honestly without claiming demo values are persisted
 * unless the caller explicitly opts in via the `demo` prop.
 */
export const BackendGapBanner = ({
  field,
  feature,
  demo = false,
  className,
}: BackendGapBannerProps) => (
  <div
    className={className}
    style={bannerStyle}
    role="status"
    aria-live="polite"
    data-component="BackendGapBanner"
  >
    <strong>
      {demo
        ? `Demo field — awaiting backend API: ${field}`
        : `Backend gap — not yet exposed by Swagger: ${field}`}
    </strong>
    {feature && (
      <span>
        {demo
          ? `${feature} Any values entered here live only in frontend demo state and are NOT persisted to the backend.`
          : `${feature} The page renders only the fields Swagger actually exposes.`}
      </span>
    )}
  </div>
);

export default BackendGapBanner;
