import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileText, Save, Send } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { useFirebaseUpload } from '../../../hooks/useFirebaseUpload';
import { openAlexAdapter, type OpenAlexLookupOutcome } from './openalexAdapter';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { Button } from '../../../components/Button/Button';
import styles from './researcher.module.css';

const PAPER_UPLOAD_FOLDER = 'researcher_papers/';

type OpenAlexUiState =
  | { stage: 'idle' }
  | { stage: 'invalid'; message: string }
  | { stage: 'unsupported'; message: string }
  | { stage: 'confirmed'; id: string }
  | { stage: 'skipped' };

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ResearcherSubmissionForm — Researcher-only manuscript creation.
//
// Visual: sectioned form (Required metadata, Manuscript PDF, OpenAlex
// link, Submit). Tokens come from ars-tokens.css; the section markers
// are role-coloured with the Researcher amber accent. No inline styles
// anywhere in the JSX; all layout lives in researcher.module.css.
//
// Behaviour (unchanged from the legacy version):
//   - PDF upload must complete before the form can submit.
//   - OpenAlex lookup is an additive, FE-only boundary that validates
//     the format and shows a preview before attaching the ID.
//   - Save draft keeps the paper in DRAFT status; Submit advances to
//     SUBMITTED via the adapter.

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

  const [openAlexDraft, setOpenAlexDraft] = useState('');
  const [openAlexState, setOpenAlexState] = useState<OpenAlexUiState>({ stage: 'idle' });
  const [openAlexScanning, setOpenAlexScanning] = useState(false);

  const handleScanOpenAlex = async () => {
    if (!openAlexDraft.trim()) {
      setOpenAlexState({
        stage: 'invalid',
        message:
          'Enter an OpenAlex work ID (e.g. W2741809807) or use manual entry.',
      });
      return;
    }
    setOpenAlexScanning(true);
    setOpenAlexState({ stage: 'idle' });
    try {
      const outcome: OpenAlexLookupOutcome = await openAlexAdapter.lookupPreview(openAlexDraft);
      switch (outcome.status) {
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

  const handleSkipOpenAlex = () => {
    setOpenAlexState({ stage: 'skipped' });
    setOpenAlexDraft('');
  };

  const handleManualFallbackOpenAlex = () => {
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
      setError(
        'Title, abstract, first author, institution, and a completed PDF upload are required.',
      );
      return;
    }
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
            id: '',
            name: authorName.trim(),
            institutionIds: [],
            order: 1,
          },
        ],
        institutions: [{ id: '', name: institution.trim() }],
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
    <section className={styles.page}>
      <PageHeader
        eyebrow="RESEARCHER WORKSPACE"
        title="New submission"
        description="Prepare manuscript metadata for Admin screening. Reviewer selection is performed by Admin only."
        accent="var(--ars-researcher)"
      />

      {error && (
        <ErrorBanner
          tone="error"
          title="Could not save submission"
          message={error}
        />
      )}

      <form
        className={styles.formCard}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(true);
        }}
        aria-label="New submission form"
      >
        {/* ── Required metadata ──────────────────────────────────── */}
        <section className={styles.formSection} aria-labelledby="form-section-metadata">
          <header className={styles.formSectionHeader}>
            <h2 className={styles.formSectionTitle} id="form-section-metadata">
              Required metadata
            </h2>
            <p className={styles.formSectionHint}>
              All five fields are required before Admin will accept the submission.
            </p>
          </header>

          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.full}`}>
              <label htmlFor="submission-title">Title</label>
              <input
                id="submission-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Manuscript title"
              />
            </div>

            <div className={`${styles.field} ${styles.full}`}>
              <label htmlFor="submission-abstract">Abstract</label>
              <textarea
                id="submission-abstract"
                rows={6}
                value={abstract}
                onChange={(event) => setAbstract(event.target.value)}
                placeholder="Provide a structured abstract (objectives, methods, results, conclusions)."
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="submission-author">First author</label>
              <input
                id="submission-author"
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                placeholder="Full name"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="submission-institution">Institution</label>
              <input
                id="submission-institution"
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
                placeholder="Primary affiliation"
              />
            </div>

            <div className={styles.field}>
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

            <div className={styles.field}>
              <label htmlFor="submission-keywords">Keywords</label>
              <input
                id="submission-keywords"
                placeholder="Comma separated"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ── Manuscript PDF ─────────────────────────────────────── */}
        <section className={styles.formSection} aria-labelledby="form-section-pdf">
          <header className={styles.formSectionHeader}>
            <h2 className={styles.formSectionTitle} id="form-section-pdf">
              Manuscript PDF
            </h2>
            <p className={styles.formSectionHint}>PDF only, up to 10 MB.</p>
          </header>

          <div className={`${styles.field} ${styles.full}`}>
            <div className={styles.fieldFile}>
              <label htmlFor="submission-file">Upload Paper (PDF)</label>
              <input
                id="submission-file"
                data-testid="submission-file"
                type="file"
                accept="application/pdf"
                onChange={(event) => void handleFileInput(event)}
                disabled={isUploading || saving}
              />
            </div>

            {uploadedFile && (
              <p
                className={styles.fieldHint}
                data-testid="submission-file-filename"
                aria-live="polite"
              >
                <FileText size={12} aria-hidden /> {uploadedFile.name} ·{' '}
                {formatBytes(uploadedFile.size)}
              </p>
            )}

            {isUploading && (
              <div className={styles.fileStatusRow} data-testid="submission-file-progress" aria-live="polite">
                <span>Uploading PDF… {progress}%</span>
                <div
                  className={styles.progressBar}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={styles.progressFill}
                    style={{ ['--progress-fill' as string]: `${progress}%` } as React.CSSProperties}
                  />
                </div>
              </div>
            )}

            {pdfUrl && !isUploading && (
              <p className={styles.fileStatusRow} data-testid="submission-file-url">
                <CheckCircle2 size={12} aria-hidden /> <strong>Upload complete.</strong>
                <span>The submit button unlocks once all required fields are valid.</span>
              </p>
            )}

            {fileError && (
              <ErrorBanner
                tone="error"
                title="Manuscript upload failed"
                message={fileError}
                data-testid="submission-file-error"
                retry={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleRetry()}
                  >
                    Retry upload
                  </Button>
                }
              />
            )}

            {!isUploading && uploadedFile && pdfUrl && !fileError && (
              <div className={styles.actionsRow}>
                <Button variant="outline" size="sm" onClick={handleRemoveUpload}>
                  Remove file
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* ── OpenAlex Work ID (optional) ───────────────────────── */}
        <section className={styles.formSection} aria-labelledby="form-section-openalex">
          <header className={styles.formSectionHeader}>
            <h2 className={styles.formSectionTitle} id="form-section-openalex">
              OpenAlex link (optional)
            </h2>
            <p className={styles.formSectionHint}>No network call is issued from the browser.</p>
          </header>

          <div className={`${styles.field} ${styles.full}`}>
            <label htmlFor="submission-openalex">OpenAlex Work ID</label>
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
            <p className={styles.fieldHint}>
              Paste an OpenAlex work ID. The form validates the identifier and shows a
              preview before attaching it to the submission. DOI and full URL forms
              are not yet supported by the research submission form.
            </p>

            {openAlexState.stage === 'idle' && (
              <div className={styles.actionsRow}>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!openAlexDraft.trim() || openAlexScanning}
                  onClick={() => void handleScanOpenAlex()}
                  data-testid="submission-openalex-scan"
                >
                  {openAlexScanning ? 'Scanning…' : 'Scan OpenAlex'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualFallbackOpenAlex}
                  data-testid="submission-openalex-manual"
                >
                  Enter manually
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkipOpenAlex}
                  data-testid="submission-openalex-skip"
                >
                  Skip
                </Button>
              </div>
            )}

            {openAlexState.stage === 'invalid' && (
              <ErrorBanner
                tone="error"
                title="Invalid OpenAlex ID"
                message={openAlexState.message}
                data-testid="submission-openalex-invalid"
                retry={
                  <div className={styles.actionsRow}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOpenAlexState({ stage: 'idle' })}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleManualFallbackOpenAlex}
                    >
                      Enter manually instead
                    </Button>
                  </div>
                }
              />
            )}

            {openAlexState.stage === 'unsupported' && (
              <ErrorBanner
                tone="warning"
                title="OpenAlex preview unavailable"
                message={openAlexState.message}
                data-testid="submission-openalex-unsupported"
                retry={
                  <div className={styles.actionsRow}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOpenAlexState({ stage: 'idle' })}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleManualFallbackOpenAlex}
                    >
                      Enter manually instead
                    </Button>
                  </div>
                }
              />
            )}

            {openAlexState.stage === 'confirmed' && (
              <p className={styles.openAlexConfirm} data-testid="submission-openalex-confirmed">
                <CheckCircle2 size={12} aria-hidden />
                <span>OpenAlex ID attached:</span>
                <strong>{openAlexState.id}</strong>
                <button
                  type="button"
                  className={styles.openAlexLink}
                  onClick={() => setOpenAlexState({ stage: 'idle' })}
                >
                  Change
                </button>
              </p>
            )}

            {openAlexState.stage === 'skipped' && (
              <p className={styles.openAlexConfirm} data-testid="submission-openalex-skipped">
                <AlertTriangle size={12} aria-hidden />
                <span>OpenAlex lookup skipped.</span>
                <button
                  type="button"
                  className={styles.openAlexLink}
                  onClick={() => setOpenAlexState({ stage: 'idle' })}
                >
                  Provide an ID
                </button>
              </p>
            )}
          </div>
        </section>

        <footer className={styles.formFooter}>
          <p className={styles.formHint}>
            Submitting routes the manuscript to Admin screening. You can save a draft
            without submitting to review the metadata first.
          </p>
          <div className={styles.formActionButtons}>
            <Button
              variant="outline"
              size="md"
              disabled={saving || !canSubmit}
              onClick={() => void submit(false)}
              leftIcon={<Save size={14} aria-hidden />}
              data-testid="submission-save-draft"
            >
              Save draft
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!canSubmit}
              leftIcon={<Send size={14} aria-hidden />}
              data-testid="submission-submit"
            >
              {saving ? 'Saving…' : 'Submit to Admin'}
            </Button>
          </div>
        </footer>
      </form>
    </section>
  );
};

export default ResearcherSubmissionForm;