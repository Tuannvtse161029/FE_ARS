/**
 * AdminPolicies — Admin-only tab for editing platform policy documents.
 *
 * Policies are owned by the admin team and stored in Firebase Firestore
 * (no BE endpoints). The page renders one card per policy type with the
 * latest saved content (or a "not set yet" state on a fresh project) and
 * a primary Edit button that opens a modal with a plain-text editor.
 *
 * Why Firestore direct from the browser
 * -------------------------------------
 * The admin team owns policy text yearly. Routing every save through the
 * .NET BE just to proxy a 50 KB text blob would add latency and a
 * failure mode for no product value. The Firebase project must enforce
 * admin-only writes on the `policies` collection (see security rules
 * comment in `src/services/policy.service.ts`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Edit3, FileText, Loader2, RefreshCw, Save, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import { useAuth } from '../../context/AuthContext';
import { policyService } from '../../services/policy.service';
import {
  POLICY_META,
  POLICY_SLUGS,
  type PolicySlug,
  type PolicySnapshot,
} from '../../types/policy';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import styles from './Policies.module.css';

const ROLE_ACCENT = 'var(--ars-admin)';

const formatTimestamp = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

/**
 * Localised translation with simple `{var}` substitution. The project `t`
 * helper only accepts `(key, fallback?)` — variable interpolation is not in
 * scope, so we apply it ourselves to keep translation strings readable.
 */
