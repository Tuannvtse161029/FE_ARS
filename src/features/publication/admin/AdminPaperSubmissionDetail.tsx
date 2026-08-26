import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicationAdapter } from '../api/publication.adapter';
import { PublicationDemoBanner } from '../components/PublicationDemoBanner';
import shared from '../components/PublicationShared.module.css';
import { statusLabel, type PublicationPaper } from '../types/publication';

export const AdminPaperSubmissionDetail = () => {
  const { id } = useParams(); const [paper, setPaper] = useState<PublicationPaper | null>(null); const [reviewerName, setReviewerName] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { publicationAdapter.getAdminSubmissions().then((items) => setPaper(items.find((item) => item.id === id) ?? null)); }, [id]);
  const assign = async () => { if (!paper || !reviewerName.trim()) return; setSaving(true); try { setPaper(await publicationAdapter.assignReviewer(paper.id, reviewerName.trim())); } finally { setSaving(false); } };
  const publish = async () => { if (!paper) return; setSaving(true); try { setPaper(await publicationAdapter.publishPaper(paper.id)); } finally { setSaving(false); } };
  if (!paper) return <div className={shared.loading}>Loading editorial record...</div>;
  const reviewerRecommended = paper.status === 'REVIEWER_RECOMMENDED_ACCEPT' || paper.status === 'REVIEWER_RECOMMENDED_REJECT';
  return <section className={shared.page}><header className={shared.header}><div><h1>{paper.title}</h1><p>Admin editorial record. Private review material is only rendered here.</p></div><span className={shared.status}>{statusLabel(paper.status)}</span></header><PublicationDemoBanner /><div className={shared.panel}><p><strong>Researcher verification:</strong> {paper.researcherVerificationStatus}</p><p><strong>Identifiers:</strong> {paper.doi ?? paper.openAlexId ?? paper.externalIdentifier ?? 'None supplied'}</p><p><strong>Authors:</strong> {paper.authors.map((author) => author.name).join(', ')}</p><p><strong>Institutions:</strong> {paper.institutions.map((institution) => institution.name).join(', ')}</p>{paper.reviewer && <section className={shared.panel}><h2 style={{ fontSize: 17 }}>Private reviewer recommendation</h2><p><strong>Reviewer:</strong> {paper.reviewer.reviewerName}</p><p><strong>Recommendation:</strong> {paper.reviewer.recommendation}</p><p><strong>Private comments:</strong> {paper.reviewer.privateComments || 'No private comments submitted.'}</p></section>}<div className={shared.actions}>{!paper.reviewer && <><input aria-label="Reviewer name" placeholder="Reviewer name" value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} /><button className={shared.button} disabled={saving || !reviewerName.trim()} onClick={() => void assign()}>Assign reviewer</button></>}{reviewerRecommended && <button className={shared.button} disabled={saving} onClick={() => void publish()}>Approve and publish</button>}{paper.status === 'PUBLISHED' && <span className={shared.status}>Published to Home catalog</span>}</div></div></section>;
};

export default AdminPaperSubmissionDetail;
