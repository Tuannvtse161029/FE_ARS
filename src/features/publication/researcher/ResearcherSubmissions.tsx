import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicationAdapter } from '../api/publication.adapter';
import { PublicationDemoBanner } from '../components/PublicationDemoBanner';
import shared from '../components/PublicationShared.module.css';
import { statusLabel, type PublicationPaper } from '../types/publication';

export const ResearcherSubmissions = () => {
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { publicationAdapter.getResearcherSubmissions().then(setPapers).finally(() => setLoading(false)); }, []);

  return <section className={shared.page}><header className={shared.header}><div><h1>My Submissions</h1><p>Create drafts, submit metadata and manuscripts to Admin, and follow the editorial decision.</p></div><Link className={shared.button} to="/researcher/submissions/new">New submission</Link></header><PublicationDemoBanner />{loading ? <div className={shared.loading}>Loading submissions...</div> : <div className={shared.panel}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th align="left">Paper</th><th align="left">Status</th><th align="left">Reviewer</th><th align="left">Action</th></tr></thead><tbody>{papers.map((paper) => <tr key={paper.id}><td style={{ padding: '14px 8px' }}><strong>{paper.title}</strong><br /><small>{paper.paperType} · v{paper.version}</small></td><td><span className={shared.status}>{statusLabel(paper.status)}</span></td><td>{paper.status === 'REVIEWER_ASSIGNED' || paper.status === 'UNDER_REVIEW' || paper.reviewer ? paper.reviewer?.reviewerName ?? 'Assignment pending' : 'Not assigned'}</td><td><Link to={`/researcher/submissions/${paper.id}`}>View submission</Link></td></tr>)}</tbody></table></div>}</section>;
};

export default ResearcherSubmissions;
