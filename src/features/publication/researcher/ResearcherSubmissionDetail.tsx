import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { publicationAdapter } from '../api/publication.adapter';
import {
  publicReviewerName,
  statusLabel,
  type PublicationPaper,
} from '../types/publication';
import { CitationActions } from '../components/CitationActions';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { SkeletonRow } from '../../../components/SkeletonRow';
import { StatusBadge } from '../../../components/lecturer/StatusBadge';
import { Button } from '../../../components/Button/Button';
import { buildSafeResourceLink } from '../home/publicationLinks';
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
// Visual: PageHeader + status timeline + metadata panel + a focused
// editorial-feedback panel that is highlighted with the Researcher
// amber accent. No inline styles; all layout in researcher.module.css.

const RESEARCHER_ACCENT = 'var(--ars-researcher)';

const formatDate = (iso: string | undefined): string => {
  if (!iso) return 'Not supplied';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Not supplied';
  return parsed.toISOString().slice(0, 10);
};

export const ResearcherSubmissionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
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
        if (!cancelled) setError('The submission could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <section className={styles.page}>
        <PageHeader
          eyebrow="RESEARCHER WORKSPACE"
          title="Submission"
          accent={RESEARCHER_ACCENT}
          actions={
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/researcher/submissions')}
              leftIcon={<ArrowLeft size={14} aria-hidden />}
            >
              All submissions
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
          eyebrow="RESEARCHER WORKSPACE"
          title="Submission"
          accent={RESEARCHER_ACCENT}
          actions={
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate('/researcher/submissions')}
              leftIcon={<ArrowLeft size={14} aria-hidden />}
            >
              All submissions
            </Button>
          }
        />
        <ErrorBanner
          tone="error"
          title="Could not load submission"
          message={error}
        />
      </section>
    );
  }

  if (!paper) {
    return (
      <section className={styles.page}>
        <PageHeader
          eyebrow="RESEARCHER WORKSPACE"
          title="Submission"
          accent={RESEARCHER_ACCENT}
          actions={
            <Button
              variant="outline"
              size="md"
              onClick={() => window.history.back()}
              leftIcon={<ArrowLeft size={14} aria-hidden />}
            >
              Back
            </Button>
          }
        />
        <EmptyState
          icon={<AlertTriangle size={20} aria-hidden />}
          title="Submission not available"
          description="This submission could not be found in your Researcher workspace. It may have been withdrawn, reassigned to another author, or the link is incorrect."
          action={
            <Link to="/researcher/submissions">
              <Button variant="outline" size="md">Back to my submissions</Button>
            </Link>
          }
        />
      </section>
    );
  }

  const reviewerName = publicReviewerName(paper);
  const safeFileUrl = buildSafeResourceLink(paper.fileUrl);

  return (
    <section className={styles.page}>
      <PageHeader
        eyebrow="RESEARCHER WORKSPACE"
        title={paper.title}
        description="Private researcher view of this submission. Editorial feedback and reviewer identity are surfaced here when Admin has approved them."
        accent={RESEARCHER_ACCENT}
        // === GSI LOCALE + STATUS BADGE RELOCATE (this worker) ===
        // StatusBadge is now inline with the title via `titleAccessory`,
        // not floating in the right-side `actions` slot. The "Back" link
        // remains in `actions` where it belongs.
        titleAccessory={
          <StatusBadge
            status={paper.status}
            label={statusLabel(paper.status)}
            size="sm"
          />
        }
        // === END GSI LOCALE + STATUS BADGE RELOCATE (this worker) ===
        actions={
          <Link to="/researcher/submissions">
            <Button
              variant="outline"
              size="md"
              leftIcon={<ArrowLeft size={14} aria-hidden />}
            >
              All submissions
            </Button>
          </Link>
        }
      />

      {paper.status === 'PUBLISHED' && (
        <div className={styles.publishedBanner}>
          <CheckCircle2 size={14} aria-hidden />
          <span>Your paper is published in the public catalog.</span>
        </div>
      )}

      <div className={styles.detailLayout}>
        <div className={styles.detailSection}>
          <header className={styles.formSectionHeader}>
            <h2 className={styles.detailHeading}>Current editorial status</h2>
            <StatusBadge
              status={paper.status}
              label={statusLabel(paper.status)}
              size="sm"
            />
          </header>
          <p className={styles.statusExplanation}>
            {paper.status === 'DRAFT'
              ? 'Complete the required metadata and PDF upload, then submit the manuscript to Admin screening.'
              : paper.status === 'REVISION_REQUIRED'
                ? 'Admin has requested a revision. Review the released feedback before preparing the next version.'
                : paper.status === 'RESEARCHER_VERIFICATION_REQUIRED'
                  ? 'Researcher verification is required before this manuscript can continue through editorial screening.'
                  : paper.status === 'PUBLISHED'
                    ? 'The public catalog now lists this paper according to its publication visibility.'
                    : 'The editorial workflow will update this status when the next permitted action is completed.'}
          </p>
        </div>

        <div className={styles.detailSection}>
          <h2 className={styles.detailHeading}>Editorial feedback</h2>
          {paper.researcherFeedback ? (
            <div className={styles.feedbackPanel}>
              <p className={styles.feedbackTitle}>Released feedback</p>
              <p className={styles.feedbackBody}>{paper.researcherFeedback}</p>
            </div>
          ) : (
            <p className={styles.feedbackEmpty}>
              No researcher feedback has been released yet. Admin and reviewer work
              product remains private.
            </p>
          )}
        </div>
      </div>

      <div className={styles.detailLayout}>
        <div className={styles.detailSection}>
          <h2 className={styles.detailHeading}>Manuscript metadata</h2>
          <dl className={styles.detailMeta}>
            <div>
              <dt>Version</dt>
              <dd>{paper.version ?? 'Not supplied'}</dd>
            </div>
            <div>
              <dt>Paper type</dt>
              <dd>{paper.paperType || 'Not supplied'}</dd>
            </div>
            <div>
              <dt>Authors</dt>
              <dd>{paper.authors.map((author) => author.name).join(', ') || 'Not supplied'}</dd>
            </div>
            <div>
              <dt>Institutions</dt>
              <dd>
                {paper.institutions.map((item) => item.name).join(', ') || 'Not supplied'}
              </dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>{formatDate(paper.submittedAt ?? paper.createdAt)}</dd>
            </div>
            <div>
              <dt>Published</dt>
              <dd>{formatDate(paper.publishedAt)}</dd>
            </div>
            <div>
              <dt>DOI</dt>
              <dd>{paper.doi ?? 'Not supplied'}</dd>
            </div>
            <div>
              <dt>OpenAlex ID</dt>
              <dd>{paper.openAlexId ?? 'Not supplied'}</dd>
            </div>
            <div>
              <dt>Researcher verification</dt>
              <dd>{paper.researcherVerificationStatus}</dd>
            </div>
            <div>
              <dt>Visibility</dt>
              <dd>{paper.visibility}</dd>
            </div>
          </dl>
        </div>

        <div className={styles.detailSection}>
          <h2 className={styles.detailHeading}>Reviewer &amp; next action</h2>
          <dl className={styles.detailMeta}>
            <div>
              <dt>Assigned reviewer</dt>
              <dd>
                {reviewerName ??
                  (paper.reviewer
                    ? 'Assigned reviewer (identity private)'
                    : 'Not assigned by Admin')}
              </dd>
            </div>
            <div>
              <dt>Review deadline</dt>
              <dd>{formatDate(paper.reviewDeadline)}</dd>
            </div>
            <div>
              <dt>Review type</dt>
              <dd>{paper.reviewType ?? 'Not supplied'}</dd>
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
                Read PDF
              </a>
            ) : (
              <span className={styles.pdfDisabled} aria-disabled="true">
                <FileText size={14} aria-hidden />
                Read PDF unavailable
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ResearcherSubmissionDetail;