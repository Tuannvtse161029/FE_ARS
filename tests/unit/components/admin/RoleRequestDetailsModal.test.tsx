/**
 * Component tests for src/pages/Admin/RoleRequestDetailsModal.tsx (Phase C: Admin).
 *
 * This modal is read-only. It must NOT contain any input / textarea / select
 * elements, and no Approve / Deny / Confirm buttons.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoleRequestDetailsModal } from '../../../../src/pages/Admin/RoleRequestDetailsModal';
import type { RoleRequest } from '../../../../src/types/admin';

const NOW = '2026-08-16T10:30:00Z';
const REQUEST: RoleRequest = {
  id: 1234,
  userId: 99,
  userName: 'Pham Test',
  email: 'test@example.com',
  phone: '+84 901 000 099',
  affiliation: 'VNU',
  department: 'CS',
  currentRoles: ['RESEARCHER'],
  requestedAdditionalRoles: ['REVIEWER'],
  requestType: 'ADDITIONAL_ROLE',
  proofDocumentUrl: 'https://example.com/proof.pdf',
  submissionDate: NOW,
  status: 'DENIED',
  notes: 'Proof document was a CV, not a research focus statement.',
};

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof RoleRequestDetailsModal>> = {},
) => {
  const onClose = vi.fn();
  const utils = render(
    <RoleRequestDetailsModal
      request={REQUEST}
      open
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onClose, ...utils };
};

describe('<RoleRequestDetailsModal>', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <RoleRequestDetailsModal
        request={REQUEST}
        open={false}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders nothing when request is null', () => {
    render(<RoleRequestDetailsModal request={null} open onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows all metadata in read-only form (no editable inputs/textareas/selects)', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(dialog).queryAllByRole('button', { name: /^(Approve|Deny|Confirm)/i })).toHaveLength(0);
    // Only Close button allowed (in the footer)
    expect(within(dialog).getByRole('button', { name: /^Close$/ })).toBeInTheDocument();

    // Spot check the metadata rendered
    expect(within(dialog).getByText(/Pham Test/)).toBeInTheDocument();
    expect(within(dialog).getByText(/test@example.com/)).toBeInTheDocument();
    expect(within(dialog).getByText(/VNU/)).toBeInTheDocument();
    expect(within(dialog).getByText(/RESEARCHER/)).toBeInTheDocument();
    expect(within(dialog).getByText(/REVIEWER/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Additional role/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Proof document was a CV/)).toBeInTheDocument();
  });

  it('Close button calls onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: /^Close$/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the status badge', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('DENIED')).toBeInTheDocument();
  });

  it('em-dash for missing optional fields (phone)', () => {
    const { phone, ...withoutPhone } = REQUEST;
    void phone;
    renderModal({ request: { ...withoutPhone, phone: undefined } });
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});