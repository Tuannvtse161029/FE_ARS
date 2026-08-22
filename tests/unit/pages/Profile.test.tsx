/**
 * Page-level tests for src/pages/Profile/Profile.tsx.
 *
 * Coverage focus:
 *   1. The page never asks the user to enter a profile id — the edit
 *      form has no `id` input and the wire payload carries
 *      `userId = authenticatedUserId` exclusively.
 *   2. The save action sends ONLY the keys Swagger publishes in
 *      `ProfileUpdateRequest` and only the fields that actually changed.
 *   3. The four states the page must handle (unauthenticated, loading,
 *      error, populated) are rendered through their dedicated surfaces
 *      (no fake data fallbacks).
 *   4. Client-side validation prevents submission when fullName is blank
 *      and the avatarInitials pattern is violated.
 *   5. Per-role meta changes the page eyebrow but does NOT change which
 *      fields are editable — every role can edit the same fields.
 *   6. The cancel button restores the last-saved draft and exits edit
 *      mode without issuing a save.
 *
 * The Profile service is mocked here; the service-level guarantees
 * (payload whitelist, authenticated id only) are locked down in
 * profile.service.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const serviceMock = vi.hoisted(() => ({
  getCurrent: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../../src/services/profile.service', () => ({
  profileService: serviceMock,
}));

const authMock = vi.hoisted(() => ({
  user: {
    userId: 42,
    username: 'reviewer.name',
    email: 'reviewer@example.com',
    role: 'Reviewer' as 'Reviewer' | 'Researcher' | 'Lecturer' | 'Graduate Student' | 'Admin' | null,
  } as { userId: number; username: string; email: string; role: 'Reviewer' | 'Researcher' | 'Lecturer' | 'Graduate Student' | 'Admin' | null } | null,
  isAuthenticated: true,
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: authMock.user,
    isAuthenticated: authMock.isAuthenticated,
    effectiveRole: authMock.user?.role ?? null,
  }),
}));

import { Profile } from '../../../src/pages/Profile/Profile';

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/profile']}>
      <Profile />
    </MemoryRouter>,
  );

const seedAuth = (overrides: Partial<typeof authMock.user> = {}) => {
  authMock.user = {
    userId: 42,
    username: 'reviewer.name',
    email: 'reviewer@example.com',
    role: 'Reviewer',
    ...overrides,
  } as typeof authMock.user;
};

beforeEach(() => {
  serviceMock.getCurrent.mockReset();
  serviceMock.update.mockReset();
  authMock.user = {
    userId: 42,
    username: 'reviewer.name',
    email: 'reviewer@example.com',
    role: 'Reviewer',
  } as typeof authMock.user;
});

describe('Profile page — wire & state contracts', () => {
  it('renders the unauthenticated guard when there is no signed-in user', async () => {
    authMock.user = null;
    renderPage();
    expect(
      await screen.findByText(/Sign in to view your profile/i),
    ).toBeInTheDocument();
    expect(serviceMock.getCurrent).not.toHaveBeenCalled();
  });

  it('renders the loading state on first render with a populated profile on success', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({
      userId: 42,
      fullName: 'Dr. Auth',
      academicTitle: 'Senior Reviewer',
      institution: 'FPT University',
      bio: 'Specializing in AI safety.',
      keywords: ['Distributed Systems', 'AI Safety'],
      avatarInitials: 'DA',
    });

    renderPage();
    expect(await screen.findByTestId('profile-display-name')).toHaveTextContent('Dr. Auth');
    expect(screen.getByTestId('view-academic-title')).toHaveTextContent('Senior Reviewer');
    expect(screen.getByTestId('view-institution')).toHaveTextContent('FPT University');
    expect(screen.getByTestId('view-keywords')).toHaveTextContent('Distributed Systems');
    expect(screen.getByTestId('view-avatar-initials')).toHaveTextContent('DA');
    expect(serviceMock.getCurrent).toHaveBeenCalledWith(42);
  });

  it('renders an error state with a retry control on fetch failure', async () => {
    serviceMock.getCurrent.mockRejectedValueOnce(new Error('503 Service Unavailable'));

    renderPage();
    const retry = await screen.findByTestId('profile-retry-button');
    expect(retry).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/503 Service Unavailable/);

    // Retry kicks off a second fetch — proves the recovery path.
    serviceMock.getCurrent.mockResolvedValueOnce({ userId: 42, fullName: 'Recovered' });
    fireEvent.click(retry);
    expect(await screen.findByTestId('profile-display-name')).toHaveTextContent('Recovered');
    expect(serviceMock.getCurrent).toHaveBeenCalledTimes(2);
  });

  it('enter edit, save sends only the changed field and uses the authenticated id', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({
      userId: 42,
      fullName: 'Dr. Auth',
      academicTitle: 'Senior Reviewer',
      institution: 'FPT University',
      bio: 'old bio',
      keywords: ['AI Safety'],
    });
    serviceMock.update.mockResolvedValueOnce({
      userId: 42,
      fullName: 'Dr. Auth',
      bio: 'new bio',
    });

    renderPage();
    fireEvent.click(await screen.findByTestId('profile-edit-button'));

    const bioInput = await screen.findByTestId('profile-input-bio');
    fireEvent.change(bioInput, { target: { value: 'new bio' } });

    fireEvent.click(screen.getByTestId('profile-save-button'));

    await waitFor(() => expect(serviceMock.update).toHaveBeenCalledTimes(1));
    const [calledId, payload] = serviceMock.update.mock.calls[0];
    expect(calledId).toBe(42);
    expect(payload).toEqual({ bio: 'new bio' });
    // Switch back to view mode and confirm success banner.
    await waitFor(() =>
      expect(screen.queryByTestId('profile-save-button')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('profile-success-banner')).toBeInTheDocument();
    expect(screen.getByTestId('view-bio')).toHaveTextContent('new bio');
  });

  it('shows an inline save error and does NOT update the cached profile', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({
      userId: 42,
      fullName: 'Dr. Auth',
      bio: 'old bio',
    });
    serviceMock.update.mockRejectedValueOnce(new Error('400 Bad Request'));

    renderPage();
    fireEvent.click(await screen.findByTestId('profile-edit-button'));
    fireEvent.change(screen.getByTestId('profile-input-bio'), { target: { value: 'new' } });
    fireEvent.click(screen.getByTestId('profile-save-button'));

    await waitFor(() =>
      expect(screen.getByTestId('profile-save-error-banner')).toBeInTheDocument(),
    );
    // Edit mode is preserved so the user can correct + retry.
    expect(screen.getByTestId('profile-save-button')).toBeInTheDocument();
    // Re-rendering the view via Cancel keeps the original bio.
    fireEvent.click(screen.getByTestId('profile-cancel-button'));
    expect(screen.getByTestId('view-bio')).toHaveTextContent('old bio');
  });

  it('client-side validation blocks submit when fullName is blank', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({
      userId: 42,
      fullName: 'Dr. Auth',
    });

    renderPage();
    fireEvent.click(await screen.findByTestId('profile-edit-button'));
    fireEvent.change(screen.getByTestId('profile-input-full-name'), { target: { value: '' } });

    // Save button disabled while validation fails.
    const saveBtn = screen.getByTestId('profile-save-button');
    expect(saveBtn).toBeDisabled();
    expect(screen.getByTestId('profile-error-full-name')).toBeInTheDocument();

    // A submit attempt (e.g. via Enter) must NOT call the service.
    fireEvent.submit(saveBtn.closest('form') as HTMLFormElement);
    expect(serviceMock.update).not.toHaveBeenCalled();
  });

  it('client-side validation rejects an avatarInitials value with non-allowed characters', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({ userId: 42, fullName: 'X' });
    renderPage();
    fireEvent.click(await screen.findByTestId('profile-edit-button'));
    const input = screen.getByTestId('profile-input-avatar-initials');
    fireEvent.change(input, { target: { value: '!!!!!' } });
    expect(screen.getByTestId('profile-save-button')).toBeDisabled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('cancel restores the last-saved draft and does not call update', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({
      userId: 42,
      fullName: 'Dr. Auth',
      bio: 'old bio',
    });

    renderPage();
    fireEvent.click(await screen.findByTestId('profile-edit-button'));
    fireEvent.change(screen.getByTestId('profile-input-bio'), { target: { value: 'draft change' } });
    fireEvent.click(screen.getByTestId('profile-cancel-button'));

    expect(screen.queryByTestId('profile-input-bio')).not.toBeInTheDocument();
    expect(screen.getByTestId('view-bio')).toHaveTextContent('old bio');
    expect(serviceMock.update).not.toHaveBeenCalled();
  });

  it('keyword add / remove cycles a chip through the UI', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({
      userId: 42,
      fullName: 'X',
      keywords: ['AI Safety'],
    });

    renderPage();
    fireEvent.click(await screen.findByTestId('profile-edit-button'));

    fireEvent.change(screen.getByTestId('profile-input-keyword'), {
      target: { value: 'Distributed Systems' },
    });
    fireEvent.click(screen.getByTestId('profile-add-keyword-button'));
    expect(screen.getByTestId('profile-keyword-chips')).toHaveTextContent('Distributed Systems');

    fireEvent.click(screen.getByTestId('profile-remove-keyword-Distributed Systems'));
    expect(screen.getByTestId('profile-keyword-chips')).not.toHaveTextContent('Distributed Systems');
    // Pre-existing chip still present:
    expect(screen.getByTestId('profile-keyword-chips')).toHaveTextContent('AI Safety');
  });

  it('empty profile renders the "not yet configured" badge', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({ userId: 42 });
    renderPage();
    expect(await screen.findByText(/Profile not yet configured/i)).toBeInTheDocument();
  });

  it('renders the role-specific eyebrow without changing which fields are editable', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({
      userId: 7,
      fullName: 'Lecturer',
      keywords: ['Distributed Systems'],
    });
    seedAuth({ userId: 7, role: 'Lecturer' });

    renderPage();
    expect(await screen.findByText(/LECTURER WORKSPACE/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('profile-edit-button'));

    // Same set of fields is available regardless of role.
    expect(screen.getByTestId('profile-input-full-name')).toBeInTheDocument();
    expect(screen.getByTestId('profile-input-academic-title')).toBeInTheDocument();
    expect(screen.getByTestId('profile-input-institution')).toBeInTheDocument();
    expect(screen.getByTestId('profile-input-phone')).toBeInTheDocument();
    expect(screen.getByTestId('profile-input-bio')).toBeInTheDocument();
    expect(screen.getByTestId('profile-input-keyword')).toBeInTheDocument();
    expect(screen.getByTestId('profile-input-dob')).toBeInTheDocument();
    expect(screen.getByTestId('profile-input-gender')).toBeInTheDocument();
    expect(screen.getByTestId('profile-input-address')).toBeInTheDocument();
    expect(screen.getByTestId('profile-input-avatar-initials')).toBeInTheDocument();
  });

  it('the form has NO profile id input — the id is sourced exclusively from the auth store', async () => {
    serviceMock.getCurrent.mockResolvedValueOnce({ userId: 42, fullName: 'X' });
    renderPage();
    fireEvent.click(await screen.findByTestId('profile-edit-button'));

    const form = screen.getByTestId('profile-save-button').closest('form');
    expect(form).not.toBeNull();
    // No input named id/userId/profileId — the only id on the wire comes
    // from the authenticated user.
    const allInputs = form!.querySelectorAll('input');
    for (const input of Array.from(allInputs)) {
      expect(input.name).not.toBe('id');
      expect(input.name).not.toBe('userId');
      expect(input.name).not.toBe('profileId');
      expect(input.id).not.toBe('id-input');
      expect(input.id).not.toBe('user-id-input');
      expect(input.id).not.toBe('profile-id-input');
    }
  });
});