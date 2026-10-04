import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, ExternalLink, FileText, ShieldCheck, UserCheck } from 'lucide-react';
import { paperTypeLabel, type PublicationAuthor, type PublicationPaper } from '../types/publication';
import { CitationActions } from '../components/CitationActions';
import {
  buildArxivBadge,
  buildSafeResourceLink,
  collectPaperExternalLinks,
  resolveAuthorLinks,
  buildAuthorProfilePath,
} from './publicationLinks';
import { OpenAlexBrandLogo } from '../../../components/openalex/OpenAlexBrandLogo';
import { useLocale, useT } from '../../../i18n/I18nContext';
import { formatDisplayDate } from '../../../utils/datetime';
import card from './PublishedPaperCard.module.css';

export interface PublishedPaperCardProps {
  readonly paper: PublicationPaper;
  readonly publicReviewerName: string | null;
  /**
   * Optional accent color (CSS variable or hex). Defaults to ARS blue
   * so the catalog surface stays consistent with the home page hero.
   */
  readonly accent?: string;
}

/**
 * Author chip — OpenAlex-style scannable row. Renders the author name
 * as plain text by default; the name becomes a link to that user's
 * public profile at `/profile/:userId` when one of two signals is true:
 *
 *   1. `author.userId` is populated by the BE and `buildAuthorProfilePath`
 *      validates it as a positive integer (per-author identification).
 *   2. The call site has flagged this entry as the paper's submitter via
 *      `isResearcher` + `researcherId` (paper-level identification).
 *
 * Authors we cannot confidently identify stay as plain text — the
 * "never build a URL from a bare name" rule is preserved. When the
 * author also carries a canonical ORCID, the ORCID chip is rendered
 * alongside the profile link.
 */
const AuthorChip = ({
  author,
  isResearcher,
  researcherId,
}: {
  readonly author: PublicationAuthor;
  readonly isResearcher?: boolean;
  readonly researcherId?: number | null;
}) => {
  const t = useT();
  const links = resolveAuthorLinks(author);
  const perAuthorPath = buildAuthorProfilePath(author);
  const profilePath =
    perAuthorPath ?? (isResearcher && researcherId ? `/profile/${researcherId}` : null);
  const linkClass = perAuthorPath ? card.authorNameLink : card.authorProfileLink;
  return (
    <span className={card.author} data-testid="public-paper-author" data-author-id={author.id}>
      {profilePath ? (
        <Link
          to={profilePath}
          className={linkClass}
          aria-label={t(
            'home.catalog.author.viewProfile',
            'View {name}\u2019s profile',
            { name: author.name },
          )}
          data-testid="public-paper-author-profile-link"
        >
          <span className={card.authorName}>{author.name}</span>
        </Link>
      ) : (
        <span className={card.authorName}>{author.name}</span>
      )}
      {links.map((link) => (
        <a
          key={link.authorId}
          className={card.authorLink}
          href={link.orcid!.href}
          rel="noopener noreferrer"
          target="_blank"
          aria-label={`Open ORCID profile for ${author.name}`}
        >
          <ExternalLink size={12} aria-hidden="true" />
          <span>{link.orcid!.label}</span>
        </a>
      ))}
    </span>
  );
};

/**
 * Field pill — highlights the canonical domain → field → subfield string,
 * with graceful fallback when classification is missing.
 */
const FieldPath = ({ paper }: { readonly paper: PublicationPaper }) => {
  const locale = useLocale();
  const path = [paper.domain, paper.field, paper.subfield].filter(Boolean).join(' / ');
  if (!path) return <span className={card.muted}>{locale === 'en' ? 'Not classified' : 'Chưa phân loại'}</span>;
  return <span className={card.fieldPath}>{path}</span>;
};

/**
 * Single scannable paper card.
 *
 * - Required metadata is shown compactly with section markers.
 * - Author identity is shown with safe ORCID chips only.
 * - Reviewer name is shown only when `reviewerIdentityPublic` is true.
 * - Private review content (`privateComments`, `privateScores`,
 *   `recommendation`, `submittedAt`) is *never* rendered here.
 * - External links go through strict validators — invalid identifiers
 *   become plain text, never malformed URLs.
 */
