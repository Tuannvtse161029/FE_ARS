import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Papers } from '../../../src/pages/Papers/Papers';
import * as useMajorFieldsModule from '../../../src/hooks/useMajorFields';
import * as usePapersModule from '../../../src/hooks/usePapers';
import * as usePaperReviewLocksModule from '../../../src/hooks/usePaperReviewLocks';
import * as useAuthenticatedResearcherModule from '../../../src/hooks/useAuthenticatedResearcher';
import * as paperServiceModule from '../../../src/services/paper.service';

vi.mock('../../../src/hooks/useMajorFields');
vi.mock('../../../src/hooks/usePapers');
vi.mock('../../../src/hooks/usePaperReviewLocks');
vi.mock('../../../src/hooks/useAuthenticatedResearcher');
vi.mock('../../../src/services/paper.service');

// Hoisted mocks shared across tests — vi.hoisted runs before vi.mock factories
const { mockUploadTask, mockStorage, mockGetDownloadURL } = vi.hoisted(() => {
  const mockUploadTask = {
    on: vi.fn(),
    snapshot: { ref: {} },
  };
  const mockStorage = {};
  const mockGetDownloadURL = vi.fn(() => Promise.resolve('https://example.com/test.pdf'));
  return { mockUploadTask, mockStorage, mockGetDownloadURL };
});

vi.mock('../../firebase', () => ({
  storage: mockStorage,
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})),
  uploadBytesResumable: vi.fn(() => mockUploadTask),
  getDownloadURL: mockGetDownloadURL,
}));

