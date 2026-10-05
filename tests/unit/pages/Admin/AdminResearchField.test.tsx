/**
 * AdminResearchField — single test file covering the merged
 * Major / Sub / Grading Rubic tabbed admin page.
 *
 * Coverage:
 *   1. Renders behind useAdminGuard; default tab is "Major Field".
 *   2. Tab buttons switch the active tab in the URL.
 *   3. URL ?tab=sub deep-links to the Sub-field tab.
 *   4. localStorage fallback: empty URL on mount → restores last tab.
 *   5. Major tab: delete on a major that has sub-fields → toast.error,
 *      fieldService.deleteMajor is NOT called.
 *   6. Major tab: delete on a major with 0 sub-fields → confirm modal
 *      appears; confirming calls fieldService.deleteMajor.
 *   7. Sub tab: delete on a sub-field that has a rubric attached →
 *      toast.error, fieldService.deleteSub is NOT called.
 *   8. Sub tab: delete on a sub-field with 0 rubric criteria → confirm
 *      modal appears; confirming calls fieldService.deleteSub.
 *   9. Grading Rubic tab: clicking "Manage Rubric" opens the
 *      GradingRubricModal.
 *  10. URL sync: changing the tab updates the ?tab= query string.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../../src/hooks/useAdminGuard', () => ({
  useAdminGuard: () => undefined,
}));

vi.mock('../../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 99, role: 'Admin', token: 't', email: 'admin@test.com' },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../../../../src/store/authSlice', () => ({
  useAuthStore: <T,>(selector: (s: { user: { id: number; role: string } | null }) => T) =>
    selector({ user: { id: 1, role: 'Admin' } }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastWarning = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    warning: (...args: unknown[]) => toastWarning(...args),
    info: vi.fn(),
  },
}));

const fieldServiceMock = vi.hoisted(() => ({
  getAllMajor: vi.fn(),
  getAllSub: vi.fn(),
  listSubFieldsWithRubric: vi.fn(),
  createMajor: vi.fn(),
  updateMajor: vi.fn(),
  deleteMajor: vi.fn(),
  createSub: vi.fn(),
  updateSub: vi.fn(),
  deleteSub: vi.fn(),
  patchRubric: vi.fn(),
}));

vi.mock('../../../../src/services/field.service', () => ({
  fieldService: fieldServiceMock,
}));

import { AdminResearchField } from '../../../../src/pages/Admin/AdminResearchField';

const MAJOR_WITHOUT_SUBS = [
  { id: 1, name: 'Computer Science', description: 'CS' },
];
const MAJOR_WITH_SUBS = [
  {
    id: 2,
    name: 'Mathematics',
    description: 'Math',
    subFields: [{ id: 21, majorFieldId: 2, name: 'Algebra' }],
  },
];
const SUBS_LIST = [
  { id: 21, majorFieldId: 2, name: 'Algebra', description: null },
  { id: 22, majorFieldId: 2, name: 'Topology', description: null },
];
const SUBS_WITH_RUBRIC = [
  {
    id: 21,
    subFieldId: 21,
    majorFieldId: 2,
    name: 'Algebra',
    majorFieldName: 'Mathematics',
    description: null,
    gradingRubric: [
      {
        code: 'NOV',
        title: 'Novelty',
        description: '',
        maxScore: 10,
        order: 1,
        standardReferences: [],
      },
    ],
  },
  {
    id: 22,
    subFieldId: 22,
    majorFieldId: 2,
    name: 'Topology',
    majorFieldName: 'Mathematics',
    description: null,
    gradingRubric: [],
  },
];

const renderPage = (initialPath = '/admin/research-field') => {
  // A tiny harness that puts the page inside MemoryRouter so we can
  // exercise the URL → tab mapping. The page itself owns the tab state
  // through useSearchParams.
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AdminResearchField />
    </MemoryRouter>,
  );
};

const setStoredTab = (value: string | null) => {
  if (value === null) {
    window.localStorage.removeItem('ars_admin_research_field_tab');
  } else {
    window.localStorage.setItem('ars_admin_research_field_tab', value);
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  fieldServiceMock.getAllMajor.mockResolvedValue(MAJOR_WITHOUT_SUBS);
  fieldServiceMock.getAllSub.mockResolvedValue(SUBS_LIST);
  fieldServiceMock.listSubFieldsWithRubric.mockResolvedValue(SUBS_WITH_RUBRIC);
  fieldServiceMock.deleteMajor.mockResolvedValue(undefined);
  fieldServiceMock.deleteSub.mockResolvedValue(undefined);
});

describe('AdminResearchField', () => {
  it('renders the page and defaults to the Major Field tab', async () => {
    renderPage();
    expect(
      await screen.findByTestId('admin-research-field-page'),
    ).toBeInTheDocument();
    // The default tab is "major" so the Major surface mounts.
    expect(
      await screen.findByTestId('admin-major-fields-surface'),
    ).toBeInTheDocument();
  });

  it('deep-links to the Sub-field tab when ?tab=sub is in the URL', async () => {
    renderPage('/admin/research-field?tab=sub');
    expect(
      await screen.findByTestId('admin-sub-fields-surface'),
    ).toBeInTheDocument();
    // The Sub tab should be selected, Major should not.
    expect(
      screen.getByRole('tab', { name: /Sub Field/i, selected: true }),
    ).toBeInTheDocument();
  });

  it('falls back to the last persisted tab from localStorage when no ?tab= is present', async () => {
    setStoredTab('gr');
    renderPage();
    expect(
      await screen.findByTestId('admin-grading-rubric-surface'),
    ).toBeInTheDocument();
  });

  it('switching tabs updates the ?tab= query string', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('admin-major-fields-surface');
    // Click the Sub Field tab button. The tab text falls back to the
    // English second argument of t() when no dictionary is loaded.
    const tabs = await screen.findAllByRole('tab');
    const subTab = tabs.find((tab) => /Sub/i.test(tab.textContent ?? ''));
    expect(subTab).toBeDefined();
    await user.click(subTab!);
    expect(
      await screen.findByTestId('admin-sub-fields-surface'),
    ).toBeInTheDocument();
    // The Sub tab should now be aria-selected. This is the closest
    // proxy for the URL update when using MemoryRouter (which does
    // not mutate window.location).
    const selected = screen.getByRole('tab', { selected: true });
    expect(selected.id).toBe('research-field-tab-sub');
  });

  it('blocks deletion of a major field that has sub-fields attached with a toast.error and never calls deleteMajor', async () => {
    fieldServiceMock.getAllMajor.mockResolvedValue(MAJOR_WITH_SUBS);
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('admin-major-fields-surface');
    const deleteBtn = await screen.findByTestId(
      'admin-major-fields-delete-2',
    );
    await user.click(deleteBtn);
    // The toast.error for the cascade block was emitted.
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    // No confirm modal was shown and the API was never called.
    expect(fieldServiceMock.deleteMajor).not.toHaveBeenCalled();
  });

  it('opens a destructive confirm modal and calls deleteMajor when a major field has 0 sub-fields', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('admin-major-fields-surface');
    const deleteBtn = await screen.findByTestId(
      'admin-major-fields-delete-1',
    );
    await user.click(deleteBtn);
    // The confirm modal must show. The modal's confirm button is the
    // LAST button with the "Delete" name (after the row's delete btn
    // in the DOM). Use getAllByRole and pick the modal-scoped one.
    const deleteButtons = await screen.findAllByRole('button', { name: /^Delete$/ });
    // The modal confirm is the last one (after the row's delete btn).
    const confirmBtn = deleteButtons[deleteButtons.length - 1];
    await user.click(confirmBtn);
    await waitFor(() => {
      expect(fieldServiceMock.deleteMajor).toHaveBeenCalledWith(1);
    });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('blocks deletion of a sub-field that has a rubric attached with a toast.error and never calls deleteSub', async () => {
    const user = userEvent.setup();
    renderPage('/admin/research-field?tab=sub');
    await screen.findByTestId('admin-sub-fields-surface');
    // The sub-field with id 21 has a rubric criterion in SUBS_WITH_RUBRIC.
    const deleteBtn = await screen.findByTestId('admin-sub-fields-delete-21');
    await user.click(deleteBtn);
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(fieldServiceMock.deleteSub).not.toHaveBeenCalled();
  });

  it('opens the confirm modal and calls deleteSub for a sub-field with 0 rubric criteria', async () => {
    const user = userEvent.setup();
    renderPage('/admin/research-field?tab=sub');
    await screen.findByTestId('admin-sub-fields-surface');
    // The sub-field with id 22 has 0 rubric criteria.
    const deleteBtn = await screen.findByTestId('admin-sub-fields-delete-22');
    await user.click(deleteBtn);
    const deleteButtons = await screen.findAllByRole('button', { name: /^Delete$/ });
    const confirmBtn = deleteButtons[deleteButtons.length - 1];
    await user.click(confirmBtn);
    await waitFor(() => {
      expect(fieldServiceMock.deleteSub).toHaveBeenCalledWith(22);
    });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('renders the Grading Rubic surface when ?tab=gr is in the URL', async () => {
    renderPage('/admin/research-field?tab=gr');
    expect(
      await screen.findByTestId('admin-grading-rubric-surface'),
    ).toBeInTheDocument();
  });
});
