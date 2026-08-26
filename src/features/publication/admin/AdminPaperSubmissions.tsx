import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicationAdapter } from '../api/publication.adapter';
import { PublicationDemoBanner } from '../components/PublicationDemoBanner';
import shared from '../components/PublicationShared.module.css';
import { statusLabel, type PublicationPaper, type PublicationStatus } from '../types/publication';

export const AdminPaperSubmissions = () => {
  const [papers, setPapers] = useState<PublicationPaper[]>([]); const [status, setStatus] = useState<PublicationStatus | ''>('');
  useEffect(() => { publicationAdapter.getAdminSubmissions().then(setPapers); }, []);
  const visible = useMemo(() => status ? papers.filter((paper) => paper.status === status) : papers, [papers, status]);
  return <section className={shared.page}><header className={shared.header}><div><h1>Paper Submissions</h1><p>Screen submissions, verify workflow readiness, and prepare reviewer assignments.</p></div></header><PublicationDemoBanner /><div className={shared.panel}><label className={shared.field}><span>Filter status</span><select value={status} onChange={(event) => setStatus(event.target.value as PublicationStatus | '')}><option value="">All statuses</option>{['SUBMITTED', 'ADMIN_SCREENING', 'RESEARCHER_VERIFICATION_REQUIRED', 'READY_FOR_REVIEWER', 'REVIEWER_ASSIGNED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'RESUBMITTED', 'REVIEWER_RECOMMENDED_ACCEPT', 'REVIEWER_RECOMMENDED_REJECT', 'ADMIN_APPROVED', 'PUBLISHED', 'ADMIN_REJECTED'].map((item) => <option key={item} value={item}>{statusLabel(item as PublicationStatus)}</option>)}</select></label><table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}><thead><tr><th align="left">Submission</th><th align="left">Status</th><th align="left">Researcher verification</th><th align="left">Action</th></tr></thead><tbody>{visible.map((paper) => <tr key={paper.id}><td style={{ padding: '12px 8px' }}>{paper.title}</td><td><span className={shared.status}>{statusLabel(paper.status)}</span></td><td>{paper.researcherVerificationStatus}</td><td><Link to={`/admin/paper-submissions/${paper.id}`}>Open editorial record</Link></td></tr>)}</tbody></table></div></section>;
};

export default AdminPaperSubmissions;
