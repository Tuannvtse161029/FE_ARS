import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicationAdapter } from '../api/publication.adapter';
import { PublicationDemoBanner } from '../components/PublicationDemoBanner';
import shared from '../components/PublicationShared.module.css';
import { statusLabel, type PublicationPaper } from '../types/publication';

export const ReviewerAssignments = () => {
  const [papers, setPapers] = useState<PublicationPaper[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { publicationAdapter.getReviewerAssignments().then(setPapers).finally(() => setLoading(false)); }, []);
  return <section className={shared.page}><header className={shared.header}><div><h1>Review Assignments</h1><p>Accept or decline Admin assignments, then submit a private recommendation to Admin.</p></div></header><PublicationDemoBanner />{loading ? <div className={shared.loading}>Loading assignments...</div> : papers.length === 0 ? <div className={shared.empty}>No reviewer assignments are ready.</div> : <div className={shared.panel}>{papers.map((paper) => <article key={paper.id} style={{ borderBottom: '1px solid #e4e9f0', padding: '14px 0' }}><span className={shared.status}>{statusLabel(paper.status)}</span><h2 style={{ fontSize: 18 }}>{paper.title}</h2><p>{paper.abstract}</p><Link to={`/reviewer/assignments/${paper.id}`}>Open assignment</Link></article>)}</div>}</section>;
};

export default ReviewerAssignments;