export const PublishedPaperCard = ({
  paper,
  publicReviewerName,
  accent,
}: PublishedPaperCardProps) => {
  const locale = useLocale();
  const copy = (en: string, vi: string): string => (locale === 'en' ? en : vi);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const orderedAuthors = [...paper.authors].sort((left, right) => left.order - right.order);
  const paperExternalLinks = collectPaperExternalLinks(paper);
  const arxivBadge = buildArxivBadge(paper.externalIdentifier);

  const accentStyle = accent
    ? ({ '--card-accent': accent } as React.CSSProperties)
    : undefined;

  return (
    <article
      className={card.paper}
      style={accentStyle}
      data-testid="public-paper-card"
      data-paper-id={paper.id}
    >
      <header className={card.head}>
        <div className={card.headMeta}>
          <span className={card.paperType}>{paperTypeLabel(paper.paperType) || paper.paperType}</span>
          {paper.publishedAt && (
            <time className={card.publishedAt} dateTime={paper.publishedAt}>
              {copy('Published', 'Xuất bản')} {formatDisplayDate(paper.publishedAt)}
            </time>
          )}
          {typeof paper.version === 'number' && (
            <span className={card.version}>v{paper.version}</span>
          )}
          {paper.doi && (
            <span className={card.mono}>{paper.doi}</span>
          )}
        </div>
        <h2 className={card.title}>{paper.title}</h2>
        {typeof paper.sourceName === 'string' && paper.sourceName.trim().length > 0 && (
          <p className={card.sourceName}>{paper.sourceName}</p>
        )}
        {paper.institutions.length > 0 && (
          <p className={card.institutions}>
            {paper.institutions.map((institution) => institution.name).join(' · ')}
          </p>
        )}
      </header>

      <section className={card.section} aria-label="Authors">
        {(paper.researcherName || paper.submitterName) && (
          <div className={card.researcherRow}>
            {paper.authorId ? (
              <Link
                to={`/profile/${paper.authorId}`}
                className={card.researcherBadge}
                data-testid="public-paper-researcher"
                title={copy('View researcher profile', 'Xem hồ sơ nhà nghiên cứu')}
              >
                <UserCheck size={14} aria-hidden="true" />
                <span className={card.researcherLabel}>{copy('Researcher:', 'Nhà nghiên cứu:')}</span>
                <strong className={card.researcherName}>{paper.researcherName || paper.submitterName}</strong>
              </Link>
            ) : (
              <div className={card.researcherBadge} data-testid="public-paper-researcher">
                <UserCheck size={14} aria-hidden="true" />
                <span className={card.researcherLabel}>{copy('Researcher:', 'Nhà nghiên cứu:')}</span>
                <strong className={card.researcherName}>{paper.researcherName || paper.submitterName}</strong>
              </div>
            )}
          </div>
        )}
        <p className={card.authorsList}>
          {orderedAuthors.length > 0 && (paper.researcherName || paper.submitterName) && (
            <span className={card.coAuthorsLabel}>{copy('Authors:', 'Tác giả:')}</span>
          )}
          {orderedAuthors.map((author, index) => {
            const isResearcher = Boolean(
              paper.authorId &&
              ((paper.researcherName && author.name.trim().toLowerCase() === paper.researcherName.trim().toLowerCase()) ||
               (paper.submitterName && author.name.trim().toLowerCase() === paper.submitterName.trim().toLowerCase()) ||
               orderedAuthors.length === 1)
            );
            return (
              <span key={author.id} className={card.authorWrap}>
                <AuthorChip
                  author={author}
                  isResearcher={isResearcher}
                  researcherId={paper.authorId}
                />
                {index < orderedAuthors.length - 1 ? <span className={card.authorSeparator}>, </span> : null}
              </span>
            );
          })}
        </p>
      </section>

      <section className={card.section} aria-label="Abstract">
        <p className={card.abstract}>{paper.abstract}</p>
      </section>

      <button
        type="button"
        className={card.detailsToggle}
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((open) => !open)}
      >
        <span>{detailsOpen ? copy('Hide publication details', 'Thu gọn chi tiết ấn phẩm') : copy('Show publication details', 'Xem chi tiết ấn phẩm')}</span>
        {detailsOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>

      {detailsOpen ? (
        <div className={card.details}>
          {paper.keywords.length > 0 && (
            <section className={card.section} aria-label="Keywords">
              <ul className={card.keywords}>
                {paper.keywords.map((keyword) => (
                  <li key={keyword} className={card.keyword}>{keyword}</li>
                ))}
              </ul>
            </section>
          )}

          {paper.topics.length > 0 && (
            <section className={card.section} aria-label="Topics">
              <ul className={card.topics}>
                {paper.topics.map((topic) => (
                  <li key={topic} className={card.topic}>{topic}</li>
                ))}
              </ul>
            </section>
          )}

          <section className={card.detailGrid} aria-label="Identifiers and classification">
            <div className={card.detailRow}>
              <span className={card.detailLabel}>DOI</span>
              {paperExternalLinks[0]?.source === 'DOI' ? (
                <a className={card.identifierLink} href={paperExternalLinks[0].href} rel="noopener noreferrer" target="_blank">
                  <FileText size={12} aria-hidden="true" />
                  <span>{paper.doi}</span>
                </a>
              ) : (
                <span className={card.identifierPlain}>{copy('Not supplied', 'Chưa cung cấp')}</span>
              )}
            </div>
            {paperExternalLinks.length > 1 && paperExternalLinks[1]?.source === 'OpenAlex' && (
              <div className={card.detailRow}>
                <span className={card.detailLabel}>
                  <OpenAlexBrandLogo
                    variant="mark"
                    ariaLabel="OpenAlex"
                  />
                  <span aria-hidden="true">OpenAlex</span>
                </span>
                <a className={card.identifierLink} href={paperExternalLinks[1].href} rel="noopener noreferrer" target="_blank">
                  <ExternalLink size={12} aria-hidden="true" />
                  <span>{paper.openAlexId}</span>
                </a>
              </div>
            )}
            {arxivBadge && (
              <div className={card.detailRow}>
                <span className={card.detailLabel}>arXiv</span>
                <span className={card.identifierPlain}>{arxivBadge}</span>
              </div>
            )}
            <div className={card.detailRow}>
              <span className={card.detailLabel}>{copy('Field', 'Ngành')}</span>
              <FieldPath paper={paper} />
            </div>
            {(paper.researcherName || paper.submitterName) && (
              <div className={card.detailRow}>
                <span className={card.detailLabel}>{copy('Researcher', 'Nhà nghiên cứu')}</span>
                {paper.authorId ? (
                  <Link
                    to={`/profile/${paper.authorId}`}
                    className={card.profileLink}
                    title={copy('View profile', 'Xem hồ sơ')}
                  >
                    <span>{paper.researcherName || paper.submitterName}</span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className={card.identifierPlain}>{paper.researcherName || paper.submitterName}</span>
                )}
              </div>
            )}
          </section>

          <section className={card.reviewerRow} aria-label="Editorial review">
            {publicReviewerName ? (
              <div className={card.reviewerPublic}>
                <UserCheck size={14} aria-hidden="true" />
                <span>{copy('Reviewed by', 'Phản biện bởi')} <strong>{publicReviewerName}</strong> {copy('(publicly disclosed)', '(công khai danh tính)')}</span>
              </div>
            ) : (
              <div className={card.reviewerPrivate}>
                <ShieldCheck size={14} aria-hidden="true" />
                <span>{copy('Reviewer identity withheld per policy.', 'Danh tính người phản biện được bảo mật theo chính sách.')}</span>
              </div>
            )}
          </section>
        </div>
      ) : null}

      <footer className={card.actions}>
        <CitationActions paper={paper} />
        {buildSafeResourceLink(paper.fileUrl) && (
          <a
            className={card.pdfLink}
            href={buildSafeResourceLink(paper.fileUrl) ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileText size={12} aria-hidden="true" />
            {copy('Read PDF', 'Đọc PDF')}
          </a>
        )}
      </footer>
    </article>
  );
};

export default PublishedPaperCard;