import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicationAdapter } from '../api/publication.adapter';
import { PublicationDemoBanner } from '../components/PublicationDemoBanner';
import shared from '../components/PublicationShared.module.css';

export const ResearcherSubmissionForm = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [institution, setInstitution] = useState('');
  const [paperType, setPaperType] = useState('Research article');
  const [keywords, setKeywords] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (sendToAdmin: boolean) => {
    if (!title.trim() || !abstract.trim() || !authorName.trim() || !institution.trim()) { setError('Title, abstract, first author, and institution are required.'); return; }
    setSaving(true); setError(null);
    try {
      const draft = await publicationAdapter.createDraft({ title: title.trim(), abstract: abstract.trim(), authors: [{ id: 'current-author', name: authorName.trim(), institutionIds: ['current-institution'], order: 1 }], institutions: [{ id: 'current-institution', name: institution.trim() }], paperType, keywords: keywords.split(',').map((value) => value.trim()).filter(Boolean), topics: [], fileUrl: fileUrl.trim() || undefined });
      const paper = sendToAdmin ? await publicationAdapter.submitPaper(draft.id) : draft;
      navigate(`/researcher/submissions/${paper.id}`);
    } catch { setError('The draft could not be saved.'); } finally { setSaving(false); }
  };

  return <section className={shared.page}><header className={shared.header}><div><h1>New Submission</h1><p>Prepare manuscript metadata for Admin screening. Reviewer selection is performed by Admin only.</p></div></header><PublicationDemoBanner />{error && <div className={shared.error} role="alert">{error}</div>}<form className={shared.panel} onSubmit={(event) => { event.preventDefault(); void submit(true); }}><div className={shared.formGrid}><div className={`${shared.field} ${shared.full}`}><label htmlFor="submission-title">Title</label><input id="submission-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div><div className={`${shared.field} ${shared.full}`}><label htmlFor="submission-abstract">Abstract</label><textarea id="submission-abstract" rows={6} value={abstract} onChange={(event) => setAbstract(event.target.value)} /></div><div className={shared.field}><label htmlFor="submission-author">First author</label><input id="submission-author" value={authorName} onChange={(event) => setAuthorName(event.target.value)} /></div><div className={shared.field}><label htmlFor="submission-institution">Institution</label><input id="submission-institution" value={institution} onChange={(event) => setInstitution(event.target.value)} /></div><div className={shared.field}><label htmlFor="submission-type">Paper type</label><select id="submission-type" value={paperType} onChange={(event) => setPaperType(event.target.value)}><option>Research article</option><option>Methodology article</option><option>Review article</option></select></div><div className={shared.field}><label htmlFor="submission-keywords">Keywords</label><input id="submission-keywords" placeholder="Comma separated" value={keywords} onChange={(event) => setKeywords(event.target.value)} /></div><div className={`${shared.field} ${shared.full}`}><label htmlFor="submission-file">Manuscript file URL</label><input id="submission-file" type="url" placeholder="Firebase upload URL when available" value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} /></div></div><div className={shared.actions} style={{ marginTop: 18 }}><button type="button" className={shared.buttonSecondary} disabled={saving} onClick={() => void submit(false)}>Save draft</button><button className={shared.button} disabled={saving}>{saving ? 'Saving...' : 'Submit to Admin'}</button></div></form></section>;
};

export default ResearcherSubmissionForm;
