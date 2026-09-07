import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublicationConfirmation } from '../../../../src/features/publication/admin/PublicationConfirmation';

describe('Publication confirmation incident guards', () => {
  it('portals outside transformed page containers and displays mutation errors', () => {
    const { container } = render(<div style={{ transform: 'translateY(0)' }}><PublicationConfirmation title="Publish" message="Confirm publication" busy={false} error="The backend rejected this change." onClose={vi.fn()} onConfirm={vi.fn()} /></div>);
    const dialog = screen.getByRole('dialog', { name: 'Publish' });
    expect(container.contains(dialog)).toBe(false);
    expect(document.body.contains(dialog)).toBe(true);
    expect(screen.getByRole('alert')).toHaveTextContent('The backend rejected this change.');
  });

  it('blocks repeat confirmation and dismissal during an active mutation', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<PublicationConfirmation title="Publish" message="Confirm publication" busy error="" onClose={onClose} onConfirm={onConfirm} />);
    const dialog = screen.getByRole('dialog');
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
