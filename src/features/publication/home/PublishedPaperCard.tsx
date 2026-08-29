import { ExternalLink, FileText, ShieldCheck, UserCheck } from 'lucide-react';
import type { PublicationAuthor, PublicationPaper } from '../types/publication';
import { CitationActions } from '../components/CitationActions';
import {
  buildArxivBadge,
  buildSafeResourceLink,
  collectPaperExternalLinks,
  resolveAuthorLinks,
} from './publicationLinks';
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
 * (always plain text — never a URL built from the name) and a safe ORCID
 * link when one exists. No slug, no profile URL, no Google search link.
 */
const AuthorChip = ({ author }: { readonly author: PublicationAuthor }) => {
  const links = resolveAuthorLinks(author);
  return (
    <span className={card.author} data-testid="public-paper-author" data-author-id={author.id}>
      <span className={card.authorName}>{author.name}</span>
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
  const path = [paper.domain, paper.field, paper.subfield].filter(Boolean).join(' / ');
  if (!path) return <span className={card.muted}>Not classified</span>;
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
          <span className={card.paperType}>{paper.paperType}</span>
          {paper.publishedAt && (
            <time className={card.publishedAt} dateTime={paper.publishedAt}>
              Published {paper.publishedAt.slice(0, 10)}
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
        {paper.institutions.length > 0 && (
          <p className={card.institutions}>
            {paper.institutions.map((institution) => institution.name).join(' · ')}
          </p>
        )}
      </header>

      <section className={card.section} aria-label="Authors">
        <p className={card.authorsList}>
          {orderedAuthors.map((author, index) => (
            <span key={author.id} className={card.authorWrap}>
              <AuthorChip author={author} />
              {index < orderedAuthors.length - 1 ? <span className={card.authorSeparator}>, </span> : null}
            </span>
          ))}
        </p>
      </section>

      <section className={card.section} aria-label="Abstract">
        <p className={card.abstract}>{paper.abstract}</p>
      </section>

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
        {paperExternalLinks[0]?.source === 'DOI' && (
          <div className={card.detailRow}>
            <span className={card.detailLabel}>DOI</span>
            <a
              className={card.identifierLink}
              href={paperExternalLinks[0].href}
              rel="noopener noreferrer"
              target="_blank"
            >
              <FileText size={12} aria-hidden="true" />
              <span>{paper.doi}</span>
            </a>
          </div>
        )}
        {paperExternalLinks.length > 1 && paperExternalLinks[1]?.source === 'OpenAlex' && (
          <div className={card.detailRow}>
            <span className={card.detailLabel}>OpenAlex</span>
            <a
              className={card.identifierLink}
              href={paperExternalLinks[1].href}
              rel="noopener noreferrer"
              target="_blank"
            >
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
          <span className={card.detailLabel}>Field</span>
          <FieldPath paper={paper} />
        </div>
      </section>

      <section className={card.reviewerRow} aria-label="Editorial review">
        {publicReviewerName ? (
          <div className={card.reviewerPublic}>
            <UserCheck size={14} aria-hidden="true" />
            <span>
              Reviewed by <strong>{publicReviewerName}</strong> (publicly disclosed)
            </span>
          </div>
        ) : (
          <div className={card.reviewerPrivate}>
            <ShieldCheck size={14} aria-hidden="true" />
            <span>Reviewer identity withheld per policy.</span>
          </div>
        )}
      </section>

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
            Read PDF
          </a>
        )}
      </footer>
    </article>
  );
};

export default PublishedPaperCard;