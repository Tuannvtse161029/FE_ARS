/**
 * AdminMedals — main page component
 *
 * Refactored from src/pages/Admin/AdminMedals.tsx
 * Uses extracted components:
 *   - MedalCatalog (catalog state management)
 *   - TierEditor (create/edit form)
 *   - ArtworkUpload (quick image modal)
 *   - SafeMedalBadge (badge rendering)
 */
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  RotateCcw,
  CheckCircle2,
  XCircle,
  BarChart3,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { medalService, type Medal, type MedalCreateInput, type MedalFamilyGroup } from '../../services/medal.service';
import {
  medalAnalyticsService,
  type MedalRecipientInfo,
} from '../../services/medalAnalytics.service';
import { useI18n } from '../../i18n/I18nContext';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { MedalCatalog } from './components/MedalCatalog';
import { TierEditor } from './components/TierEditor';
import { ArtworkUpload } from './components/ArtworkUpload';
import { SafeMedalBadge, LUCIDE_ICONS_MAP, LUCIDE_ICONS_LIST, resolveMedalIconName } from './components/SafeMedalBadge';
import { MedalAnalyticsDashboard } from './components/MedalAnalyticsDashboard';
import { MedalRecipientsModal } from './components/MedalRecipientsModal';
import { GrantMedalModal } from './components/GrantMedalModal';
import { invalidateFlairCache } from '../../hooks/useAuthorFlair';
// CSS module kept alongside the refactored component so the stale
// `src/pages/Admin/AdminMedals.tsx` duplicate can be deleted without
// breaking the styling of this module.
import styles from './AdminMedals.module.css';

// Re-export for backward compatibility with any remaining imports
export { SafeMedalBadge, LUCIDE_ICONS_MAP, LUCIDE_ICONS_LIST, resolveMedalIconName };

