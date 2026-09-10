import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LecturerMaterialsPage } from '../../../src/pages/Lecturer/Materials';

const { getAllLearningMock, getAllSharedMock } = vi.hoisted(() => ({
  getAllLearningMock: vi.fn(),
  getAllSharedMock: vi.fn(),
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 7, userId: 7, email: 'lecturer@test.com', role: 'Lecturer', fullName: 'Dr. John Lecturer' },
    isLoading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  default: {},
}));

vi.mock('../../../src/services/axios', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url.includes('/api/User')) {
        return Promise.resolve({
          data: [
            { id: 8, fullName: 'Prof. Alice Smith', email: 'alice@test.com' },
            { id: 9, fullName: 'Dr. Bob Jones', email: 'bob@test.com' },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

vi.mock('../../../src/hooks/useLearningMaterials', () => ({
  useLearningMaterials: () => ({
    materials: mockMaterials,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../src/services/learningMaterial.service', () => ({
  learningMaterialService: {
    getAll: getAllLearningMock,
    create: vi.fn(),
    delete: vi.fn(),
  },
  defaultLearningMaterialFolderPath: () => 'lecturer-materials',
}));

vi.mock('../../../src/services/sharedMaterial.service', () => ({
  sharedMaterialService: {
    getAll: getAllSharedMock,
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../src/services/researchTopic.service', () => ({
  researchTopicService: {
    getAll: vi.fn(() => Promise.resolve([])),
    getByLecturerId: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../../../src/services/phasedReport.service', () => ({
  phasedReportService: {
    getAll: vi.fn(() => Promise.resolve([])),
  },
}));

const mockMaterials = [
  {
    id: 101,
    learningMaterialId: 101,
    lecturerId: 7,
    title: 'Advanced AI Architectures Guide',
    description: 'Comprehensive research paper and slide deck on multi-agent architectures.',
    fileUrl: 'https://firebasestorage.googleapis.com/v0/b/ars.appspot.com/o/ai_guide.pdf',
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z',
  },
];

const mockSharedMaterials = [
  {
    sharedMaterialId: 501,
    lecturerId: 7,
    sharedWithColleagueId: 8,
    paperId: 101,
    title: 'Advanced AI Architectures Guide',
    fileUrl: 'https://firebasestorage.googleapis.com/v0/b/ars.appspot.com/o/ai_guide.pdf',
    status: 'ACCEPTED',
    sharedAt: '2026-09-05T10:00:00Z',
  },
  {
    sharedMaterialId: 502,
    lecturerId: 9,
    sharedWithColleagueId: 7,
    paperId: 202,
    title: 'Quantum Computing Fundamentals',
    fileUrl: 'https://firebasestorage.googleapis.com/v0/b/ars.appspot.com/o/quantum.pdf',
    status: 'PENDING',
    sharedAt: '2026-09-08T10:00:00Z',
  },
];

const renderComponent = () =>
  render(
    <MemoryRouter>
      <LecturerMaterialsPage />
    </MemoryRouter>,
  );

describe('Lecturer Materials — Redesigned Share Material Modal & Tab 2 View Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllLearningMock.mockResolvedValue(mockMaterials);
    getAllSharedMock.mockResolvedValue(mockSharedMaterials);
  });

  it('renders Material card and opens redesigned Share Material modal with full showcase information', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Advanced AI Architectures Guide')).toBeInTheDocument();
    });

    const shareBtn = screen.getByRole('button', { name: /share material/i });
    expect(shareBtn).toBeInTheDocument();
    await user.click(shareBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText(/Share material with a colleague|Chia sẻ tài liệu/i)).toBeInTheDocument();
    expect(screen.getAllByText('Comprehensive research paper and slide deck on multi-agent architectures.').length).toBeGreaterThanOrEqual(1);

    const viewBtn = screen.getByRole('button', { name: /view material|xem tài liệu/i });
    expect(viewBtn).toBeInTheDocument();

    await user.click(viewBtn);
    expect(openSpy).toHaveBeenCalledWith(
      'https://firebasestorage.googleapis.com/v0/b/ars.appspot.com/o/ai_guide.pdf',
      '_blank',
      'noopener,noreferrer',
    );

    expect(
      screen.getByText(/Selected colleagues will receive read-only access|Đồng nghiệp được chọn sẽ có quyền xem/i),
    ).toBeInTheDocument();

    openSpy.mockRestore();
  });

  it('provides View and Preview buttons in Shared Materials tab', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Advanced AI Architectures Guide')).toBeInTheDocument();
    });

    const sharedTab = screen.getByRole('tab', { name: /shared materials|tài liệu chia sẻ/i });
    await user.click(sharedTab);

    await waitFor(() => {
      expect(screen.getByText(/Shared by me|Tôi đã chia sẻ/i)).toBeInTheDocument();
      expect(screen.getByText(/Shared with me|Được chia sẻ với tôi/i)).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByRole('button', { name: /^view$|^xem$/i });
    expect(viewButtons.length).toBeGreaterThanOrEqual(1);

    await user.click(viewButtons[0]);
    expect(openSpy).toHaveBeenCalledWith(
      'https://firebasestorage.googleapis.com/v0/b/ars.appspot.com/o/ai_guide.pdf',
      '_blank',
      'noopener,noreferrer',
    );

    const previewBtn = screen.getByRole('button', { name: /preview|xem trước/i });
    expect(previewBtn).toBeInTheDocument();

    await user.click(previewBtn);
    expect(openSpy).toHaveBeenCalledWith(
      'https://firebasestorage.googleapis.com/v0/b/ars.appspot.com/o/quantum.pdf',
      '_blank',
      'noopener,noreferrer',
    );

    openSpy.mockRestore();
  });
});
