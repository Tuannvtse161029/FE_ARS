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
import {
  Plus,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { medalService, type Medal, type MedalCreateInput } from '../../services/medal.service';
import { useI18n } from '../../i18n/I18nContext';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button/Button';
import { MedalCatalog } from './components/MedalCatalog';
import { TierEditor } from './components/TierEditor';
import { ArtworkUpload } from './components/ArtworkUpload';
import { SafeMedalBadge, LUCIDE_ICONS_MAP, LUCIDE_ICONS_LIST, resolveMedalIconName } from './components/SafeMedalBadge';
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
  const [activeModal, setActiveModal] = useState<'create' | 'edit' | 'quickImage' | 'delete' | 'reset' | null>(null);
  const [targetMedal, setTargetMedal] = useState<Medal | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

  useEffect(() => {
    void loadMedals();
  }, [loadMedals]);

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

  const handleSaveQuickImage = async (newImageUrl: string) => {
    if (!targetMedal) return;
    try {
      const familyTiers = medals.filter(
        (m) => deriveFamilyKeyLocal(m.code) === deriveFamilyKeyLocal(targetMedal.code),
      );
      if (familyTiers.length <= 1) {
        await medalService.update(targetMedal.id, { imageUrl: newImageUrl });
      } else {
        await medalService.updateMedalFamilyIcon(
          deriveFamilyKeyLocal(targetMedal.code),
          newImageUrl,
        );
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
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        t('admin.medals.error.resetFailed', 'Lỗi khi khôi phục dữ liệu gốc');
      showNotification(msg, 'error');
    }
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

      {/* Catalog (stats, filters, grid/table) */}
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
      />

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
      {activeModal === 'delete' && targetMedal && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmModal}>
            <h3>{t('admin.medals.delete.title', 'Xác nhận xóa')}</h3>
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
        </div>
      )}

      {/* Reset confirmation */}
      {activeModal === 'reset' && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmModal}>
            <h3>{t('admin.medals.reset.title', 'Khôi phục mẫu chuẩn')}</h3>
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
        </div>
      )}
    </div>
  );
};

export default AdminMedals;
