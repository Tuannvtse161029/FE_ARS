// Lecturer — Materials (combined Learning + Shared Materials page)
//
// This is the canonical Lecturer surface for managing both Learning Materials
// and Shared Materials under a single "Materials" tab.
//
// Previously there were two separate pages:
//   - Learning Materials (route: /lecturer/learning-materials) — reference PDFs
//     and resources linked to research topics.
//   - Shared Materials (route: /lecturer/shared-materials) — research papers
//     shared with colleagues.
//
// Both are now unified here with a tab switcher. The old routes are kept for
// backward compatibility but redirect to this page.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
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
  Square,
  CheckSquare,
  ChevronRight,
  Code2,
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
// NOTE: import the canonical `ResearchTopic` from the shared types module,
// NOT from `researchTopic.service`. The service exposes a BE-response shape
// (with optional `id`) that is intentionally wider than the canonical type
// the rest of the FE uses. `MaterialUsageModal` accepts the canonical shape,
// so the service result is cast at the fetch boundary below.
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
import { formatDisplayDateTime } from '../../utils/datetime';
import {
  buildConfigureMilestonesUrl,
  buildResearchTopicsUrl,
} from '../../utils/topicRouting';
import {
  MaterialUsageModal,
  type UsageNavigationTarget,
} from '../../components/lecturer/MaterialUsageModal';
import { ShareApiContractPreview } from '../../components/lecturer/ShareApiContractPreview';
import styles from './Materials.module.css';

type TabId = 'my-materials' | 'shared-materials';

// ── Source-type detection ──────────────────────────────────────────────────
// Firebase Storage URLs follow a stable pattern; everything else (or missing)
// is treated as a "Link" source. The pattern intentionally matches both
// `firebasestorage.googleapis.com` (real Firebase) and any URL with a typical
// PDF/doc extension as a "file" — keeping the rule FE-side rather than
// hard-coding a single host.
const FILE_URL_PATTERN =
  /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|webp)(\?|#|$)/i;
const FIREBASE_HOST_PATTERN = /firebasestorage\.googleapis\.com/i;

const isFileSource = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (FILE_URL_PATTERN.test(trimmed)) return true;
  return FIREBASE_HOST_PATTERN.test(trimmed);
};

// ── Shared-material status taxonomy ────────────────────────────────────────
// The BE currently returns only ACTIVE / ARCHIVED. We layer five richer
// states on top for the FE; each maps back to a BE-known primitive so the
// gap banner stays honest about what the server actually exposes.
export type SharedMaterialUiStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'ENDED'
  | 'ACTIVE'
  | 'ARCHIVED';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const isExpired = (sharedAt: string | null | undefined): boolean => {
  if (!sharedAt) return false;
  const ts = new Date(sharedAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > THIRTY_DAYS_MS;
};

const resolveUiStatus = (item: SharedMaterial): SharedMaterialUiStatus => {
  const raw = (item.status ?? '').toUpperCase();
  // FE-owned terminal states win over BE status.
  if (raw === 'ENDED') return 'ENDED';
  if (raw === 'ACCEPTED') return 'ACCEPTED';
  if (raw === 'DECLINED') return 'DECLINED';
  if (raw === 'PENDING') return 'PENDING';
  if (isExpired(item.sharedAt ?? item.createdAt)) return 'EXPIRED';
  // BE-known fallback states.
  if (raw === 'ARCHIVED') return 'ARCHIVED';
  return 'ACTIVE';
};

// ── Learning Materials helpers ─────────────────────────────────────────────

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

// ── Lecturer roster (used by the Share modal) ────────────────────────────

interface LecturerRosterEntry {
  id: number;
  fullName: string;
  email: string;
}

// `RosterLoadOutcome` tells the caller whether the roster came back
// empty because the BE has filtered it down to zero rows, or because the
// BE rejected the request outright (e.g. `/api/User` is Admin-only and a
// lecturer JWT gets `403 Forbidden`). The share modal uses the second
// shape to render an honest empty-state instead of pretending there are
// just no colleagues to pick from.
export type RosterLoadOutcome =
  | { kind: 'empty' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string };

const isForbiddenError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const status =
    (err as { response?: { status?: number }; status?: number }).response
      ?.status ??
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
        const entry = raw as Partial<LecturerRosterEntry> & {
          userId?: number;
        };
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
      outcome: { kind: 'empty' } as const,
    };
  } catch (err) {
    // `/api/User` is Admin-only in the live BE (Swagger summary:
    // "Lấy danh sách người dùng phân trang (Dành cho Admin)"). A lecturer
    // JWT hits `403 Forbidden`; we swallow the rejection here so the
    // Materials page does not crash, and surface the gap as a banner
    // inside the share modal instead. See ticket
    // `tickets/backend/FE_MATERIAL_SHARE_403_TICKET.md`.
    if (isForbiddenError(err)) {
      return { rows: [], outcome: { kind: 'forbidden' } as const };
    }
    const message =
      err instanceof Error ? err.message : 'Unknown lecturer roster error.';
    return { rows: [], outcome: { kind: 'error', message } as const };
  }
};

// ── Main combined page ───────────────────────────────────────────────────

