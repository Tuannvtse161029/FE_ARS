import React, { useState, useEffect, type FormEvent } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { userService } from '../../../services/user.service';
import type { User } from '../../../types/auth';
import type { Medal } from '../../../services/medal.service';
import { medalAnalyticsService } from '../../../services/medalAnalytics.service';
import { SmartMedalDropdown } from './SmartMedalDropdown';
import { Button } from '../../../components/Button/Button';
import { useI18n } from '../../../i18n/I18nContext';
import styles from './GrantMedalModal.module.css';

export interface GrantMedalModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
  locale: string;
}

export const GrantMedalModal: React.FC<GrantMedalModalProps> = ({
  onClose,
  onSuccess,
  locale,
}) => {
  const { t } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [selectedMedal, setSelectedMedal] = useState<Medal | null>(null);
  const [forceUnlocked, setForceUnlocked] = useState(true);
  const [awardedReason, setAwardedReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    setIsLoadingUsers(true);
    userService
      .getAllUsers(50)
      .then((res) => {
        if (isMounted) {
          setUsers(res.items || []);
          setIsLoadingUsers(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingUsers(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase().trim();
    return (
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.roleName || '').toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setError(copy('Please select a user', 'Vui lòng chọn người dùng'));
      return;
    }
    if (!selectedMedal) {
      setError(copy('Please select a medal to grant', 'Vui lòng chọn huy hiệu để trao'));
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await medalAnalyticsService.grantMedal({
        userId: selectedUser.id,
        medalCode: selectedMedal.code,
        forceUnlocked,
        awardedReason: awardedReason.trim() || 'Admin manual grant',
      });

      onSuccess(
        t('admin.medals.grant.success', 'Đã trao huy hiệu thành công cho {name}!', {
          name: selectedUser.fullName,
        })
      );
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        t('admin.medals.grant.error', 'Không thể trao huy hiệu');
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {t('admin.medals.grant.title', 'Trao huy hiệu cho người dùng')}
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {error && (
              <div className={styles.errorBanner}>
                {error}
              </div>
            )}

            {/* User Selector */}
            <div className={styles.formGroup}>
              <label htmlFor="userSelectSearch" className={styles.formLabel}>
                {t('admin.medals.grant.selectUser', 'Chọn người dùng *')}
              </label>

              {selectedUser ? (
                <div className={styles.userCardSelected}>
                  <div className={styles.userInfo}>
                    <div className={styles.userAvatar}>
                      {selectedUser.avatarUrl ? (
                        <img src={selectedUser.avatarUrl} alt="" className={styles.avatarImg} />
                      ) : (
                        selectedUser.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className={styles.selectedUserName}>
                        {selectedUser.fullName}
                      </div>
                      <div className={styles.selectedUserEmail}>
                        {selectedUser.email}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={styles.userRoleBadge}>{selectedUser.roleName}</span>
                    <button
                      type="button"
                      className={styles.clearUserBtn}
                      onClick={() => {
                        setSelectedUser(null);
                        setSelectedMedal(null);
                      }}
                      title={copy('Change user', 'Đổi người dùng')}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    id="userSelectSearch"
                    placeholder={t(
                      'admin.medals.grant.userPlaceholder',
                      'Tìm theo tên hoặc email...'
                    )}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className={styles.formInput}
                  />

                  <div className={styles.userDropdownList}>
                    {isLoadingUsers ? (
                      <div className={styles.userDropdownEmpty}>
                        {copy('Loading users...', 'Đang tải danh sách người dùng...')}
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className={styles.userDropdownEmpty}>
                        {copy('No users found', 'Không tìm thấy người dùng phù hợp')}
                      </div>
                    ) : (
                      filteredUsers.slice(0, 20).map((u) => (
                        <div
                          key={u.id}
                          onClick={() => {
                            setSelectedUser(u);
                            setUserSearch('');
                            setSelectedMedal(null);
                          }}
                          className={styles.userDropdownItem}
                        >
                          <div>
                            <div className={styles.selectedUserName}>{u.fullName}</div>
                            <div className={styles.selectedUserEmail}>{u.email}</div>
                          </div>
                          <span className={styles.userRoleBadge}>{u.roleName}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Smart Medal Dropdown */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                {t('admin.medals.grant.selectMedal', 'Chọn huy hiệu cần trao *')}
              </label>
              <SmartMedalDropdown
                value={selectedMedal?.code || null}
                onChange={setSelectedMedal}
                targetRole={selectedUser?.roleName || null}
                targetUserId={selectedUser?.id || null}
                showProgress={true}
                placeholder={
                  selectedUser
                    ? copy(
                        `Choose a medal for ${selectedUser.fullName}...`,
                        `Chọn huy hiệu phù hợp cho ${selectedUser.fullName}...`
                      )
                    : t('admin.medals.smartDropdown.placeholder', 'Chọn huy hiệu...')
                }
              />
            </div>

            {/* Force Unlock Checkbox */}
            <div>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={forceUnlocked}
                  onChange={(e) => setForceUnlocked(e.target.checked)}
                />
                <span>
                  {t(
                    'admin.medals.grant.forceUnlock',
                    'Mở khóa ngay lập tức (bỏ qua điều kiện tích lũy)'
                  )}
                </span>
              </label>
            </div>

            {/* Award Reason */}
            <div className={styles.formGroup}>
              <label htmlFor="awardedReasonInput" className={styles.formLabel}>
                {t('admin.medals.grant.reason', 'Lý do trao thưởng (tùy chọn)')}
              </label>
              <textarea
                id="awardedReasonInput"
                rows={2}
                placeholder={t(
                  'admin.medals.grant.reasonPlaceholder',
                  'vd: Khen thưởng thành tích xuất sắc trong kỳ học...'
                )}
                value={awardedReason}
                onChange={(e) => setAwardedReason(e.target.value)}
                className={styles.formTextarea}
              />
            </div>
          </div>

          {/* Footer */}
          <div className={styles.modalFooter}>
            <Button
              variant="secondary"
              type="button"
              onClick={onClose}
            >
              {t('admin.medals.modal.cancel', 'Hủy')}
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={isSubmitting || !selectedUser || !selectedMedal}
              leftIcon={<ShieldCheck size={16} />}
            >
              {isSubmitting
                ? copy('Granting...', 'Đang xử lý...')
                : t('admin.medals.grant.submit', 'Xác nhận trao huy hiệu')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GrantMedalModal;