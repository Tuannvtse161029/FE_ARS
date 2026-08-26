import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { publicationAdapter } from '../api/publication.adapter';
import { PublicationDemoBanner } from '../components/PublicationDemoBanner';
import shared from '../components/PublicationShared.module.css';
import type { PublicationPaper, ReviewerRecommendation } from '../types/publication';

export const ReviewerAssignmentDetail = () => {
  const { id } = useParams(); const navigate = useNavigate(); const [paper, setPaper] = useState<PublicationPaper | null>(null); const [comments, setComments] = useState(''); const [recommendation, setRecommendation] = useState<ReviewerRecommendation>('ACCEPT'); const [saving, setSaving] = useState(false);
  useEffect(() => { publicationAdapter.getAdminSubmissions().then((items) => setPaper(items.find((item) => item.id === id) ?? null)); }, [id]);
  const respond = async (accepted: boolean) => { if (!paper) return; setSaving(true); try { const updated = await publicationAdapter.respondToAssignment(paper.id, accepted); setPaper(updated); if (!accepted) navigate('/reviewer/assignments'); } finally { setSaving(false); } };
  const submit = async () => { if (!paper || !comments.trim()) return; setSaving(true); try { setPaper(await publicationAdapter.submitReview(paper.id, recommendation, comments.trim())); } finally { setSaving(false); } };
  if (!paper) return <div className={shared.loading}>Loading assignment...</div>;
  const awaitingResponse = paper.status === 'REVIEWER_ASSIGNED'; const canReview = paper.status === 'UNDER_REVIEW'; const submitted = paper.status === 'REVIEWER_RECOMMENDED_ACCEPT' || paper.status === 'REVIEWER_RECOMMENDED_REJECT';
  return <section className={shared.page}><header className={shared.header}><div><h1>{paper.title}</h1><p>Assigned by Admin. Your recommendation is private and does not publish this paper.</p></div></header><PublicationDemoBanner /><div className={shared.panel}><p>{paper.abstract}</p><p><strong>File:</strong> {paper.fileUrl ? <a href={paper.fileUrl} target="_blank" rel="noreferrer">Open manuscript</a> : 'No file URL is available in this demo record.'}</p>{awaitingResponse && <div className={shared.actions}><button className={shared.button} disabled={saving} onClick={() => void respond(true)}>Accept assignment</button><button className={shared.buttonSecondary} disabled={saving} onClick={() => void respond(false)}>Decline assignment</button></div>}{canReview && <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className={shared.formGrid}><div className={`${shared.field} ${shared.full}`}><label htmlFor="private-comments">Private review feedback for Admin</label><textarea id="private-comments" rows={7} value={comments} onChange={(event) => setComments(event.target.value)} /></div><div className={shared.field}><label htmlFor="recommendation">Recommendation</label><select id="recommendation" value={recommendation} onChange={(event) => setRecommendation(event.target.value as ReviewerRecommendation)}><option value="ACCEPT">Accept</option><option value="REVISION_REQUIRED">Revision required</option><option value="REJECT">Reject</option></select></div><div className={shared.actions} style={{ alignItems: 'end' }}><button className={shared.button} disabled={saving}>Submit private review to Admin</button></div></form>}{submitted && <div className={shared.empty}>Review submitted. Awaiting Admin decision.</div>}</div></section>;
};

export default ReviewerAssignmentDetail;
