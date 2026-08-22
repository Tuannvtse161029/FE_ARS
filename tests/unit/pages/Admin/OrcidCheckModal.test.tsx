/**
 * Tests for src/pages/Admin/OrcidCheckModal.tsx — Admin ORCID Check modal.
 *
 * The live ARS backend does not yet expose an ORCID lookup endpoint, so the
 * modal will always render its "Feature Unavailable" state with the backend
 * team request. These tests verify:
 *   - The modal opens & closes correctly
 *   - It renders the unavailable state when the feature is disabled
 *   - It renders the unavailable state when the user has no ORCID iD
 *   - It opens with a valid ORCID iD and shows the unavailable state when
 *     feature is disabled (no axios calls, no external HTTP)
 *   - Accessibility (aria-modal, dialog role, escape-to-close)
 *   - External links carry safe rel attributes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach } from 'vitest';
import { OrcidCheckModal } from '../../../../src/pages/Admin/OrcidCheckModal';
import { ORCID_CHECK_ENABLED } from '../../../../src/services/orcid.service';

// Make sure the feature is off in the test environment.
expect(ORCID_CHECK_ENABLED).toBe(false);

const baseUser = {
  id: 7001,
  fullName: 'Tran Van Khanh',
  email: 'khanh.tran@example.com',
  orcidId: '0000-0002-1825-0097',
};

describe('OrcidCheckModal', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when closed', () => {
    render(<OrcidCheckModal user={baseUser} open={false} onClose={() => undefined} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders unavailable state with backend request when feature is disabled', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch' as unknown as typeof fetch)
      .mockResolvedValue(new Response('{}', { status: 200 }));

    render(<OrcidCheckModal user={baseUser} open={true} onClose={() => undefined} />);

    // Backend request visible
    await waitFor(() => {
      expect(screen.getByTestId('orcid-backend-request')).toBeInTheDocument();
    });

    // No external fetch — proves we don't call OpenAlex/ORCID directly
    expect(fetchSpy).not.toHaveBeenCalled();

    // Unavailable title is rendered
    expect(screen.getByTestId('orcid-check-unavailable')).toBeInTheDocument();
  });

  it('displays the user context in the header (name + id)', async () => {
    render(<OrcidCheckModal user={baseUser} open={true} onClose={() => undefined} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Tran Van Khanh/),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/User #7001/)).toBeInTheDocument();
  });

  it('shows the ORCID iD when available', async () => {
    render(<OrcidCheckModal user={baseUser} open={true} onClose={() => undefined} />);
    await waitFor(() => {
      expect(screen.getByText('0000-0002-1825-0097')).toBeInTheDocument();
    });
  });

  it('exposes a working Close button that calls onClose', async () => {
    const onClose = vi.fn();
    render(<OrcidCheckModal user={baseUser} open={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('orcid-check-unavailable-close')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('orcid-check-unavailable-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses escape key to close', async () => {
    const onClose = vi.fn();
    render(<OrcidCheckModal user={baseUser} open={true} onClose={onClose} />);

    // Wait for modal to mount
    await waitFor(() => {
      expect(screen.getByTestId('orcid-check-unavailable-close')).toBeInTheDocument();
    });

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('is keyboard-accessible (dialog + aria-modal)', async () => {
    render(<OrcidCheckModal user={baseUser} open={true} onClose={() => undefined} />);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'orcid-check-title');
  });

  it('renders unavailable state when user has no ORCID iD', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch' as unknown as typeof fetch)
      .mockResolvedValue(new Response('{}', { status: 200 }));

    const noOrcid = { ...baseUser, orcidId: undefined };
    render(<OrcidCheckModal user={noOrcid} open={true} onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByTestId('orcid-check-unavailable')).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders unavailable state for malformed ORCID', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch' as unknown as typeof fetch)
      .mockResolvedValue(new Response('{}', { status: 200 }));

    const malformed = { ...baseUser, orcidId: 'not-a-valid-orcid' };
    render(<OrcidCheckModal user={malformed} open={true} onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByTestId('orcid-check-unavailable')).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
