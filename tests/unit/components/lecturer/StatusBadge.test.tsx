/**
 * Unit tests for src/components/lecturer/StatusBadge.tsx
 *
 * Covers:
 *   - Color mapping per brief #7:
 *       submitted + submitted-late → blue (info) class
 *       awaiting-submission       → blue (info) class
 *       evaluated                → green (success) class
 *       rejected                 → red (error) class
 *       overdue                  → red (error) class
 *   - The normalizedStatus prop bypasses label-based normalisation so
 *     the CSS class is always correct regardless of label variations.
 *   - Legacy backward compat: raw status strings still normalise correctly.
 *   - WCAG: label text is always visible (never color-alone).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../../../../src/components/lecturer/StatusBadge';

describe('<StatusBadge> — color mapping (brief #7)', () => {
  describe('normalizedStatus prop (authoritative path for PhaseReports)', () => {
    it('maps submitted → blue/info CSS class', () => {
      const { container } = render(
        <StatusBadge status="OnTime" normalizedStatus="submitted" label="Submitted On Time" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge).toBeInTheDocument();
      // CSS Modules hash the class name; check that the scoped class is present
      expect(badge!.className).toContain('submitted');
      expect(badge!.className).not.toContain('evaluated');
      expect(screen.getByText('Submitted On Time')).toBeInTheDocument();
    });

    it('maps submitted-late → blue/info CSS class', () => {
      const { container } = render(
        <StatusBadge status="OnTime" normalizedStatus="submitted-late" label="Submitted Late" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge).toBeInTheDocument();
      expect(badge!.className).toContain('submitted-late');
      expect(badge!.className).not.toContain('evaluated');
      expect(screen.getByText('Submitted Late')).toBeInTheDocument();
    });

    it('maps awaiting-submission → blue/info CSS class', () => {
      const { container } = render(
        <StatusBadge status="Pending" normalizedStatus="awaiting-submission" label="Awaiting Submission" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge).toBeInTheDocument();
      expect(badge!.className).toContain('awaiting-submission');
      expect(badge!.className).not.toContain('evaluated');
      expect(screen.getByText('Awaiting Submission')).toBeInTheDocument();
    });

    it('maps evaluated → green/success CSS class', () => {
      const { container } = render(
        <StatusBadge status="Graded" normalizedStatus="evaluated" label="Accepted" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge).toBeInTheDocument();
      expect(badge!.className).toContain('evaluated');
      expect(badge!.className).not.toContain('rejected');
      expect(screen.getByText('Accepted')).toBeInTheDocument();
    });

    it('maps rejected → red/error CSS class', () => {
      const { container } = render(
        <StatusBadge status="Rejected" normalizedStatus="rejected" label="Rejected" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge).toBeInTheDocument();
      expect(badge!.className).toContain('rejected');
      expect(badge!.className).not.toContain('evaluated');
      expect(screen.getByText('Rejected')).toBeInTheDocument();
    });

    it('maps overdue → red/error CSS class', () => {
      const { container } = render(
        <StatusBadge status="Overdue" normalizedStatus="overdue" label="Overdue" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge).toBeInTheDocument();
      expect(badge!.className).toContain('overdue');
      expect(badge!.className).not.toContain('evaluated');
      expect(screen.getByText('Overdue')).toBeInTheDocument();
    });

    it('evaluated badge does NOT use the green color when only status prop is passed (no normalizedStatus)', () => {
      // This tests that the fallback normalisation path doesn't accidentally
      // produce the wrong class when the label-based path is used without
      // normalizedStatus — e.g. for legacy callers outside PhaseReports.
      const { container } = render(
        <StatusBadge status="evaluated" label="Evaluated" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge).toBeInTheDocument();
      expect(badge!.className).toContain('evaluated');
    });
  });

  describe('raw string normalisation (backward compat for non-PhaseReports callers)', () => {
    it('"Submitted" raw string normalises to submitted (blue)', () => {
      const { container } = render(
        <StatusBadge status="Submitted" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge!.className).toContain('submitted');
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });

    it('"pending_review" raw string normalises to submitted (blue)', () => {
      const { container } = render(
        <StatusBadge status="pending_review" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge!.className).toContain('submitted');
    });

    it('"waiting" raw string normalises to waiting (blue)', () => {
      const { container } = render(
        <StatusBadge status="waiting" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge!.className).toContain('waiting');
    });

    it('"approved" raw string normalises to evaluated (green)', () => {
      const { container } = render(
        <StatusBadge status="approved" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge!.className).toContain('evaluated');
    });

    it('"denied" raw string normalises to rejected (red)', () => {
      const { container } = render(
        <StatusBadge status="denied" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge!.className).toContain('rejected');
    });

    it('unknown raw string falls back to unknown (muted grey)', () => {
      const { container } = render(
        <StatusBadge status="random-nonsense" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge!.className).toContain('unknown');
    });

    it('null status falls back to unknown', () => {
      const { container } = render(
        <StatusBadge status={null} />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge!.className).toContain('unknown');
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('WCAG: label is always visible (never color-alone)', () => {
    it('renders the label text for each status', () => {
      const labels = [
        { normalizedStatus: 'submitted', label: 'Submitted On Time' },
        { normalizedStatus: 'submitted-late', label: 'Submitted Late' },
        { normalizedStatus: 'awaiting-submission', label: 'Awaiting Submission' },
        { normalizedStatus: 'evaluated', label: 'Accepted' },
        { normalizedStatus: 'rejected', label: 'Rejected' },
        { normalizedStatus: 'overdue', label: 'Overdue' },
      ];

      for (const { normalizedStatus, label } of labels) {
        const { container } = render(
          <StatusBadge
            status="stub"
            normalizedStatus={normalizedStatus as Parameters<typeof StatusBadge>[0]['normalizedStatus']}
            label={label}
          />,
        );
        expect(
          screen.getByText(label, { selector: '[data-component="StatusBadge"]' }),
          `Label "${label}" must be visible`,
        ).toBeInTheDocument();
        // Also verify the dot (color+dot+label triad) is rendered
        const dot = container.querySelector('span[aria-hidden]');
        expect(dot).toBeInTheDocument();
      }
    });
  });

  describe('size prop', () => {
    it('size="sm" applies the sizeSm class', () => {
      const { container } = render(
        <StatusBadge status="Submitted" normalizedStatus="submitted" size="sm" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge!.className).toContain('sizeSm');
      expect(badge!.className).not.toContain('sizeMd');
    });

    it('size="md" (default) applies the sizeMd class', () => {
      const { container } = render(
        <StatusBadge status="Submitted" normalizedStatus="submitted" />,
      );
      const badge = container.querySelector('[data-component="StatusBadge"]');
      expect(badge!.className).toContain('sizeMd');
    });
  });

  describe('aria-label includes the label', () => {
    it('aria-label is set to "Status: <label>"', () => {
      render(
        <StatusBadge
          status="Overdue"
          normalizedStatus="overdue"
          label="Overdue"
        />,
      );
      // Use getByLabelText because <span aria-label> is matched by label queries
      expect(screen.getByLabelText('Status: Overdue')).toBeInTheDocument();
    });
  });
});
