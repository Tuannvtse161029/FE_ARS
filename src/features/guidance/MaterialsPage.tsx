/**
 * MaterialsPage — Lecturer materials combined page
 *
 * Refactored from src/pages/Lecturer/Materials.tsx
 * Uses extracted components:
 *   - MaterialEditor (add material form)
 *   - MaterialUpload (upload lifecycle helper)
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  FileText,
  Loader,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Library,
  Trash2,
  Link2,
  Upload,
  Check,
  CloudUpload,
  Search,
  Share2,
  ChevronRight,
  Eye,
} from 'lucide-react';
import api from '../../services/axios';
import { API_ENDPOINTS } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { useLearningMaterials } from '../../hooks/useLearningMaterials';
import {
  learningMaterialService,
  defaultLearningMaterialFolderPath,
} from '../../services/learningMaterial.service';
import type { LearningMaterial } from '../../services/learningMaterial.service';
import {
  sharedMaterialService,
  type SharedMaterial,
} from '../../services/sharedMaterial.service';
import { researchTopicService } from '../../services/researchTopic.service';
import type { ResearchTopic } from '../../types/research';
import { phasedReportService } from '../../services/phasedReport.service';
import type { PhasedReport } from '../../services/phasedReport.service';
import {
  useFirebaseFileUpload,
  FILE_UPLOAD_ACCEPT,
} from '../../hooks/useFirebaseFileUpload';
import { FieldError } from '../../components/FieldError';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { BackendGapBanner } from '../../components/BackendGapBanner';
import { useT } from '../../i18n/I18nContext';
import { ROUTES } from '../../routes/paths';
import { validateHttpsUrl } from '../../utils/validationRules';
import {
  buildConfigureMilestonesUrl,
  buildResearchTopicsUrl,
} from '../../utils/topicRouting';
import {
  MaterialUsageModal,
  type UsageNavigationTarget,
} from '../../components/lecturer/MaterialUsageModal';
import { ShareApiContractPreview } from '../../components/lecturer/ShareApiContractPreview';
import { MaterialEditor } from './components/MaterialEditor';
import { SharedSection } from './components/SharedSection';
// CSS module kept at the original Materials CSS location for now.
import styles from '../../pages/Lecturer/Materials.module.css';

export type SharedMaterialUiStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'ENDED' | 'ACTIVE' | 'ARCHIVED';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const isExpired = (sharedAt: string | null | undefined): boolean => {
  if (!sharedAt) return false;
  const ts = new Date(sharedAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > THIRTY_DAYS_MS;
};
export const resolveUiStatus = (item: SharedMaterial): SharedMaterialUiStatus => {
  const raw = (item.status ?? '').toUpperCase();
  if (raw === 'ENDED') return 'ENDED';
  if (raw === 'ACCEPTED') return 'ACCEPTED';
  if (raw === 'DECLINED') return 'DECLINED';
  if (raw === 'PENDING') return 'PENDING';
  if (isExpired(item.sharedAt ?? item.createdAt)) return 'EXPIRED';
  if (raw === 'ARCHIVED') return 'ARCHIVED';
  return 'ACTIVE';
};

export type RosterLoadOutcome =
  | { kind: 'empty' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string };

type TabId = 'my-materials' | 'shared-materials';

// ── Source-type detection ──────────────────────────────────────────
const FILE_URL_PATTERN = /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|webp)(\?|#|$)/i;
const FIREBASE_HOST_PATTERN = /firebasestorage\.googleapis\.com/i;

const isFileSource = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (FILE_URL_PATTERN.test(trimmed)) return true;
  return FIREBASE_HOST_PATTERN.test(trimmed);
};

// ── Learning Materials helpers ─────────────────────────────────────

const formatTitle = (m: LearningMaterial): string => {
  if (m.title && m.title.trim().length > 0) return m.title.trim();
  if (m.id) return `Material #${m.id}`;
  return 'Untitled material';
};

const deriveFilenameFromUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  try {
    const cleaned = url.split('?')[0]?.split('#')[0] ?? url;
    const segments = cleaned.split('/').filter(Boolean);
    const tail = segments[segments.length - 1] ?? '';
    return decodeURIComponent(tail) || url;
  } catch {
    return url;
  }
};

// ── Lecturer roster ────────────────────────────────────────────────

interface LecturerRosterEntry {
  id: number;
  fullName: string;
  email: string;
}

export type RosterLoadOutcome =
  | { kind: 'empty' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string };

const isForbiddenError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const status =
    (err as { response?: { status?: number }; status?: number }).response?.status ??
    (err as { status?: number }).status;
  return status === 403 || status === 401;
};

const ROSTER_PAGE_SIZE = 100;
const ROSTER_MAX_PAGES = 10;

const fetchLecturerRoster = async (
  currentUserId: number | null,
): Promise<{ rows: LecturerRosterEntry[]; outcome: RosterLoadOutcome }> => {
  try {
    const seen = new Set<number>();
    const collected: LecturerRosterEntry[] = [];
    for (let page = 1; page <= ROSTER_MAX_PAGES; page += 1) {
      const response = await api.get(API_ENDPOINTS.USER.GET_ALL, {
        params: { pageNumber: page, pageSize: ROSTER_PAGE_SIZE, role: 'Lecturer' },
      });
      const payload = response.data as
        | { items?: unknown; data?: unknown; totalPages?: number }
        | unknown[];
      const items: unknown[] = Array.isArray(payload)
        ? (payload as unknown[])
        : ((payload as { items?: unknown[] }).items ??
          (payload as { data?: unknown[] }).data ??
          []);
      if (items.length === 0) break;
      for (const raw of items) {
        const entry = raw as Partial<LecturerRosterEntry> & { userId?: number };
        const id = entry.id ?? entry.userId;
        if (typeof id !== 'number') continue;
        if (seen.has(id)) continue;
        seen.add(id);
        collected.push({
          id,
          fullName: (entry.fullName ?? '').toString(),
          email: (entry.email ?? '').toString(),
        });
      }
      const totalPages = (payload as { totalPages?: number }).totalPages;
      if (typeof totalPages === 'number' && page >= totalPages) break;
    }
    return {
      rows: collected.filter((u) => u.id !== currentUserId),
      outcome: { kind: 'empty' },
    };
  } catch (err) {
    if (isForbiddenError(err)) return { rows: [], outcome: { kind: 'forbidden' } };
    const message = err instanceof Error ? err.message : 'Unknown lecturer roster error.';
    return { rows: [], outcome: { kind: 'error', message } };
  }
};

export const LecturerMaterialsPage = () => {
  const { user } = useAuth();
  const lecturerId = user?.userId ?? null;
  const t = useT();

  const [activeTab, setActiveTab] = useState<TabId>('my-materials');

  const [usageModalMaterial, setUsageModalMaterial] = useState<LearningMaterial | null>(null);
  const openUsageModal = (material: LearningMaterial) => setUsageModalMaterial(material);
  const closeUsageModal = () => setUsageModalMaterial(null);

  const {
    materials,
    isLoading: lmLoading,
    error: lmError,
    refetch: refetchLearning,
  } = useLearningMaterials({ lecturerId });

  const [topics, setTopics] = useState<ResearchTopic[]>([]);
  const [phases, setPhases] = useState<PhasedReport[]>([]);
  const [crossRefLoading, setCrossRefLoading] = useState(true);

  const loadCrossReference = useCallback(async () => {
    setCrossRefLoading(true);
    try {
      const [topicList, phaseList] = await Promise.all([
        researchTopicService.getAll().catch(() => []),
        phasedReportService.getAll().catch(() => [] as PhasedReport[]),
      ]);
      setTopics((topicList as ResearchTopic[]).filter((t): t is ResearchTopic => typeof t.id === 'number'));
      setPhases(phaseList);
    } finally {
      setCrossRefLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCrossReference();
  }, [loadCrossReference]);

  const usedByTopicsForModal = useMemo(() => {
    if (!usageModalMaterial) return [];
    const url = usageModalMaterial.fileUrl?.trim();
    if (!url) return [];
    return topics.filter((t) => (t.materialsUrl ?? '').trim() === url);
  }, [usageModalMaterial, topics]);

  const usedByPhasesForModal = useMemo(() => {
    if (!usageModalMaterial) return [];
    const url = usageModalMaterial.fileUrl?.trim();
    if (!url) return [];
    return phases.filter((p) => (p.phasedMaterialsUrl ?? '').trim() === url);
  }, [usageModalMaterial, phases]);

  const usageByUrl = useMemo(() => {
    const map = new Map<string, { topicCount: number; phaseCount: number; hasOpenTopic: boolean }>();
    for (const m of materials) {
      const url = m.fileUrl?.trim();
      if (!url) continue;
      const entry = map.get(url) ?? { topicCount: 0, phaseCount: 0, hasOpenTopic: false };
      for (const topic of topics) {
        if ((topic.materialsUrl ?? '').trim() === url) {
          entry.topicCount += 1;
          if ((topic.status ?? '').toUpperCase() === 'OPEN') entry.hasOpenTopic = true;
        }
      }
      for (const phase of phases) {
        if ((phase.phasedMaterialsUrl ?? '').trim() === url) entry.phaseCount += 1;
      }
      map.set(url, entry);
    }
    return map;
  }, [materials, topics, phases]);

  const [lmSearch, setLmSearch] = useState('');
  const [lmShowForm, setLmShowForm] = useState(false);

  const {
    uploadFile,
    progress: lmUploadProgress,
    isUploading: lmIsUploading,
    error: lmUploadError,
    fileUrl: lmUploadedUrl,
    resetUpload: lmResetUpload,
  } = useFirebaseFileUpload(defaultLearningMaterialFolderPath(lecturerId));

  const [banner, setBanner] = useState<{
    visible: boolean;
    text: string;
    variant: 'success' | 'error';
  }>({ visible: false, text: '', variant: 'success' });

  const showBanner = (text: string, variant: 'success' | 'error' = 'success') => {
    setBanner({ visible: true, text, variant });
    window.setTimeout(() => setBanner({ visible: false, text: '', variant: 'success' }), 4000);
  };

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const filteredMaterials = useMemo(() => {
    const q = lmSearch.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((m) =>
      [m.title ?? '', m.description ?? '', m.fileUrl ?? ''].join(' ').toLowerCase().includes(q),
    );
  }, [materials, lmSearch]);

  const sortedMaterials = useMemo(() => {
    return [...filteredMaterials].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [filteredMaterials]);

  const handleLmRefresh = async () => {
    await Promise.all([refetchLearning(), loadCrossReference()]);
  };

  const closeLmForm = () => {
    setLmShowForm(false);
    lmResetUpload();
    setLmSearch('');
  };

  const handleLmAdd = async (
    title: string,
    description: string,
    sourceMode: 'file' | 'url',
    uploadedFile: File | null,
    fileUrl: string,
  ) => {
    if (!lecturerId) {
      showBanner('No lecturer session — please sign in again.', 'error');
      return false;
    }
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle) {
      showBanner('Title is required.', 'error');
      return false;
    }

    let resolvedUrl: string | null = null;
    if (sourceMode === 'file') {
      if (!uploadedFile) {
        showBanner('Please select a file to upload.', 'error');
        return false;
      }
      if (lmUploadedUrl) {
        resolvedUrl = lmUploadedUrl;
      } else {
        resolvedUrl = await uploadFile(uploadedFile);
        if (!resolvedUrl) {
          showBanner(lmUploadError ?? 'File upload failed.', 'error');
          return false;
        }
      }
    } else {
      const urlVal = fileUrl.trim();
      if (urlVal.length > 0) {
        const urlErr = validateHttpsUrl(urlVal);
        if (urlErr) {
          showBanner(urlErr, 'error');
          return false;
        }
      }
      resolvedUrl = urlVal.length > 0 ? urlVal : null;
    }

    try {
      await learningMaterialService.create({
        lecturerId,
        title: trimmedTitle,
        fileUrl: resolvedUrl,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        subFieldId: null,
      });
      showBanner('Material added to your library.');
      closeLmForm();
      await Promise.all([refetchLearning(), loadCrossReference()]);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The server rejected the material. Please try again.';
      showBanner(message, 'error');
      return false;
    }
  };

  const handleLmDelete = async (id: number) => {
    if (!id) return;
    try {
      await learningMaterialService.delete(id);
      setPendingDeleteId(null);
      showBanner('Material deleted.');
      await Promise.all([refetchLearning(), loadCrossReference()]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete the material.';
      showBanner(message, 'error');
    }
  };

  // ── Shared Materials ──────────────────────────────────────────
  const [sharedItems, setSharedItems] = useState<SharedMaterial[]>([]);
  const [sharedLoading, setSharedLoading] = useState(true);
  const [sharedError, setSharedError] = useState<string | null>(null);

  const loadShared = useCallback(async () => {
    setSharedLoading(true);
    setSharedError(null);
    try {
      setSharedItems(await sharedMaterialService.getAll());
    } catch {
      setSharedError('Shared materials could not be loaded.');
    } finally {
      setSharedLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShared();
  }, [loadShared]);

  const sharedByMe = useMemo(() => sharedItems.filter((s) => s.lecturerId === lecturerId), [sharedItems, lecturerId]);
  const sharedWithMe = useMemo(() => sharedItems.filter((s) => s.sharedWithColleagueId === lecturerId), [sharedItems, lecturerId]);

  const learningById = useMemo(() => {
    const map = new Map<number, LearningMaterial>();
    for (const m of materials) {
      const id = typeof m.id === 'number' ? m.id : null;
      if (id !== null) map.set(id, m);
    }
    return map;
  }, [materials]);

  const resolveSharedTitle = (item: SharedMaterial): { title: string; known: boolean } => {
    const directTitle = (item.learningMaterialTitle || item.title)?.trim();
    if (directTitle) return { title: directTitle, known: true };
    const targetId = typeof item.learningMaterialId === 'number'
      ? item.learningMaterialId
      : typeof item.paperId === 'number' ? item.paperId : null;
    if (targetId !== null) {
      const found = learningById.get(targetId);
      if (found) return { title: formatTitle(found), known: true };
    }
    return { title: `Material #${targetId ?? '—'}`, known: false };
  };

  const resolveSharedExpiry = (sharedAt: string | null | undefined): { iso: string; daysRemaining: number | null } => {
    if (!sharedAt) return { iso: '', daysRemaining: null };
    const ts = new Date(sharedAt).getTime();
    if (Number.isNaN(ts)) return { iso: sharedAt, daysRemaining: null };
    const expiresAt = ts + THIRTY_DAYS_MS;
    const daysRemaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
    return { iso: new Date(expiresAt).toISOString(), daysRemaining };
  };

  const resolveColleagueName = (item: SharedMaterial, rosterIndex: Map<number, LecturerRosterEntry>): string => {
    const counterpart = item.lecturerId === lecturerId ? item.sharedWithColleagueId : item.lecturerId;
    if (typeof counterpart === 'number') {
      const found = rosterIndex.get(counterpart);
      if (found?.fullName) return found.fullName;
    }
    return `Colleague #${counterpart ?? '—'}`;
  };

  const [lecturerRoster, setLecturerRoster] = useState<LecturerRosterEntry[]>([]);
  const [rosterLoadOutcome, setRosterLoadOutcome] = useState<RosterLoadOutcome>({ kind: 'empty' });

  useEffect(() => {
    let cancelled = false;
    void fetchLecturerRoster(lecturerId).then(({ rows, outcome }) => {
      if (cancelled) return;
      setLecturerRoster(rows);
      setRosterLoadOutcome(outcome);
    });
    return () => { cancelled = true; };
  }, [lecturerId]);

  const rosterIndex = useMemo(() => {
    const map = new Map<number, LecturerRosterEntry>();
    for (const entry of lecturerRoster) map.set(entry.id, entry);
    return map;
  }, [lecturerRoster]);

  const updateSharedStatus = async (item: SharedMaterial, nextStatus: SharedMaterialUiStatus) => {
    if (!item.sharedMaterialId) return;
    try {
      await sharedMaterialService.update(item.sharedMaterialId, {
        lecturerId: item.lecturerId,
        paperId: item.paperId,
        sharedWithColleagueId: item.sharedWithColleagueId,
        sharedAt: item.sharedAt,
        status: nextStatus,
      });
      await Promise.all([loadShared(), refetchLearning()]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update the share.';
      showBanner(message, 'error');
    }
  };

  return (
    <div className={styles.materialsPage} data-testid="lecturer-materials">
      <PageHeader
        eyebrow="LECTURER WORKSPACE"
        title="Materials"
        description="Manage your learning materials and shared research papers in one place."
        accent="var(--ars-lecturer)"
      />

      <div className={styles.breadcrumbs}>
        Home &gt; <Link to={ROUTES.FORUM}>Forums</Link> &gt; <span className={styles.activeBreadcrumb}>Materials</span>
      </div>

      {banner.visible && (
        <div className={styles.successToastBanner}>
          <div className={styles.toastLeft}>
            <span className={styles.toastCheckIcon}>
              {banner.variant === 'success' ? <X size={14} strokeWidth={3} aria-hidden style={{ display: 'none' }} /> : <AlertTriangle size={14} aria-hidden />}
              {banner.variant === 'success' ? '+' : '!'}
            </span>
            <div>
              <span className={styles.toastTitle}>{banner.variant === 'success' ? 'Action Successful' : 'Action Failed'}</span>
              <p className={styles.toastSub}>{banner.text}</p>
            </div>
          </div>
          <div className={styles.toastRight}>
            <button type="button" className={styles.toastCloseBtn} onClick={() => setBanner({ visible: false, text: '', variant: 'success' })} aria-label="Dismiss">
              <X size={14} aria-hidden />
            </button>
          </div>
        </div>
      )}

      <div className={styles.tabBar} role="tablist" aria-label="Materials sections">
        <div className={styles.tabBarLeft}>
          <button
            type="button"
            role="tab"
            id="tab-my-materials"
            aria-selected={activeTab === 'my-materials'}
            aria-controls="panel-my-materials"
            className={`${styles.tabBtn} ${activeTab === 'my-materials' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('my-materials')}
          >
            <Library size={16} aria-hidden />
            {t('lecturer.materials.tab.myMaterials', 'My Materials')}
          </button>
          <button
            type="button"
            role="tab"
            id="tab-shared-materials"
            aria-selected={activeTab === 'shared-materials'}
            aria-controls="panel-shared-materials"
            className={`${styles.tabBtn} ${activeTab === 'shared-materials' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('shared-materials')}
          >
            <Link2 size={16} aria-hidden />
            {t('lecturer.materials.tab.sharedMaterials', 'Shared Materials')}
          </button>
        </div>

        {activeTab === 'my-materials' && (
          <div className={styles.tabBarActions}>
            <Button variant="outline" size="sm" leftIcon={lmLoading ? <Loader size={13} className={styles.spinningIcon} aria-hidden /> : <RefreshCw size={13} aria-hidden />} onClick={() => void handleLmRefresh()} disabled={lmLoading} aria-label="Refresh materials">
              Refresh
            </Button>
            <Button variant="primary" size="sm" leftIcon={<X size={14} aria-hidden style={{ display: 'none' }} />} onClick={() => setLmShowForm(true)} data-testid="open-add-material-modal">
              <span>+ Add Material</span>
            </Button>
          </div>
        )}
      </div>

      {/* TAB 1: My Materials */}
      <div id="panel-my-materials" role="tabpanel" aria-labelledby="tab-my-materials" className={`${styles.tabPanel} ${activeTab !== 'my-materials' ? styles.tabPanelHidden : ''}`}>
        {lmError && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorBannerIcon}>
              <AlertTriangle size={14} aria-hidden />
              <span>{lmError.message}</span>
            </span>
            <button type="button" className={styles.errorRetryBtn} onClick={() => void refetchLearning()}>
              Retry
            </button>
          </div>
        )}

        {lmShowForm && (
          <MaterialEditor
            onClose={closeLmForm}
            onSubmit={handleLmAdd}
            uploadProgress={lmUploadProgress}
            isUploading={lmIsUploading}
            uploadError={lmUploadError}
            uploadedUrl={lmUploadedUrl}
            onUploadFile={uploadFile}
            onResetUpload={lmResetUpload}
          />
        )}

        <div className={styles.lmSearchBar}>
          <Search size={14} aria-hidden />
          <input type="search" className={styles.lmSearchInput} placeholder="Search materials by title, description, or URL" value={lmSearch} onChange={(e) => setLmSearch(e.target.value)} aria-label="Search materials" />
          {lmSearch && (
            <button type="button" className={styles.lmSearchClear} aria-label="Clear search" onClick={() => setLmSearch('')}>
              <X size={12} aria-hidden />
            </button>
          )}
        </div>

        {lmLoading ? (
          <div className={styles.lmEmpty}><Loader size={16} className={styles.spinningIcon} aria-hidden /> Loading materials…</div>
        ) : materials.length === 0 ? (
          <div className={styles.lmEmpty}>
            <FileText size={28} aria-hidden />
            <strong>{t('lecturer.materials.empty.title', 'No materials yet')}</strong>
            <span>{t('lecturer.materials.empty.hint', 'Click Add Material to upload a file or paste a link.')}</span>
          </div>
        ) : sortedMaterials.length === 0 ? (
          <div className={styles.lmEmpty}>
            <FileText size={20} aria-hidden />
            <span>{t('lecturer.materials.empty.search', `No materials match "${lmSearch.trim()}".`)}</span>
          </div>
        ) : (
          <ul className={styles.materialGrid} aria-label="Learning materials">
            {sortedMaterials.map((material) => {
              const id = typeof material.id === 'number' ? material.id : -1;
              const url = material.fileUrl?.trim() ?? '';
              const fileLike = isFileSource(url);
              const usage = usageByUrl.get(url) ?? { topicCount: 0, phaseCount: 0, hasOpenTopic: false };
              const usageTotal = usage.topicCount + usage.phaseCount;
              const disabledDelete = usageTotal > 0;
              const disabledOpen = !url;
              const isConfirming = pendingDeleteId === id;
              const isSharedFromColleague = typeof material.lecturerId === 'number' && material.lecturerId !== lecturerId;
              return (
                <li key={String(material.id ?? id)} className={styles.materialCard} data-testid="learning-material-card">
                  <header className={styles.materialCardHeader}>
                    <h3 className={styles.materialCardTitle} title={formatTitle(material)}>{formatTitle(material)}</h3>
                    <span className={`${styles.materialSourceChip} ${isSharedFromColleague ? styles.materialSourceChipShared : fileLike ? styles.materialSourceChipFile : styles.materialSourceChipLink}`}>
                      {isSharedFromColleague ? t('lecturer.materials.source.shared', 'Shared') : fileLike ? t('lecturer.materials.source.file', 'File') : t('lecturer.materials.source.link', 'Link')}
                    </span>
                  </header>

                  {url && (
                    <p className={styles.materialCardUrl} title={url} onClick={() => { if (!disabledOpen) window.open(url, '_blank', 'noopener,noreferrer'); }}>
                      {fileLike ? deriveFilenameFromUrl(url) : url}
                    </p>
                  )}

                  {material.description?.trim() && <p className={styles.materialCardDescription} title={material.description}>{material.description}</p>}

                  <div className={styles.materialCardUsage}>
                    {crossRefLoading && usageTotal === 0 ? (
                      <span className={styles.materialUsageChipMuted}>Checking usage…</span>
                    ) : usageTotal === 0 ? (
                      <span className={styles.materialUsageChipMuted}>{t('lecturer.materials.usage.none', 'Not used')}</span>
                    ) : (
                      <button type="button" className={styles.materialUsageChipBtn} onClick={() => openUsageModal(material)} aria-label="Show where this material is used" data-testid="material-usage-chip-button">
                        {t('lecturer.materials.usage.summary', `Used by: ${usage.topicCount} topic(s), ${usage.phaseCount} phase(s)`, { topics: usage.topicCount, phases: usage.phaseCount })}
                        <ChevronRight size={12} aria-hidden />
                      </button>
                    )}
                  </div>

                  <div className={styles.materialCardActions}>
                    <button type="button" className={styles.materialOpenBtn} onClick={() => { if (!disabledOpen) window.open(url, '_blank', 'noopener,noreferrer'); }} disabled={disabledOpen} aria-label="Open material" title={disabledOpen ? 'No file or URL available' : 'Open'}>
                      <ExternalLink size={14} aria-hidden />
                      {t('lecturer.materials.action.open', 'Open')}
                    </button>
                    <button type="button" className={styles.materialShareBtn} aria-label="Share material">
                      <Share2 size={14} aria-hidden />
                      {t('lecturer.materials.action.share', 'Share')}
                    </button>
                    {!isSharedFromColleague && (
                      <button
                        type="button"
                        className={styles.materialDeleteBtn}
                        onClick={() => {
                          if (disabledDelete) return;
                          if (isConfirming) void handleLmDelete(id);
                          else setPendingDeleteId(id);
                        }}
                        disabled={disabledDelete || id < 0}
                        title={disabledDelete ? 'This material is in use and cannot be deleted.' : undefined}
                        aria-label="Delete material"
                      >
                        <Trash2 size={14} aria-hidden />
                        {isConfirming ? t('lecturer.materials.action.deleteConfirm', 'Delete') : t('lecturer.materials.action.cancel', 'Delete')}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* TAB 2: Shared Materials */}
      <div id="panel-shared-materials" role="tabpanel" aria-labelledby="tab-shared-materials" className={`${styles.tabPanel} ${activeTab !== 'shared-materials' ? styles.tabPanelHidden : ''}`}>
        <BackendGapBanner
          field={t('lecturer.materials.shared.gapBanner.field', 'SharedMaterial.learningMaterialId, status enum, expiry')}
          feature={t('lecturer.materials.shared.gapBanner.feature', 'API only accepts paperId (numeric) and returns ACTIVE/ARCHIVED — the FE infers the remaining statuses and computes the 30-day expiry client-side.')}
        />

        {sharedError && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorBannerIcon}>
              <AlertTriangle size={14} aria-hidden />
              <span>{sharedError}</span>
            </span>
            <button type="button" className={styles.errorRetryBtn} onClick={() => void loadShared()}>Retry</button>
          </div>
        )}

        <SharedSection
          title={t('lecturer.materials.shared.sectionByMe', 'Shared by me')}
          emptyText={t('lecturer.materials.shared.emptyByMe', 'You have not shared any materials with colleagues yet.')}
          loading={sharedLoading}
          items={sharedByMe}
          resolveExpiry={resolveSharedExpiry}
          resolveTitle={resolveSharedTitle}
          resolveColleagueName={(item) => resolveColleagueName(item, rosterIndex)}
          renderAction={(item) => {
            const status = resolveUiStatus(item);
            if (status === 'PENDING' || status === 'ACCEPTED' || status === 'EXPIRED') {
              return (
                <button type="button" className={styles.sharedEndBtn} onClick={() => void updateSharedStatus(item, 'ENDED')}>
                  {t('lecturer.materials.shared.endSharing', 'End sharing')}
                </button>
              );
            }
            return null;
          }}
        />

        <SharedSection
          title={t('lecturer.materials.shared.sectionWithMe', 'Shared with me')}
          emptyText={t('lecturer.materials.shared.emptyWithMe', 'No colleagues have shared a material with you yet.')}
          loading={sharedLoading}
          items={sharedWithMe}
          resolveExpiry={resolveSharedExpiry}
          resolveTitle={resolveSharedTitle}
          resolveColleagueName={(item) => resolveColleagueName(item, rosterIndex)}
          renderAction={(item) => {
            const status = resolveUiStatus(item);
            if (status === 'PENDING') {
              return (
                <div className={styles.sharedAcceptDecline}>
                  <button type="button" className={styles.sharedAcceptBtn} onClick={() => void updateSharedStatus(item, 'ACCEPTED')}>{t('lecturer.materials.shared.accept', 'Accept')}</button>
                  <button type="button" className={styles.sharedDeclineBtn} onClick={() => void updateSharedStatus(item, 'DECLINED')}>{t('lecturer.materials.shared.decline', 'Decline')}</button>
                </div>
              );
            }
            if (status === 'ACCEPTED') {
              const targetId = typeof item.learningMaterialId === 'number' ? item.learningMaterialId : typeof item.paperId === 'number' ? item.paperId : null;
              const foundMaterial = targetId !== null ? learningById.get(targetId) : null;
              const openUrl = item.learningMaterialUrl || item.fileUrl || item.url || foundMaterial?.fileUrl;
              return (
                <button type="button" className={`${styles.materialOpenBtn} ${styles.sharedOpenBtn}`} disabled={!openUrl} onClick={() => { if (openUrl) window.open(openUrl, '_blank', 'noopener,noreferrer'); }} title={openUrl ? t('lecturer.materials.action.open', 'Open') : 'No URL available'}>
                  <Eye size={14} aria-hidden /> {t('lecturer.materials.shared.open', 'Open')}
                </button>
              );
            }
            return null;
          }}
        />
      </div>

      <MaterialUsageModal
        isOpen={usageModalMaterial !== null}
        material={usageModalMaterial}
        usedByTopics={usedByTopicsForModal}
        usedByPhases={usedByPhasesForModal}
        loading={crossRefLoading}
        onNavigate={(target: UsageNavigationTarget) => {
          if (target.kind === 'topic') {
            window.location.href = buildResearchTopicsUrl({ highlightTopicId: target.topicId });
          } else {
            window.location.href = buildConfigureMilestonesUrl(target.topicId, target.groupId, { highlightPhaseNumber: target.phaseNumber });
          }
          closeUsageModal();
        }}
        onClose={closeUsageModal}
      />

      <ShareApiContractPreview isOpen={false} onClose={() => undefined} />
    </div>
  );
};

// Re-export for backward compat
export { formatTitle as formatLearningMaterialTitle, deriveFilenameFromUrl };

export default LecturerMaterialsPage;
