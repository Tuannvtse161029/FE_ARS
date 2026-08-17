/**
 * Component tests for src/components/lecturer/LearningMaterialModal.tsx.
 *
 * Per lead-phase-c-contract.md §3.1 / L3.c: the BE has no
 * `LearningMaterial.topicId` column, so the modal lists materials owned by
 * the current lecturer (no server-side topic filter).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  LearningMaterialModal,
} from '../../../components/lecturer/LearningMaterialModal';
import { buildMockAuth } from '../../utils/mockAuth';

const { getAllLearningMaterialsMock, createLearningMaterialMock } =
  vi.hoisted(() => ({
    getAllLearningMaterialsMock: vi.fn(),
    createLearningMaterialMock: vi.fn(),
  }));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => buildMockAuth({ role: 'Lecturer', userId: 7 }),
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => buildMockAuth({ role: 'Lecturer', userId: 7 }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  default: {},
}));

vi.mock('../../../services/learningMaterial.service', () => ({
  learningMaterialService: {
    getAll: getAllLearningMaterialsMock,
    create: createLearningMaterialMock,
  },
}));

const SEED_TOPIC = {
  id: 11,
  title: 'Speech-to-text',
  status: 'OPEN' as const,
};

const renderModal = (overrides: { isOpen?: boolean } = {}) =>
  render(
    <LearningMaterialModal
      isOpen={overrides.isOpen ?? true}
      topic={SEED_TOPIC}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
    />,
  );

describe('<LearningMaterialModal>', () => {
  beforeEach(() => {
    getAllLearningMaterialsMock.mockReset();
    createLearningMaterialMock.mockReset();
    getAllLearningMaterialsMock.mockResolvedValue([]);
    createLearningMaterialMock.mockResolvedValue({ id: 999 });
  });

  it('renders nothing when isOpen=false', () => {
    const { container } = render(
      <LearningMaterialModal
        isOpen={false}
        topic={SEED_TOPIC}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('lists useLearningMaterials rows for the topic when isOpen=true', async () => {
    getAllLearningMaterialsMock.mockResolvedValueOnce([
      { id: 1, lecturerId: 7, title: 'Syllabus A', fileUrl: 'https://x/a.pdf' },
      { id: 2, lecturerId: 7, title: 'Syllabus B', fileUrl: 'https://x/b.pdf' },
    ]);
    renderModal();
    await waitFor(() =>
      expect(screen.getByText(/Syllabus A/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Syllabus B/)).toBeInTheDocument();
  });

  it('shows empty state when no materials', async () => {
    getAllLearningMaterialsMock.mockResolvedValueOnce([]);
    renderModal();
    await waitFor(() =>
      expect(screen.getByText(/You have no learning materials yet/)).toBeInTheDocument(),
    );
  });

  it('"Add Material" POSTs via learningMaterialService.create (no topicId)', async () => {
    getAllLearningMaterialsMock.mockResolvedValue([]);
    renderModal();
    await waitFor(() =>
      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument(),
    );
    await userEvent.setup().type(screen.getByLabelText(/Title/i), 'New Syllabus');
    await userEvent.setup().type(
      screen.getByLabelText(/File URL/i),
      'https://firebasestorage/x.pdf',
    );
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Add Material/i }),
    );
    await waitFor(() => expect(createLearningMaterialMock).toHaveBeenCalled());
    const callArgs = createLearningMaterialMock.mock.calls[0][0];
    expect(callArgs.title).toBe('New Syllabus');
    expect(callArgs.fileUrl).toBe('https://firebasestorage/x.pdf');
    expect(callArgs.lecturerId).toBe(7);
    // No topicId — the BE has no column for it.
    expect(callArgs.topicId).toBeUndefined();
  });

  it('BE-gap disclaimer about topicId is visible', async () => {
    renderModal();
    await waitFor(() =>
      expect(
        screen.getByText(/backend has no/),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/LearningMaterial.topicId/)).toBeInTheDocument();
  });
});