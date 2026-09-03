import { useState } from 'react';
import { Check, Copy, Quote } from 'lucide-react';
import type { PublicationPaper } from '../types/publication';
import { useLocale } from '../../../i18n/I18nContext';
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
  const locale = useLocale();
  const tr = (en: string, vi: string): string => (locale === 'en' ? en : vi);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyCitation = async (format: 'apa' | 'bibtex') => {
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
        {tr('Cite', 'Trích dẫn')}
      </button>
      {open && (
        <div className={styles.citationMenu} role="group" aria-label={tr('Citation formats', 'Định dạng trích dẫn')}>
          {(['apa', 'bibtex'] as const).map((format) => (
            <button type="button" className={styles.citationOption} key={format} onClick={() => void copyCitation(format)}>
              {copied === format ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {format === 'apa' ? tr('Copy APA', 'Sao chép APA') : tr('Copy BibTeX', 'Sao chép BibTeX')}
            </button>
          ))}
          {copied && <span className={styles.citationStatus} role="status">{tr('Citation copied', 'Đã sao chép trích dẫn')}</span>}
        </div>
      )}
    </div>
  );
};
