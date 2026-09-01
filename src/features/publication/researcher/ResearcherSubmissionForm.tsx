import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileText, Save, Send } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import { useFirebaseUpload } from '../../../hooks/useFirebaseUpload';
import { useMajorFields, useSubFields } from '../../../hooks/useMajorFields';
import {
  openAlexAdapter,
  type OpenAlexImportedMetadata,
  type OpenAlexLookupOutcome,
} from './openalexAdapter';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { Button } from '../../../components/Button/Button';
import styles from './researcher.module.css';

const PAPER_UPLOAD_FOLDER = 'researcher_papers/';

type OpenAlexUiState =
  | { stage: 'idle' }
  | { stage: 'invalid'; message: string }
  | { stage: 'unavailable'; message: string }
  | { stage: 'preview'; metadata: OpenAlexImportedMetadata }
  | { stage: 'confirmed'; metadata: OpenAlexImportedMetadata }
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
//   - OpenAlex lookup validates the work ID, calls the ARS backend, and
//     renders a reviewable preview before the researcher confirms an import.
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
  const [selectedMajorFieldId, setSelectedMajorFieldId] = useState<number | null>(null);
  const [selectedSubFieldId, setSelectedSubFieldId] = useState<number | null>(null);

  const { fields: majorFields, isLoading: isLoadingMajorFields } = useMajorFields();
  const { subFields, isLoading: isLoadingSubFields } = useSubFields(selectedMajorFieldId);

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
        case 'preview':
          setOpenAlexState({ stage: 'preview', metadata: outcome.metadata });
          break;
        case 'invalid_format':
          setOpenAlexState({ stage: 'invalid', message: outcome.message });
          break;
        case 'unsupported_variant':
        case 'unavailable':
          setOpenAlexState({ stage: 'unavailable', message: outcome.message });
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

  const handleConfirmOpenAlex = () => {
    if (openAlexState.stage !== 'preview') return;
    const { metadata } = openAlexState;
    setTitle((current) => current || metadata.title || '');
    setAbstract((current) => current || metadata.abstract || '');
    setAuthorName((current) => current || metadata.authors[0] || '');
    setInstitution((current) => current || metadata.institutions[0] || '');
    setKeywords((current) => current || metadata.keywords.join(', '));
    setOpenAlexState({ stage: 'confirmed', metadata });
  };

  const canSubmit =
    !saving &&
    !inFlightRef.current &&
    !!pdfUrl &&
    uploadedAt !== null &&
    !!title.trim() &&
    !!abstract.trim() &&
    !!authorName.trim() &&
    !!institution.trim() &&
    selectedMajorFieldId !== null &&
    selectedSubFieldId !== null;

  const submit = async (sendToAdmin: boolean) => {
    if (!canSubmit) {
      setError(
        'Title, abstract, first author, institution, major field, subfield, and a completed PDF upload are required.',
      );
      return;
    }
    const submissionId = ++submissionIdRef.current;
    setSaving(true);
    setError(null);
    try {
      const trimmedOpenAlex =
        openAlexState.stage === 'confirmed' ? openAlexState.metadata.id : undefined;
      const selectedMajorField = majorFields.find((f) => f.id === selectedMajorFieldId);
      const selectedSubField = subFields.find((f) => f.id === selectedSubFieldId);

      const draft = await publicationAdapter.createDraft({
        title: title.trim(),
        abstract: abstract.trim(),
        subFieldId: selectedSubFieldId ?? undefined,
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
        domain: selectedMajorField?.name ?? '',
        field: selectedMajorField?.name ?? '',
        subfield: selectedSubField?.name ?? '',
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
              All seven fields are required before Admin will accept the submission.
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

            <div className={styles.field}>
              <label htmlFor="submission-major-field">
                Major field <span className={styles.fieldRequired}>*</span>
              </label>
              <select
                id="submission-major-field"
                value={selectedMajorFieldId ?? ''}
                onChange={(event) => {
                  const val = event.target.value;
                  setSelectedMajorFieldId(val ? Number(val) : null);
                  setSelectedSubFieldId(null);
                }}
                disabled={isLoadingMajorFields}
              >
                <option value="">
                  {isLoadingMajorFields ? 'Loading fields…' : 'Select a major field'}
                </option>
                {majorFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="submission-subfield">
                Subfield <span className={styles.fieldRequired}>*</span>
              </label>
              <select
                id="submission-subfield"
                value={selectedSubFieldId ?? ''}
                onChange={(event) => {
                  const val = event.target.value;
                  setSelectedSubFieldId(val ? Number(val) : null);
                }}
                disabled={!selectedMajorFieldId || isLoadingSubFields}
              >
                <option value="">
                  {!selectedMajorFieldId
                    ? 'Select a major field first'
                    : isLoadingSubFields
                      ? 'Loading subfields…'
                      : 'Select a subfield'}
                </option>
                {subFields.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
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
              <div data-testid="submission-file-error">
                <ErrorBanner
                  tone="error"
                  title="Manuscript upload failed"
                  message={fileError}
                  retry={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRetry()}
                      data-testid="submission-file-retry"
                    >
                      Retry upload
                    </Button>
                  }
                />
              </div>
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
              OpenAlex Scan (optional)
            </h2>
            <p className={styles.formSectionHint}>Review metadata before copying it into this form.</p>
          </header>

          <div className={`${styles.field} ${styles.full}`}>
            <label htmlFor="submission-openalex">OpenAlex ID</label>
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
              Enter a W-prefixed work ID. The scan requests metadata from the ARS backend;
              no data is copied until you confirm the preview.
            </p>

            {openAlexState.stage === 'idle' && (
              <div className={styles.actionsRow}>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!openAlexDraft.trim() || openAlexScanning}
                  onClick={() => void handleScanOpenAlex()}
                  data-testid="submission-openalex-scan"
                >
                  {openAlexScanning ? 'Scanning...' : 'OpenAlex Scan'}
                </Button>
                <Button
                  type="button"
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
              <div data-testid="submission-openalex-invalid">
                <ErrorBanner
                  tone="error"
                  title="Invalid OpenAlex ID"
                  message={openAlexState.message}
                  retry={
                    <div className={styles.actionsRow}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenAlexState({ stage: 'idle' })}
                      >
                        Try another ID
                      </Button>
                    </div>
                  }
                />
              </div>
            )}

            {openAlexState.stage === 'unavailable' && (
              <div data-testid="submission-openalex-unavailable">
                <ErrorBanner
                  tone="warning"
                  title="OpenAlex preview unavailable"
                  message={openAlexState.message}
                  retry={
                    <div className={styles.actionsRow}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenAlexState({ stage: 'idle' })}
                      >
                        Try again
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={handleSkipOpenAlex}>
                        Skip
                      </Button>
                    </div>
                  }
                />
              </div>
            )}

            {openAlexState.stage === 'preview' && (
              <div className={styles.openAlexPreview} data-testid="submission-openalex-preview">
                <h3>OpenAlex imported metadata</h3>
                <dl>
                  {openAlexState.metadata.title && <><dt>Title</dt><dd>{openAlexState.metadata.title}</dd></>}
                  {openAlexState.metadata.abstract && <><dt>Abstract</dt><dd>{openAlexState.metadata.abstract}</dd></>}
                  {openAlexState.metadata.authors.length > 0 && <><dt>Authors</dt><dd>{openAlexState.metadata.authors.join(', ')}</dd></>}
                  {openAlexState.metadata.institutions.length > 0 && <><dt>Institutions</dt><dd>{openAlexState.metadata.institutions.join(', ')}</dd></>}
                  {openAlexState.metadata.keywords.length > 0 && <><dt>Keywords</dt><dd>{openAlexState.metadata.keywords.join(', ')}</dd></>}
                  {openAlexState.metadata.doi && <><dt>DOI</dt><dd>{openAlexState.metadata.doi}</dd></>}
                  {openAlexState.metadata.publicationDate && <><dt>Publication date</dt><dd>{openAlexState.metadata.publicationDate}</dd></>}
                </dl>
                <p>ARS major field and subfield must be selected manually.</p>
                <div className={styles.actionsRow}>
                  <Button type="button" variant="primary" size="sm" onClick={handleConfirmOpenAlex}>
                    Use imported metadata
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenAlexState({ stage: 'idle' })}
                  >
                    Discard preview
                  </Button>
                </div>
              </div>
            )}

            {openAlexState.stage === 'confirmed' && (
              <p className={styles.openAlexConfirm} data-testid="submission-openalex-confirmed">
                <CheckCircle2 size={12} aria-hidden />
                <span>OpenAlex ID attached:</span>
                <strong>{openAlexState.metadata.id}</strong>
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
          {!canSubmit && (
            <p className={styles.formValidation} role="status">
              Submission remains unavailable until the required metadata (including major field and subfield), and a completed PDF upload are in place.
            </p>
          )}
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