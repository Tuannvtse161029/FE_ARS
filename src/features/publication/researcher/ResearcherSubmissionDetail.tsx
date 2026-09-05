import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2, FileText, Info, Clock, UserCheck } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import {
  publicReviewerName,
  reviewTypeLabel,
  statusLabel,
  type PublicationPaper,
} from '../types/publication';
import { CitationActions } from '../components/CitationActions';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { Button } from '../../../components/Button/Button';
import { buildSafeResourceLink } from '../home/publicationLinks';
import { formatDisplayDate } from '../../../utils/datetime';
import { useT } from '../../../i18n/I18nContext';
import styles from './researcher.module.css';

// ResearcherSubmissionDetail — Researcher-only view of one manuscript
// the current author owns.
//
// Coordinator authority:
//   - `docs/UI_PUBLICATION_FLOW_DECISIONS.md` §1, §3 (route fixed at
//     /researcher/submissions/:id; status semantics; safe editorial
//     feedback only).
//   - `docs/PUBLICATION_FLOW_ARCHITECTURE_REVIEW.md` §10 (the
//     researcher never sees another reviewer's private scores).
//
// "WHAT HAPPENS NEXT" — explains who acts next, deadline when known,
// and whether the author needs to do anything. REVIEWER IDENTITY RELEASE
// RULE: the reviewer's name is only shown via the shared publicReviewerName()
// helper which checks paper.reviewerIdentityPublic. Reviewer ASSIGNMENT does
// NOT imply reviewer ACCEPTANCE — the assigned reviewer may still decline.
//
// "NOT SUPPLIED" POLICY — optional metadata that is empty is suppressed so
// the detail page only highlights fields that genuinely need to be filled
// in. The few unavoidable empty placeholders (paper type / field / authors)
// render the shared "Not supplied" copy rather than three en-dashes.

const RESEARCHER_ACCENT = 'var(--ars-researcher)';
const NOT_SUPPLIED = '—';

const formatDate = (iso: string | undefined): string => {
  if (!iso) return NOT_SUPPLIED;
  const formatted = formatDisplayDate(iso);
  return formatted === '—' ? NOT_SUPPLIED : formatted;
};