describe('Papers - Subfield Taxonomy Integration', () => {
  const mockMajorFields = [
    { id: 1, name: 'Computer Science', description: 'CS field' },
    { id: 2, name: 'Mathematics', description: 'Math field' },
  ];

  const mockSubfieldsCS = [
    { id: 10, majorFieldId: 1, name: 'Artificial Intelligence', description: '' },
    { id: 11, majorFieldId: 1, name: 'Software Engineering', description: '' },
  ];

  const mockSubfieldsMath = [
    { id: 20, majorFieldId: 2, name: 'Algebra', description: '' },
    { id: 21, majorFieldId: 2, name: 'Geometry', description: '' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useMajorFields
    vi.spyOn(useMajorFieldsModule, 'useMajorFields').mockReturnValue({
      fields: mockMajorFields,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Mock useSubFields - will be controlled per test
    vi.spyOn(useMajorFieldsModule, 'useSubFields').mockReturnValue({
      subFields: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Mock usePapers
    vi.spyOn(usePapersModule, 'usePapers').mockReturnValue({
      papers: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      detectedCrossAccountLeak: false,
    });

    // Mock usePaperReviewLocks
    vi.spyOn(usePaperReviewLocksModule, 'usePaperReviewLocks').mockReturnValue({
      getLockForPaper: vi.fn(() => ({
        isLocked: false,
        reviewerNames: [],
        activeRequestCount: 0,
      })),
      requests: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Mock useAuthenticatedResearcher
    vi.spyOn(useAuthenticatedResearcherModule, 'useAuthenticatedResearcher').mockReturnValue({
      researcherUserId: 1,
      isLoading: false,
      error: null,
    });
  });

  it('shows prompt to select Major Field before Subfield selection appears', async () => {
    render(<Papers />);

    // Open upload modal by simulating file selection
    const fileInput = screen.getByTestId('papers-file-input');
    const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText(/Select a Major Field to view its Subfields/i)).toBeInTheDocument();
    });
  });

  it('loads Subfields when Major Field is selected', async () => {
    const useSubFieldsSpy = vi.spyOn(useMajorFieldsModule, 'useSubFields');
    
    // Initially no major selected - return empty
    useSubFieldsSpy.mockReturnValue({
      subFields: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { rerender } = render(<Papers />);

    // Open upload modal
    const fileInput = screen.getByTestId('papers-file-input');
    const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId('upload-preview-card')).toBeInTheDocument();
    });

    // Select a Major Field
    const majorSelect = screen.getByLabelText(/Major Field/i);
    await userEvent.selectOptions(majorSelect, '1');

    // Simulate hook returning Subfields for CS
    useSubFieldsSpy.mockReturnValue({
      subFields: mockSubfieldsCS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    rerender(<Papers />);

    await waitFor(() => {
      const subfieldSelect = screen.getByLabelText(/Subfield/i) as HTMLSelectElement;
      expect(subfieldSelect).toBeInTheDocument();
      // Should have options: placeholder + 2 CS subfields
      expect(subfieldSelect.options.length).toBe(3);
    });
  });

  it('clears Subfield selection when Major Field changes', async () => {
    const useSubFieldsSpy = vi.spyOn(useMajorFieldsModule, 'useSubFields');

    // Start with CS subfields
    useSubFieldsSpy.mockReturnValue({
      subFields: mockSubfieldsCS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<Papers />);

    // Open upload modal
    const fileInput = screen.getByTestId('papers-file-input');
    const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId('upload-preview-card')).toBeInTheDocument();
    });

    // Select CS Major Field
    const majorSelect = screen.getByLabelText(/Major Field/i);
    await userEvent.selectOptions(majorSelect, '1');

    await waitFor(() => {
      const subfieldSelect = screen.getByLabelText(/Subfield/i) as HTMLSelectElement;
      expect(subfieldSelect.options.length).toBe(3); // placeholder + 2 CS options
    });

    // Select AI Subfield
    const subfieldSelect = screen.getByLabelText(/Subfield/i) as HTMLSelectElement;
    await userEvent.selectOptions(subfieldSelect, '10');

    expect(subfieldSelect.value).toBe('10');

    // Change Major Field to Math
    await userEvent.selectOptions(majorSelect, '2');

    // Subfield should be cleared (back to empty value)
    await waitFor(() => {
      expect(subfieldSelect.value).toBe('');
    });
  });

  it('disables upload button until Subfield is selected', async () => {
    const useSubFieldsSpy = vi.spyOn(useMajorFieldsModule, 'useSubFields');
    useSubFieldsSpy.mockReturnValue({
      subFields: mockSubfieldsCS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<Papers />);

    // Open upload modal
    const fileInput = screen.getByTestId('papers-file-input');
    const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId('upload-preview-card')).toBeInTheDocument();
    });

    // Fill title
    const titleInput = screen.getByPlaceholderText(/e.g., A Modular Backend/i);
    await userEvent.type(titleInput, 'Test Paper Title');

    // Fill abstract
    const abstractInput = screen.getByPlaceholderText(/Summarize your research/i);
    await userEvent.type(abstractInput, 'Test abstract content');

    // Select Major Field
    const majorSelect = screen.getByLabelText(/Major Field/i);
    await userEvent.selectOptions(majorSelect, '1');

    // Upload button should be disabled (no Subfield yet)
    const uploadButton = screen.getByRole('button', { name: /Upload Paper/i });
    expect(uploadButton).toBeDisabled();

    // Select Subfield
    const subfieldSelect = screen.getByLabelText(/Subfield/i);
    await userEvent.selectOptions(subfieldSelect, '10');

    // Upload button should now be enabled
    await waitFor(() => {
      expect(uploadButton).not.toBeDisabled();
    });
  });

  it('sends numeric subfieldId in Paper creation payload', async () => {
    const createSpy = vi.spyOn(paperServiceModule.paperService, 'create').mockResolvedValue({
      id: '123',
      title: 'Test Paper',
      status: 'Waiting for Review',
      fileUrl: 'https://example.com/test.pdf',
    });

    const useSubFieldsSpy = vi.spyOn(useMajorFieldsModule, 'useSubFields');
    useSubFieldsSpy.mockReturnValue({
      subFields: mockSubfieldsCS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Configure the shared Firebase mock to complete once on state_changed event
    mockUploadTask.on.mockReset();
    let completeCallCount = 0;
    mockUploadTask.on.mockImplementation((_event: string, _progressCb: () => void, _errorCb: (e: Error) => void, completeCb: () => void) => {
      completeCallCount++;
      if (completeCallCount <= 1) {
        setTimeout(completeCb, 10);
      }
    });

    render(<Papers />);

    // Open upload modal
    const fileInput = screen.getByTestId('papers-file-input');
    const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId('upload-preview-card')).toBeInTheDocument();
    });

    // Fill required fields
    const titleInput = screen.getByPlaceholderText(/e.g., A Modular Backend/i);
    await userEvent.type(titleInput, 'AI Research Paper');

    const abstractInput = screen.getByPlaceholderText(/Summarize your research/i);
    await userEvent.type(abstractInput, 'This is a test abstract about AI research.');

    // Select CS Major Field
    const majorSelect = screen.getByLabelText(/Major Field/i);
    await userEvent.selectOptions(majorSelect, '1');

    // Select AI Subfield
    const subfieldSelect = screen.getByLabelText(/Subfield/i);
    await userEvent.selectOptions(subfieldSelect, '10');

    // Click Upload Paper
    const uploadButton = screen.getByRole('button', { name: /Upload Paper/i });
    await userEvent.click(uploadButton);

    // Confirm upload in modal — button is scoped by its aria-label/role to avoid matching the h3 title
    const confirmButton = screen.getByRole('button', { name: /Confirm Upload/i });
    await userEvent.click(confirmButton);

    // Verify paperService.create was called with numeric subfieldId
    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'AI Research Paper',
          abstract: 'This is a test abstract about AI research.',
          subFieldId: 10, // ← Numeric ID, not string
        })
      );
    });
  });

  it('does not send subfieldId: 0 or null when taxonomy is missing', async () => {
    const createSpy = vi.spyOn(paperServiceModule.paperService, 'create');

    render(<Papers />);

    // This test verifies the form validation prevents upload without Subfield
    // Open upload modal
    const fileInput = screen.getByTestId('papers-file-input');
    const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId('upload-preview-card')).toBeInTheDocument();
    });

    // Fill title only
    const titleInput = screen.getByPlaceholderText(/e.g., A Modular Backend/i);
    await userEvent.type(titleInput, 'Test Paper');

    const abstractInput = screen.getByPlaceholderText(/Summarize your research/i);
    await userEvent.type(abstractInput, 'Test abstract');

    // Do NOT select Major or Subfield

    // Upload button should be disabled
    const uploadButton = screen.getByRole('button', { name: /Upload Paper/i });
    expect(uploadButton).toBeDisabled();

    // paperService.create should NOT have been called
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('shows loading state while Subfields are being fetched', async () => {
    const useSubFieldsSpy = vi.spyOn(useMajorFieldsModule, 'useSubFields');
    useSubFieldsSpy.mockReturnValue({
      subFields: [],
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<Papers />);

    // Open upload modal
    const fileInput = screen.getByTestId('papers-file-input');
    const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId('upload-preview-card')).toBeInTheDocument();
    });

    // Select Major Field
    const majorSelect = screen.getByLabelText(/Major Field/i);
    await userEvent.selectOptions(majorSelect, '1');

    // Should show loading message
    await waitFor(() => {
      expect(screen.getByText(/Loading Subfields.../i)).toBeInTheDocument();
    });
  });

  it('shows error message when Subfield load fails', async () => {
    const useSubFieldsSpy = vi.spyOn(useMajorFieldsModule, 'useSubFields');
    useSubFieldsSpy.mockReturnValue({
      subFields: [],
      isLoading: false,
      error: new Error('Network error'),
      refetch: vi.fn(),
    });

    render(<Papers />);

    // Open upload modal
    const fileInput = screen.getByTestId('papers-file-input');
    const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId('upload-preview-card')).toBeInTheDocument();
    });

    // Select Major Field
    const majorSelect = screen.getByLabelText(/Major Field/i);
    await userEvent.selectOptions(majorSelect, '1');

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Subfields could not be loaded/i)).toBeInTheDocument();
    });
  });
});
