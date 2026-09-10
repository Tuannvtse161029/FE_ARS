/**
 * Tests for the Lecturer Materials page (combined Learning + Shared Materials
 * tab). Verifies that the page no longer renders the previously hardcoded
 * "Catalog preview" demo grid (pdf/drive/website/reference placeholders),
 * and that the live Swagger endpoints drive the visible state.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LecturerMaterialsPage } from '../../../src/features/guidance/MaterialsPage';

const { getAllLearningMock, getAllSharedMock } = vi.hoisted(() => ({
  getAllLearningMock: vi.fn(),
  getAllSharedMock: vi.fn(),
}));

vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 7, userId: 7, email: 'lecturer@test.com', role: 'Lecturer' },
    isLoading: false,
  }),
}));
vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 7, userId: 7, email: 'lecturer@test.com', role: 'Lecturer' },
    isLoading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  default: {},
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

const renderPage = () =>
  render(
    <MemoryRouter>
      <LecturerMaterialsPage />
    </MemoryRouter>,
  );

describe('LecturerMaterialsPage — no hardcoded demo data', () => {
  beforeEach(() => {
    getAllLearningMock.mockReset();
    getAllSharedMock.mockReset();
    getAllSharedMock.mockResolvedValue([]);
  });

  it('does NOT render the hardcoded "Catalog preview" demo grid', async () => {
    getAllLearningMock.mockResolvedValueOnce([]);
    getAllSharedMock.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(getAllLearningMock).toHaveBeenCalled());
    expect(screen.queryAllByText(/Demo catalog card/i)).toHaveLength(0);
    expect(screen.queryByText(/^PDF$/)).toBeNull();
    expect(screen.queryByText(/^Google Drive$/)).toBeNull();
    expect(screen.queryByText(/^Website$/)).toBeNull();
    expect(screen.queryByText(/^Reference$/)).toBeNull();
  });

  it('renders real Learning Material rows returned by the API', async () => {
    getAllLearningMock.mockResolvedValueOnce([
      {
        id: 1,
        lecturerId: 7,
        title: 'Distributed Speech-to-Text Syllabus',
        fileUrl: 'https://firebasestorage.googleapis.com/example/syllabus.pdf',
        subFieldId: 42,
        updatedAt: '2026-08-30T10:00:00Z',
      },
    ]);
    getAllSharedMock.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Distributed Speech-to-Text Syllabus')).toBeInTheDocument(),
    );
  });

  it('renders the truthful empty state on the Learning tab when the API returns []', async () => {
    getAllLearningMock.mockResolvedValueOnce([]);
    getAllSharedMock.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/No materials yet|Chưa có tài liệu nào/)).toBeInTheDocument(),
    );
  });

  it('renders the Shared Materials truthful empty state when the API returns []', async () => {
    getAllLearningMock.mockResolvedValueOnce([]);
    getAllSharedMock.mockResolvedValue([]);
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: /Shared by me|Tôi đã chia sẻ|Shared Materials|Tài liệu chia sẻ/i }));
    await waitFor(() =>
      expect(screen.getByText(/You have not shared any materials with colleagues yet|Bạn chưa chia sẻ tài liệu nào/)).toBeInTheDocument(),
    );
  });

  it('renders real Shared Material cards returned by the API in Tab 2', async () => {
    getAllLearningMock.mockResolvedValueOnce([]);
    getAllSharedMock.mockResolvedValue([
      {
        sharedMaterialId: 9,
        lecturerId: 7,
        paperId: 123,
        sharedWithColleagueId: 55,
        sharedAt: '2026-08-15T10:00:00Z',
        status: 'ACTIVE',
      },
    ]);
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: /Shared by me|Tôi đã chia sẻ|Shared Materials|Tài liệu chia sẻ/i }));
    await waitFor(() => expect(screen.getByText('Material #123')).toBeInTheDocument());
    expect(screen.getByText('Colleague #55')).toBeInTheDocument();
  });

  it('renders Shared with me cards in Tab 3 when clicked', async () => {
    getAllLearningMock.mockResolvedValueOnce([]);
    getAllSharedMock.mockResolvedValue([
      {
        sharedMaterialId: 10,
        lecturerId: 55,
        paperId: 456,
        sharedWithColleagueId: 7,
        sharedAt: '2026-08-16T10:00:00Z',
        status: 'PENDING',
      },
    ]);
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: /Shared with me|Được chia sẻ với tôi/i }));
    await waitFor(() => expect(screen.getByText('Material #456')).toBeInTheDocument());
  });
});