export const LecturerMaterialsPage = () => {
  const { user } = useAuth();
  const lecturerId = user?.userId ?? null;
  const t = useT();
  const navigate = useNavigate();

  // ── Tab state ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('my-materials');

  // ── "Used by" modal state ──────────────────────────────────────────────
  // Tracks which material card the user clicked from. We re-derive the
  // matched topics + phases by filtering the already-loaded cross-ref
  // data against the material's fileUrl so the modal opens with no
  // additional API call.
  const [usageModalMaterial, setUsageModalMaterial] =
    useState<LearningMaterial | null>(null);

  const openUsageModal = (material: LearningMaterial) => {
    setUsageModalMaterial(material);
  };
  const closeUsageModal = () => setUsageModalMaterial(null);

  const handleUsageNavigate = (target: UsageNavigationTarget) => {
    if (target.kind === 'topic') {
      navigate(buildResearchTopicsUrl({ highlightTopicId: target.topicId }));
    } else {
      navigate(
        buildConfigureMilestonesUrl(target.topicId, target.groupId, {
          highlightPhaseNumber: target.phaseNumber,
        }),
      );
    }
    closeUsageModal();
  };

  // ════════════════════════════════════════════════════════════════════════
  // TAB 1: My Materials (Learning Materials)
  // ════════════════════════════════════════════════════════════════════════

  const {
    materials,
    isLoading: lmLoading,
    error: lmError,
    refetch: refetchLearning,
  } = useLearningMaterials({ lecturerId });

  // Topic + phase cross-reference so the card can show "Used by N topic(s),
  // N phase(s)". Loading once per page mount is cheap; the lists do not
  // change frequently while the lecturer is browsing this tab.
  const [topics, setTopics] = useState<ResearchTopic[]>([]);
  const [phases, setPhases] = useState<PhasedReport[]>([]);
  const [crossRefLoading, setCrossRefLoading] = useState(true);

  const loadCrossReference = useCallback(async () => {
    setCrossRefLoading(true);
    try {
      // The service returns its own wider BE-shape `ResearchTopic`
      // (`id?: number`); the rest of the page works against the canonical
      // shape from `types/research` (`id: number`). Cast at the boundary
      // and drop topics that didn't come back with a usable id — the
      // Usage Modal already handles missing ids defensively, but the
      // canonical type won't accept them.
      const [topicList, phaseList] = await Promise.all([
        researchTopicService.getAll().catch(() => []),
        phasedReportService.getAll().catch(() => [] as PhasedReport[]),
      ]);
      setTopics(
        (topicList as ResearchTopic[]).filter(
          (t): t is ResearchTopic => typeof t.id === 'number',
        ),
      );
      setPhases(phaseList);
    } finally {
      setCrossRefLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCrossReference();
  }, [loadCrossReference]);

  // Derived lists for the "Used by …" modal. We re-filter the already-loaded
  // cross-reference data against the open material's fileUrl so the modal
  // opens with no additional API call. Declared AFTER `topics` /
  // `phases` so the dependency arrays actually resolve.
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

  // Map fileUrl → { topicCount, phaseCount, hasOpenTopic } for the usage chip.
  const usageByUrl = useMemo(() => {
    const map = new Map<
      string,
      { topicCount: number; phaseCount: number; hasOpenTopic: boolean }
    >();
    for (const m of materials) {
      const url = m.fileUrl?.trim();
      if (!url) continue;
      const entry = map.get(url) ?? {
        topicCount: 0,
        phaseCount: 0,
        hasOpenTopic: false,
      };
      for (const topic of topics) {
        if ((topic.materialsUrl ?? '').trim() === url) {
          entry.topicCount += 1;
          if ((topic.status ?? '').toUpperCase() === 'OPEN') {
            entry.hasOpenTopic = true;
          }
        }
      }
      for (const phase of phases) {
        if ((phase.phasedMaterialsUrl ?? '').trim() === url) {
          entry.phaseCount += 1;
        }
      }
      map.set(url, entry);
    }
    return map;
  }, [materials, topics, phases]);

  // Add-form state (Learning Materials)
  const [lmSearch, setLmSearch] = useState('');
  const [lmShowForm, setLmShowForm] = useState(false);
  const [lmTitle, setLmTitle] = useState('');
  const [lmDescription, setLmDescription] = useState('');
  const [lmSourceMode, setLmSourceMode] = useState<'file' | 'url'>('file');
  const [lmUploadedFile, setLmUploadedFile] = useState<File | null>(null);
  const [lmFileUrl, setLmFileUrl] = useState('');
  const [lmSubmitting, setLmSubmitting] = useState(false);
  const [lmFormError, setLmFormError] = useState<string | null>(null);
  const [lmTitleError, setLmTitleError] = useState<string | null>(null);
  const [lmUrlError, setLmUrlError] = useState<string | null>(null);

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

  const showBanner = (
    text: string,
    variant: 'success' | 'error' = 'success',
  ) => {
    setBanner({ visible: true, text, variant });
    window.setTimeout(
      () => setBanner({ visible: false, text: '', variant: 'success' }),
      4000,
    );
  };

  // Pending-delete inline-confirm UI state — maps material id → boolean.
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const filteredMaterials = useMemo(() => {
    const q = lmSearch.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((m) =>
      [m.title ?? '', m.description ?? '', m.fileUrl ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [materials, lmSearch]);

  // Sort: newest createdAt first when no explicit search-driven sort. We do
  // not expose the previous multi-column sort here — cards are visual and the
  // dropdown would just add noise.
  const sortedMaterials = useMemo(() => {
    return [...filteredMaterials].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [filteredMaterials]);

  // ESC key closes the Add Material modal.
  useEffect(() => {
    if (!lmShowForm) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLmForm();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [lmShowForm]);

  const handleLmRefresh = async () => {
    await Promise.all([refetchLearning(), loadCrossReference()]);
  };

  const closeLmForm = () => {
    setLmShowForm(false);
    setLmUploadedFile(null);
    lmResetUpload();
    setLmSourceMode('file');
    setLmTitle('');
    setLmDescription('');
    setLmFileUrl('');
    setLmTitleError(null);
    setLmUrlError(null);
    setLmFormError(null);
  };

  const handleLmAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!lecturerId) {
      setLmFormError('No lecturer session — please sign in again.');
      return;
    }
    const title = lmTitle.trim();
    const description = lmDescription.trim();

    const titleErr = !title ? 'Title is required.' : null;
    setLmTitleError(titleErr);
    if (titleErr) return;

    let resolvedUrl: string | null = null;

    if (lmSourceMode === 'file') {
      if (!lmUploadedFile) {
        setLmFormError(
          'Please select a file to upload, or switch to the URL option below.',
        );
        return;
      }
      if (lmUploadedUrl) {
        resolvedUrl = lmUploadedUrl;
      } else {
        setLmFormError(null);
        resolvedUrl = await uploadFile(lmUploadedFile);
        if (!resolvedUrl) {
          setLmFormError(
            lmUploadError ?? 'File upload failed. Please try again.',
          );
          return;
        }
      }
    } else {
      const urlVal = lmFileUrl.trim();
      if (urlVal.length > 0) {
        const urlErr = validateHttpsUrl(urlVal);
        setLmUrlError(urlErr);
        if (urlErr) return;
      }
      resolvedUrl = urlVal.length > 0 ? urlVal : null;
    }

    setLmSubmitting(true);
    setLmFormError(null);
    try {
      await learningMaterialService.create({
        lecturerId,
        title,
        fileUrl: resolvedUrl,
        description: description.length > 0 ? description : null,
        subFieldId: null,
      });
      setLmTitle('');
      setLmDescription('');
      setLmFileUrl('');
      setLmUploadedFile(null);
      lmResetUpload();
      setLmSourceMode('file');
      setLmTitleError(null);
      setLmUrlError(null);
      setLmShowForm(false);
      showBanner('Material added to your library.');
      await Promise.all([refetchLearning(), loadCrossReference()]);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'The server rejected the material. Please try again.';
      setLmFormError(message);
    } finally {
      setLmSubmitting(false);
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
      const message =
        err instanceof Error ? err.message : 'Failed to delete the material.';
      showBanner(message, 'error');
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // TAB 2: Shared Materials
  // ════════════════════════════════════════════════════════════════════════

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

  // Look up the material title for each SharedMaterial row. The BE contract
  // stores only `paperId` today (see the BackendGapBanner below), so when we
  // find a LearningMaterial whose numeric id matches `paperId` we treat that
  // as the underlying row. We also keep a fallback map for unmatched ids.
  const sharedByMe = useMemo(() => {
    return sharedItems.filter((s) => s.lecturerId === lecturerId);
  }, [sharedItems, lecturerId]);

  const sharedWithMe = useMemo(() => {
    return sharedItems.filter((s) => s.sharedWithColleagueId === lecturerId);
  }, [sharedItems, lecturerId]);

  const learningById = useMemo(() => {
    const map = new Map<number, LearningMaterial>();
    for (const m of materials) {
      const id = typeof m.id === 'number' ? m.id : null;
      if (id !== null) map.set(id, m);
    }
    return map;
  }, [materials]);

  const resolveSharedTitle = (
    item: SharedMaterial,
  ): { title: string; known: boolean } => {
    const paperId = typeof item.paperId === 'number' ? item.paperId : null;
    if (paperId !== null) {
      const found = learningById.get(paperId);
      if (found) return { title: formatTitle(found), known: true };
    }
    return { title: `Material #${item.paperId ?? '—'}`, known: false };
  };

  const resolveSharedExpiry = (
    sharedAt: string | null | undefined,
  ): { iso: string; daysRemaining: number | null } => {
    if (!sharedAt) return { iso: '', daysRemaining: null };
    const ts = new Date(sharedAt).getTime();
    if (Number.isNaN(ts)) return { iso: sharedAt, daysRemaining: null };
    const expiresAt = ts + THIRTY_DAYS_MS;
    const daysRemaining = Math.max(
      0,
      Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)),
    );
    return { iso: new Date(expiresAt).toISOString(), daysRemaining };
  };

  const resolveColleagueName = (
    item: SharedMaterial,
    rosterIndex: Map<number, LecturerRosterEntry>,
  ): string => {
    const counterpart =
      item.lecturerId === lecturerId
        ? item.sharedWithColleagueId
        : item.lecturerId;
    if (typeof counterpart === 'number') {
      const found = rosterIndex.get(counterpart);
      if (found?.fullName) return found.fullName;
    }
    return `Colleague #${counterpart ?? '—'}`;
  };

  // ── Lecturer roster (for both share modal + colleague name lookup) ────
  const [lecturerRoster, setLecturerRoster] = useState<LecturerRosterEntry[]>(
    [],
  );
  /**
   * Set when the BE refuses the roster fetch (typically `403 Forbidden`
   * because `/api/User` is Admin-only). The share modal reads this to
   * surface an honest "no colleagues available — BE feature pending"
   * banner instead of pretending the list is just empty.
   */
  const [rosterLoadOutcome, setRosterLoadOutcome] =
    useState<RosterLoadOutcome>({ kind: 'empty' });
  useEffect(() => {
    let cancelled = false;
    void fetchLecturerRoster(lecturerId).then(({ rows, outcome }) => {
      if (cancelled) return;
      setLecturerRoster(rows);
      setRosterLoadOutcome(outcome);
    });
    return () => {
      cancelled = true;
    };
  }, [lecturerId]);

  const rosterIndex = useMemo(() => {
    const map = new Map<number, LecturerRosterEntry>();
    for (const entry of lecturerRoster) map.set(entry.id, entry);
    return map;
  }, [lecturerRoster]);

  // ── Share modal state ────────────────────────────────────────────────
  const [shareMaterialId, setShareMaterialId] = useState<number | null>(null);
  const [shareSearch, setShareSearch] = useState('');
  const [shareSelected, setShareSelected] = useState<Set<number>>(new Set());
  const [shareSaving, setShareSaving] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const shareMaterial = useMemo(() => {
    if (shareMaterialId === null) return null;
    return materials.find((m) => m.id === shareMaterialId) ?? null;
  }, [shareMaterialId, materials]);

  const openShareModal = (material: LearningMaterial) => {
    const id = typeof material.id === 'number' ? material.id : null;
    if (id === null) return;
    setShareMaterialId(id);
    setShareSearch('');
    setShareSelected(new Set());
    setShareError(null);
  };

  const closeShareModal = () => {
    setShareMaterialId(null);
    setShareSearch('');
    setShareSelected(new Set());
    setShareError(null);
    setShareSaving(false);
  };

  // ── Backend contract preview ──────────────────────────────────────
  // The Share button currently hits `POST /api/SharedMaterial` and gets
  // 403 because that endpoint was built for paper sharing, not material
  // sharing. While the BE fixes the endpoint (ticket:
  // `tickets/backend/FE_MATERIAL_SHARE_403_TICKET.md`), the lecturer
  // can open a preview modal that shows the contract the FE wants.
  const [showApiPreview, setShowApiPreview] = useState(false);

  const filteredRoster = useMemo(() => {
    const q = shareSearch.trim().toLowerCase();
    if (!q) return lecturerRoster;
    return lecturerRoster.filter((entry) =>
      `${entry.fullName} ${entry.email}`.toLowerCase().includes(q),
    );
  }, [shareSearch, lecturerRoster]);

  const toggleSelected = (id: number) => {
    setShareSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected =
    filteredRoster.length > 0 &&
    filteredRoster.every((entry) => shareSelected.has(entry.id));

  const toggleSelectAll = () => {
    setShareSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const entry of filteredRoster) next.delete(entry.id);
      } else {
        for (const entry of filteredRoster) next.add(entry.id);
      }
      return next;
    });
  };

  const submitShare = async () => {
    if (!shareMaterial || !lecturerId) return;
    if (shareSelected.size === 0) {
      setShareError('Pick at least one colleague to share with.');
      return;
    }
    const paperId =
      typeof shareMaterial.id === 'number' ? shareMaterial.id : null;
    if (paperId === null) {
      setShareError('This material has no numeric id to share.');
      return;
    }
    setShareSaving(true);
    setShareError(null);
    const sharedAt = new Date().toISOString();
    try {
      for (const colleagueId of shareSelected) {
        await sharedMaterialService.create({
          lecturerId,
          paperId,
          sharedWithColleagueId: colleagueId,
          sharedAt,
          status: 'PENDING',
        });
      }
      showBanner('Share invitations created.');
      closeShareModal();
      await loadShared();
    } catch (err) {
      setShareError(
        err instanceof Error
          ? err.message
          : 'Could not share the material. Please try again.',
      );
    } finally {
      setShareSaving(false);
    }
  };

  // ── Shared status mutations (Accept / Decline / End sharing) ─────────
  const updateSharedStatus = async (
    item: SharedMaterial,
    nextStatus: SharedMaterialUiStatus,
  ) => {
    if (!item.sharedMaterialId) return;
    try {
      await sharedMaterialService.update(item.sharedMaterialId, {
        lecturerId: item.lecturerId,
        paperId: item.paperId,
        sharedWithColleagueId: item.sharedWithColleagueId,
        sharedAt: item.sharedAt,
        status: nextStatus,
      });
      await loadShared();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not update the share.';
      showBanner(message, 'error');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className={styles.materialsPage}
      data-testid="lecturer-materials"
    >
      <PageHeader
        eyebrow="LECTURER WORKSPACE"
        title="Materials"
        description="Manage your learning materials and shared research papers in one place."
        accent="var(--ars-lecturer)"
      />

      <div className={styles.breadcrumbs}>
        Home &gt; <Link to={ROUTES.FORUM}>Forums</Link> &gt;{' '}
        <span className={styles.activeBreadcrumb}>Materials</span>
      </div>

      {banner.visible && (
        <div className={styles.successToastBanner}>
          <div className={styles.toastLeft}>
            <span className={styles.toastCheckIcon}>
              {banner.variant === 'success' ? (
                <Plus size={14} strokeWidth={3} aria-hidden />
              ) : (
                <AlertTriangle size={14} aria-hidden />
              )}
            </span>
            <div>
              <span className={styles.toastTitle}>
                {banner.variant === 'success' ? 'Action Successful' : 'Action Failed'}
              </span>
              <p className={styles.toastSub}>{banner.text}</p>
            </div>
          </div>
          <div className={styles.toastRight}>
            <button
              type="button"
              className={styles.toastCloseBtn}
              onClick={() =>
                setBanner({ visible: false, text: '', variant: 'success' })
              }
              aria-label="Dismiss"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* Tab Switcher */}
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

        {/* Actions — visible only on the My Materials tab */}
        {activeTab === 'my-materials' && (
          <div className={styles.tabBarActions}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={
                lmLoading ? (
                  <Loader size={13} className={styles.spinningIcon} aria-hidden />
                ) : (
                  <RefreshCw size={13} aria-hidden />
                )
              }
              onClick={() => void handleLmRefresh()}
              disabled={lmLoading}
              aria-label="Refresh materials"
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={14} aria-hidden />}
              onClick={() => setLmShowForm(true)}
              data-testid="open-add-material-modal"
            >
              Add Material
            </Button>
          </div>
        )}
      </div>

      {/* ── TAB 1: My Materials ──────────────────────────────────────────── */}
      <div
        id="panel-my-materials"
        role="tabpanel"
        aria-labelledby="tab-my-materials"
        className={`${styles.tabPanel} ${activeTab !== 'my-materials' ? styles.tabPanelHidden : ''}`}
      >
        {lmError && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorBannerIcon}>
              <AlertTriangle size={14} aria-hidden />
              <span>{lmError.message}</span>
            </span>
            <button
              type="button"
              className={styles.errorRetryBtn}
              onClick={() => void refetchLearning()}
            >
              Retry
            </button>
          </div>
        )}

        {lmShowForm && (
          <div
            className={styles.overlay}
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeLmForm();
              }
            }}
          >
            <form
              onSubmit={handleLmAdd}
              className={styles.modalCard}
              role="dialog"
              aria-modal="true"
              aria-labelledby="lm-modal-title"
            >
              <div className={styles.modalHeaderRow}>
                <div className={styles.modalTitleBlock}>
                  <span className={styles.modalIconCircle}>
                    <Library size={18} aria-hidden />
                  </span>
                  <div>
                    <h3 id="lm-modal-title" className={styles.modalTitle}>
                      Add a learning material
                    </h3>
                    <span className={styles.modalSubtitle}>
                      Upload a file or paste a URL — both are optional.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={closeLmForm}
                  aria-label="Close"
                  disabled={lmSubmitting}
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
              <div className={styles.modalForm}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="lm-title">
                    * Title
                  </label>
                  <input
                    id="lm-title"
                    type="text"
                    className={`${styles.formInput} ${lmTitleError ? styles.formInputError : ''}`}
                    value={lmTitle}
                    onChange={(e) => {
                      setLmTitle(e.target.value);
                      if (lmTitleError) setLmTitleError(null);
                    }}
                    aria-invalid={Boolean(lmTitleError)}
                    aria-describedby={lmTitleError ? 'lm-title-error' : undefined}
                    required
                  />
                  <FieldError id="lm-title-error" message={lmTitleError} testId="lm-title-error" />
                </div>

                <div className={styles.sourceModeToggle} role="group" aria-label="Choose material source">
                  <button
                    type="button"
                    className={`${styles.modeBtn} ${lmSourceMode === 'file' ? styles.modeBtnActive : ''}`}
                    onClick={() => setLmSourceMode('file')}
                    aria-pressed={lmSourceMode === 'file'}
                  >
                    <Upload size={14} aria-hidden />
                    Upload file
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeBtn} ${lmSourceMode === 'url' ? styles.modeBtnActive : ''}`}
                    onClick={() => setLmSourceMode('url')}
                    aria-pressed={lmSourceMode === 'url'}
                  >
                    <Link2 size={14} aria-hidden />
                    Paste URL
                  </button>
                </div>

                {lmSourceMode === 'file' && (
                  <div className={styles.formGroup}>
                    <span className={styles.formLabel}>File (optional)</span>
                    {lmUploadedFile && lmUploadedUrl ? (
                      <div className={styles.filePreviewCard}>
                        <div className={styles.filePreviewIcon}>
                          <Check size={16} aria-hidden />
                        </div>
                        <div className={styles.filePreviewInfo}>
                          <span className={styles.filePreviewName}>{lmUploadedFile.name}</span>
                          <span className={styles.filePreviewSize}>
                            {((lmUploadedFile.size) / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </div>
                        <button
                          type="button"
                          className={styles.filePreviewRemove}
                          onClick={() => {
                            setLmUploadedFile(null);
                            lmResetUpload();
                          }}
                          aria-label="Remove selected file"
                        >
                          <X size={14} aria-hidden />
                        </button>
                      </div>
                    ) : lmIsUploading ? (
                      <div className={styles.uploadProgressBox}>
                        <div className={styles.uploadProgressBarOuter}>
                          <div
                            className={styles.uploadProgressBarInner}
                            style={{ width: `${lmUploadProgress}%` }}
                          />
                        </div>
                        <span className={styles.uploadProgressLabel}>
                          Uploading… {lmUploadProgress}%
                        </span>
                      </div>
                    ) : (
                      <div
                        className={styles.fileDropzone}
                        onClick={() => {
                          const input = document.getElementById('lm-file-input') as HTMLInputElement | null;
                          input?.click();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            (document.getElementById('lm-file-input') as HTMLInputElement | null)?.click();
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label="Select a file to upload"
                      >
                        <CloudUpload size={22} className={styles.dropzoneIcon} aria-hidden />
                        <span className={styles.dropzoneText}>
                          Click to browse — PDF, Word, Excel, PowerPoint, image
                        </span>
                        <span className={styles.dropzoneHint}>Max 10 MB</span>
                        <input
                          id="lm-file-input"
                          type="file"
                          className={styles.hiddenFileInput}
                          accept={FILE_UPLOAD_ACCEPT}
                          onChange={async (e) => {
                            const file = e.target.files?.[0] ?? null;
                            if (!file) return;
                            setLmUploadedFile(file);
                            const url = await uploadFile(file);
                            if (!url) {
                              setLmUploadedFile(null);
                              setLmFormError(lmUploadError ?? 'Upload failed.');
                            }
                            if (e.target) e.target.value = '';
                          }}
                          disabled={lmIsUploading}
                        />
                      </div>
                    )}
                    {lmUploadError && !lmFormError && (
                      <p className={styles.uploadErrorText} role="alert">{lmUploadError}</p>
                    )}
                  </div>
                )}

                {lmSourceMode === 'url' && (
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor="lm-url">
                      File URL (optional)
                    </label>
                    <input
                      id="lm-url"
                      type="url"
                      className={`${styles.formInput} ${lmUrlError ? styles.formInputError : ''}`}
                      value={lmFileUrl}
                      onChange={(e) => {
                        setLmFileUrl(e.target.value);
                        if (lmUrlError) setLmUrlError(null);
                      }}
                      placeholder="https://firebasestorage.googleapis.com/.../syllabus.pdf"
                      aria-invalid={Boolean(lmUrlError)}
                      aria-describedby={lmUrlError ? 'lm-url-error' : undefined}
                    />
                    <FieldError id="lm-url-error" message={lmUrlError} testId="lm-url-error" />
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="lm-description">
                    Description (optional)
                  </label>
                  <textarea
                    id="lm-description"
                    className={styles.formTextarea}
                    value={lmDescription}
                    onChange={(e) => setLmDescription(e.target.value)}
                    placeholder="Brief note about this material…"
                    rows={3}
                  />
                </div>

                {lmFormError && (
                  <div className={styles.errorBanner} role="alert">
                    <AlertTriangle size={14} aria-hidden />
                    <span>{lmFormError}</span>
                  </div>
                )}
                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={closeLmForm}
                    disabled={lmSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.submitNavyBtn}
                    disabled={lmSubmitting || lmIsUploading}
                  >
                    {lmSubmitting || lmIsUploading ? (
                      <Loader
                        size={14}
                        className={styles.spinningIcon}
                        aria-hidden
                      />
                    ) : (
                      <Plus size={14} aria-hidden />
                    )}
                    {lmSubmitting
                      ? 'Adding…'
                      : lmIsUploading
                      ? 'Uploading…'
                      : 'Add Material'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Search bar */}
        <div className={styles.lmSearchBar}>
          <Search size={14} aria-hidden />
          <input
            type="search"
            className={styles.lmSearchInput}
            placeholder="Search materials by title, description, or URL"
            value={lmSearch}
            onChange={(e) => setLmSearch(e.target.value)}
            aria-label="Search materials"
          />
          {lmSearch && (
            <button
              type="button"
              className={styles.lmSearchClear}
              aria-label="Clear search"
              onClick={() => setLmSearch('')}
            >
              <X size={12} aria-hidden />
            </button>
          )}
        </div>

        {/* Card grid */}
        {lmLoading ? (
          <div className={styles.lmEmpty}>
            <Loader size={16} className={styles.spinningIcon} aria-hidden />
            Loading materials…
          </div>
        ) : materials.length === 0 ? (
          <div className={styles.lmEmpty}>
            <FileText size={28} aria-hidden />
            <strong>{t('lecturer.materials.empty.title', 'No materials yet')}</strong>
            <span>{t('lecturer.materials.empty.hint', 'Click Add Material to upload a file or paste a link.')}</span>
          </div>
        ) : sortedMaterials.length === 0 ? (
          <div className={styles.lmEmpty}>
            <FileText size={20} aria-hidden />
            <span>
              {t('lecturer.materials.empty.search', `No materials match "${lmSearch.trim()}".`,)}
            </span>
          </div>
        ) : (
          <ul className={styles.materialGrid} aria-label="Learning materials">
            {sortedMaterials.map((material) => {
              const id = typeof material.id === 'number' ? material.id : -1;
              const url = material.fileUrl?.trim() ?? '';
              const fileLike = isFileSource(url);
              const usage = usageByUrl.get(url) ?? {
                topicCount: 0,
                phaseCount: 0,
                hasOpenTopic: false,
              };
              const usageTotal = usage.topicCount + usage.phaseCount;
              const disabledDelete = usageTotal > 0;
              const disabledOpen = !url;
              const deleteTitle = disabledDelete
                ? t(
                    'lecturer.materials.action.deleteBlockedTitle',
                    'This material is in use and cannot be deleted.',
                  )
                : undefined;
              const isConfirming = pendingDeleteId === id;
              return (
                <li
                  key={String(material.id ?? id)}
                  className={styles.materialCard}
                  data-testid="learning-material-card"
                >
                  <header className={styles.materialCardHeader}>
                    <h3 className={styles.materialCardTitle} title={formatTitle(material)}>
                      {formatTitle(material)}
                    </h3>
                    <span
                      className={`${styles.materialSourceChip} ${fileLike ? styles.materialSourceChipFile : styles.materialSourceChipLink}`}
                    >
                      {fileLike
                        ? t('lecturer.materials.source.file', 'File')
                        : t('lecturer.materials.source.link', 'Link')}
                    </span>
                  </header>

                  {url && (
                    <p
                      className={styles.materialCardUrl}
                      title={url}
                      onClick={() => {
                        if (!disabledOpen) {
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                    >
                      {fileLike ? deriveFilenameFromUrl(url) : url}
                    </p>
                  )}

                  {material.description?.trim() && (
                    <p
                      className={styles.materialCardDescription}
                      title={material.description}
                    >
                      {material.description}
                    </p>
                  )}

                  <div className={styles.materialCardUsage}>
                    {crossRefLoading && usageTotal === 0 ? (
                      <span className={styles.materialUsageChipMuted}>
                        Checking usage…
                      </span>
                    ) : usageTotal === 0 ? (
                      <span className={styles.materialUsageChipMuted}>
                        {t('lecturer.materials.usage.none', 'Not used')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={styles.materialUsageChipBtn}
                        onClick={() => openUsageModal(material)}
                        aria-label={t(
                          'lecturer.materials.usage.openAria',
                          'Show where this material is used',
                        )}
                        data-testid="material-usage-chip-button"
                      >
                        {t(
                          'lecturer.materials.usage.summary',
                          `Used by: ${usage.topicCount} topic(s), ${usage.phaseCount} phase(s)`,
                          { topics: usage.topicCount, phases: usage.phaseCount },
                        )}
                        <ChevronRight size={12} aria-hidden />
                      </button>
                    )}
                  </div>

                  <div className={styles.materialCardActions}>
                    <button
                      type="button"
                      className={styles.materialOpenBtn}
                      onClick={() => {
                        if (!disabledOpen) {
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      disabled={disabledOpen}
                      aria-label={t(
                        'lecturer.materials.card.openAria',
                        'Open material',
                      )}
                      title={disabledOpen ? 'No file or URL available' : 'Open'}
                    >
                      <ExternalLink size={14} aria-hidden />
                      {t('lecturer.materials.action.open', 'Open')}
                    </button>
                    <button
                      type="button"
                      className={styles.materialShareBtn}
                      onClick={() => openShareModal(material)}
                      aria-label={t(
                        'lecturer.materials.card.shareAria',
                        'Share material',
                      )}
                    >
                      <Share2 size={14} aria-hidden />
                      {t('lecturer.materials.action.share', 'Share')}
                    </button>
                    <button
                      type="button"
                      className={styles.materialDeleteBtn}
                      onClick={() => {
                        if (disabledDelete) return;
                        if (isConfirming) {
                          void handleLmDelete(id);
                        } else {
                          setPendingDeleteId(id);
                        }
                      }}
                      disabled={disabledDelete || id < 0}
                      title={deleteTitle}
                      aria-label={t(
                        'lecturer.materials.card.deleteAria',
                        'Delete material',
                      )}
                    >
                      <Trash2 size={14} aria-hidden />
                      {isConfirming
                        ? t(
                            'lecturer.materials.action.deleteConfirm',
                            'Delete',
                          )
                        : t(
                            'lecturer.materials.action.cancel',
                            'Delete',
                          )}
                    </button>
                  </div>

                  {isConfirming && !disabledDelete && (
                    <div className={styles.materialDeleteConfirm}>
                      <span className={styles.materialDeleteConfirmText}>
                        {t(
                          'lecturer.materials.action.deleteConfirmTitle',
                          'Delete this material?',
                        )}
                      </span>
                      <div className={styles.materialDeleteConfirmActions}>
                        <button
                          type="button"
                          className={styles.materialDeleteCancel}
                          onClick={() => setPendingDeleteId(null)}
                        >
                          {t(
                            'lecturer.materials.action.cancel',
                            'Cancel',
                          )}
                        </button>
                        <button
                          type="button"
                          className={styles.materialDeleteCommit}
                          onClick={() => void handleLmDelete(id)}
                        >
                          {t(
                            'lecturer.materials.action.deleteConfirm',
                            'Delete',
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── TAB 2: Shared Materials ──────────────────────────────────────── */}
      <div
        id="panel-shared-materials"
        role="tabpanel"
        aria-labelledby="tab-shared-materials"
        className={`${styles.tabPanel} ${activeTab !== 'shared-materials' ? styles.tabPanelHidden : ''}`}
      >
        <BackendGapBanner
          field={t(
            'lecturer.materials.shared.gapBanner.field',
            'SharedMaterial.learningMaterialId, status enum, expiry',
          )}
          feature={t(
            'lecturer.materials.shared.gapBanner.feature',
            'API only accepts paperId (numeric) and returns ACTIVE/ARCHIVED — the FE infers the remaining statuses and computes the 30-day expiry client-side.',
          )}
        />

        {sharedError && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorBannerIcon}>
              <AlertTriangle size={14} aria-hidden />
              <span>{sharedError}</span>
            </span>
            <button
              type="button"
              className={styles.errorRetryBtn}
              onClick={() => void loadShared()}
            >
              Retry
            </button>
          </div>
        )}

        <SharedSection
          title={t(
            'lecturer.materials.shared.sectionByMe',
            'Shared by me',
          )}
          emptyText={t(
            'lecturer.materials.shared.emptyByMe',
            'You have not shared any materials with colleagues yet.',
          )}
          loading={sharedLoading}
          items={sharedByMe}
          resolveExpiry={resolveSharedExpiry}
          resolveTitle={resolveSharedTitle}
          resolveColleagueName={(item) =>
            resolveColleagueName(item, rosterIndex)
          }
          renderAction={(item) => {
            const status = resolveUiStatus(item);
            if (
              status === 'PENDING' ||
              status === 'ACCEPTED' ||
              status === 'EXPIRED'
            ) {
              // After the narrowing above, `status` cannot be 'ENDED' in
              // this branch, so no `disabled` is needed (and TS rightly
              // rejects `status === 'ENDED'` as an impossible check).
              return (
                <button
                  type="button"
                  className={styles.sharedEndBtn}
                  onClick={() => void updateSharedStatus(item, 'ENDED')}
                >
                  {t('lecturer.materials.shared.endSharing', 'End sharing')}
                </button>
              );
            }
            return null;
          }}
        />

        <SharedSection
          title={t(
            'lecturer.materials.shared.sectionWithMe',
            'Shared with me',
          )}
          emptyText={t(
            'lecturer.materials.shared.emptyWithMe',
            'No colleagues have shared a material with you yet.',
          )}
          loading={sharedLoading}
          items={sharedWithMe}
          resolveExpiry={resolveSharedExpiry}
          resolveTitle={resolveSharedTitle}
          resolveColleagueName={(item) =>
            resolveColleagueName(item, rosterIndex)
          }
          renderAction={(item) => {
            const status = resolveUiStatus(item);
            if (status === 'PENDING') {
              return (
                <div className={styles.sharedAcceptDecline}>
                  <button
                    type="button"
                    className={styles.sharedAcceptBtn}
                    onClick={() => void updateSharedStatus(item, 'ACCEPTED')}
                  >
                    {t('lecturer.materials.shared.accept', 'Accept')}
                  </button>
                  <button
                    type="button"
                    className={styles.sharedDeclineBtn}
                    onClick={() => void updateSharedStatus(item, 'DECLINED')}
                  >
                    {t('lecturer.materials.shared.decline', 'Decline')}
                  </button>
                </div>
              );
            }
            return null;
          }}
        />
      </div>

      {/* ── All modals must live OUTSIDE the tab panels ─────────────────────
          If a modal is rendered inside the inactive panel, the panel's
          `display: none` hides it; the moment the panel becomes visible
          (e.g. user clicks the Shared Materials tab) the modal pops up
          on the wrong tab. Modal state belongs to the page root. */}
      <MaterialUsageModal
        isOpen={usageModalMaterial !== null}
        material={usageModalMaterial}
        usedByTopics={usedByTopicsForModal}
        usedByPhases={usedByPhasesForModal}
        loading={crossRefLoading}
        onNavigate={handleUsageNavigate}
        onClose={closeUsageModal}
      />

      {/* Share Modal — also lives outside the tab panels so the dialog
          stays visible regardless of which tab is currently active. */}
      {shareMaterial && (
          <div
            className={styles.overlay}
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget && !shareSaving) {
                closeShareModal();
              }
            }}
          >
            <div
              className={styles.shareModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-modal-title"
            >
              <div className={styles.modalHeaderRow}>
                <div className={styles.modalTitleBlock}>
                  <span className={styles.modalIconCircle}>
                    <Share2 size={18} aria-hidden />
                  </span>
                  <div>
                    <h3 id="share-modal-title" className={styles.modalTitle}>
                      {t(
                        'lecturer.materials.shareModal.title',
                        'Share material with a colleague',
                      )}
                    </h3>
                    <span className={styles.modalSubtitle}>
                      {shareMaterial.title ?? 'Untitled material'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={closeShareModal}
                  aria-label="Close"
                  disabled={shareSaving}
                >
                  <X size={16} aria-hidden />
                </button>
              </div>

              <p className={styles.shareModalSubtitle}>
                {t(
                  'lecturer.materials.shareModal.subtitle',
                  'Pick the lecturers you want to grant 30-day read access to.',
                )}
                {' '}
                <button
                  type="button"
                  className={styles.shareApiContractLink}
                  onClick={() => setShowApiPreview(true)}
                  data-testid="share-api-contract-link"
                >
                  <Code2 size={12} aria-hidden />
                  View API contract
                </button>
              </p>

              <div className={styles.shareSearchBar}>
                <Search size={14} aria-hidden />
                <input
                  type="search"
                  className={styles.lmSearchInput}
                  placeholder={t(
                    'lecturer.materials.shareModal.searchPlaceholder',
                    'Search by name or email',
                  )}
                  value={shareSearch}
                  onChange={(e) => setShareSearch(e.target.value)}
                  aria-label="Search lecturers"
                />
              </div>

              {rosterLoadOutcome.kind !== 'empty' && (
                <BackendGapBanner
                  field={
                    rosterLoadOutcome.kind === 'forbidden'
                      ? 'GET /api/User (paginated lecturer roster — Admin-only)'
                      : `GET /api/User failed: ${rosterLoadOutcome.message}`
                  }
                  feature="The Materials Share modal needs a list of other lecturers you can share this material with. Until the BE ships a lecturer-facing roster endpoint, the Share modal renders an empty recipient list and the action is blocked."
                  className={styles.shareRosterGap}
                />
              )}

              <div className={styles.shareSelectAllRow}>
                <button
                  type="button"
                  className={styles.shareSelectAllBtn}
                  onClick={toggleSelectAll}
                  disabled={filteredRoster.length === 0}
                  aria-pressed={allFilteredSelected}
                >
                  {allFilteredSelected ? (
                    <CheckSquare size={14} aria-hidden />
                  ) : (
                    <Square size={14} aria-hidden />
                  )}
                  {allFilteredSelected
                    ? t(
                        'lecturer.materials.shareModal.deselectAll',
                        'Deselect all',
                      )
                    : t(
                        'lecturer.materials.shareModal.selectAll',
                        'Select all',
                      )}
                </button>
                <span className={styles.shareSelectedCount}>
                  {shareSelected.size > 0
                    ? `${shareSelected.size} selected`
                    : ''}
                </span>
              </div>

              <ul className={styles.shareRoster} role="listbox" aria-multiselectable="true">
                {filteredRoster.length === 0 ? (
                  <li className={styles.shareRosterEmpty}>
                    {t(
                      'lecturer.materials.shareModal.empty',
                      'No other lecturers are available to share with.',
                    )}
                  </li>
                ) : (
                  filteredRoster.map((entry) => {
                    const selected = shareSelected.has(entry.id);
                    return (
                      <li
                        key={entry.id}
                        className={`${styles.shareRosterItem} ${selected ? styles.shareRosterItemSelected : ''}`}
                        role="option"
                        aria-selected={selected}
                      >
                        <button
                          type="button"
                          className={styles.shareRosterCheckBtn}
                          onClick={() => toggleSelected(entry.id)}
                          aria-pressed={selected}
                        >
                          {selected ? (
                            <CheckSquare size={16} aria-hidden />
                          ) : (
                            <Square size={16} aria-hidden />
                          )}
                        </button>
                        <div className={styles.shareRosterInfo}>
                          <span className={styles.shareRosterName}>
                            {entry.fullName || `Lecturer #${entry.id}`}
                          </span>
                          <span className={styles.shareRosterEmail}>
                            {entry.email}
                          </span>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>

              {shareError && (
                <div className={styles.errorBanner} role="alert">
                  <AlertTriangle size={14} aria-hidden />
                  <span>{shareError}</span>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={closeShareModal}
                  disabled={shareSaving}
                >
                  {t('lecturer.materials.shareModal.cancel', 'Cancel')}
                </button>
                <button
                  type="button"
                  className={styles.submitNavyBtn}
                  onClick={() => void submitShare()}
                  disabled={shareSaving || shareSelected.size === 0}
                >
                  {shareSaving ? (
                    <Loader size={14} className={styles.spinningIcon} aria-hidden />
                  ) : (
                    <Share2 size={14} aria-hidden />
                  )}
                  {shareSaving
                    ? 'Sharing…'
                    : shareSelected.size === 1
                    ? t(
                        'lecturer.materials.shareModal.submitOne',
                        'Share with 1 lecturer',
                      )
                    : t(
                        'lecturer.materials.shareModal.submitMany',
                        `Share with ${shareSelected.size} lecturers`,
                        { count: shareSelected.size },
                      )}
                </button>
              </div>
            </div>
          </div>
        )}

      <ShareApiContractPreview
        isOpen={showApiPreview}
        onClose={() => setShowApiPreview(false)}
      />
    </div>
  );
};

