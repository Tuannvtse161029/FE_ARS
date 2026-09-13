import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvatarPickerModal } from '../../../src/components/profile/AvatarPickerModal';

const uploadImage = vi.fn();

vi.mock('../../../src/hooks/useImageUpload', () => ({
  useImageUpload: () => ({
    uploadImage,
    progress: 0,
    isUploading: false,
    error: null,
    imageUrl: null,
    resetUpload: vi.fn(),
  }),
}));

describe('AvatarPickerModal', () => {
  it('saves a selected bundled research symbol as a generated image URL', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <AvatarPickerModal
        isOpen
        userId={42}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'atom' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toBe('lucide:atom');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('rejects an unsupported upload before calling Firebase upload', async () => {
    const onSave = vi.fn();

    render(
      <AvatarPickerModal
        isOpen
        userId={42}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /upload photo/i }));
    const input = screen.getByLabelText(/choose image/i);
    fireEvent.change(input, {
      target: {
        files: [new File(['not-an-image'], 'notes.txt', { type: 'text/plain' })],
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/JPEG, PNG, GIF, or WebP/i);
    expect(uploadImage).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
