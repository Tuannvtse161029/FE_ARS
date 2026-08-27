import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicationAdapter } from '../api/publication.adapter';
import { PublicationDemoBanner } from '../components/PublicationDemoBanner';
import shared from '../components/PublicationShared.module.css';
import { statusLabel, type PublicationPaper } from '../types/publication';

export const ResearcherSubmissionDetail = () => {
  const { id } = useParams(); const [paper, setPaper] = useState<PublicationPaper | null>(null);
  useEffect(() => { publicationAdapter.getResearcherSubmissions().then((items) => setPaper(items.find((item) => item.id === id) ?? null)); }, [id]);
  if (!paper) return <div className={shared.loading}>Loading submission...</div>;
  return <section className={shared.page}><header className={shared.header}><div><h1>{paper.title}</h1><p>Private researcher submission view.</p></div><span className={shared.status}>{statusLabel(paper.status)}</span></header><PublicationDemoBanner /><div className={shared.panel}><p><strong>Version:</strong> {paper.version}</p><p><strong>Authors:</strong> {paper.authors.map((author) => author.name).join(', ')}</p><p><strong>Institution:</strong> {paper.institutions.map((item) => item.name).join(', ')}</p><p><strong>Assigned reviewer:</strong> {paper.reviewer?.reviewerName ?? 'Not assigned by Admin'}</p><p><strong>Editorial feedback:</strong> {paper.researcherFeedback ?? 'No researcher feedback has been released.'}</p>{paper.status === 'PUBLISHED' && <p><strong>Publication notification:</strong> Your paper is published. The production notification will be issued by the backend publication transaction.</p>}</div></section>;
};

export default ResearcherSubmissionDetail;
