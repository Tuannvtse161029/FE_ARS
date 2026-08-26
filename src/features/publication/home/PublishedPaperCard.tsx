import { ExternalLink, FileText, ShieldCheck, UserCheck } from 'lucide-react';
import type { PublicationAuthor, PublicationPaper } from '../types/publication';
import shared from '../components/PublicationShared.module.css';
import {
  buildArxivBadge,
  collectPaperExternalLinks,
  resolveAuthorLinks,
} from './publicationLinks';
import card from './PublishedPaperCard.module.css';

export interface PublishedPaperCardProps {
  readonly paper: PublicationPaper;
  readonly publicReviewerName: string | null;
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

const fieldPathFor = (paper: PublicationPaper): string =>
  [paper.domain, paper.field, paper.subfield].filter(Boolean).join(' / ');

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
export const PublishedPaperCard = ({ paper, publicReviewerName }: PublishedPaperCardProps) => {
  const orderedAuthors = [...paper.authors].sort((left, right) => left.order - right.order);
  const paperExternalLinks = collectPaperExternalLinks(paper);
  const arxivBadge = buildArxivBadge(paper.externalIdentifier);
  const fieldPath = fieldPathFor(paper);

  return (
    <article className={card.paper} data-testid="public-paper-card" data-paper-id={paper.id}>
      <header className={card.head}>
        <div className={card.headMeta}>
          <span className={shared.sectionMarker ?? ''}>Publication</span>
          <span className={card.paperType}>{paper.paperType}</span>
          {paper.publishedAt && (
            <time className={card.publishedAt} dateTime={paper.publishedAt}>
              Published {paper.publishedAt.slice(0, 10)}
            </time>
          )}
          {typeof paper.version === 'number' && (
            <span className={card.version}>v{paper.version}</span>
          )}
        </div>
        <h2 className={card.title}>{paper.title}</h2>
      </header>

      <section className={card.section} aria-label="Authors and institutions">
        <span className={shared.sectionMarker ?? ''}>Authors</span>
        <p className={card.authorsList}>
          {orderedAuthors.map((author, index) => (
            <span key={author.id} className={card.authorWrap}>
              <AuthorChip author={author} />
              {index < orderedAuthors.length - 1 ? <span className={card.authorSeparator}>, </span> : null}
            </span>
          ))}
        </p>
        {paper.institutions.length > 0 && (
          <p className={card.institutions}>
            {paper.institutions.map((institution) => institution.name).join(' · ')}
          </p>
        )}
      </section>

      <section className={card.section} aria-label="Abstract">
        <span className={shared.sectionMarker ?? ''}>Abstract</span>
        <p className={card.abstract}>{paper.abstract}</p>
      </section>

      {paper.keywords.length > 0 && (
        <section className={card.section} aria-label="Keywords">
          <span className={shared.sectionMarker ?? ''}>Keywords</span>
          <ul className={card.keywords} aria-label="Paper keywords">
            {paper.keywords.map((keyword) => (
              <li key={keyword} className={card.keyword}>{keyword}</li>
            ))}
          </ul>
        </section>
      )}

      {paper.topics.length > 0 && (
        <section className={card.section} aria-label="Topics">
          <span className={shared.sectionMarker ?? ''}>Topics</span>
          <ul className={card.topics} aria-label="Paper topics">
            {paper.topics.map((topic) => (
              <li key={topic} className={card.topic}>{topic}</li>
            ))}
          </ul>
        </section>
      )}

      <section className={card.section} aria-label="Identifiers and classification">
        <span className={shared.sectionMarker ?? ''}>Identifiers &amp; classification</span>
        <dl className={card.details}>
          <div className={card.detailRow}>
            <dt>DOI</dt>
            <dd>
              {paperExternalLinks[0]?.source === 'DOI' ? (
                <a
                  className={card.identifierLink}
                  href={paperExternalLinks[0].href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <FileText size={14} aria-hidden="true" />
                  <span>{paper.doi}</span>
                </a>
              ) : <span className={card.muted}>Not supplied</span>}
            </dd>
          </div>
          {paperExternalLinks.length > 1 && paperExternalLinks[1]?.source === 'OpenAlex' && (
            <div className={card.detailRow}>
              <dt>OpenAlex</dt>
              <dd>
                <a
                  className={card.identifierLink}
                  href={paperExternalLinks[1].href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  <span>{paper.openAlexId}</span>
                </a>
              </dd>
            </div>
          )}
          {arxivBadge && (
            <div className={card.detailRow}>
              <dt>arXiv</dt>
              <dd className={card.identifierPlain}>{arxivBadge}</dd>
            </div>
          )}
          <div className={card.detailRow}>
            <dt>Field</dt>
            <dd><FieldPath paper={paper} /></dd>
          </div>
        </dl>
      </section>

      <section className={card.section} aria-label="Editorial review">
        <span className={shared.sectionMarker ?? ''}>Editorial review</span>
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
    </article>
  );
};