export const AdminMedals: React.FC = () => {
  const { t, locale } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);

  const [medals, setMedals] = useState<Medal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'analytics'>('catalog');
  const [isGrantModalOpen, setIsGrantModalOpen] = useState<boolean>(false);
  const [activeModal, setActiveModal] = useState<'create' | 'edit' | 'quickImage' | 'delete' | 'reset' | null>(null);
  const [targetMedal, setTargetMedal] = useState<Medal | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Recipients data — loaded once on mount (and on demand after revoke
  // / reinstate) so the catalog metric strip can show "X granted users"
  // without each card having to fetch its own slice. Also used to power
  // the family-level recipients modal opened from the catalog cards.
  const [recipientsByMedalCode, setRecipientsByMedalCode] = useState<
    Record<string, MedalRecipientInfo[]> | null
  >(null);
  const [recipientsFamily, setRecipientsFamily] =
    useState<MedalFamilyGroup | null>(null);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState<boolean>(false);

  // Load medals
  const loadMedals = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await medalService.getAll();
      setMedals(data);
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        t('admin.medals.error.loadFailed', 'Không thể tải danh sách huy hiệu');
      showNotification(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Load recipients analytics — populates the catalog "granted users" metric.
  // Wrapped in its own loader so we can refresh it after a revoke/reinstate
  // without re-pulling the medal catalog.
  const loadRecipientAnalytics = useCallback(
    async (force = false) => {
      setIsLoadingRecipients(true);
      try {
        const stats = await medalAnalyticsService.getAnalytics(force);
        setRecipientsByMedalCode(stats.recipientsByMedalCode);
      } catch (err: unknown) {
        console.warn('Failed to load recipient analytics:', err);
        setRecipientsByMedalCode({});
      } finally {
        setIsLoadingRecipients(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadMedals();
    void loadRecipientAnalytics();
  }, [loadMedals, loadRecipientAnalytics]);

  // Toast notification
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Derive family key from code
  const deriveFamilyKeyLocal = (code: string): string => {
    if (!code) return '';
    return code
      .replace(/_(BRONZE|SILVER|GOLD|PLATINUM)$/i, '')
      .replace(/_(I|II|III|IV|V|VI|VII|VIII|IX|X)$/i, '')
      .toUpperCase();
  };

  // Modal handlers
  const handleOpenCreate = () => {
    setTargetMedal(null);
    setActiveModal('create');
  };

  const handleOpenEdit = (medal: Medal) => {
    setTargetMedal(medal);
    setActiveModal('edit');
  };

  const handleOpenQuickImage = (medal: Medal) => {
    setTargetMedal(medal);
    setActiveModal('quickImage');
  };

  const handleDelete = (medal: Medal) => {
    setTargetMedal(medal);
    setActiveModal('delete');
  };

  // Save handlers
  const handleSaveMedalForm = async (payload: MedalCreateInput) => {
    try {
      if (activeModal === 'create') {
        await medalService.create(payload);
        showNotification(t('admin.medals.success.created', 'Tạo huy hiệu mới thành công!'));
      } else if (activeModal === 'edit' && targetMedal) {
        await medalService.update(targetMedal.id, payload);
        const name = locale === 'vi' ? payload.titleVi : payload.title;
        showNotification(t('admin.medals.success.updated', `Đã cập nhật huy hiệu "${name}" thành công!`));
      }
      setActiveModal(null);
      setTargetMedal(null);
      await loadMedals();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        t('admin.medals.error.saveFailed', 'Lỗi khi lưu thông tin huy hiệu');
      showNotification(msg, 'error');
      throw err;
    }
  };

  const handleSaveQuickImage = async (next: { imageUrl: string }) => {
    if (!targetMedal) return;
    try {
      const familyKey = deriveFamilyKeyLocal(targetMedal.code);
      const familyTiers = medals.filter(
        (m) => deriveFamilyKeyLocal(m.code) === familyKey,
      );
      // Fan the icon out across every tier in the family when there's
      // more than one sibling. Single-tier medals (rare, but possible
      // if the admin only created Bronze) hit the simpler per-id path.
      // Frame shape is locked to 'circle' — we no longer expose it in
      // the admin UI — so we just write it alongside the icon update
      // to keep any BE fan-out consistent with what the renderer shows.
      if (familyTiers.length <= 1) {
        await medalService.update(targetMedal.id, {
          imageUrl: next.imageUrl,
          frameShape: 'circle',
        });
      } else {
        await Promise.all([
          medalService.updateMedalFamilyIcon(familyKey, next.imageUrl),
          medalService.updateMedalFamilyShape(familyKey, 'circle'),
        ]);
      }
      const medalName = locale === 'vi' ? targetMedal.titleVi : targetMedal.title;
      showNotification(
        t(
          'admin.medals.success.imageUpdated',
          `Đã cập nhật biểu tượng cho "${medalName}" — áp dụng cho mọi cấp bậc!`
        )
      );
      setActiveModal(null);
      setTargetMedal(null);
      await loadMedals();
      // Critical: drop the module-level flair cache so any
      // UserFlairBadge / ProfileBadgesSection currently mounted on a
      // viewer's page picks up the new icon on its next render. Without
      // this the cache holds the old icon for the rest of the browser
      // session — exactly the bug where the Profile keeps showing
      // ShieldCheck after admin sets the ORCID family to Award.
      invalidateFlairCache();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        t('admin.medals.error.saveFailed', 'Lỗi khi lưu thông tin huy hiệu');
      showNotification(msg, 'error');
      throw err;
    }
  };

  const handleToggleStatus = async (medal: Medal) => {
    try {
      await medalService.update(medal.id, { isActive: !medal.isActive });
      const name = locale === 'vi' ? medal.titleVi : medal.title;
      const action = !medal.isActive
        ? t('admin.medals.action.turnOn', 'Bật').toLowerCase()
        : t('admin.medals.action.turnOff', 'Tắt').toLowerCase();
      showNotification(
        t('admin.medals.success.statusChanged', `Đã ${action} huy hiệu "${name}".`)
      );
      await loadMedals();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        t('admin.medals.error.statusChange', 'Lỗi khi thay đổi trạng thái');
      showNotification(msg, 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!targetMedal) return;
    try {
      await medalService.delete(targetMedal.id);
      const name = locale === 'vi' ? targetMedal.titleVi : targetMedal.title;
      showNotification(t('admin.medals.success.deleted', `Đã xóa huy hiệu "${name}"!`));
      setActiveModal(null);
      setTargetMedal(null);
      await loadMedals();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        t('admin.medals.error.deleteFailed', 'Lỗi khi xóa huy hiệu');
      showNotification(msg, 'error');
    }
  };

  const handleResetDefaults = async () => {
    try {
      await medalService.resetToDefaults();
      showNotification(
        t('admin.medals.success.reset', 'Đã khôi phục toàn bộ 26 huy hiệu mặc định!')
      );
      setActiveModal(null);
      await loadMedals();
      await loadRecipientAnalytics(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        t('admin.medals.error.resetFailed', 'Lỗi khi khôi phục dữ liệu gốc');
      showNotification(msg, 'error');
    }
  };

  // ─── Family recipients modal (catalog view) ─────────────────────────
  const handleOpenFamilyRecipients = (family: MedalFamilyGroup) => {
    setRecipientsFamily(family);
  };

  const handleCloseFamilyRecipients = () => {
    setRecipientsFamily(null);
  };

  const handleRevokeRecipient = async (
    recipient: MedalRecipientInfo,
    reason: string,
  ): Promise<void> => {
    await medalAnalyticsService.revokeMedal(recipient.userMedalId, recipient.userId);
    // Optimistic: drop the row from the local recipients map so the modal
    // and the catalog metric both update immediately. The next
    // refresh-recipients call below keeps things in sync with the BE.
    setRecipientsByMedalCode((prev) => {
      if (!prev) return prev;
      const next: Record<string, MedalRecipientInfo[]> = {};
      for (const [key, list] of Object.entries(prev)) {
        next[key] = list.filter((r) => r.userMedalId !== recipient.userMedalId);
      }
      return next;
    });
    await loadRecipientAnalytics(true);
    // Include the admin-supplied reason in the success toast so the
    // audit trail is preserved client-side even though the BE's revoke
    // endpoint doesn't accept a reason parameter today. If a future
    // BE endpoint is added (`/api/Medal/revoke-with-reason`), wire it
    // through `medalAnalyticsService.revokeMedal` instead.
    showNotification(
      copy(
        `Revoked "${recipient.fullName}" — ${reason}`,
        `Đã thu hồi huy hiệu của "${recipient.fullName}" — ${reason}`,
      ),
    );
  };

  const handleReinstateRecipient = async (
    recipient: MedalRecipientInfo,
    note?: string,
  ): Promise<void> => {
    const medalCode = recipient.medalCode;
    if (!medalCode) {
      throw new Error(
        t(
          'admin.medals.error.missingCode',
          'Không thể khôi phục — thiếu mã huy hiệu.',
        ),
      );
    }
    await medalAnalyticsService.reinstateMedal({
      userId: recipient.userId,
      medalCode,
      note,
    });
    // Optimistic: re-insert the row (marking it as Active again) so the
    // user sees the badge appear immediately.
    setRecipientsByMedalCode((prev) => {
      const base = prev ?? {};
      const code = medalCode.toUpperCase();
      const existing = base[code] ?? [];
      // Only re-add if the BE doesn't already report this user.
      if (existing.some((r) => r.userMedalId === recipient.userMedalId)) {
        return prev;
      }
      const restored: MedalRecipientInfo = {
        ...recipient,
        unlockedAt: new Date().toISOString(),
        isUnlocked: true,
      };
      return { ...base, [code]: [restored, ...existing] };
    });
    await loadRecipientAnalytics(true);
    showNotification(
      t(
        'admin.medals.success.reinstated',
        `Đã khôi phục huy hiệu cho "${recipient.fullName}".`,
      ),
    );
  };

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      {notification && (
        <div
          className={styles.toast}
          role={notification.type === 'error' ? 'alert' : 'status'}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <XCircle size={18} />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <PageHeader
        eyebrow={t('admin.medals.eyebrow', 'QUẢN TRỊ · VINH DANH')}
        title={t('admin.medals.title', 'Huy hiệu & Danh hiệu Học thuật')}
        description={t(
          'admin.medals.description',
          'Hệ thống vinh danh học thuật dành cho Nhà nghiên cứu, Giảng viên, Người phản biện & Học viên. Tùy biến biểu tượng từ thư viện Lucide hoặc tải lên ảnh riêng.'
        )}
        actions={
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.btnAction}
              onClick={() => setIsGrantModalOpen(true)}
              title={t('admin.medals.action.grantMedal', 'Trao huy hiệu')}
            >
              <ShieldCheck size={16} color="#0284c7" />
              <span>{t('admin.medals.action.grantMedal', 'Trao huy hiệu')}</span>
            </button>
            <button
              type="button"
              className={styles.btnAction}
              onClick={() => setActiveModal('reset')}
              title={t('admin.medals.reset', 'Khôi phục mẫu chuẩn')}
            >
              <RotateCcw size={15} />
              <span>{t('admin.medals.reset', 'Khôi phục mẫu chuẩn')}</span>
            </button>
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={handleOpenCreate}
            >
              {t('admin.medals.add', 'Thêm huy hiệu mới')}
            </Button>
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className={styles.tabsContainer} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'catalog'}
          className={`${styles.tabButton} ${activeTab === 'catalog' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('catalog')}
        >
          <Layers size={16} />
          <span>{t('admin.medals.tabs.catalog', 'Danh mục Huy hiệu')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'analytics'}
          className={`${styles.tabButton} ${activeTab === 'analytics' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={16} />
          <span>{t('admin.medals.tabs.analytics', 'Bảng phân tích & Người sở hữu')}</span>
        </button>
      </div>

      {/* Tab 1: Catalog View */}
      {activeTab === 'catalog' && (
        <MedalCatalog
          medals={medals}
          isLoading={isLoading}
          onRefetch={loadMedals}
          onOpenQuickImage={handleOpenQuickImage}
          onOpenEdit={handleOpenEdit}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          showNotification={showNotification}
          locale={locale}
          recipientsByMedalCode={isLoadingRecipients ? null : recipientsByMedalCode}
          onOpenRecipients={handleOpenFamilyRecipients}
        />
      )}

      {/* Tab 2: Analytics Dashboard View */}
      {activeTab === 'analytics' && (
        <MedalAnalyticsDashboard locale={locale} />
      )}

      {/* Grant Medal Modal */}
      {isGrantModalOpen && (
        <GrantMedalModal
          onClose={() => setIsGrantModalOpen(false)}
          onSuccess={(msg) => {
            showNotification(msg, 'success');
            void loadMedals();
          }}
          locale={locale}
        />
      )}

      {/* Modals */}
      {(activeModal === 'create' || activeModal === 'edit') && (
        <TierEditor
          mode={activeModal}
          medal={targetMedal}
          onSave={handleSaveMedalForm}
          onClose={() => {
            setActiveModal(null);
            setTargetMedal(null);
          }}
          showNotification={showNotification}
          locale={locale}
        />
      )}

      {activeModal === 'quickImage' && targetMedal && (
        <ArtworkUpload
          medal={targetMedal}
          currentImageUrl={targetMedal.imageUrl || 'lucide:' + resolveMedalIconName(targetMedal)}
          onSave={handleSaveQuickImage}
          onClose={() => {
            setActiveModal(null);
            setTargetMedal(null);
          }}
          showNotification={showNotification}
          locale={locale}
        />
      )}

      {/* Delete confirmation */}
      {activeModal === 'delete' && targetMedal && createPortal(
        <div
          className={styles.confirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="medal-delete-title"
        >
          <div className={styles.confirmModal}>
            <h3 id="medal-delete-title">{t('admin.medals.delete.title', 'Xác nhận xóa')}</h3>
            <p>
              {copy(
                `Are you sure you want to delete "${targetMedal.title}"?`,
                `Bạn có chắc muốn xóa huy hiệu "${targetMedal.titleVi || targetMedal.title}" không?`
              )}
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.btnAction}
                onClick={() => {
                  setActiveModal(null);
                  setTargetMedal(null);
                }}
              >
                {t('common.cancel', 'Hủy')}
              </button>
              <Button variant="primary" onClick={handleDeleteConfirm}>
                {t('admin.medals.delete.confirm', 'Xóa')}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reset confirmation */}
      {activeModal === 'reset' && createPortal(
        <div
          className={styles.confirmOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="medal-reset-title"
        >
          <div className={styles.confirmModal}>
            <h3 id="medal-reset-title">{t('admin.medals.reset.title', 'Khôi phục mẫu chuẩn')}</h3>
            <p>
              {copy(
                'This will reset all medals to their default values. Are you sure?',
                'Thao tác này sẽ khôi phục toàn bộ huy hiệu về giá trị mặc định. Bạn có chắc muốn tiếp tục?'
              )}
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.btnAction}
                onClick={() => setActiveModal(null)}
              >
                {t('common.cancel', 'Hủy')}
              </button>
              <Button variant="primary" onClick={handleResetDefaults}>
                {t('admin.medals.reset.confirm', 'Khôi phục')}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Family-level recipients modal — opened from the catalog "View" button.
          Aggregates recipients across every tier in the family so the admin can
          filter by tier inside the modal. Revoke / reinstate actions live here. */}
      {recipientsFamily && recipientsByMedalCode && (
        <MedalRecipientsModal
          familyName={
            locale === 'vi'
              ? recipientsFamily.primary.titleVi || recipientsFamily.primary.title
              : recipientsFamily.primary.title || recipientsFamily.primary.titleVi
          }
          primaryMedal={recipientsFamily.primary}
          familyTiers={recipientsFamily.tiers}
          recipients={medalAnalyticsService.aggregateRecipientsByFamily(
            recipientsByMedalCode,
            recipientsFamily.tiers.map((t) => t.code),
          )}
          locale={locale}
          onClose={handleCloseFamilyRecipients}
          onRevoke={handleRevokeRecipient}
          onReinstate={handleReinstateRecipient}
        />
      )}
    </div>
  );
};

export default AdminMedals;
