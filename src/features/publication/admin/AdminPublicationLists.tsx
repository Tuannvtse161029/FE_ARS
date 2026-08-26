import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicationAdapter } from '../api/publication.adapter';
import { PublicationDemoBanner } from '../components/PublicationDemoBanner';
import shared from '../components/PublicationShared.module.css';
import type { PublicationPaper } from '../types/publication';

export const AdminReviewerAssignments = () => <AdminList title="Reviewer Assignments" predicate={(paper) => paper.status === 'REVIEWER_ASSIGNED' || paper.status === 'UNDER_REVIEW'} />;
export const AdminPublishedPapers = () => <AdminList title="Published Papers" predicate={(paper) => paper.status === 'PUBLISHED'} />;

const AdminList = ({ title, predicate }: { title: string; predicate: (paper: PublicationPaper) => boolean }) => {
  const [papers, setPapers] = useState<PublicationPaper[]>([]);
  useEffect(() => { publicationAdapter.getAdminSubmissions().then((items) => setPapers(items.filter(predicate))); }, [predicate]);
  return <section className={shared.page}><header className={shared.header}><div><h1>{title}</h1><p>Admin-only publication workflow view.</p></div></header><PublicationDemoBanner /><div className={shared.panel}>{papers.length === 0 ? <div className={shared.empty}>No records are available.</div> : papers.map((paper) => <p key={paper.id}><Link to={`/admin/paper-submissions/${paper.id}`}>{paper.title}</Link> {paper.reviewer?.reviewerName ? `- ${paper.reviewer.reviewerName}` : ''}</p>)}</div></section>;
};
