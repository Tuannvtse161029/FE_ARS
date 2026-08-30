import type { CSSProperties } from 'react';

export interface BackendGapBannerProps {
  /** Backend field or endpoint that is not available in the live contract. */
  field: string;
  /** Optional feature context, shown as supporting text. */
  feature?: string;
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

/** Makes backend gaps explicit without claiming demo values are persisted. */
export const BackendGapBanner = ({ field, feature, className }: BackendGapBannerProps) => (
  <div
    className={className}
    style={bannerStyle}
    role="status"
    aria-live="polite"
    data-component="BackendGapBanner"
  >
    <strong>Demo field — awaiting backend API: {field}</strong>
    {feature && <span>{feature} is currently isolated to frontend demo state.</span>}
  </div>
);

export default BackendGapBanner;
