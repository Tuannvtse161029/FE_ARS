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
    updatedAt: string;
    isAvailable: boolean;
  }>,
  auth: {
    user: { userId: 42, role: 'Reviewer' as string | null, username: 'reviewer.name', email: 'reviewer@example.com' },
    isAuthenticated: true,
  },
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
  updatedAt: '2026-08-19T10:00:00Z',
  isAvailable: true,
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[ROUTES.PROFESSIONAL_PROFILE]}>
      <ProfessionalProfile />
    </MemoryRouter>,
  );

const setAuthRole = (role: string | null, userId: number = 42) => {
  mocks.auth.user = {
    userId,
    role,
    username: `${role ?? 'user'}.name`,
    email: `${role ?? 'user'}@example.com`,
  } as typeof mocks.auth.user;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profiles = [profile(), profile({ userId: 7, orcidId: 'wrong' })];
  setAuthRole('Reviewer');
  mocks.auth.isAuthenticated = true;
  mocks.refetch.mockResolvedValue(undefined);
  mocks.getById.mockResolvedValue({ id: 42, fullName: 'Dr. Reviewer Name', email: 'reviewer@example.com' });
  mocks.getAllMajor.mockResolvedValue([{ id: 4, name: 'Computer Science' }]);
  mocks.getAllSub.mockResolvedValue([{ id: 9, majorFieldId: 4, name: 'Artificial Intelligence' }]);
});

