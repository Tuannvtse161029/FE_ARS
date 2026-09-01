import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Layers, Loader, Plus, Save, Trash2 } from 'lucide-react';
import { useResearchTopics } from '../../hooks/useResearchTopics';
import { useResearchGroups } from '../../hooks/useResearchGroups';
import { researchTopicPhaseService, validatePhaseDrafts, type PhaseDraft, type ResearchTopicPhase, toInputDate } from '../../services/researchTopicPhase.service';
import BackendGapBanner from '../../components/BackendGapBanner';
import styles from './ConfigureMilestones.module.css';

const makePhase = (number: number): PhaseDraft => ({ title: `Phase ${number}`, requirements: '', assessmentCriteria: '', startAt: '', endAt: '' });

export const ConfigureMilestones = () => {
  const { topics, isLoading: topicsLoading } = useResearchTopics();
  const { groups } = useResearchGroups();
  const [topicId, setTopicId] = useState<number | null>(null);
  const [phases, setPhases] = useState<PhaseDraft[]>([makePhase(1)]);
  const [existing, setExisting] = useState<ResearchTopicPhase[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!topicId && topics[0]?.id) setTopicId(topics[0].id); }, [topics, topicId]);
  useEffect(() => {
    if (!topicId) return;
    setLoading(true); setError(null);
    researchTopicPhaseService.getByTopic(topicId).then((items) => {
      setExisting(items);
      if (items.length) setPhases(items.map((item) => ({ title: item.title, requirements: item.requirements, assessmentCriteria: item.assessmentCriteria, startAt: toInputDate(item.startAt), endAt: toInputDate(item.endAt || item.deadlineAt) })));
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load phases.')).finally(() => setLoading(false));
  }, [topicId]);
  const group = useMemo(() => groups.find((item) => item.topicId === topicId) ?? null, [groups, topicId]);
  const update = (index: number, key: keyof PhaseDraft, value: string) => setPhases((current) => current.map((phase, i) => i === index ? { ...phase, [key]: value } : phase));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setMessage(null);
    if (!topicId) { setError('Select a research topic first.'); return; }
    const validation = validatePhaseDrafts(phases);
    if (validation) { setError(validation); return; }
    setSaving(true);
    try {
      const result = await researchTopicPhaseService.save(topicId, phases, group?.id ?? null);
      setExisting(result.phases); setMessage(result.usedDemo ? 'API milestones saved. Additional phases are isolated demo data and were not persisted.' : 'Milestones saved successfully.');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Unable to save phases.'); } finally { setSaving(false); }
  };
  return <div className={styles.configureMilestones}>
    <div className={styles.breadcrumbs}>Home &gt; Guidance Group &gt; <span className={styles.activeBreadcrumb}>Topic phases</span></div>
    <BackendGapBanner field="ResearchTopicPhase CRUD, requirements, assessmentCriteria, startAt, endAt, order" feature="Dynamic phases beyond the fixed PhasedReport milestone API" />
    <section className={styles.configCard}>
      <div className={styles.cardHeader}><div><span className={styles.headerLabel}>RESEARCH TOPIC WORKFLOW</span><h1 className={styles.pageTitle}>Configure reporting phases</h1></div><span className={styles.headerLabel}><Layers size={14} /> {phases.length} PHASES</span></div>
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-subtle)' }}><label htmlFor="phase-topic">Research topic</label><select id="phase-topic" value={topicId ?? ''} onChange={(event) => setTopicId(Number(event.target.value))} disabled={topicsLoading}><option value="">Select a topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title || `Topic #${topic.id}`}</option>)}</select>{group && <span> Assigned group: <strong>{group.name}</strong></span>}</div>
      {error && <div role="alert" style={{ padding: '1rem', color: 'var(--status-danger-text)' }}><AlertTriangle size={16} /> {error}</div>}
      {message && <div role="status" style={{ padding: '1rem', color: 'var(--status-success-text)' }}>{message}</div>}
      <form onSubmit={save} style={{ padding: '1.25rem' }}>
        {phases.map((phase, index) => <div key={index} style={{ border: '1px solid var(--border-subtle)', padding: '1rem', marginBottom: '1rem', background: 'var(--surface-raised)' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Phase {index + 1}</strong>{phases.length > 1 && <button type="button" onClick={() => setPhases((current) => current.filter((_, i) => i !== index))} aria-label={`Remove phase ${index + 1}`}><Trash2 size={16} /></button>}</div><label>Title<input value={phase.title} onChange={(event) => update(index, 'title', event.target.value)} required /></label><label>Requirements<textarea value={phase.requirements} onChange={(event) => update(index, 'requirements', event.target.value)} rows={2} /></label><label>Assessment criteria<textarea value={phase.assessmentCriteria} onChange={(event) => update(index, 'assessmentCriteria', event.target.value)} rows={2} /></label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}><label>Starts<input type="datetime-local" value={phase.startAt} onChange={(event) => update(index, 'startAt', event.target.value)} /></label><label>Ends / deadline<input type="datetime-local" value={phase.endAt} onChange={(event) => update(index, 'endAt', event.target.value)} required /></label></div>{existing[index]?.locked && <small>This phase is locked because a report has been submitted.</small>}</div>)}
        <div style={{ display: 'flex', gap: '0.75rem' }}><button type="button" onClick={() => setPhases((current) => [...current, makePhase(current.length + 1)])}><Plus size={16} /> Add phase</button><button type="submit" disabled={saving || loading}>{saving ? <Loader size={16} /> : <Save size={16} />} Save phases</button></div>
      </form>
    </section>
  </div>;
};

export default ConfigureMilestones;
