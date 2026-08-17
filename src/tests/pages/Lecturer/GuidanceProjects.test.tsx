/**
 * Component-level tests for src/pages/Lecturer/GuidanceProjects.tsx.
 *
 * Phase C, contract §3.1 / L1. Covers:
 *   - Empty state from useGuidanceProjects returning []
 *   - Client-side lecturer filter (BE has no ?lecturerId= on GuidanceProject)
 *   - Status filter pill (ONGOING)
 *   - Search by title
 *   - Search by student id (BE has no student name echo)
 *   - Cancel / Complete buttons gated by status
 *   - Create Proposal modal calls api.post(/api/GuidanceProject)
 *   - 409 invalid-transition error surfaces verbatim
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { GuidanceProjects } from '../../../pages/Lecturer/GuidanceProjects';
import { buildMockAuth } from '../../utils/mockAuth';

const {
  getAllGuidanceProjectsMock,
  postMock,
  putMock,
  getJoinedGroupsForStudentMock,
} = vi.hoisted(() => ({
  getAllGuidanceProjectsMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
  getJoinedGroupsForStudentMock: vi.fn(),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => buildMockAuth({ role: 'Lecturer', userId: 7 }),
}));

// The GuidanceProjects page imports useAuth from context/AuthContext.
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => buildMockAuth({ role: 'Lecturer', userId: 7 }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  default: {},
}));

vi.mock('../../../services/axios', () => ({
  default: {
    get: vi.fn(),
    post: postMock,
    put: putMock,
    delete: vi.fn(),
  },
}));

vi.mock('../../../services/guidanceProject.service', () => ({
  getAllGuidanceProjects: getAllGuidanceProjectsMock,
}));

vi.mock('../../../services/groupMembership.service', () => ({
  getJoinedGroupsForStudent: getJoinedGroupsForStudentMock,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <GuidanceProjects />
    </MemoryRouter>,
  );

describe('<GuidanceProjects> page', () => {
  beforeEach(() => {
    getAllGuidanceProjectsMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    getJoinedGroupsForStudentMock.mockReset();
    getJoinedGroupsForStudentMock.mockResolvedValue([]);
    postMock.mockResolvedValue({ data: { id: 999, title: 'Stub' } });
    putMock.mockResolvedValue({ data: {} });
  });

  it('renders empty state when useGuidanceProjects returns []', async () => {
    getAllGuidanceProjectsMock.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText(/haven't created any guidance projects yet/),
      ).toBeInTheDocument(),
    );
  });

  it('lists only rows where lecturerId === currentUserId (client-side filter)', async () => {
    getAllGuidanceProjectsMock.mockResolvedValueOnce([
      {
        id: 1,
        lecturerId: 7,
        studentId: 9,
        title: 'Mine',
        status: 'ONGOING',
      },
      {
        id: 2,
        lecturerId: 8,
        studentId: 9,
        title: 'Other lecturer',
        status: 'ONGOING',
      },
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText(/Mine/)).toBeInTheDocument());
    expect(screen.queryByText(/Other lecturer/)).not.toBeInTheDocument();
  });

  it('status filter pill "ONGOING" hides non-ONGOING rows', async () => {
    getAllGuidanceProjectsMock.mockResolvedValueOnce([
      { id: 1, lecturerId: 7, studentId: 9, title: 'A-ONGOING', status: 'ONGOING' },
      { id: 2, lecturerId: 7, studentId: 9, title: 'B-PROPOSED', status: 'PROPOSED' },
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText(/A-ONGOING/)).toBeInTheDocument());
    await userEvent.setup().click(screen.getByRole('tab', { name: /Ongoing/i }));
    await waitFor(() => expect(screen.queryByText(/B-PROPOSED/)).not.toBeInTheDocument());
    expect(screen.getByText(/A-ONGOING/)).toBeInTheDocument();
  });

  it('search box filters by title', async () => {
    getAllGuidanceProjectsMock.mockResolvedValueOnce([
      { id: 1, lecturerId: 7, studentId: 9, title: 'Speech to Text', status: 'ONGOING' },
      { id: 2, lecturerId: 7, studentId: 9, title: 'Translation', status: 'ONGOING' },
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText(/Speech to Text/)).toBeInTheDocument());
    const search = screen.getByLabelText(/Search guidance projects/i);
    await userEvent.setup().type(search, 'Translation');
    await waitFor(() => expect(screen.queryByText(/Speech to Text/)).not.toBeInTheDocument());
    expect(screen.getByText(/Translation/)).toBeInTheDocument();
  });

  it('search box filters by student id (studentId-based fallback)', async () => {
    getAllGuidanceProjectsMock.mockResolvedValueOnce([
      { id: 1, lecturerId: 7, studentId: 42, title: 'Alpha', status: 'ONGOING' },
      { id: 2, lecturerId: 7, studentId: 99, title: 'Beta', status: 'ONGOING' },
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText(/Alpha/)).toBeInTheDocument());
    const search = screen.getByLabelText(/Search guidance projects/i);
    await userEvent.setup().type(search, '99');
    await waitFor(() => expect(screen.queryByText(/Alpha/)).not.toBeInTheDocument());
    expect(screen.getByText(/Beta/)).toBeInTheDocument();
  });

  it('"Cancel" button is disabled when status is not ONGOING', async () => {
    getAllGuidanceProjectsMock.mockResolvedValueOnce([
      { id: 1, lecturerId: 7, studentId: 9, title: 'P', status: 'COMPLETED' },
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText(/^P$/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Cancel project/i })).toBeDisabled();
  });

  it('"Mark Complete" button is disabled when status is not ONGOING', async () => {
    getAllGuidanceProjectsMock.mockResolvedValueOnce([
      { id: 1, lecturerId: 7, studentId: 9, title: 'P', status: 'PROPOSED' },
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText(/^P$/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Mark complete/i })).toBeDisabled();
  });

  it('"Create Proposal" modal opens and POSTs to /api/GuidanceProject', async () => {
    getAllGuidanceProjectsMock.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Create Proposal/i })).toBeInTheDocument(),
    );
    const openButtons = screen.getAllByRole('button', { name: /Create Proposal/i });
    // Click the header button (first match). The modal exposes a
    // submit button with the same label later.
    await userEvent.setup().click(openButtons[0]!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const titleInput = screen.getByLabelText(/Project Title/i) as HTMLInputElement;
    await userEvent.setup().type(titleInput, 'New GP');
    const descInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement;
    await userEvent.setup().type(descInput, 'A description');
    const submitButtons = screen.getAllByRole('button', { name: /Create Proposal/i });
    // Last match is the submit button inside the modal.
    await userEvent.setup().click(submitButtons[submitButtons.length - 1]!);
    await waitFor(() => expect(postMock).toHaveBeenCalled());
    expect(postMock).toHaveBeenCalledWith(
      '/api/GuidanceProject',
      expect.objectContaining({
        title: 'New GP',
        description: 'A description',
        lecturerId: 7,
      }),
    );
  });

  it('invalid-transition BE 409 surfaces verbatim in error banner', async () => {
    // PROPOSED → CANCELLED is allowed client-side; the BE can still 409 if
    // it has additional state checks we don't model (e.g. a student is
    // already linked).
    getAllGuidanceProjectsMock.mockResolvedValueOnce([
      { id: 1, lecturerId: 7, studentId: 9, title: 'P', status: 'PROPOSED' },
    ]);
    putMock.mockRejectedValueOnce(
      new Error('Invalid state transition: PROPOSED → CANCELLED (409)'),
    );
    renderPage();
    await waitFor(() => expect(screen.getByText(/^P$/)).toBeInTheDocument());
    const cancelBtn = screen.getByRole('button', { name: /Cancel project/i });
    expect(cancelBtn).not.toBeDisabled();
    await userEvent.setup().click(cancelBtn);
    await waitFor(() => expect(putMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        /Invalid state transition: PROPOSED/,
      ),
    );
  });
});