describe('Reviewer Professional Profile — five vital contracts', () => {
  it('selects the profile matching the authenticated reviewer, not the first API row', async () => {
    mocks.profiles = [
      profile({ userId: 7, orcidId: 'first-profile' }),
      profile({ userId: 42, orcidId: 'authenticated-profile' }),
    ];
    renderPage();
    expect(await screen.findByText('authenticated-profile')).toBeInTheDocument();
    expect(screen.queryByText('first-profile')).not.toBeInTheDocument();
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

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(42, {
        userId: 42,
        majorFieldId: 4,
        subFieldId: 9,
      }),
    );
  });

  it('keeps admin-managed metrics read-only', () => {
    renderPage();
    expect(screen.getByTestId('academic-metrics-section').querySelector('input')).toBeNull();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe('Professional Profile — role-aware surface (Researcher / Reviewer / Lecturer)', () => {
  it('lets a Reviewer see Availability + Academic Metrics + expertise', () => {
    setAuthRole('Reviewer');
    renderPage();
    // Reviewer keeps every section. Use getAllByText so we don't trip on
    // the page subtitle ("Manage your reviewer availability and...") which
    // ALSO contains the word "availability" — we only care that the dl row
    // label is present.
    expect(screen.getByText('ORCID')).toBeInTheDocument();
    expect(screen.getAllByText(/Availability/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('academic-metrics-section')).toBeInTheDocument();
    expect(screen.getByTestId('research-expertise-section')).toBeInTheDocument();
    expect(screen.getByTestId('professional-profile-role-badge')).toHaveTextContent('Reviewer');
    expect(screen.getByTestId('professional-profile-eyebrow')).toHaveTextContent('REVIEWER WORKSPACE');
  });

  it('lets a Researcher see Academic Metrics + expertise but hides Availability', () => {
    setAuthRole('Researcher');
    mocks.getById.mockResolvedValue({ id: 42, fullName: 'Dr. Researcher Name', email: 'researcher@example.com' });
    renderPage();
    // Availability row should NOT render for a researcher. We anchor the
    // regex so the page subtitle (which never mentions "Availability" for
    // a Researcher) and the Researcher's own eyebrow ("RESEARCHER
    // WORKSPACE") don't accidentally match.
    expect(screen.queryByText('Availability')).not.toBeInTheDocument();
    // Academic metrics still apply to researchers.
    expect(screen.getByTestId('academic-metrics-section')).toBeInTheDocument();
    // Research expertise still applies to researchers.
    expect(screen.getByTestId('research-expertise-section')).toBeInTheDocument();
    expect(screen.getByTestId('professional-profile-role-badge')).toHaveTextContent('Researcher');
    expect(screen.getByTestId('professional-profile-eyebrow')).toHaveTextContent('RESEARCHER WORKSPACE');
  });

  it('lets a Lecturer see only the research-expertise section (no Availability, no Academic Metrics)', () => {
    setAuthRole('Lecturer');
    mocks.getById.mockResolvedValue({ id: 42, fullName: 'Dr. Lecturer Name', email: 'lecturer@example.com' });
    renderPage();
    // Availability row hidden for lecturer.
    expect(screen.queryByText('Availability')).not.toBeInTheDocument();
    // Academic Metrics hidden for lecturer.
    expect(screen.queryByTestId('academic-metrics-section')).not.toBeInTheDocument();
    // Research expertise remains for lecturer.
    expect(screen.getByTestId('research-expertise-section')).toBeInTheDocument();
    expect(screen.getByTestId('professional-profile-role-badge')).toHaveTextContent('Lecturer');
    expect(screen.getByTestId('professional-profile-eyebrow')).toHaveTextContent('LECTURER WORKSPACE');
  });

  it('saves expertise on behalf of a Researcher the same way as a Reviewer', async () => {
    setAuthRole('Researcher', 99);
    mocks.profiles = [profile({ userId: 99, majorFieldId: null, subFieldId: null })];
    renderPage();

    const majorSelect = await screen.findByTestId('major-field-select');
    fireEvent.change(majorSelect, { target: { value: '4' } });

    const subSelect = await screen.findByTestId('sub-field-select');
    await waitFor(() => expect(subSelect).toHaveTextContent('Artificial Intelligence'));
    fireEvent.change(subSelect, { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('save-expertise-button'));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(99, {
        userId: 99,
        majorFieldId: 4,
        subFieldId: 9,
      }),
    );
  });

  it('saves expertise on behalf of a Lecturer the same way as a Reviewer', async () => {
    setAuthRole('Lecturer', 77);
    mocks.profiles = [profile({ userId: 77, majorFieldId: null, subFieldId: null })];
    mocks.getById.mockResolvedValue({ id: 77, fullName: 'Dr. Lecturer Name', email: 'lecturer@example.com' });
    renderPage();

    const majorSelect = await screen.findByTestId('major-field-select');
    fireEvent.change(majorSelect, { target: { value: '4' } });

    const subSelect = await screen.findByTestId('sub-field-select');
    await waitFor(() => expect(subSelect).toHaveTextContent('Artificial Intelligence'));
    fireEvent.change(subSelect, { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('save-expertise-button'));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(77, {
        userId: 77,
        majorFieldId: 4,
        subFieldId: 9,
      }),
    );
  });
});

describe('Professional Profile — route guard expansion', () => {
  const Location = () => {
    const location = useLocation();
    return <div data-testid="current-location">{location.pathname}</div>;
  };

  const renderGuardedRoute = () =>
    render(
      <MemoryRouter initialEntries={[ROUTES.PROFESSIONAL_PROFILE]}>
        <Routes>
          <Route
            element={<RoleRouteGuard allow={['Researcher', 'Reviewer', 'Lecturer']} />}
          >
            <Route path={ROUTES.PROFESSIONAL_PROFILE} element={<ProfessionalProfile />} />
          </Route>
          <Route path={ROUTES.FORUM} element={<Location />} />
          <Route path="*" element={<Navigate to={ROUTES.FORUM} replace />} />
        </Routes>
      </MemoryRouter>,
    );

  it('lets a Researcher through to the Professional Profile page', () => {
    setAuthRole('Researcher');
    renderGuardedRoute();
    // The page renders the role badge, which only appears inside the
    // mounted page — i.e. the guard let the Researcher in.
    expect(screen.getByTestId('professional-profile-role-badge')).toHaveTextContent('Researcher');
  });

  it('lets a Lecturer through to the Professional Profile page', () => {
    setAuthRole('Lecturer');
    renderGuardedRoute();
    expect(screen.getByTestId('professional-profile-role-badge')).toHaveTextContent('Lecturer');
  });

  it('still redirects unsupported roles (e.g. Graduate Student) to /forum', () => {
    setAuthRole('Graduate Student');
    renderGuardedRoute();
    expect(screen.getByTestId('current-location')).toHaveTextContent(ROUTES.FORUM);
  });
});