export const ResearcherSubmissionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const [paper, setPaper] = useState<PublicationPaper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    publicationAdapter
      .getResearcherSubmissions()
      .then((items) => {
        if (cancelled) return;
        setPaper(items.find((item) => item.id === id) ?? null);
      })
      .catch(() => {
        if (!cancelled) setError(t('researcher.detail.unknownStatus'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  if (loading) {
    return (
      <section className={styles.page}>
        <PageHeader
          eyebrow={t('researcher.submissions.eyebrow')}
          title={t('researcher.detail.titleFallback')}
          accent={RESEARCHER_ACCENT}
          actions={
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/researcher/submissions')}
              leftIcon={<ArrowLeft size={14} aria-hidden />}
            >
              {t('researcher.detail.allSubmissions')}
            </Button>
          }
        />
        <SkeletonRow count={6} withHeader />
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.page}>
        <PageHeader
          eyebrow={t('researcher.submissions.eyebrow')}
          title={t('researcher.detail.titleFallback')}
          accent={RESEARCHER_ACCENT}
          actions={
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/researcher/submissions')}
              leftIcon={<ArrowLeft size={14} aria-hidden />}
            >
              {t('researcher.detail.allSubmissions')}
            </Button>
          }
        />
        <ErrorBanner
          tone="error"
          title={t('researcher.detail.unknownStatus')}
          message={error}
        />
      </section>
    );
  }

  if (!paper) {
    return (
      <section className={styles.page}>
        <PageHeader
          eyebrow={t('researcher.submissions.eyebrow')}
          title={t('researcher.detail.titleFallback')}
          accent={RESEARCHER_ACCENT}
          actions={
            <Button
              variant="outline"
              size="md"
              onClick={() => window.history.back()}
              leftIcon={<ArrowLeft size={14} aria-hidden />}
            >
              {t('researcher.detail.back')}
            </Button>
          }
        />
        <EmptyState
          icon={<AlertTriangle size={20} aria-hidden />}
          title={t('researcher.detail.notFound.title')}
          description={t('researcher.detail.notFound.description')}
          action={
            <Link to="/researcher/submissions">
              <Button variant="outline" size="md">{t('researcher.detail.notFound.cta')}</Button>
            </Link>
          }
        />
      </section>
    );
  }

  // Shared helper — respects paper.reviewerIdentityPublic before exposing a name.
  const reviewerName = publicReviewerName(paper);
  const safeFileUrl = buildSafeResourceLink(paper.fileUrl);

  const whoActsLabel = (key: 'you' | 'admin' | 'reviewerPending' | 'reviewer' | 'none' | 'unknown') =>
    t(`researcher.detail.whoActs.${key}`);

  /**
   * What happens next — explains who acts next, deadline when known,
   * and whether the author needs to do anything.
   *
   * REVIEWER ASSIGNMENT vs ACCEPTANCE:
   *   A REVIEWER_ASSIGNED status means the reviewer is deciding whether
   *   to accept; it does NOT mean the reviewer has accepted the work.
   */
  const whatHappensNext = (() => {
    const deadline = paper.reviewDeadline
      ? t('researcher.detail.deadline.label', undefined, {
          date: formatDate(paper.reviewDeadline),
        })
      : null;

    switch (paper.status) {
      case 'DRAFT':
        return {
          whoActs: whoActsLabel('you'),
          action: t('researcher.detail.action.draft'),
          deadline: null,
          needsResearcher: true,
        };
      case 'SUBMITTED':
      case 'ADMIN_SCREENING':
        return {
          whoActs: whoActsLabel('admin'),
          action: t('researcher.detail.action.submitted'),
          deadline: null,
          needsResearcher: false,
        };
      case 'RESEARCHER_VERIFICATION_REQUIRED':
        return {
          whoActs: whoActsLabel('you'),
          action: t('researcher.detail.action.verificationRequired'),
          deadline: null,
          needsResearcher: true,
        };
      case 'READY_FOR_REVIEWER':
        return {
          whoActs: whoActsLabel('admin'),
          action: t('researcher.detail.action.readyForReviewer'),
          deadline: null,
          needsResearcher: false,
        };
      case 'REVIEWER_ASSIGNED':
        return {
          whoActs: whoActsLabel('reviewerPending'),
          action: reviewerName
            ? t('researcher.detail.action.reviewerAssigned.named', undefined, { name: reviewerName })
            : t('researcher.detail.action.reviewerAssigned.unnamed'),
          deadline,
          needsResearcher: false,
        };
      case 'UNDER_REVIEW':
        return {
          whoActs: whoActsLabel('reviewer'),
          action: reviewerName
            ? t('researcher.detail.action.underReview.named', undefined, { name: reviewerName })
            : t('researcher.detail.action.underReview.unnamed'),
          deadline,
          needsResearcher: false,
        };
      case 'REVISION_REQUIRED':
        return {
          whoActs: whoActsLabel('you'),
          action: t('researcher.detail.action.revisionRequired'),
          deadline,
          needsResearcher: true,
        };
      case 'RESUBMITTED':
        return {
          whoActs: whoActsLabel('admin'),
          action: t('researcher.detail.action.resubmitted'),
          deadline: null,
          needsResearcher: false,
        };
      case 'REVIEWER_RECOMMENDED_ACCEPT':
      case 'REVIEWER_RECOMMENDED_REJECT':
        return {
          whoActs: whoActsLabel('admin'),
          action: t('researcher.detail.action.reviewerRecommended'),
          deadline: null,
          needsResearcher: false,
        };
      case 'ADMIN_APPROVED':
        return {
          whoActs: whoActsLabel('admin'),
          action: t('researcher.detail.action.adminApproved'),
          deadline: null,
          needsResearcher: false,
        };
      case 'PUBLISHED':
        return {
          whoActs: whoActsLabel('none'),
          action: t('researcher.detail.action.published'),
          deadline: null,
          needsResearcher: false,
        };
      case 'ADMIN_REJECTED':
        return {
          whoActs: whoActsLabel('none'),
          action: t('researcher.detail.action.rejected'),
          deadline: null,
          needsResearcher: false,
        };
      case 'WITHDRAWN':
        return {
          whoActs: whoActsLabel('none'),
          action: t('researcher.detail.action.withdrawn'),
          deadline: null,
          needsResearcher: false,
        };
      case 'INACTIVE':
        return {
          whoActs: whoActsLabel('none'),
          action: t('researcher.detail.action.inactive'),
          deadline: null,
          needsResearcher: false,
        };
      default:
        return {
          whoActs: whoActsLabel('unknown'),
          action: t('researcher.detail.action.unknown'),
          deadline: null,
          needsResearcher: false,
        };
    }
  })();

  const formatOptionalField = (value: string | null | undefined): string | null => {
    if (value == null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (trimmed.toLowerCase() === 'not supplied') return null;
    return trimmed;
  };

  const formattedField = (paper.domain && paper.field ? `${paper.domain} / ${paper.field}` : paper.domain ?? paper.field);
  const formattedSubfield = formatOptionalField(paper.subfield);
  const authorsJoined = paper.authors.map((author) => author.name).filter(Boolean).join(', ');
  const institutionsJoined = paper.institutions.map((item) => item.name).filter(Boolean).join(', ');
  const showOptionalMetadata = (paper.doi && paper.doi.trim()) || (paper.openAlexId && paper.openAlexId.trim());

  return (
    <section className={styles.page}>
      <PageHeader
        eyebrow={t('researcher.submissions.eyebrow')}
        title={paper.title}
        description={t('researcher.detail.description')}
        accent={RESEARCHER_ACCENT}
        titleAccessory={
          <StatusBadge
            status={paper.status}
            label={statusLabel(paper.status)}
            size="sm"
          />
        }
        actions={
          <Link to="/researcher/submissions">
            <Button
              variant="outline"
              size="md"
              leftIcon={<ArrowLeft size={14} aria-hidden />}
            >
              {t('researcher.detail.allSubmissions')}
            </Button>
          </Link>
        }
      />

      {paper.status === 'PUBLISHED' && (
        <div className={styles.publishedBanner}>
          <CheckCircle2 size={14} aria-hidden />
          <span>{t('researcher.detail.publishedBanner')}</span>
        </div>
      )}

      {/* ── What Happens Next ──────────────────────────────────────────── */}
      <section className={styles.whatHappensNext} aria-labelledby="what-happens-next-title">
        <div className={styles.whatHappensNextIcon}>
          <Info size={18} aria-hidden />
        </div>
        <div className={styles.whatHappensNextContent}>
          <h2 id="what-happens-next-title" className={styles.whatHappensNextTitle}>
            {t('researcher.detail.whatHappens.title')}
          </h2>
          <div className={styles.whatHappensNextGrid}>
            <div className={styles.whatHappensNextItem}>
              <UserCheck size={14} aria-hidden className={styles.whatHappensNextIconInline} />
              <span className={styles.whatHappensNextLabel}>{t('researcher.detail.whatHappens.who')}</span>
              <span className={styles.whatHappensNextValue}>{whatHappensNext.whoActs}</span>
            </div>
            <div className={styles.whatHappensNextItem}>
              <span className={styles.whatHappensNextLabel}>{t('researcher.detail.whatHappens.action')}</span>
              <span className={styles.whatHappensNextValue}>{whatHappensNext.action}</span>
            </div>
            {whatHappensNext.deadline && (
              <div className={styles.whatHappensNextItem}>
                <Clock size={14} aria-hidden className={styles.whatHappensNextIconInline} />
                <span className={styles.whatHappensNextLabel}>{t('researcher.detail.whatHappens.deadline')}</span>
                <span className={styles.whatHappensNextValue}>{whatHappensNext.deadline}</span>
              </div>
            )}
            {whatHappensNext.needsResearcher && (
              <div className={`${styles.whatHappensNextItem} ${styles.whatHappensNextAction}`}>
                <span className={styles.whatHappensNextActionBadge}>
                  {t('researcher.detail.whatHappens.attention')}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className={styles.detailLayout}>
        <div className={styles.detailSection}>
          <h2 className={styles.detailHeading}>{t('researcher.detail.feedback.title')}</h2>
          {paper.researcherFeedback ? (
            <div className={styles.feedbackPanel}>
              <p className={styles.feedbackTitle}>{t('researcher.detail.feedback.released')}</p>
              <p className={styles.feedbackBody}>{paper.researcherFeedback}</p>
            </div>
          ) : (
            <p className={styles.feedbackEmpty}>{t('researcher.detail.feedback.empty')}</p>
          )}
        </div>

        <div className={styles.detailSection}>
          <h2 className={styles.detailHeading}>{t('researcher.detail.reviewer.title')}</h2>
          <dl className={styles.detailMeta}>
            <div>
              <dt>{t('researcher.submissions.column.reviewer')}</dt>
              <dd>
                {reviewerName
                  ? reviewerName
                  : paper.reviewer
                    ? t('researcher.detail.reviewer.confidential')
                    : t('researcher.detail.reviewer.notAssigned')}
              </dd>
            </div>
            {paper.reviewDeadline && (
              <div>
                <dt>{t('researcher.detail.reviewer.deadline')}</dt>
                <dd>{formatDate(paper.reviewDeadline)}</dd>
              </div>
            )}
            {paper.reviewType && (
              <div>
                <dt>{t('researcher.detail.reviewer.type')}</dt>
                <dd>{reviewTypeLabel(paper.reviewType) || t('researcher.detail.notSupplied')}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className={styles.detailLayout}>
        <div className={styles.detailSection}>
          <h2 className={styles.detailHeading}>{t('reviewer.detail.metadata.title')}</h2>
          <dl className={styles.detailMeta}>
            <div>
              <dt>{t('researcher.detail.detail.version')}</dt>
              <dd>{paper.version != null ? `v${paper.version}` : NOT_SUPPLIED}</dd>
            </div>
            <div>
              <dt>{t('researcher.detail.detail.paperType')}</dt>
              <dd>{paper.paperType && paper.paperType !== 'Not supplied' ? paper.paperType : NOT_SUPPLIED}</dd>
            </div>
            {(formattedField || formattedSubfield) && (
              <div>
                <dt>{t('researcher.detail.detail.field')}</dt>
                <dd>
                  {[formattedField, formattedSubfield].filter(Boolean).join(' / ') ||
                    (paper.subFieldId ? `Subfield #${paper.subFieldId}` : NOT_SUPPLIED)}
                </dd>
              </div>
            )}
            {authorsJoined && (
              <div>
                <dt>{t('researcher.detail.detail.authors')}</dt>
                <dd>{authorsJoined}</dd>
              </div>
            )}
            {institutionsJoined && (
              <div>
                <dt>{t('researcher.detail.detail.institutions')}</dt>
                <dd>{institutionsJoined}</dd>
              </div>
            )}
          </dl>

          {/* Optional identifiers — collapsed when empty */}
          {showOptionalMetadata && (
            <>
              <h3 className={styles.subHeading}>{t('researcher.detail.identifiers.title')}</h3>
              <dl className={styles.detailMeta}>
                {paper.doi && paper.doi.trim() && (
                  <div>
                    <dt>{t('researcher.detail.identifiers.doi')}</dt>
                    <dd>{paper.doi}</dd>
                  </div>
                )}
                {paper.openAlexId && paper.openAlexId.trim() && (
                  <div>
                    <dt>{t('researcher.detail.identifiers.openAlex')}</dt>
                    <dd>{paper.openAlexId}</dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </div>

        <div className={styles.detailSection}>
          <h2 className={styles.detailHeading}>{t('researcher.detail.timeline.title')}</h2>
          <dl className={styles.detailMeta}>
            <div>
              <dt>{t('researcher.detail.timeline.created')}</dt>
              <dd>{formatDate(paper.createdAt)}</dd>
            </div>
            {paper.submittedAt && (
              <div>
                <dt>{t('researcher.detail.timeline.submitted')}</dt>
                <dd>{formatDate(paper.submittedAt)}</dd>
              </div>
            )}
            {paper.publishedAt && (
              <div>
                <dt>{t('researcher.detail.timeline.published')}</dt>
                <dd>{formatDate(paper.publishedAt)}</dd>
              </div>
            )}
          </dl>

          {/* Visibility & verification — collapsed when not relevant */}
          <h3 className={styles.subHeading}>{t('researcher.detail.statusFlags.title')}</h3>
          <dl className={styles.detailMeta}>
            <div>
              <dt>{t('researcher.detail.statusFlags.verification')}</dt>
              <dd>{paper.researcherVerificationStatus}</dd>
            </div>
            <div>
              <dt>{t('researcher.detail.statusFlags.visibility')}</dt>
              <dd>{paper.visibility}</dd>
            </div>
          </dl>

          <div className={styles.detailActions}>
            <CitationActions paper={paper} />
            {safeFileUrl ? (
              <a
                className={styles.pdfLink}
                href={safeFileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText size={14} aria-hidden />
                {t('researcher.detail.actions.readPdf')}
              </a>
            ) : (
              <span className={styles.pdfDisabled} aria-disabled="true">
                <FileText size={14} aria-hidden />
                {t('researcher.detail.actions.readPdfUnavailable')}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ResearcherSubmissionDetail;
