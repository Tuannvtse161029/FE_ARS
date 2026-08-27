import { useState } from 'react';
import { Check, Copy, Quote } from 'lucide-react';
import type { PublicationPaper } from '../types/publication';
import styles from './PublicationShared.module.css';

const escapeBibtex = (value: string): string => value.replace(/[{}]/g, '').trim();

const authorList = (paper: PublicationPaper): string[] =>
  [...paper.authors]
    .sort((left, right) => left.order - right.order)
    .map((author) => author.name.trim())
    .filter(Boolean);

export const citationText = (paper: PublicationPaper, format: 'apa' | 'bibtex'): string => {
  const authors = authorList(paper);
  const year = (paper.publicationDate ?? paper.publishedAt ?? paper.createdAt).slice(0, 4);
  if (format === 'bibtex') {
    const key = `${authors[0]?.replace(/\s+/g, '').toLowerCase() || 'ars'}${year}`;
    return `@article{${key},\n  title = {${escapeBibtex(paper.title)}},\n  author = {${authors.join(' and ')}},\n  year = {${year}}${paper.doi ? `,\n  doi = {${escapeBibtex(paper.doi)}}` : ''}\n}`;
  }
  return `${authors.length > 0 ? `${authors.join(', ')}. ` : ''}(${year}). ${paper.title}. ${paper.doi ? `https://doi.org/${paper.doi.replace(/^https?:\/\/doi.org\//i, '')}` : 'ARS Academic Research Sharing Platform'}`;
};

export const CitationActions = ({ paper }: { readonly paper: PublicationPaper }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (format: 'apa' | 'bibtex') => {
    try {
      await navigator.clipboard.writeText(citationText(paper, format));
      setCopied(format);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className={styles.citationActions}>
      <button type="button" className={styles.buttonSecondary} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Quote size={14} aria-hidden="true" />
        Cite
      </button>
      {open && (
        <div className={styles.citationMenu} role="group" aria-label="Citation formats">
          {(['apa', 'bibtex'] as const).map((format) => (
            <button type="button" className={styles.citationOption} key={format} onClick={() => void copy(format)}>
              {copied === format ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {format === 'apa' ? 'Copy APA' : 'Copy BibTeX'}
            </button>
          ))}
          {copied && <span className={styles.citationStatus} role="status">Citation copied</span>}
        </div>
      )}
    </div>
  );
};