// ── Shared Materials section renderer ─────────────────────────────────────

interface SharedSectionProps {
  title: string;
  emptyText: string;
  loading: boolean;
  items: SharedMaterial[];
  resolveTitle: (item: SharedMaterial) => { title: string; known: boolean };
  resolveColleagueName: (item: SharedMaterial) => string;
  resolveExpiry: (
    sharedAt: string | null | undefined,
  ) => { iso: string; daysRemaining: number | null };
  renderAction: (item: SharedMaterial) => ReactNode;
}

const SharedSection = ({
  title,
  emptyText,
  loading,
  items,
  resolveTitle,
  resolveColleagueName,
  resolveExpiry,
  renderAction,
}: SharedSectionProps) => {
  const t = useT();
  return (
    <section className={styles.sharedSection} aria-label={title}>
      <header className={styles.sharedSectionHeader}>
        <h3 className={styles.sharedSectionTitle}>{title}</h3>
        <span className={styles.sharedSectionCount}>{items.length}</span>
      </header>
      {loading ? (
        <div className={styles.sharedEmpty}>
          <Loader size={16} className={styles.spinningIcon} aria-hidden />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className={styles.sharedEmpty}>
          <FileText size={20} aria-hidden />
          <span>{emptyText}</span>
        </div>
      ) : (
        <ul className={styles.sharedList}>
          {items.map((item) => {
            const id = item.sharedMaterialId ?? item.id ?? '—';
            const { title: materialTitle } = resolveTitle(item);
            const uiStatus = resolveUiStatus(item);
            const expiry = resolveExpiry(item.sharedAt ?? item.createdAt);
            const statusLabel = t(
              `lecturer.materials.shared.status.${uiStatus}`,
              uiStatus,
            );
            return (
              <li
                key={String(id)}
                className={`${styles.sharedRow} ${styles[`sharedRowStatus${uiStatus}`] ?? ''}`}
                data-testid="shared-material-row"
              >
                <div className={styles.sharedRowMain}>
                  <div className={styles.sharedRowTitleRow}>
                    <span className={styles.sharedRowTitle}>{materialTitle}</span>
                    <span className={styles.sharedRowStatusPill}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className={styles.sharedRowMeta}>
                    <span>
                      <span className={styles.sharedRowMetaLabel}>Colleague</span>{' '}
                      {resolveColleagueName(item)}
                    </span>
                    <span>
                      <span className={styles.sharedRowMetaLabel}>Shared</span>{' '}
                      {item.sharedAt
                        ? formatDisplayDateTime(item.sharedAt)
                        : '—'}
                    </span>
                    {expiry.iso && (
                      <span>
                        <span className={styles.sharedRowMetaLabel}>
                          {uiStatus === 'EXPIRED'
                            ? 'Expired'
                            : 'Expires'}
                        </span>{' '}
                        {formatDisplayDateTime(expiry.iso)}
                        {expiry.daysRemaining !== null &&
                          uiStatus !== 'EXPIRED' && (
                            <>
                              {' '}
                              <span className={styles.sharedRowMetaMuted}>
                                {`(${expiry.daysRemaining}d left)`}
                              </span>
                            </>
                          )}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.sharedRowActions}>{renderAction(item)}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default LecturerMaterialsPage;