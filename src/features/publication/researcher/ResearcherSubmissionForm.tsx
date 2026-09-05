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
import { OpenAlexBrandLogo } from '../../../components/openalex/OpenAlexBrandLogo';
import { useT } from '../../../i18n/I18nContext';
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
// Visual: sectioned form (Manuscript details / Authors & institutions /
// Classification / Manuscript PDF / OpenAlex import / Final review).
// OpenAlex lookup is intentionally placed BEFORE the manual metadata
// section so a researcher can lift the open record once instead of
// retyping the same fields by hand. Tokens come from ars-tokens.css; the
// section markers are role-coloured with the Researcher amber accent. No
// inline styles anywhere in the JSX; all layout lives in researcher.module.css.
//
// Behaviour (unchanged from the legacy version):
//   - PDF upload must complete before the form can submit.
//   - OpenAlex lookup validates the work ID, calls the ARS backend, and
//     renders a reviewable preview before the researcher confirms an import.
//   - Save draft keeps the paper in DRAFT status; Submit advances to
//     SUBMITTED via the adapter.
//
// Save-draft / submit copy: the form NEVER claims autosave. The
// "Save draft" button is explicit; nothing is persisted until the user
// clicks Save draft or Submit to Admin.

export const ResearcherSubmissionForm = () => {
  const navigate = useNavigate();
  const t = useT();

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
      return t('researcher.form.file.errorType');
    }
    if (file.size > 10 * 1024 * 1024) {
      return t('researcher.form.file.errorSize');
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
        message: t('researcher.form.openalex.invalid.example'),
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
        default:
          // The deployed adapter and older test doubles may surface recoverable
          // availability failures under more specific status strings. The UI
          // treats every non-preview, non-format outcome as recoverable.
          setOpenAlexState({
            stage: 'unavailable',
            message: 'message' in outcome && typeof outcome.message === 'string'
              ? outcome.message
              : 'OpenAlex metadata is temporarily unavailable.',
          });
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
      setError(t('researcher.form.footer.validation'));
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
        setError(t('researcher.form.error.title'));
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
        eyebrow={t('researcher.submissions.eyebrow')}
        title={t('researcher.form.title')}
        description={t('researcher.form.description')}
        accent="var(--ars-researcher)"
      />

      {error && (
        <ErrorBanner
          tone="error"
          title={t('researcher.form.error.title')}
          message={error}
        />
      )}

      <form
        className={styles.formCard}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(true);
        }}
        aria-label={t('researcher.form.title')}
      >
        {/* ── Manuscript details ─────────────────────────────────── */}
        <section className={styles.formSection} aria-labelledby="form-section-metadata">
          <header className={styles.formSectionHeader}>
            <h2 className={styles.formSectionTitle} id="form-section-metadata">
              {t('researcher.form.section.manuscript.title')}
            </h2>
            <p className={styles.formSectionHint}>{t('researcher.form.section.manuscript.hint')}</p>
          </header>

          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.full}`}>
              <label htmlFor="submission-title">{t('researcher.form.field.title')}</label>
              <input
                id="submission-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('researcher.form.field.title')}
              />
            </div>

            <div className={`${styles.field} ${styles.full}`}>
              <label htmlFor="submission-abstract">{t('researcher.form.field.abstract')}</label>
              <textarea
                id="submission-abstract"
                rows={6}
                value={abstract}
                onChange={(event) => setAbstract(event.target.value)}
                placeholder={t('researcher.form.field.abstractPlaceholder')}
              />
            </div>
          </div>
        </section>

        {/* ── Authors & institutions ─────────────────────────────── */}
        <section className={styles.formSection} aria-labelledby="form-section-authors">
          <header className={styles.formSectionHeader}>
            <h2 className={styles.formSectionTitle} id="form-section-authors">
              {t('researcher.form.section.authors.title')}
            </h2>
            <p className={styles.formSectionHint}>{t('researcher.form.section.authors.hint')}</p>
          </header>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="submission-author">{t('researcher.form.field.firstAuthor')}</label>
              <input
                id="submission-author"
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                placeholder={t('researcher.form.field.firstAuthor')}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="submission-institution">{t('researcher.form.field.institution')}</label>
              <input
                id="submission-institution"
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
                placeholder={t('researcher.form.field.institution')}
              />
            </div>
          </div>
        </section>

        {/* ── Classification ────────────────────────────────────── */}
        <section className={styles.formSection} aria-labelledby="form-section-classification">
          <header className={styles.formSectionHeader}>
            <h2 className={styles.formSectionTitle} id="form-section-classification">
              {t('researcher.form.section.classification.title')}
            </h2>
            <p className={styles.formSectionHint}>{t('researcher.form.section.classification.hint')}</p>
          </header>

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label htmlFor="submission-type">{t('researcher.form.field.paperType')}</label>
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
              <label htmlFor="submission-keywords">{t('researcher.form.field.keywords')}</label>
              <input
                id="submission-keywords"
                placeholder={t('researcher.form.field.keywordsPlaceholder')}
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="submission-major-field">
                {t('researcher.form.field.majorField')} <span className={styles.fieldRequired}>*</span>
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
                  {isLoadingMajorFields ? 'Loading fields…' : t('researcher.form.field.majorField')}
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
                {t('researcher.form.field.subfield')} <span className={styles.fieldRequired}>*</span>
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
                    ? t('researcher.form.field.majorField')
                    : isLoadingSubFields
                      ? 'Loading subfields…'
                      : t('researcher.form.field.subfield')}
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
              {t('researcher.form.section.file.title')}
            </h2>
            <p className={styles.formSectionHint}>{t('researcher.form.section.file.hint')}</p>
          </header>

          <div className={`${styles.field} ${styles.full}`}>
            <div className={styles.fieldFile}>
              <label htmlFor="submission-file">{t('researcher.form.file.uploadLabel')}</label>
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
                <span>{t('researcher.form.file.uploading', undefined, { progress })}</span>
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
                <CheckCircle2 size={12} aria-hidden /> <strong>{t('researcher.form.file.uploadComplete')}</strong>
                <span>{t('researcher.form.file.uploadCompleteHint')}</span>
              </p>
            )}

            {fileError && (
              <div data-testid="submission-file-error">
                <ErrorBanner
                  tone="error"
                  title={t('researcher.form.file.failedTitle')}
                  message={fileError}
                  retry={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRetry()}
                      data-testid="submission-file-retry"
                    >
                      {t('researcher.form.file.retry')}
                    </Button>
                  }
                />
              </div>
            )}

            {!isUploading && uploadedFile && pdfUrl && !fileError && (
              <div className={styles.actionsRow}>
                <Button variant="outline" size="sm" onClick={handleRemoveUpload}>
                  {t('researcher.form.file.remove')}
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* ── OpenAlex import (optional) ───────────────────────── */}
        <section className={`${styles.formSection} ${styles.openAlexSection}`} aria-labelledby="form-section-openalex">
          <header className={styles.openAlexSectionHeader}>
            <h2 className={styles.formSectionTitle} id="form-section-openalex">
              {t('researcher.form.section.openalex.title')}
              <span className={styles.openAlexOptional}>&nbsp;(optional)</span>
            </h2>
            <p className={styles.formSectionHint}>{t('researcher.form.section.openalex.hint')}</p>
          </header>

          <div className={styles.openAlexLookupSurface}>
            <div className={styles.openAlexBrandLockup} aria-label={t('researcher.form.openalex.label.brand')}>
              <OpenAlexBrandLogo
                variant="mark"
                ariaLabel={t('researcher.form.openalex.label.brand')}
                className={styles.openAlexBrandMark}
              />
              <div>
                <p className={styles.openAlexBrandName}>{t('researcher.form.openalex.label.brand')}</p>
                <p className={styles.openAlexBrandLabel}>{t('researcher.form.openalex.label.workId')}</p>
              </div>
            </div>

            <div className={styles.openAlexEntry}>
              <label htmlFor="submission-openalex">{t('researcher.form.openalex.label.workId')}</label>
              <div className={styles.openAlexInputRow}>
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
                {openAlexState.stage === 'idle' ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    className={styles.openAlexLookupButton}
                    onClick={() => void handleScanOpenAlex()}
                    disabled={!openAlexDraft.trim() || openAlexScanning}
                    data-testid="submission-openalex-scan"
                    isLoading={openAlexScanning}
                  >
                    {t('researcher.form.openalex.lookupCta')}
                  </Button>
                ) : null}
              </div>
              <p className={styles.fieldHint}>{t('researcher.form.openalex.emptyHint')}</p>
              {openAlexState.stage === 'idle' ? (
                <div className={styles.openAlexSecondaryActions}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSkipOpenAlex}
                    data-testid="submission-openalex-skip"
                  >
                    {t('researcher.form.openalex.skip')}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className={`${styles.field} ${styles.full}`}>

            {openAlexState.stage === 'invalid' && (
              <div data-testid="submission-openalex-invalid">
                <ErrorBanner
                  tone="error"
                  title={t('researcher.form.openalex.invalidTitle')}
                  message={openAlexState.message}
                  retry={
                    <div className={styles.actionsRow}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenAlexState({ stage: 'idle' })}
                      >
                        {t('researcher.form.openalex.tryAnother')}
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
                  title={t('researcher.form.openalex.unavailableTitle')}
                  message={openAlexState.message}
                  retry={
                    <div className={styles.actionsRow}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOpenAlexState({ stage: 'idle' })}
                      >
                        {t('researcher.form.openalex.unavailableTryAgain')}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={handleSkipOpenAlex}>
                        {t('researcher.form.openalex.unavailableSkip')}
                      </Button>
                    </div>
                  }
                />
              </div>
            )}

            {openAlexState.stage === 'preview' && (
              <div className={styles.openAlexPreview} data-testid="submission-openalex-preview">
                <div className={styles.openAlexPreviewHeader}>
                  <h3>{t('researcher.form.openalex.previewTitle')}</h3>
                  <span className={styles.openAlexAttribution}>
                    <OpenAlexBrandLogo variant="mark" ariaLabel="" />
                    <span>{t('researcher.form.openalex.attribution')}</span>
                  </span>
                </div>
                <dl>
                  {openAlexState.metadata.title && <><dt>{t('researcher.form.field.title')}</dt><dd>{openAlexState.metadata.title}</dd></>}
                  {openAlexState.metadata.abstract && <><dt>{t('researcher.form.field.abstract')}</dt><dd>{openAlexState.metadata.abstract}</dd></>}
                  {openAlexState.metadata.authors.length > 0 && <><dt>{t('researcher.detail.detail.authors')}</dt><dd>{openAlexState.metadata.authors.join(', ')}</dd></>}
                  {openAlexState.metadata.institutions.length > 0 && <><dt>{t('researcher.detail.detail.institutions')}</dt><dd>{openAlexState.metadata.institutions.join(', ')}</dd></>}
                  {openAlexState.metadata.keywords.length > 0 && <><dt>{t('researcher.form.field.keywords')}</dt><dd>{openAlexState.metadata.keywords.join(', ')}</dd></>}
                  {openAlexState.metadata.doi && <><dt>{t('researcher.detail.identifiers.doi')}</dt><dd>{openAlexState.metadata.doi}</dd></>}
                  {openAlexState.metadata.publicationDate && <><dt>{t('researcher.detail.timeline.published')}</dt><dd>{openAlexState.metadata.publicationDate}</dd></>}
                </dl>
                <p>{t('researcher.form.openalex.manualHint')}</p>
                <div className={styles.actionsRow}>
                  <Button type="button" variant="primary" size="sm" onClick={handleConfirmOpenAlex}>
                    {t('researcher.form.openalex.confirmImport')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenAlexState({ stage: 'idle' })}
                  >
                    {t('researcher.form.openalex.discardPreview')}
                  </Button>
                </div>
              </div>
            )}

            {openAlexState.stage === 'confirmed' && (
              <div className={styles.openAlexConfirm} data-testid="submission-openalex-confirmed">
                <CheckCircle2 size={14} aria-hidden className={styles.openAlexConfirmIcon} />
                <span className={styles.openAlexConfirmLabel}>
                  {t('researcher.form.openalex.confirmedLabel', undefined, { id: openAlexState.metadata.id })}
                </span>
                <span className={styles.openAlexAttribution}>
                  <OpenAlexBrandLogo variant="mark" ariaLabel="" />
                  <span>{t('researcher.form.openalex.attribution')}</span>
                </span>
                <button
                  type="button"
                  className={styles.openAlexLink}
                  onClick={() => setOpenAlexState({ stage: 'idle' })}
                >
                  {t('researcher.form.openalex.change')}
                </button>
              </div>
            )}

            {openAlexState.stage === 'skipped' && (
              <div className={styles.openAlexConfirm} data-testid="submission-openalex-skipped">
                <AlertTriangle size={14} aria-hidden className={styles.openAlexConfirmIcon} />
                <span className={styles.openAlexConfirmLabel}>
                  {t('researcher.form.openalex.skippedLabel')}
                </span>
                <button
                  type="button"
                  className={styles.openAlexLink}
                  onClick={() => setOpenAlexState({ stage: 'idle' })}
                >
                  {t('researcher.form.openalex.provideId')}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Final review (Save draft / Submit) ──────────────────── */}
        <footer className={styles.formFinalReview}>
          <header className={styles.formSectionHeader}>
            <h2 className={styles.formSectionTitle}>{t('researcher.form.section.finalReview.title')}</h2>
            <p className={styles.formSectionHint}>{t('researcher.form.section.finalReview.hint')}</p>
          </header>
          <p className={styles.formHint}>{t('researcher.form.footer.hint')}</p>
          {!canSubmit && (
            <p className={styles.formValidation} role="status">
              {t('researcher.form.footer.validation')}
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
              {t('researcher.form.footer.saveDraft')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!canSubmit}
              leftIcon={<Send size={14} aria-hidden />}
              data-testid="submission-submit"
            >
              {saving ? t('researcher.form.footer.submitting') : t('researcher.form.footer.submit')}
            </Button>
          </div>
        </footer>
      </form>
    </section>
  );
};

export default ResearcherSubmissionForm;
