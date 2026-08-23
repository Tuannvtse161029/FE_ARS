import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ProfessionalProfile } from '../../../src/pages/Reviewer/ProfessionalProfile';
import { RoleRouteGuard } from '../../../src/routes/RoleRouteGuard';
import { ROUTES } from '../../../src/routes/paths';

const mocks = vi.hoisted(() => ({
  profiles: [] as Array<{
    userId: number;
    orcidId: string | null;
    hindex: number | null;
    totalCitations: number | null;
    publicationCount: number | null;
    syncStatus: string | null;
    majorFieldId: number | null;
    subFieldId: number | null;
    reviewFee: number | null;
    updatedAt: string;
    isAvailable: boolean;
  }>,
  auth: { user: { userId: 42, role: 'Reviewer', username: 'reviewer.name', email: 'reviewer@example.com' }, isAuthenticated: true },
  update: vi.fn(),
  getById: vi.fn(),
  getAllMajor: vi.fn(),
  getAllSub: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../../../src/hooks/useReviewerProfiles', () => ({
  useReviewerProfiles: () => ({ profiles: mocks.profiles, isLoading: false, error: null, refetch: mocks.refetch }),
  useReviewerAvailability: () => ({ isAvailable: true, isLoading: false, error: null, refetch: mocks.refetch }),
}));

vi.mock('../../../src/services/reviewer.service', () => ({ reviewerService: { update: mocks.update } }));

vi.mock('../../../src/services/user.service', () => ({
  userService: { getById: mocks.getById },
}));

vi.mock('../../../src/services/field.service', () => ({
  fieldService: { getAllMajor: mocks.getAllMajor, getAllSub: mocks.getAllSub },
}));

const profile = (overrides: Partial<(typeof mocks.profiles)[number]> = {}) => ({
  userId: 42,
  orcidId: '0000-0002-1825-0097',
  hindex: 12,
  totalCitations: 345,
  publicationCount: 27,
  syncStatus: 'Synced',
  majorFieldId: 4,
  subFieldId: 9,
  reviewFee: 10000,
  updatedAt: '2026-08-19T10:00:00Z',
  isAvailable: true,
  ...overrides,
});

const renderPage = () => render(
  <MemoryRouter initialEntries={[ROUTES.PROFESSIONAL_PROFILE]}>
    <ProfessionalProfile />
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profiles = [profile(), profile({ userId: 7, orcidId: 'wrong', reviewFee: 1 })];
  mocks.auth.user = { userId: 42, role: 'Reviewer', username: 'reviewer.name', email: 'reviewer@example.com' };
  mocks.auth.isAuthenticated = true;
  mocks.update.mockResolvedValue(profile({ reviewFee: 25000 }));
  mocks.refetch.mockResolvedValue(undefined);
  mocks.getById.mockResolvedValue({ id: 42, fullName: 'Dr. Reviewer Name', email: 'reviewer@example.com' });
  mocks.getAllMajor.mockResolvedValue([{ id: 4, name: 'Computer Science' }]);
  mocks.getAllSub.mockResolvedValue([{ id: 9, majorFieldId: 4, name: 'Artificial Intelligence' }]);
});

describe('Reviewer Professional Profile — five vital contracts', () => {
  it('selects the profile matching the authenticated reviewer, not the first API row', async () => {
    mocks.profiles = [profile({ userId: 7, orcidId: 'first-profile' }), profile({ userId: 42, orcidId: 'authenticated-profile' })];
    renderPage();
    expect(await screen.findByText('authenticated-profile')).toBeInTheDocument();
    expect(screen.queryByText('first-profile')).not.toBeInTheDocument();
  });

  it('sends the exact fee-only PUT body using the authenticated ID and refetches after success', async () => {
    renderPage();
    const input = await screen.findByTestId('review-fee-input');
    fireEvent.change(input, { target: { value: '25000' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(42, { reviewFee: 25000 }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it('saves reviewer expertise with the authenticated profile userId', async () => {
    mocks.profiles = [profile({ majorFieldId: null, subFieldId: null })];
    renderPage();

    const majorSelect = await screen.findByTestId('major-field-select');
    fireEvent.change(majorSelect, { target: { value: '4' } });

    const subSelect = await screen.findByTestId('sub-field-select');
    await waitFor(() => expect(subSelect).toHaveTextContent('Artificial Intelligence'));
    fireEvent.change(subSelect, { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('save-expertise-button'));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(42, {
      userId: 42,
      majorFieldId: 4,
      subFieldId: 9,
    }));
  });

  it('keeps admin-managed metrics read-only and absent from the fee mutation payload', () => {
    renderPage();
    expect(screen.getByTestId('academic-metrics-section').querySelector('input')).toBeNull();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('restores the server fee when the fee update fails', async () => {
    mocks.update.mockRejectedValueOnce(new Error('Update rejected'));
    renderPage();
    const input = await screen.findByTestId('review-fee-input');
    fireEvent.change(input, { target: { value: '25000' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    await waitFor(() => expect(input).toHaveValue('10000'));
    expect(screen.getByRole('alert')).toHaveTextContent('Update rejected');
  });

  it('redirects non-Reviewer roles away from the protected professional profile route', () => {
    mocks.auth.user = { userId: 99, role: 'Researcher', username: 'researcher', email: 'researcher@example.com' };
    mocks.auth.isAuthenticated = true;
    const Location = () => {
      const location = useLocation();
      return <div data-testid="current-location">{location.pathname}</div>;
    };
    render(
      <MemoryRouter initialEntries={[ROUTES.PROFESSIONAL_PROFILE]}>
        <Routes>
          <Route element={<RoleRouteGuard allow={['Reviewer']} />}>
            <Route path={ROUTES.PROFESSIONAL_PROFILE} element={<ProfessionalProfile />} />
          </Route>
          <Route path={ROUTES.FORUM} element={<Location />} />
          <Route path="*" element={<Navigate to={ROUTES.FORUM} replace />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('current-location')).toHaveTextContent(ROUTES.FORUM);
  });
});

