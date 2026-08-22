/**
 * Component tests for src/components/lecturer/StatusBadge.tsx.
 *
 * Verifies:
 *   - the 4 ResearchTopic status colors render in the right CSS classes
 *   - the 4 PhasedReport status variants render the right label
 *   - defensive normalization (synonyms → canonical variants)
 *   - unknown inputs fall back to the muted "unknown" variant
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../../../src/components/lecturer/StatusBadge';
import styles from '../../../src/components/lecturer/StatusBadge.module.css';

describe('<StatusBadge>', () => {
  describe('ResearchTopic variant colors', () => {
    it('OPEN uses the open variant', () => {
      render(<StatusBadge status="OPEN" />);
      const badge = screen.getByLabelText(/Status: OPEN/);
      expect(badge.className).toContain(styles.open);
    });

    it('ASSIGNED uses the assigned variant (purple)', () => {
      render(<StatusBadge status="ASSIGNED" />);
      const badge = screen.getByLabelText(/Status: ASSIGNED/);
      expect(badge.className).toContain(styles.assigned);
    });

    it('COMPLETED uses the completed variant (green)', () => {
      render(<StatusBadge status="COMPLETED" />);
      const badge = screen.getByLabelText(/Status: COMPLETED/);
      expect(badge.className).toContain(styles.completed);
    });

    it('CLOSED uses the closed variant (slate)', () => {
      render(<StatusBadge status="CLOSED" />);
      const badge = screen.getByLabelText(/Status: CLOSED/);
      expect(badge.className).toContain(styles.closed);
    });
  });

  describe('PhasedReport variant colors', () => {
    it('SUBMITTED uses the submitted variant (amber)', () => {
      render(<StatusBadge status="SUBMITTED" />);
      const badge = screen.getByLabelText(/Status: SUBMITTED/);
      expect(badge.className).toContain(styles.submitted);
    });

    it('EVALUATED uses the evaluated variant (green)', () => {
      render(<StatusBadge status="EVALUATED" />);
      const badge = screen.getByLabelText(/Status: EVALUATED/);
      expect(badge.className).toContain(styles.evaluated);
    });

    it('REJECTED uses the rejected variant (red)', () => {
      render(<StatusBadge status="REJECTED" />);
      const badge = screen.getByLabelText(/Status: REJECTED/);
      expect(badge.className).toContain(styles.rejected);
    });

    it('WAITING uses the waiting variant (blue)', () => {
      render(<StatusBadge status="WAITING" />);
      const badge = screen.getByLabelText(/Status: WAITING/);
      expect(badge.className).toContain(styles.waiting);
    });
  });

  describe('GuidanceProject variant colors', () => {
    it('PROPOSED uses the proposed variant', () => {
      render(<StatusBadge status="PROPOSED" />);
      const badge = screen.getByLabelText(/Status: PROPOSED/);
      expect(badge.className).toContain(styles.proposed);
    });

    it('ONGOING uses the ongoing variant', () => {
      render(<StatusBadge status="ONGOING" />);
      const badge = screen.getByLabelText(/Status: ONGOING/);
      expect(badge.className).toContain(styles.ongoing);
    });

    it('CANCELLED uses the cancelled variant', () => {
      render(<StatusBadge status="CANCELLED" />);
      const badge = screen.getByLabelText(/Status: CANCELLED/);
      expect(badge.className).toContain(styles.cancelled);
    });
  });

  describe('normalization', () => {
    it('maps APPROVED → evaluated', () => {
      render(<StatusBadge status="APPROVED" />);
      const badge = screen.getByLabelText(/Status: APPROVED/);
      expect(badge.className).toContain(styles.evaluated);
    });

    it('maps DENIED → rejected', () => {
      render(<StatusBadge status="DENIED" />);
      const badge = screen.getByLabelText(/Status: DENIED/);
      expect(badge.className).toContain(styles.rejected);
    });

    it('maps PENDING → waiting', () => {
      render(<StatusBadge status="PENDING" />);
      const badge = screen.getByLabelText(/Status: PENDING/);
      expect(badge.className).toContain(styles.waiting);
    });
  });

  describe('unknown input', () => {
    it('falls back to the muted "unknown" variant for nonsense', () => {
      render(<StatusBadge status="some-future-state" />);
      const badge = screen.getByLabelText(/Status: some-future-state/);
      expect(badge.className).toContain(styles.unknown);
    });

    it('falls back to "Unknown" label when status is null', () => {
      render(<StatusBadge status={null} />);
      const badge = screen.getByLabelText(/Status: Unknown/);
      expect(badge.className).toContain(styles.unknown);
    });

    it('respects an explicit label override', () => {
      render(<StatusBadge status="OPEN" label="Open now" />);
      const badge = screen.getByLabelText(/Status: Open now/);
      expect(badge.className).toContain(styles.open);
    });
  });
});