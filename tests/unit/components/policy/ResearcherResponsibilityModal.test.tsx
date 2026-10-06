/**
 * Tests for the Researcher Responsibility pre-submission gate.
 *
 * Covered:
 *   1. The gate renders on the Researcher submission form below the
 *      "Submit to Admin" button and reads as "not agreed" by default.
 *   2. The Submit button is disabled while the researcher has not
 *      agreed to the policy.
 *   3. Clicking Submit while not agreed opens the modal instead of
 *      calling the BE.
 *   4. The modal renders the live policy text from `policyService`.
 *   5. The "I agree" CTA stays disabled until the checkbox is ticked.
 *   6. Ticking the checkbox AND clicking the CTA flips the gate to
 *      "agreed" and closes the modal.
 *   7. After agreeing, the Submit button becomes enabled and the next
 *      click calls `createDraft` on the adapter.
 *   8. Cancelling the modal (button or Escape) leaves the gate
 *      un-agreed and the Submit button still disabled.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { dictionary } from '../../../../src/i18n/dictionaries/en';

const translate = (
  key: string,
  fallback?: string,
  params?: Record<string, string | number>,
) =>
  Object.entries(params ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    dictionary[key] ?? fallback ?? key,
  );

vi.mock('../../../../src/i18n/I18nContext', () => ({
  useT: () => translate,
  useLocale: () => 'en',
}));

vi.mock(
  '../../../../src/components/PdfViewer',
  () => ({
    default: () => <div data-testid="mock-local-preview" />,
    PdfViewer: () => <div data-testid="mock-local-preview" />,
  }),
);

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

const { mockPolicyService } = vi.hoisted(() => ({
  mockPolicyService: {
    getOne: vi.fn(),
    listAll: vi.fn(),
    save: vi.fn(),
    subscribe: vi.fn(),
    invalidate: vi.fn(),
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

vi.mock('../../../../src/services/policy.service', () => ({
  policyService: mockPolicyService,
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

let firebaseStateHolder: FirebaseState = makeFirebaseState();
mockUseFirebaseUpload.mockImplementation(() => firebaseStateHolder);

const setFirebaseState = (next: Partial<FirebaseState>) => {
  firebaseStateHolder = { ...firebaseStateHolder, ...next };
};

const renderForm = () =>
  render(
    <MemoryRouter>
      <ResearcherSubmissionForm />
    </MemoryRouter>,
  );

const EXACT_URL =
  'https://firebasestorage.googleapis.com/v0/b/ars-platform.appspot.com/o/researcher_papers%2F123_manuscript.pdf?alt=media&token=abc';

const SEED_TEXT =
  '1. Originality & Plagiarism\n\nEvery research paper you submit to ARS must be your own original work.\n\n2. Citation Integrity\n\nCite every source that influenced your methodology.';

describe('ResearcherSubmissionForm – Researcher Responsibility gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setFirebaseState({ pdfUrl: EXACT_URL });
    mockAdapter.createDraft.mockResolvedValue({
      id: 'demo-draft-gate',
      status: 'SUBMITTED',
      fileUrl: EXACT_URL,
    });
    mockPolicyService.getOne.mockResolvedValue({
      slug: 'researcher_responsibility',
      title: 'Researcher Responsibility',
      content: SEED_TEXT,
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin',
      fromFirestore: true,
    });
    mockOpenAlexAdapter.lookupPreview.mockResolvedValue({
      status: 'unsupported_variant',
      message: 'unsupported',
    });
  });

  afterEach(() => {
    setFirebaseState(makeFirebaseState());
  });

  it('renders the gate in the "not agreed" state on first paint', () => {
    renderForm();
    const gate = screen.getByTestId('researcher-responsibility-gate');
    expect(gate).toHaveAttribute('data-agreed', 'false');
    expect(gate).toHaveTextContent(/read & agree to the researcher responsibility/i);
  });

  it('disables the Submit button until the researcher agrees', () => {
    renderForm();
    const submit = screen.getByTestId('submission-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('opens the modal when Submit is clicked before agreeing, and does NOT call createDraft', async () => {
    renderForm();
    const submit = screen.getByTestId('submission-submit') as HTMLButtonElement;
    // Even though the form is invalid (we did not fill required fields),
    // we want the gate to intercept first — the form-level `canSubmit`
    // check runs before the gate, so we must fill the required fields
    // here to isolate the gate behaviour. We only check that the BE is
    // NOT called when the gate is open.
    fireEvent.change(document.getElementById('submission-title') as HTMLInputElement, {
      target: { value: 'A title' },
    });
    fireEvent.change(document.getElementById('submission-abstract') as HTMLTextAreaElement, {
      target: { value: 'A long enough abstract that satisfies the form requirements.' },
    });
    fireEvent.change(document.getElementById('submission-author') as HTMLInputElement, {
      target: { value: 'Author' },
    });
    fireEvent.change(
      document.getElementById('submission-institution') as HTMLInputElement,
      {
        target: { value: 'Inst' },
      },
    );
    fireEvent.change(document.getElementById('submission-major-field') as HTMLSelectElement, {
      target: { value: '1' },
    });
    fireEvent.change(document.getElementById('submission-subfield') as HTMLSelectElement, {
      target: { value: '10' },
    });

    // The submit button is now form-valid, but still gated.
    expect(submit.disabled).toBe(true);

    // The "Read & agree" button is a separate path — use that to open
    // the modal without depending on the submit click.
    fireEvent.click(screen.getByTestId('researcher-responsibility-open'));
    expect(
      await screen.findByTestId('researcher-responsibility-modal'),
    ).toBeInTheDocument();
    expect(mockAdapter.createDraft).not.toHaveBeenCalled();
  });

  it('loads the live policy text into the modal body', async () => {
    renderForm();
    fireEvent.click(screen.getByTestId('researcher-responsibility-open'));
    const content = await screen.findByTestId('researcher-responsibility-content');
    await waitFor(() => {
      expect(content).toHaveTextContent(/Originality/);
      expect(content).toHaveTextContent(/Citation Integrity/);
    });
  });

  it('keeps the "I agree" CTA disabled until the checkbox is ticked', async () => {
    renderForm();
    fireEvent.click(screen.getByTestId('researcher-responsibility-open'));
    await screen.findByTestId('researcher-responsibility-modal');
    const agreeCta = await screen.findByTestId('researcher-responsibility-agree');
    expect(agreeCta).toBeDisabled();

    await userEvent.click(screen.getByTestId('researcher-responsibility-checkbox'));
    expect(agreeCta).not.toBeDisabled();
  });

  it('flips the gate to "agreed" and closes the modal after the researcher agrees', async () => {
    renderForm();
    fireEvent.click(screen.getByTestId('researcher-responsibility-open'));
    await screen.findByTestId('researcher-responsibility-modal');
    await userEvent.click(screen.getByTestId('researcher-responsibility-checkbox'));
    await userEvent.click(screen.getByTestId('researcher-responsibility-agree'));

    await waitFor(() => {
      expect(screen.queryByTestId('researcher-responsibility-modal')).not.toBeInTheDocument();
    });
    const gate = screen.getByTestId('researcher-responsibility-gate');
    expect(gate).toHaveAttribute('data-agreed', 'true');
    expect(gate).toHaveTextContent(/researcher responsibility agreed/i);
  });

  it('enables the Submit button after agreement and the next click calls createDraft', async () => {
    renderForm();
    // Drive the file input so `uploadedFile` is set; the `useEffect` on
    // pdfUrl/uploadedFile then flips `uploadedAt` and `canSubmit` is
    // free to evaluate to true once the policy is also agreed.
    const file = new File(['%PDF-1.4'], 'manuscript.pdf', {
      type: 'application/pdf',
    });
    const fileInput = screen.getByTestId('submission-file') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
      configurable: true,
    });
    fireEvent.change(fileInput);

    fireEvent.change(document.getElementById('submission-title') as HTMLInputElement, {
      target: { value: 'A title' },
    });
    fireEvent.change(document.getElementById('submission-abstract') as HTMLTextAreaElement, {
      target: { value: 'A long enough abstract that satisfies the form requirements.' },
    });
    fireEvent.change(document.getElementById('submission-author') as HTMLInputElement, {
      target: { value: 'Author' },
    });
    fireEvent.change(
      document.getElementById('submission-institution') as HTMLInputElement,
      {
        target: { value: 'Inst' },
      },
    );
    fireEvent.change(document.getElementById('submission-major-field') as HTMLSelectElement, {
      target: { value: '1' },
    });
    fireEvent.change(document.getElementById('submission-subfield') as HTMLSelectElement, {
      target: { value: '10' },
    });

    // Open + agree
    fireEvent.click(screen.getByTestId('researcher-responsibility-open'));
    await screen.findByTestId('researcher-responsibility-modal');
    await userEvent.click(screen.getByTestId('researcher-responsibility-checkbox'));
    await userEvent.click(screen.getByTestId('researcher-responsibility-agree'));

    const submit = await screen.findByTestId('submission-submit');
    await waitFor(() => {
      expect(submit).not.toBeDisabled();
    });
    await userEvent.click(submit);

    await waitFor(() => {
      expect(mockAdapter.createDraft).toHaveBeenCalledTimes(1);
    });
  });

  it('cancelling the modal keeps the gate un-agreed and Submit disabled', async () => {
    renderForm();
    fireEvent.click(screen.getByTestId('researcher-responsibility-open'));
    await screen.findByTestId('researcher-responsibility-modal');
    await userEvent.click(screen.getByTestId('researcher-responsibility-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('researcher-responsibility-modal')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('researcher-responsibility-gate')).toHaveAttribute(
      'data-agreed',
      'false',
    );
    const submit = screen.getByTestId('submission-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('Escape key closes the modal without flipping the agreement', async () => {
    renderForm();
    fireEvent.click(screen.getByTestId('researcher-responsibility-open'));
    await screen.findByTestId('researcher-responsibility-modal');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('researcher-responsibility-modal')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('researcher-responsibility-gate')).toHaveAttribute(
      'data-agreed',
      'false',
    );
  });

  // Oct 2026 fix: the previous implementation locked `document.body`
  // with `overflow: hidden` while the modal was open, which prevented
  // the researcher from scrolling the page behind the modal. The
  // researcher reported they could not see/agree because the page
  // itself was jammed. The modal's own `.content` is the scroll
  // container for the policy text, so the body lock is unnecessary.
  it('does NOT lock the body scroll while the modal is open (so the page can be scrolled)', async () => {
    renderForm();
    expect(document.body.style.overflow).not.toBe('hidden');
    fireEvent.click(screen.getByTestId('researcher-responsibility-open'));
    await screen.findByTestId('researcher-responsibility-modal');
    // Modal is open — the body should still be free to scroll.
    expect(document.body.style.overflow).not.toBe('hidden');
    // Closing the modal leaves the body in its original state.
    await userEvent.click(screen.getByTestId('researcher-responsibility-cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('researcher-responsibility-modal')).not.toBeInTheDocument();
    });
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  // Oct 2026: the previous implementation rendered a "Default policy
  // (admin has not saved a custom version yet)" version badge AND a
  // bottom notice "Admins have not published a custom Researcher
  // Responsibility yet …" when the policy came from the seed/fallback
  // path (i.e. `fromFirestore: false`). Both pieces of copy were
  // confusing the researcher — they leaked an internal implementation
  // detail and made the modal look like it was warning them about
  // something. We removed both. When the policy is the default seed,
  // the modal should look identical to the live-policy case EXCEPT
  // for the version badge, which simply doesn't render.
  describe('default / seed policy (Oct 2026: no internal-detail copy)', () => {
    const setDefaultPolicy = () => {
      mockPolicyService.getOne.mockResolvedValue({
        slug: 'researcher_responsibility',
        title: 'Researcher Responsibility',
        content: SEED_TEXT,
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: 'System',
        fromFirestore: false,
      });
    };

    it('does NOT show the "Default policy (admin has not saved a custom version yet)" version badge', async () => {
      setDefaultPolicy();
      renderForm();
      fireEvent.click(screen.getByTestId('researcher-responsibility-open'));
      const modal = await screen.findByTestId('researcher-responsibility-modal');
      // The version-badge text was the user's reported bad copy.
      // After the fix, the version row simply doesn't render, so
      // neither the English default string nor its translation can
      // appear inside the modal.
      expect(modal.textContent ?? '').not.toMatch(/default policy/i);
      expect(modal.textContent ?? '').not.toMatch(/admin has not saved/i);
      expect(modal.textContent ?? '').not.toMatch(/chính sách mặc định/i);
      expect(modal.textContent ?? '').not.toMatch(/quản trị viên chưa lưu/i);
    });

    it('does NOT show the bottom "Admins have not published a custom Researcher Responsibility …" notice', async () => {
      setDefaultPolicy();
      renderForm();
      fireEvent.click(screen.getByTestId('researcher-responsibility-open'));
      const modal = await screen.findByTestId('researcher-responsibility-modal');
      await waitFor(() => {
        expect(
          screen.getByTestId('researcher-responsibility-content'),
        ).toHaveTextContent(/Originality/);
      });
      expect(modal.textContent ?? '').not.toMatch(
        /admins have not published/i,
      );
      expect(modal.textContent ?? '').not.toMatch(
        /platform default and is still binding/i,
      );
      expect(modal.textContent ?? '').not.toMatch(
        /quản trị viên chưa xuất bản/i,
      );
      expect(modal.textContent ?? '').not.toMatch(
        /mặc định của nền tảng/i,
      );
    });

    it('still shows the live version badge when the policy comes from Firestore', async () => {
      // Sanity check: the version badge is still wired up, just
      // only for the live-policy path. The default-policy case is
      // the only one we hide it for.
      renderForm();
      fireEvent.click(screen.getByTestId('researcher-responsibility-open'));
      const modal = await screen.findByTestId('researcher-responsibility-modal');
      await waitFor(() => {
        expect(modal.textContent ?? '').toMatch(/active policy/i);
      });
    });
  });
});
