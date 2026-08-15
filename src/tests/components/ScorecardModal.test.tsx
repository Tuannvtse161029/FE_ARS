/**
 * Tests for the ScorecardModal (Reviewer) component.
 *
 * Covers:
 *   1. Returns null when isOpen is false
 *   2. Renders the Accept branch when fileName contains "consensus"
 *   3. Renders the Reject branch for other fileNames
 *   4. Renders all 5 criteria + Final Decision
 *   5. Active score pill matches the score
 *   6. Closes modal when Close button is clicked
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { ScorecardModal } from '../../pages/Reviewer/components/ScorecardModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const renderModal = (props: { isOpen?: boolean; fileName?: string; onClose?: () => void }) =>
  render(
    <ScorecardModal
      isOpen={props.isOpen ?? true}
      onClose={props.onClose ?? (() => {})}
      fileName={props.fileName ?? 'Microservice_Consensus_v3.pdf'}
    />
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ScorecardModal – visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    render(<ScorecardModal isOpen={false} onClose={() => {}} fileName="anything.pdf" />);
    expect(screen.queryByText(/criteria evaluation scorecard/i)).not.toBeInTheDocument();
  });
});

describe('ScorecardModal – Accept branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Accept badge for files containing "consensus"', () => {
    renderModal({ fileName: 'Microservice_Consensus_v3.pdf' });

    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('ACCEPTED')).toBeInTheDocument();
  });

  it('shows the seeded file name in the header', () => {
    renderModal({ fileName: 'Microservice_Consensus_v3.pdf' });
    expect(screen.getByText('Microservice_Consensus_v3.pdf')).toBeInTheDocument();
  });

  it('shows the reviewer and date in the footer', () => {
    renderModal({ fileName: 'Microservice_Consensus_v3.pdf' });
    expect(screen.getByText(/Reviewer: Dr\. Nguyen Van A/)).toBeInTheDocument();
    expect(screen.getByText(/Submitted 2026-07-20/)).toBeInTheDocument();
  });

  it('renders all 5 numbered criteria', () => {
    renderModal({ fileName: 'Microservice_Consensus_v3.pdf' });

    expect(screen.getByText('1. ORIGINALITY')).toBeInTheDocument();
    expect(screen.getByText('2. LITERATURE REVIEW')).toBeInTheDocument();
    expect(screen.getByText('3. METHODOLOGY')).toBeInTheDocument();
    expect(screen.getByText('4. RESULTS & DISCUSSION')).toBeInTheDocument();
    expect(screen.getByText('5. FORMATTING & STRUCTURE')).toBeInTheDocument();
    expect(screen.getByText('6. FINAL DECISION')).toBeInTheDocument();
  });
});

describe('ScorecardModal – Reject branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Reject badge for non-consensus file names', () => {
    renderModal({ fileName: 'EdgeNet_Protocol_v2.pdf' });

    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.getByText('REJECTED')).toBeInTheDocument();
  });

  it('shows the EdgeNet paper name in the header', () => {
    renderModal({ fileName: 'EdgeNet_Protocol_v2.pdf' });
    expect(screen.getByText('EdgeNet_Protocol_v2.pdf')).toBeInTheDocument();
  });

  it('still renders all 5 criteria in the Reject branch', () => {
    renderModal({ fileName: 'EdgeNet_Protocol_v2.pdf' });

    expect(screen.getByText('1. ORIGINALITY')).toBeInTheDocument();
    expect(screen.getByText('5. FORMATTING & STRUCTURE')).toBeInTheDocument();
  });
});

describe('ScorecardModal – close behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onClose when the X close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<ScorecardModal isOpen={true} onClose={onClose} fileName="Microservice_Consensus_v3.pdf" />);

    // The X close button is in the header
    const closeButtons = screen.getAllByRole('button');
    // The first close button is the header X
    await user.click(closeButtons[closeButtons.length - 2]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the footer Close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<ScorecardModal isOpen={true} onClose={onClose} fileName="Microservice_Consensus_v3.pdf" />);

    await user.click(screen.getByRole('button', { name: /^close$/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ScorecardModal – accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('the modal title is the H2 header', () => {
    renderModal({ fileName: 'Microservice_Consensus_v3.pdf' });
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[0]).toHaveTextContent(/criteria evaluation scorecard/i);
  });
});
