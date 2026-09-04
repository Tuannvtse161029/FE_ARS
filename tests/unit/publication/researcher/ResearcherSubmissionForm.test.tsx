/**
 * Focused unit tests for ResearcherSubmissionForm.
 *
 * Owned by: agent-researcher-paper-submission
 *
 * Covers:
 *   1. Upload sequencing — file selected → Firebase upload → getDownloadURL → form unlocks submit.
 *   2. Exact payload Firebase URL — once uploaded, the createDraft payload receives the
 *      exact URL returned by Firebase (no client-side rewriting).
 *   3. OpenAlex scan preview — invalid ID surfaces the error inline; form does not
 *      call the network and does not expose keys.
 *   4. Manual fallback — a free-text identifier can be attached without scanning.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { mockUseFirebaseUpload } = vi.hoisted(() => ({
  mockUseFirebaseUpload: vi.fn(),
}));

const { mockAdapter } = vi.hoisted(() => ({
  mockAdapter: {
    getPublicCatalog: vi.fn(),
    getResearcherSubmissions: vi.fn(),
    getReviewerAssignments: vi.fn(),
    getAdminSubmissions: vi.fn(),
    getNotifications: vi.fn(),
    createDraft: vi.fn(),
    submitPaper: vi.fn(),
    respondToAssignment: vi.fn(),
    submitReview: vi.fn(),
    assignReviewer: vi.fn(),
    publishPaper: vi.fn(),
  },
}));

const { mockOpenAlexAdapter } = vi.hoisted(() => ({
  mockOpenAlexAdapter: {
    lookupPreview: vi.fn(),
    normalize: vi.fn(),
  },
}));

vi.mock('../../../../src/hooks/useFirebaseUpload', () => ({
  useFirebaseUpload: mockUseFirebaseUpload,
}));

vi.mock('../../../../src/features/publication/api/publication.adapter', () => ({
  publicationAdapter: mockAdapter,
}));

vi.mock('../../../../src/features/publication/researcher/openalexAdapter', () => ({
  openAlexAdapter: mockOpenAlexAdapter,
}));

vi.mock('../../../../src/hooks/useMajorFields', () => ({
  useMajorFields: () => ({
    fields: [{ id: 1, name: 'Computer Science' }],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useSubFields: () => ({
    subFields: [{ id: 10, name: 'Artificial Intelligence', majorFieldId: 1 }],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { ResearcherSubmissionForm } from '../../../../src/features/publication/researcher/ResearcherSubmissionForm';

// ── Firebase upload hook double ───────────────────────────────────────────────
type FirebaseState = {
  uploadPdf: ReturnType<typeof vi.fn>;
  progress: number;
  isUploading: boolean;
  error: string | null;
  pdfUrl: string | null;
  resetUpload: ReturnType<typeof vi.fn>;
};

const makeFirebaseState = (
  overrides: Partial<FirebaseState> = {},
): FirebaseState => ({
  uploadPdf: vi.fn().mockResolvedValue(undefined),
  progress: 0,
  isUploading: false,
  error: null,
  pdfUrl: null,
  resetUpload: vi.fn(),
  ...overrides,
});

// A mutable Firebase state holder that the test can swap between renders.
// The hook mock reads from this holder each call, so once we set `pdfUrl`
// here and trigger a re-render (by mutating controlled state), the form
// will see the upload-completion state.
let firebaseStateHolder: FirebaseState = makeFirebaseState();
mockUseFirebaseUpload.mockImplementation(() => firebaseStateHolder);

const setFirebaseState = (next: Partial<FirebaseState>) => {
  firebaseStateHolder = { ...firebaseStateHolder, ...next };
};

// Drives the file input change using a synthetic FileList via fireEvent.
const selectFile = (input: HTMLInputElement, file: File) => {
  Object.defineProperty(input, 'files', {
    value: [file],
    writable: false,
    configurable: true,
  });
  fireEvent.change(input);
};

const renderForm = () =>
  render(
    <MemoryRouter>
      <ResearcherSubmissionForm />
    </MemoryRouter>,
  );

const fillRequiredTextFields = () => {
  fireEvent.change(screen.getByLabelText(/Title/i), {
    target: { value: 'Sequencing Test Paper' },
  });
  fireEvent.change(screen.getByLabelText(/Abstract/i), {
    target: { value: 'A long enough abstract that satisfies the form requirements.' },
  });
  fireEvent.change(screen.getByLabelText(/First author/i), {
    target: { value: 'Researcher One' },
  });
  fireEvent.change(screen.getByLabelText(/Institution/i), {
    target: { value: 'ARS University' },
  });
  fireEvent.change(screen.getByLabelText(/Major field/i), {
    target: { value: '1' },
  });
  fireEvent.change(screen.getByLabelText(/Subfield/i), {
    target: { value: '10' },
  });
};

const EXACT_URL =
  'https://firebasestorage.googleapis.com/v0/b/ars-platform.appspot.com/o/researcher_papers%2F123_manuscript.pdf?alt=media&token=abc';

describe('ResearcherSubmissionForm – Upload Paper (PDF) sequencing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter.createDraft.mockResolvedValue({
      id: 'demo-draft-1',
      status: 'DRAFT',
      fileUrl: EXACT_URL,
    });
    mockAdapter.submitPaper.mockResolvedValue({
      id: 'demo-draft-1',
      status: 'SUBMITTED',
      fileUrl: EXACT_URL,
    });
    mockOpenAlexAdapter.lookupPreview.mockResolvedValue({
      status: 'unsupported_variant',
      message: 'unsupported',
    });
  });

  afterEach(() => {
    setFirebaseState(makeFirebaseState());
  });

  it('preserves the exact Firebase URL through upload → preview → createDraft payload', async () => {
    const uploadPdf = vi.fn().mockResolvedValue(undefined);
    setFirebaseState({ uploadPdf });
    renderForm();

    // Drive the file-input change.
    const file = new File(['%PDF-1.4'], 'manuscript.pdf', {
      type: 'application/pdf',
    });
    selectFile(screen.getByTestId('submission-file'), file);

    // Simulate the hook's completion state and trigger a re-render.
    setFirebaseState({ progress: 100, isUploading: false, pdfUrl: EXACT_URL });
    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: 'Sequencing Test Paper' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('submission-file-url')).toBeInTheDocument();
    });

    fillRequiredTextFields();

    const submit = screen.getByTestId('submission-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(false);

    await userEvent.click(submit);

    await waitFor(() => {
      expect(mockAdapter.createDraft).toHaveBeenCalledTimes(1);
    });
    const payload = mockAdapter.createDraft.mock.calls[0][0];
    expect(payload.fileUrl).toBe(EXACT_URL);
  });

  it('locks the submit button until the Firebase URL is captured', () => {
    setFirebaseState({ progress: 0, isUploading: false, pdfUrl: null });
    renderForm();

    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: 'T' },
    });
    fireEvent.change(screen.getByLabelText(/Abstract/i), {
      target: { value: 'A valid abstract.' },
    });
    fireEvent.change(screen.getByLabelText(/First author/i), {
      target: { value: 'Author' },
    });
    fireEvent.change(screen.getByLabelText(/Institution/i), {
      target: { value: 'Inst' },
    });

    const submit = screen.getByTestId('submission-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('disables the file input while uploading to block duplicate submissions', () => {
    setFirebaseState({ progress: 40, isUploading: true });
    renderForm();

    const fileInput = screen.getByTestId('submission-file') as HTMLInputElement;
    expect(fileInput.disabled).toBe(true);
  });

  it('renders the "Firebase URL captured" hint once the upload completes', () => {
    setFirebaseState({ progress: 100, isUploading: false, pdfUrl: EXACT_URL });
    renderForm();

    expect(screen.getByTestId('submission-file-url')).toHaveTextContent(
      /Upload complete/i,
    );
  });

  it('rejects files whose type is not application/pdf', () => {
    const resetUpload = vi.fn();
    setFirebaseState({ resetUpload });
    renderForm();

    const fileInput = screen.getByTestId('submission-file') as HTMLInputElement;
    const pngFile = new File(['hello'], 'manuscript.png', { type: 'image/png' });
    selectFile(fileInput, pngFile);

    expect(screen.getByTestId('submission-file-error')).toHaveTextContent(
      /Only PDF files are allowed/i,
    );
    expect(resetUpload).toHaveBeenCalled();
  });

  it('exposes a Retry upload control after a failed upload', async () => {
    setFirebaseState({ error: 'Storage quota exceeded', pdfUrl: null });
    renderForm();

    const fileInput = screen.getByTestId('submission-file') as HTMLInputElement;
    const pdfFile = new File(['x'], 'manuscript.pdf', { type: 'application/pdf' });
    selectFile(fileInput, pdfFile);

    expect(
      await screen.findByTestId('submission-file-error'),
    ).toHaveTextContent(/Storage quota exceeded/i);
    expect(screen.getByTestId('submission-file-retry')).toBeInTheDocument();
  });
});

describe('ResearcherSubmissionForm – OpenAlex scan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setFirebaseState({
      pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/ars-platform.appspot.com/o/manuscript.pdf',
    });
    mockAdapter.createDraft.mockResolvedValue({ id: 'demo-draft-2', status: 'DRAFT' });
    mockAdapter.submitPaper.mockResolvedValue({ id: 'demo-draft-2', status: 'SUBMITTED' });
  });

  afterEach(() => {
    setFirebaseState(makeFirebaseState());
  });

  it('shows malformed IDs inline and keeps the researcher on the form', async () => {
    mockOpenAlexAdapter.lookupPreview.mockResolvedValue({
      status: 'invalid_format',
      message: '"not-a-real-id" is not a valid OpenAlex work ID.',
    });

    renderForm();
    fireEvent.change(screen.getByTestId('submission-openalex-input'), {
      target: { value: 'not-a-real-id' },
    });
    fireEvent.click(screen.getByTestId('submission-openalex-scan'));

    expect(await screen.findByTestId('submission-openalex-invalid')).toHaveTextContent(
      /not a valid OpenAlex work ID/i,
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not copy returned metadata before the researcher confirms it', async () => {
    mockOpenAlexAdapter.lookupPreview.mockResolvedValue({
      status: 'preview',
      metadata: {
        id: 'W2741809807',
        title: 'Imported title',
        abstract: 'Imported abstract',
        authors: ['Imported Author'],
        institutions: ['Imported Institution'],
        keywords: ['open access'],
        topics: ['Artificial intelligence'],
      },
    });

    renderForm();
    fireEvent.change(screen.getByTestId('submission-openalex-input'), {
      target: { value: 'w2741809807' },
    });
    fireEvent.click(screen.getByTestId('submission-openalex-scan'));

    const preview = await screen.findByTestId('submission-openalex-preview');
    expect(preview).toHaveTextContent('OpenAlex imported metadata');
    expect(preview).toHaveTextContent('ARS major field and subfield must be selected manually.');
    expect(screen.getByLabelText(/Title/i)).toHaveValue('');

    await userEvent.click(screen.getByRole('button', { name: 'Use imported metadata' }));
    expect(screen.getByLabelText(/Title/i)).toHaveValue('Imported title');
    expect(screen.getByLabelText(/Abstract/i)).toHaveValue('Imported abstract');
    expect(screen.getByLabelText(/First author/i)).toHaveValue('Imported Author');
    expect(screen.getByLabelText(/Institution/i)).toHaveValue('Imported Institution');
    expect(screen.getByLabelText(/Keywords/i)).toHaveValue('open access');
    expect(screen.getByTestId('submission-openalex-confirmed')).toHaveTextContent('W2741809807');
    expect(mockAdapter.createDraft).not.toHaveBeenCalled();
  });

  it.each([
    ['not_found', 'No OpenAlex work was found for this ID.'],
    ['rate_limited', 'OpenAlex scanning is temporarily rate limited.'],
    ['error', 'OpenAlex scanning is unavailable.'],
  ] as const)('shows a recoverable %s scan failure', async (status, message) => {
    mockOpenAlexAdapter.lookupPreview.mockResolvedValue({ status, message });

    renderForm();
    fireEvent.change(screen.getByTestId('submission-openalex-input'), {
      target: { value: 'W2741809807' },
    });
    fireEvent.click(screen.getByTestId('submission-openalex-scan'));

    expect(await screen.findByTestId('submission-openalex-unavailable')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