const localize = (
  raw: string,
  vars: Record<string, string | number> | undefined,
): string => {
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`,
  );
};

const characterCount = (text: string): number => text.length;

interface PolicyCardProps {
  snapshot: PolicySnapshot;
  onEdit: (slug: PolicySlug) => void;
}

const PolicyCard = ({ snapshot, onEdit }: PolicyCardProps) => {
  const { t } = useI18n();
  const meta = POLICY_META[snapshot.slug];
  const isSeeded = !snapshot.fromFirestore;
  const charCount = characterCount(snapshot.content);

  return (
    <article
      className={styles.card}
      data-testid={`policy-card-${snapshot.slug}`}
      data-policy-slug={snapshot.slug}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardTitleBlock}>
          <span className={styles.cardIcon} aria-hidden>
            <FileText size={18} />
          </span>
          <div>
            <h3 className={styles.cardTitle}>{meta.title}</h3>
            <p className={styles.cardSummary}>{meta.summary}</p>
          </div>
        </div>
        <div className={styles.cardBadgeBlock}>
          {isSeeded ? (
            <span
              className={`${styles.badge} ${styles.badgeSeed}`}
              data-testid={`policy-badge-${snapshot.slug}-seed`}
            >
              {t('admin.policies.badge.notSaved')}
            </span>
          ) : (
            <span
              className={`${styles.badge} ${styles.badgeSaved}`}
              data-testid={`policy-badge-${snapshot.slug}-saved`}
            >
              v{snapshot.version}
            </span>
          )}
        </div>
      </div>

      <div className={styles.cardMeta}>
        {snapshot.fromFirestore && snapshot.updatedAt ? (
          <span>
            {localize(t('admin.policies.lastUpdated'), { when: formatTimestamp(snapshot.updatedAt) })}
            {snapshot.updatedBy ? ` · ${snapshot.updatedBy}` : ''}
          </span>
        ) : (
          <span className={styles.cardMetaMuted}>
            {t('admin.policies.neverUpdated')}
          </span>
        )}
        <span className={styles.cardCharCount} aria-label={t('admin.policies.charCount')}>
          {charCount.toLocaleString()} {t('admin.policies.charCount')}
        </span>
      </div>

      <pre className={styles.preview} aria-label={t('admin.policies.preview')}>
        {snapshot.content}
      </pre>

      <div className={styles.cardActions}>
        <Button
          variant="primary"
          size="md"
          onClick={() => onEdit(snapshot.slug)}
          leftIcon={<Edit3 size={14} />}
          data-testid={`policy-edit-${snapshot.slug}`}
        >
          {t('admin.policies.edit')}
        </Button>
      </div>
    </article>
  );
};

interface EditorModalProps {
  slug: PolicySlug;
  snapshot: PolicySnapshot;
  onClose: () => void;
  onSaved: (slug: PolicySlug, updated: PolicySnapshot) => void;
  actorName: string | null;
}

const EditorModal = ({ slug, snapshot, onClose, onSaved, actorName }: EditorModalProps) => {
  const { t } = useI18n();
  const meta = POLICY_META[slug];
  const [draft, setDraft] = useState<string>(snapshot.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset draft when modal opens or slug changes.
  useEffect(() => {
    setDraft(snapshot.content);
    setError(null);
  }, [slug, snapshot.content]);

  // Escape closes the modal unless a save is in flight.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const onSave = async () => {
    if (saving) return;
    if (draft.trim().length === 0) {
      setError(t('admin.policies.errors.empty'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await policyService.save(
        slug,
        draft,
        { name: actorName },
        snapshot.version,
      );
      onSaved(slug, {
        ...updated,
        slug,
        fromFirestore: true,
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : t('admin.policies.errors.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  const dirty = draft !== snapshot.content;

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`policy-editor-title-${slug}`}
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div ref={dialogRef} className={styles.modalCard} role="document">
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleBlock}>
            <span className={styles.modalEyebrow}>{t('admin.policies.modal.eyebrow')}</span>
            <h2 className={styles.modalTitle} id={`policy-editor-title-${slug}`}>
              {meta.title}
            </h2>
            <p className={styles.modalSubtitle}>{meta.summary}</p>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={() => !saving && onClose()}
            aria-label={t('admin.policies.modal.close')}
            disabled={saving}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.modalMetaRow}>
          <span>
            {snapshot.fromFirestore
              ? localize(t('admin.policies.modal.currentVersion'), { version: snapshot.version })
              : t('admin.policies.modal.notSavedYet')}
          </span>
          {snapshot.updatedAt && (
            <span>
              {localize(t('admin.policies.lastUpdatedShort'), {
                when: formatTimestamp(snapshot.updatedAt),
              })}
            </span>
          )}
        </div>

        <label className={styles.editorLabel} htmlFor={`policy-editor-${slug}`}>
          {t('admin.policies.modal.contentLabel')}
        </label>
        <textarea
          id={`policy-editor-${slug}`}
          className={styles.editor}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck
          disabled={saving}
          data-testid={`policy-editor-textarea-${slug}`}
        />

        <div className={styles.editorFooterRow}>
          <span className={styles.editorCharCount}>
            {draft.length.toLocaleString()} {t('admin.policies.charCount')}
            {dirty && (
              <span className={styles.dirtyDot} aria-hidden>
                {' '}•
              </span>
            )}
          </span>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert" data-testid={`policy-error-${slug}`}>
            <AlertTriangle size={16} aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <div className={styles.modalActions}>
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={saving}
            data-testid={`policy-cancel-${slug}`}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => void onSave()}
            disabled={saving || !dirty}
            leftIcon={saving ? <Loader2 size={14} className={styles.spinning} /> : <Save size={14} />}
            data-testid={`policy-save-${slug}`}
          >
            {saving
              ? t('admin.policies.modal.saving')
              : localize(t('admin.policies.modal.save'), { version: snapshot.version + 1 })}
          </Button>
        </div>
      </div>
    </div>
  );
};

const Policies = () => {
  const { t } = useI18n();
  useAdminGuard();

  const { user } = useAuth();
  // AuthResponse surfaces `username` but not `fullName`. Fall back through
  // username → email so the Firestore `updatedBy` is never an empty string.
  const actorName = useMemo(() => {
    const candidate =
      user?.username && user.username.trim().length > 0
        ? user.username
        : user?.email && user.email.trim().length > 0
          ? user.email
          : null;
    return candidate;
  }, [user?.username, user?.email]);

  const [snapshots, setSnapshots] = useState<Record<PolicySlug, PolicySnapshot> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PolicySlug | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await policyService.listAll();
      setSnapshots(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaved = useCallback((slug: PolicySlug, updated: PolicySnapshot) => {
    setSnapshots((prev) => {
      if (!prev) return prev;
      return { ...prev, [slug]: updated };
    });
  }, []);

  const cards = useMemo<PolicySnapshot[]>(() => {
    if (!snapshots) return [];
    // Preserve canonical POLICY_SLUGS order in the list.
    return POLICY_SLUGS.map((slug) => snapshots[slug]);
  }, [snapshots]);

  const editingSnapshot = editing && snapshots ? snapshots[editing] : null;

  return (
    <div className={styles.page} data-testid="admin-policies-page">
      <PageHeader
        eyebrow={t('admin.policies.eyebrow')}
        title={t('admin.policies.title')}
        description={t('admin.policies.description')}
        accent={ROLE_ACCENT}
        actions={
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setRefreshing(true);
              void load();
            }}
            disabled={loading || refreshing}
            leftIcon={
              refreshing ? (
                <Loader2 size={14} className={styles.spinning} aria-hidden />
              ) : (
                <RefreshCw size={14} aria-hidden />
              )
            }
            data-testid="policies-refresh"
          >
            {loading || refreshing
              ? t('admin.policies.refreshing')
              : t('admin.policies.refresh')}
          </Button>
        }
      />

      {loading && !snapshots ? (
        <div className={styles.loadingState} role="status">
          {t('admin.policies.loading')}
        </div>
      ) : error ? (
        <div className={styles.errorBanner} role="alert" data-testid="policies-error">
          <AlertTriangle size={18} aria-hidden />
          <div>
            <strong>{t('admin.policies.errorTitle')}</strong>
            <span>{error}</span>
          </div>
        </div>
      ) : (
        <>
          <p className={styles.helperText}>{t('admin.policies.helperText')}</p>
          <div className={styles.grid}>
            {cards.map((snapshot) => (
              <PolicyCard
                key={snapshot.slug}
                snapshot={snapshot}
                onEdit={(slug) => setEditing(slug)}
              />
            ))}
          </div>
        </>
      )}

      {editing && editingSnapshot && (
        <EditorModal
          slug={editing}
          snapshot={editingSnapshot}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          actorName={actorName}
        />
      )}
    </div>
  );
};

export default Policies;
