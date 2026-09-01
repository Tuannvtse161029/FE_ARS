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

  // Empty state: no topics at all yet. The lecturer hasn't created any
  // research topics, so the milestone editor has nothing to bind to. We
  // surface a truthful message instead of a half-styled form.
  if (topics.length === 0 && !topicsLoading) {
    return (
      <div className={styles.configureMilestones}>
        <div className={styles.breadcrumbs}>
          Home &gt; <span className={styles.activeBreadcrumb}>Topic phases</span>
        </div>
        <section className={styles.configCard}>
          <div className={styles.cardHeader}>
            <div className={styles.headerTitleRow}>
              <span className={styles.headerLabel}>RESEARCH TOPIC WORKFLOW</span>
              <h1 className={styles.pageTitle}>Configure reporting phases</h1>
            </div>
          </div>
          <div className={styles.phasesEmpty}>
            Configure reporting phases for any research topic you create.
            Topics must exist before phases can be assigned.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.configureMilestones}>
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Topic phases</span>
      </div>
      <BackendGapBanner
        field="ResearchTopicPhase CRUD, requirements, assessmentCriteria, startAt, endAt, order"
        feature="Dynamic phases beyond the fixed PhasedReport milestone API"
      />
      <section className={styles.configCard}>
        <div className={styles.cardHeader}>
          <div className={styles.headerTitleRow}>
            <span className={styles.headerLabel}>RESEARCH TOPIC WORKFLOW</span>
            <h1 className={styles.pageTitle}>Configure reporting phases</h1>
          </div>
          <span className={styles.headerLabel}>
            <Layers size={14} aria-hidden /> {phases.length} PHASES
          </span>
        </div>

        <div className={styles.configCardBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="phase-topic">
              Research topic
            </label>
            <select
              id="phase-topic"
              className={styles.formSelect}
              value={topicId ?? ''}
              onChange={(event) => setTopicId(Number(event.target.value))}
              disabled={topicsLoading}
            >
              <option value="">Select a topic</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title || `Topic #${topic.id}`}
                </option>
              ))}
            </select>
          </div>
          {group && (
            <div className={styles.assignedGroupRow}>
              Assigned group: <strong>{group.name}</strong>
            </div>
          )}
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertTriangle size={16} aria-hidden /> {error}
          </div>
        )}
        {message && (
          <div className={styles.successHint} role="status">
            {message}
          </div>
        )}

        <form onSubmit={save} className={styles.phasesForm}>
          {loading ? (
            <div className={styles.phasesEmpty}>
              <Loader size={16} className={styles.spinning} aria-hidden /> Loading phases…
            </div>
          ) : phases.length === 0 ? (
            <div className={styles.phasesEmpty}>
              No phases configured. Use “Add phase” below to define the
              first one for this topic.
            </div>
          ) : (
            phases.map((phase, index) => (
              <article key={index} className={styles.phaseEditor}>
                <header className={styles.phaseEditorHead}>
                  <h3 className={styles.phaseEditorTitle}>
                    <span className={styles.phaseIndexChip}>{index + 1}</span>
                    {phase.title || `Phase ${index + 1}`}
                  </h3>
                  {phases.length > 1 && (
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() =>
                        setPhases((current) => current.filter((_, i) => i !== index))
                      }
                      aria-label={`Remove phase ${index + 1}`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  )}
                </header>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor={`phase-title-${index}`}>
                    Title
                  </label>
                  <input
                    id={`phase-title-${index}`}
                    className={styles.formInput}
                    value={phase.title}
                    onChange={(event) => update(index, 'title', event.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor={`phase-req-${index}`}>
                    Requirements
                  </label>
                  <textarea
                    id={`phase-req-${index}`}
                    className={styles.formTextarea}
                    value={phase.requirements}
                    onChange={(event) => update(index, 'requirements', event.target.value)}
                    rows={3}
                    style={{ minHeight: 80 }}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor={`phase-crit-${index}`}>
                    Assessment criteria
                  </label>
                  <textarea
                    id={`phase-crit-${index}`}
                    className={styles.formTextarea}
                    value={phase.assessmentCriteria}
                    onChange={(event) =>
                      update(index, 'assessmentCriteria', event.target.value)
                    }
                    rows={3}
                    style={{ minHeight: 80 }}
                  />
                </div>

                <div className={styles.phaseEditorRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor={`phase-start-${index}`}>
                      Starts
                    </label>
                    <input
                      id={`phase-start-${index}`}
                      type="datetime-local"
                      className={styles.formInput}
                      value={phase.startAt}
                      onChange={(event) => update(index, 'startAt', event.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor={`phase-end-${index}`}>
                      Ends / deadline
                    </label>
                    <input
                      id={`phase-end-${index}`}
                      type="datetime-local"
                      className={styles.formInput}
                      value={phase.endAt}
                      onChange={(event) => update(index, 'endAt', event.target.value)}
                      required
                    />
                  </div>
                </div>

                {existing[index]?.locked && (
                  <span className={styles.phaseLockedNote}>
                    This phase is locked because a report has been submitted.
                  </span>
                )}
              </article>
            ))
          )}

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.addPhaseBtn}
              onClick={() =>
                setPhases((current) => [...current, makePhase(current.length + 1)])
              }
            >
              <Plus size={16} aria-hidden /> Add phase
            </button>
            <button
              type="submit"
              className={styles.saveBtn}
              disabled={saving || loading}
            >
              {saving ? (
                <Loader size={16} className={styles.spinning} aria-hidden />
              ) : (
                <Save size={16} aria-hidden />
              )}
              Save phases
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default ConfigureMilestones;
