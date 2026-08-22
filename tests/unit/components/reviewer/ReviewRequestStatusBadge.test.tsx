import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  getReviewRequestStatusDisplay,
} from '../../../../../src/utils/reviewRequestDisplay';
import {
  normalizeReviewRequestStatus,
  getReviewRequestTab,
} from '../../../../../src/utils/reviewRequestPolicy';
import { ReviewRequestStatusBadge } from '../../../../../src/components/reviewer/ReviewRequestStatusBadge';
import styles from '../../../../../src/components/reviewer/ReviewRequestStatusBadge.module.css';

describe('normalizeReviewRequestStatus (defect 1A)', () => {
  it('maps canonical strings exactly', () => {
    expect(normalizeReviewRequestStatus('PENDING')).toBe('PENDING');
    expect(normalizeReviewRequestStatus('IN_PROGRESS')).toBe('IN_PROGRESS');
    expect(normalizeReviewRequestStatus('COMPLETED')).toBe('COMPLETED');
    expect(normalizeReviewRequestStatus('DECLINED')).toBe('DECLINED');
    expect(normalizeReviewRequestStatus('CANCELLED')).toBe('CANCELLED');
  });

  it('accepts lowercase and trimmed variants', () => {
    expect(normalizeReviewRequestStatus('  pending ')).toBe('PENDING');
    expect(normalizeReviewRequestStatus('in progress')).toBe('IN_PROGRESS');
    expect(normalizeReviewRequestStatus('In-Progress')).toBe('IN_PROGRESS');
  });

  it('maps confirmed completion synonyms only', () => {
    expect(normalizeReviewRequestStatus('Completed')).toBe('COMPLETED');
    expect(normalizeReviewRequestStatus('COMPLETE')).toBe('COMPLETED');
    expect(normalizeReviewRequestStatus('DONE')).toBe('COMPLETED');
    expect(normalizeReviewRequestStatus('Reviewed')).toBe('COMPLETED');
    expect(normalizeReviewRequestStatus('Closed')).toBe('COMPLETED');
    expect(normalizeReviewRequestStatus('Delivered')).toBe('COMPLETED');
    expect(normalizeReviewRequestStatus('Accepted')).toBe('COMPLETED');
  });

  it('maps declined/rejected to a non-completed bucket', () => {
    expect(normalizeReviewRequestStatus('Declined')).toBe('DECLINED');
    expect(normalizeReviewRequestStatus('Rejected')).toBe('DECLINED');
  });

  it('maps cancelled / expired / withdrawn / refunded to CANCELLED', () => {
    expect(normalizeReviewRequestStatus('Cancelled')).toBe('CANCELLED');
    expect(normalizeReviewRequestStatus('Canceled')).toBe('CANCELLED');
    expect(normalizeReviewRequestStatus('Expired')).toBe('CANCELLED');
    expect(normalizeReviewRequestStatus('Withdrawn')).toBe('CANCELLED');
    expect(normalizeReviewRequestStatus('Refunded')).toBe('CANCELLED');
  });

  it('returns UNKNOWN for empty / unrecognized values', () => {
    expect(normalizeReviewRequestStatus('')).toBe('UNKNOWN');
    expect(normalizeReviewRequestStatus(null)).toBe('UNKNOWN');
    expect(normalizeReviewRequestStatus(undefined)).toBe('UNKNOWN');
    expect(normalizeReviewRequestStatus('SomeFutureStatus')).toBe('UNKNOWN');
  });
});

describe('getReviewRequestTab (defect 2A)', () => {
  it('groups IN_PROGRESS into the inprogress bucket', () => {
    expect(getReviewRequestTab('IN_PROGRESS')).toBe('inprogress');
    expect(getReviewRequestTab('In Progress')).toBe('inprogress');
    expect(getReviewRequestTab('Ongoing')).toBe('inprogress');
  });

  it('groups COMPLETED into the completed bucket', () => {
    expect(getReviewRequestTab('Completed')).toBe('completed');
    expect(getReviewRequestTab('DONE')).toBe('completed');
  });

  it('puts PENDING, DECLINED, CANCELLED, and UNKNOWN into the pending bucket (conservative default)', () => {
    expect(getReviewRequestTab('PENDING')).toBe('pending');
    expect(getReviewRequestTab('Declined')).toBe('pending');
    expect(getReviewRequestTab('Cancelled')).toBe('pending');
    expect(getReviewRequestTab('garbage')).toBe('pending');
  });
});

describe('getReviewRequestStatusDisplay (defect 1A)', () => {
  it('Completed renders green pill with CheckCircle2 and label', () => {
    const display = getReviewRequestStatusDisplay('Completed');
    expect(display.tone).toBe('green');
    expect(display.label).toBe('Completed');
    expect(display.cssClass).toBe('statusCompleted');
    // CheckCircle2 icon name — we don't import lucide-react here so just
    // assert it's a function component (forwardRef returns object).
    expect(typeof display.icon).toBe('object');
  });

  it('Pending renders amber pill (default for empty/unknown)', () => {
    expect(getReviewRequestStatusDisplay('Pending').tone).toBe('amber');
    expect(getReviewRequestStatusDisplay(null).tone).toBe('amber');
    expect(getReviewRequestStatusDisplay('').tone).toBe('amber');
    expect(getReviewRequestStatusDisplay(undefined).tone).toBe('amber');
  });

  it('In Progress renders blue pill', () => {
    expect(getReviewRequestStatusDisplay('IN_PROGRESS').tone).toBe('blue');
    expect(getReviewRequestStatusDisplay('In Progress').tone).toBe('blue');
  });

  it('Declined / Rejected render red pill', () => {
    expect(getReviewRequestStatusDisplay('Declined').tone).toBe('red');
    expect(getReviewRequestStatusDisplay('Rejected').tone).toBe('red');
  });

  it('Cancelled / Expired render neutral pill', () => {
    expect(getReviewRequestStatusDisplay('Cancelled').tone).toBe('neutral');
    expect(getReviewRequestStatusDisplay('Expired').tone).toBe('neutral');
  });
});

describe('<ReviewRequestStatusBadge />', () => {
  it('Completed badge has green tone, CheckCircle2 icon, and inline label — defect 1A', () => {
    render(<ReviewRequestStatusBadge status="Completed" />);
    const badge = screen.getByTestId('review-request-status-badge');
    // Single-line layout
    expect(badge.className).toContain(styles.badge);
    // Green semantic treatment
    expect(badge.className).toContain(styles.statusCompleted);
    expect(badge.className).not.toContain(styles.statusPending);
    // Icon + label both present
    expect(badge.querySelector('svg')).toBeTruthy();
    expect(badge.textContent).toContain('Completed');
    expect(badge.getAttribute('data-status')).toBe('Completed');
  });

  it('Pending badge stays amber — defect 1A (must not be confused with completed)', () => {
    render(<ReviewRequestStatusBadge status="Pending" />);
    const badge = screen.getByTestId('review-request-status-badge');
    expect(badge.className).toContain(styles.statusPending);
    expect(badge.textContent).toContain('Pending');
  });

  it('size="md" applies the larger padding class', () => {
    render(<ReviewRequestStatusBadge status="Completed" size="md" />);
    const badge = screen.getByTestId('review-request-status-badge');
    expect(badge.className).toContain(styles.sizeMd);
  });

  it('unknown / empty falls back to the pending badge (never green)', () => {
    render(<ReviewRequestStatusBadge status={null} />);
    const badge = screen.getByTestId('review-request-status-badge');
    expect(badge.className).toContain(styles.statusPending);
    expect(badge.className).not.toContain(styles.statusCompleted);
  });
});