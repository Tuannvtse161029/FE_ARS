import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicationAdapter } from '../api/publication.adapter';
import { useFirebaseUpload } from '../../../hooks/useFirebaseUpload';
import { PublicationDemoBanner } from '../components/PublicationDemoBanner';
import { openAlexAdapter, type OpenAlexLookupOutcome } from './openalexAdapter';
import shared from '../components/PublicationShared.module.css';
import type { OpenAlexScanPreview } from './openalex';

const PAPER_UPLOAD_FOLDER = 'researcher_papers/';

type OpenAlexUiState =
  | { stage: 'idle' }
  | { stage: 'invalid'; message: string }
  | { stage: 'unsupported'; message: string }
  | { stage: 'preview'; preview: OpenAlexScanPreview }
  | { stage: 'confirmed'; id: string }
  | { stage: 'skipped' };

export const ResearcherSubmissionForm = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [institution, setInstitution] = useState('');
  const [paperType, setPaperType] = useState('Research article');
  const [keywords, setKeywords] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── PDF upload (Upload Paper (PDF)) ─────────────────────────────────────────
  const {
    uploadPdf,
    progress,
    isUploading,
    error: uploadError,
    pdfUrl,
    resetUpload,
  } = useFirebaseUpload(PAPER_UPLOAD_FOLDER);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedAt, setUploadedAt] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const submissionIdRef = useRef(0);

  // Hold the canonical firebase URL until the researcher presses Submit.
  // The form must not pass a stale/empty URL into the draft payload.
  useEffect(() => {
    if (uploadError) {
      setFileError(uploadError);
      setUploadedFile(null);
      setUploadedAt(null);
    }
  }, [uploadError]);

  useEffect(() => {
    if (pdfUrl && uploadedFile && uploadedAt === null) {
      setFileError(null);
      setUploadedAt(Date.now());
    }
  }, [pdfUrl, uploadedFile, uploadedAt]);

  const validateClientSide = (file: File): string | null => {
    if (file.type !== 'application/pdf') {
      return 'Only PDF files are allowed.';
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'File size must be 10 MB or less.';
    }
    return null;
  };

  const handleFileSelected = async (file: File | null) => {
    if (!file || inFlightRef.current) return;
    const validation = validateClientSide(file);
    if (validation) {
      setFileError(validation);
      setUploadedFile(null);
      setUploadedAt(null);
      resetUpload();
      return;
    }
    // Begin a new upload attempt; preserve any previous error visible
    // until the new upload completes (success or failure).
    inFlightRef.current = true;
    setUploadedFile(file);
    setUploadedAt(null);
    try {
      await uploadPdf(file);
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    try {
      await handleFileSelected(file);
    } finally {
      // Always reset the input so re-selecting the same file fires onChange.
      event.target.value = '';
    }
  };

  const handleRetry = async () => {
    if (!uploadedFile) return;
    setFileError(null);
    setUploadedAt(null);
    resetUpload();
    await handleFileSelected(uploadedFile);
  };

  const handleRemoveUpload = () => {
    resetUpload();
    setUploadedFile(null);
    setUploadedAt(null);
    setFileError(null);
  };

  // ── OpenAlex ID ─────────────────────────────────────────────────────────────
  const [openAlexDraft, setOpenAlexDraft] = useState('');
  const [openAlexState, setOpenAlexState] = useState<OpenAlexUiState>({ stage: 'idle' });
  const [openAlexScanning, setOpenAlexScanning] = useState(false);

  const handleScanOpenAlex = async () => {
    if (!openAlexDraft.trim()) {
      setOpenAlexState({ stage: 'invalid', message: 'Enter an OpenAlex work ID (e.g. W2741809807) or use manual entry.' });
      return;
    }
    setOpenAlexScanning(true);
    setOpenAlexState({ stage: 'idle' });
    try {
      const outcome: OpenAlexLookupOutcome = await openAlexAdapter.lookupPreview(openAlexDraft);
      switch (outcome.status) {
        case 'preview':
          setOpenAlexState({ stage: 'preview', preview: outcome.preview });
          break;
        case 'invalid_format':
          setOpenAlexState({ stage: 'invalid', message: outcome.message });
          break;
        case 'unsupported_variant':
          setOpenAlexState({ stage: 'unsupported', message: outcome.message });
          break;
        case 'unavailable':
          setOpenAlexState({ stage: 'unsupported', message: outcome.message });
          break;
      }
    } finally {
      setOpenAlexScanning(false);
    }
  };

  const handleConfirmOpenAlex = () => {
    if (openAlexState.stage === 'preview') {
      setOpenAlexState({ stage: 'confirmed', id: openAlexState.preview.id });
    }
  };

  const handleEditOpenAlex = () => {
    setOpenAlexState({ stage: 'idle' });
  };

  const handleSkipOpenAlex = () => {
    setOpenAlexState({ stage: 'skipped' });
    setOpenAlexDraft('');
  };

  const handleManualFallbackOpenAlex = () => {
    // Manual fallback means: stop attempting to scan, accept the raw value
    // verbatim and let the BE reconcile it later. We only allow this when
    // the raw value has at least 4 characters to avoid typos silently
    // becoming identifiers.
    const trimmed = openAlexDraft.trim();
    if (trimmed.length < 4) {
      setOpenAlexState({
        stage: 'invalid',
        message: 'Manual fallback requires at least 4 characters.',
      });
      return;
    }
    setOpenAlexState({ stage: 'confirmed', id: trimmed });
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const canSubmit =
    !saving &&
    !inFlightRef.current &&
    !!pdfUrl &&
    uploadedAt !== null &&
    !!title.trim() &&
    !!abstract.trim() &&
    !!authorName.trim() &&
    !!institution.trim();

  const submit = async (sendToAdmin: boolean) => {
    if (!canSubmit) {
      setError('Title, abstract, first author, institution, and a completed PDF upload are required.');
      return;
    }
    // Duplicate-submit protection: every successful submit gets a fresh id.
    const submissionId = ++submissionIdRef.current;
    setSaving(true);
    setError(null);
    try {
      const trimmedOpenAlex =
        openAlexState.stage === 'confirmed' ? openAlexState.id.trim() : undefined;
      const draft = await publicationAdapter.createDraft({
        title: title.trim(),
        abstract: abstract.trim(),
        authors: [
          {
            id: 'current-author',
            name: authorName.trim(),
            institutionIds: ['current-institution'],
            order: 1,
          },
        ],
        institutions: [{ id: 'current-institution', name: institution.trim() }],
        paperType,
        keywords: keywords
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        topics: [],
        fileUrl: pdfUrl ?? undefined,
        openAlexId: trimmedOpenAlex,
      });
      const paper = sendToAdmin ? await publicationAdapter.submitPaper(draft.id) : draft;
      navigate(`/researcher/submissions/${paper.id}`);
    } catch {
      // Preserve the submission id so retries do not double-fire.
      if (submissionIdRef.current === submissionId) {
        setError('The draft could not be saved.');
      }
    } finally {
      if (submissionIdRef.current === submissionId) {
        setSaving(false);
      }
    }
  };

  return (
    <section className={shared.page}>
      <header className={shared.header}>
        <div>
          <h1>New Submission</h1>
          <p>Prepare manuscript metadata for Admin screening. Reviewer selection is performed by Admin only.</p>
        </div>
      </header>
      <PublicationDemoBanner />
      {error && (
        <div className={shared.error} role="alert">
          {error}
        </div>
      )}
      <form
        className={shared.panel}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(true);
        }}
      >
        <div className={shared.formGrid}>
          <div className={`${shared.field} ${shared.full}`}>
            <label htmlFor="submission-title">Title</label>
            <input id="submission-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className={`${shared.field} ${shared.full}`}>
            <label htmlFor="submission-abstract">Abstract</label>
            <textarea
              id="submission-abstract"
              rows={6}
              value={abstract}
              onChange={(event) => setAbstract(event.target.value)}
            />
          </div>

          <div className={shared.field}>
            <label htmlFor="submission-author">First author</label>
            <input
              id="submission-author"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
            />
          </div>

          <div className={shared.field}>
            <label htmlFor="submission-institution">Institution</label>
            <input
              id="submission-institution"
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
            />
          </div>

          <div className={shared.field}>
            <label htmlFor="submission-type">Paper type</label>
            <select
              id="submission-type"
              value={paperType}
              onChange={(event) => setPaperType(event.target.value)}
            >
              <option>Research article</option>
              <option>Methodology article</option>
              <option>Review article</option>
            </select>
          </div>

          <div className={shared.field}>
            <label htmlFor="submission-keywords">Keywords</label>
            <input
              id="submission-keywords"
              placeholder="Comma separated"
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
            />
          </div>

          {/* ── Upload Paper (PDF) ─────────────────────────────────────────── */}
          <div className={`${shared.field} ${shared.full}`}>
            <label htmlFor="submission-file">Upload Paper (PDF)</label>
            <input
              id="submission-file"
              data-testid="submission-file"
              type="file"
              accept="application/pdf"
              onChange={(event) => void handleFileInput(event)}
              disabled={isUploading || saving}
            />
            {uploadedFile && (
              <p
                className={shared.fieldHint}
                data-testid="submission-file-filename"
                aria-live="polite"
              >
                {uploadedFile.name}
              </p>
            )}
            {isUploading && (
              <p className={shared.fieldHint} data-testid="submission-file-progress" aria-live="polite">
                Uploading PDF... {progress}%
              </p>
            )}
            {pdfUrl && !isUploading && (
              <p className={shared.fieldHint} data-testid="submission-file-url">
                Firebase URL captured. The submit button unlocks once all required fields are valid.
              </p>
            )}
            {fileError && (
              <p className={shared.error} role="alert" data-testid="submission-file-error">
                {fileError}
              </p>
            )}
            <div className={shared.actions} style={{ marginTop: 8 }}>
              {isUploading ? null : uploadedFile && fileError ? (
                <button
                  type="button"
                  className={shared.buttonSecondary}
                  onClick={() => void handleRetry()}
                  data-testid="submission-file-retry"
                >
                  Retry upload
                </button>
              ) : uploadedFile && pdfUrl ? (
                <button
                  type="button"
                  className={shared.buttonSecondary}
                  onClick={handleRemoveUpload}
                  data-testid="submission-file-remove"
                >
                  Remove file
                </button>
              ) : null}
            </div>
          </div>

          {/* ── OpenAlex ID (optional, with scan preview + manual fallback) ── */}
          <div className={`${shared.field} ${shared.full}`}>
            <label htmlFor="submission-openalex">OpenAlex Work ID (optional)</label>
            <input
              id="submission-openalex"
              data-testid="submission-openalex-input"
              placeholder="e.g. W2741809807"
              value={openAlexDraft}
              onChange={(event) => setOpenAlexDraft(event.target.value)}
              disabled={
                openAlexState.stage === 'confirmed' ||
                openAlexState.stage === 'skipped' ||
                openAlexScanning
              }
            />
            <p className={shared.fieldHint}>
              Paste an OpenAlex work ID. The form validates the identifier and shows a preview before
              attaching it to the submission. No OpenAlex network call is made from the browser.
            </p>

            {openAlexState.stage === 'idle' && (
              <div className={shared.actions} style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className={
                    openAlexDraft.trim() && !openAlexScanning
                      ? shared.buttonOpenAlex
                      : shared.buttonSecondary
                  }
                  data-testid="submission-openalex-scan"
                  disabled={!openAlexDraft.trim() || openAlexScanning}
                  onClick={() => void handleScanOpenAlex()}
                >
                  {openAlexScanning ? 'Scanning...' : 'Scan OpenAlex'}
                </button>
                <button
                  type="button"
                  className={shared.buttonGhost}
                  data-testid="submission-openalex-manual"
                  onClick={handleManualFallbackOpenAlex}
                >
                  Enter manually
                </button>
                <button
                  type="button"
                  className={shared.buttonGhost}
                  data-testid="submission-openalex-skip"
                  onClick={handleSkipOpenAlex}
                >
                  Skip
                </button>
              </div>
            )}

            {openAlexState.stage === 'invalid' && (
              <div className={shared.error} role="alert" data-testid="submission-openalex-invalid">
                {openAlexState.message}
                <div className={shared.actions} style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className={shared.buttonSecondary}
                    onClick={() => setOpenAlexState({ stage: 'idle' })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={shared.buttonGhost}
                    onClick={handleManualFallbackOpenAlex}
                  >
                    Enter manually instead
                  </button>
                </div>
              </div>
            )}

            {openAlexState.stage === 'unsupported' && (
              <div className={shared.error} role="alert" data-testid="submission-openalex-unsupported">
                {openAlexState.message}
                <div className={shared.actions} style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className={shared.buttonSecondary}
                    onClick={() => setOpenAlexState({ stage: 'idle' })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={shared.buttonGhost}
                    onClick={handleManualFallbackOpenAlex}
                  >
                    Enter manually instead
                  </button>
                </div>
              </div>
            )}

            {openAlexState.stage === 'preview' && (
              <div className={shared.panel} style={{ marginTop: 8 }} data-testid="submission-openalex-preview">
                <p>
                  <strong>ID:</strong> {openAlexState.preview.id}
                </p>
                <p>
                  <strong>Title:</strong> {openAlexState.preview.display.title}
                </p>
                <p>
                  <strong>Summary:</strong> {openAlexState.preview.display.summary}
                </p>
                <p className={shared.fieldHint}>{openAlexState.preview.display.sourceLabel}</p>
                <div className={shared.actions} style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className={shared.button}
                    data-testid="submission-openalex-confirm"
                    onClick={handleConfirmOpenAlex}
                  >
                    Confirm OpenAlex ID
                  </button>
                  <button
                    type="button"
                    className={shared.buttonSecondary}
                    data-testid="submission-openalex-edit"
                    onClick={handleEditOpenAlex}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={shared.buttonGhost}
                    onClick={handleManualFallbackOpenAlex}
                  >
                    Enter manually
                  </button>
                </div>
              </div>
            )}

            {openAlexState.stage === 'confirmed' && (
              <p className={shared.fieldHint} data-testid="submission-openalex-confirmed">
                OpenAlex ID attached: <strong>{openAlexState.id}</strong> ·{' '}
                <button
                  type="button"
                  className={shared.buttonGhost}
                  onClick={() => setOpenAlexState({ stage: 'idle' })}
                >
                  Change
                </button>
              </p>
            )}

            {openAlexState.stage === 'skipped' && (
              <p className={shared.fieldHint} data-testid="submission-openalex-skipped">
                OpenAlex lookup skipped. ·{' '}
                <button
                  type="button"
                  className={shared.buttonGhost}
                  onClick={() => setOpenAlexState({ stage: 'idle' })}
                >
                  Provide an ID
                </button>
              </p>
            )}
          </div>
        </div>

        <div className={shared.actions} style={{ marginTop: 18 }}>
          <button
            type="button"
            className={shared.buttonSecondary}
            disabled={saving || !canSubmit}
            onClick={() => void submit(false)}
            data-testid="submission-save-draft"
          >
            Save draft
          </button>
          <button
            type="submit"
            className={shared.button}
            disabled={!canSubmit}
            data-testid="submission-submit"
          >
            {saving ? 'Saving...' : 'Submit to Admin'}
          </button>
        </div>
      </form>
    </section>
  );
};

export default ResearcherSubmissionForm;
