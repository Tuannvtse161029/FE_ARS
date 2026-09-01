import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FileText, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { BackendGapBanner } from '../../components/BackendGapBanner';
import { sharedMaterialService, type SharedMaterial } from '../../services/sharedMaterial.service';
import { useListShortcuts } from '../../hooks/useListShortcuts';
import styles from './SharedMaterials.module.css';

export const LecturerSharedMaterialsPage = (): JSX.Element => {
  const { user } = useAuth();
  const lecturerId = user?.userId ?? null;
  const [items, setItems] = useState<SharedMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SharedMaterial | null>(null);
  const [paperId, setPaperId] = useState('');
  const [colleagueId, setColleagueId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await sharedMaterialService.getAll()); } catch { setError('Shared materials could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const startCreate = () => { setEditing(null); setPaperId(''); setColleagueId(''); setStatus('ACTIVE'); setOpen(true); };
  const startEdit = (item: SharedMaterial) => { setEditing(item); setPaperId(String(item.paperId ?? '')); setColleagueId(String(item.sharedWithColleagueId ?? '')); setStatus(item.status ?? 'ACTIVE'); setOpen(true); };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da; // newest created first
    });
  }, [items]);

  // Part 3 — keyboard shortcuts for the shared-materials grid.
  // j/k navigate cards, Enter opens the edit modal for the focused card,
  // n opens the create modal, f is intentionally omitted (no TableToolbar
  // search on this page — there are no filters to focus).
  const { selectedIndex } = useListShortcuts({
    itemCount: sortedItems.length,
    onOpen: (index) => {
      const item = sortedItems[index];
      if (item) startEdit(item);
    },
    onNew: startCreate,
    onFilterFocus: null,
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null);
    const payload = { lecturerId, paperId: paperId ? Number(paperId) : null, sharedWithColleagueId: colleagueId ? Number(colleagueId) : null, sharedAt: editing?.sharedAt ?? new Date().toISOString(), status: status || null };
    try { if (editing?.sharedMaterialId) await sharedMaterialService.update(editing.sharedMaterialId, payload); else await sharedMaterialService.create(payload); setOpen(false); await load(); }
    catch { setError('The shared material could not be saved.'); } finally { setSaving(false); }
  };
  const remove = async (item: SharedMaterial) => { if (!item.sharedMaterialId || !window.confirm('Delete this shared material?')) return; try { await sharedMaterialService.delete(item.sharedMaterialId); await load(); } catch { setError('The shared material could not be deleted.'); } };

  return <section className={styles.page}>
    <PageHeader eyebrow="LECTURER WORKSPACE" title="Shared Materials" description="Share research papers with colleagues and keep your study references close at hand." actions={<Button onClick={startCreate}><Plus size={16} /> Share paper</Button>} />
    <BackendGapBanner field="SharedMaterial.title, description, materialType, url, topicId" feature="PDF, Drive, website, and reference catalog metadata" />
    {error && <div className={styles.error} role="alert">{error}</div>}
    <div className={styles.toolbar}><span>{loading ? 'Loading…' : `${sortedItems.length} shared ${sortedItems.length === 1 ? 'paper' : 'papers'}`}</span><Button variant="ghost" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Refresh</Button></div>
    {loading ? <div className={styles.empty}>Loading shared materials…</div> : sortedItems.length === 0 ? <div className={styles.empty}><FileText size={28} /><strong>No shared papers yet</strong><span>Use Share paper to create a collaboration record.</span></div> : <div className={styles.grid}>{sortedItems.map((item, index) => <article
      className={`${styles.card} ${selectedIndex === index ? styles.selectedCard : ''}`}
      key={item.sharedMaterialId}
      data-testid="shared-material-card"
    ><div className={styles.cardIcon}><FileText size={20} /></div><div className={styles.cardBody}><h2>Paper #{item.paperId ?? 'Not supplied'}</h2><p>Shared with colleague #{item.sharedWithColleagueId ?? 'Not supplied'}</p><span className={styles.status}>{item.status ?? 'Unknown'}</span><small>{item.sharedAt ? new Date(item.sharedAt).toLocaleDateString() : 'Date not supplied'}</small></div><div className={styles.cardActions}><Button variant="ghost" aria-label="Edit" onClick={() => startEdit(item)}><Pencil size={16} /></Button><Button variant="ghost" aria-label="Delete" onClick={() => void remove(item)}><Trash2 size={16} /></Button></div></article>)}</div>}
    {open && <div className={styles.overlay} role="presentation"><form className={styles.modal} onSubmit={submit}><div className={styles.modalHeader}><h2>{editing ? 'Edit shared paper' : 'Share a paper'}</h2><Button variant="ghost" type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></Button></div><label>Paper ID<input required inputMode="numeric" value={paperId} onChange={(e) => setPaperId(e.target.value)} /></label><label>Colleague ID<input required inputMode="numeric" value={colleagueId} onChange={(e) => setColleagueId(e.target.value)} /></label><label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option></select></label><div className={styles.modalActions}><Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div></form></div>}
  </section>;
};

export default LecturerSharedMaterialsPage;
