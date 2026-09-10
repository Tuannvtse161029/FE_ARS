import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Users,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { Medal } from '../../../services/medal.service';
import type { MedalRecipientInfo } from '../../../services/medalAnalytics.service';
import { SafeMedalBadge } from './SafeMedalBadge';
import { Button } from '../../../components/Button/Button';
import { useI18n } from '../../../i18n/I18nContext';
import styles from './MedalRecipientsModal.module.css';

export interface MedalRecipientsModalProps {
  medal: Medal;
  recipients: MedalRecipientInfo[];
  onClose: () => void;
  locale: string;
}

export const MedalRecipientsModal: React.FC<MedalRecipientsModalProps> = ({
  medal,
  recipients,
  onClose,
  locale,
}) => {
  const { t } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Filter recipients
  const filteredRecipients = useMemo(() => {
    return recipients.filter((r) => {
      // Role filter
      if (roleFilter !== 'ALL' && r.roleName !== roleFilter) {
        return false;
      }
      // Type filter (Auto / Manual)
      if (typeFilter === 'AUTO' && r.awardedByAdminId != null) {
        return false;
      }
      if (typeFilter === 'MANUAL' && r.awardedByAdminId == null) {
        return false;
      }
      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.roleName.toLowerCase().includes(q)
      );
    });
  }, [recipients, searchQuery, roleFilter, typeFilter]);

  // Unique roles in this recipient list
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    recipients.forEach((r) => {
      if (r.roleName) set.add(r.roleName);
    });
    return Array.from(set);
  }, [recipients]);

  const formatDate = (isoDate: string | null) => {
    if (!isoDate) return '—';
    try {
      const d = new Date(isoDate);
      return d.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  };

  return createPortal(
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipients-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h3 id="recipients-modal-title" className={styles.modalTitle}>
            {t('admin.medals.recipients.modalTitle', 'Danh sách người dùng đạt huy hiệu')}
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Medal Summary Card */}
          <div className={styles.medalSummaryCard}>
            <SafeMedalBadge
              imageUrl={medal.imageUrl}
              tier={medal.tier}
              size={64}
              alt=""
            />
            <div className={styles.medalSummaryInfo}>
              <div className={styles.medalTitleRow}>
                <span className={styles.medalTitle}>
                  {locale === 'vi' ? medal.titleVi : medal.title}
                </span>
                <span className={styles.statBadge}>
                  {recipients.length} {copy('recipients', 'người đã đạt')}
                </span>
              </div>
              <p className={styles.medalDescription}>
                {locale === 'vi'
                  ? medal.descriptionVi || medal.description
                  : medal.description || medal.descriptionVi}
              </p>
              <div className={styles.medalStatsRow}>
                <span>
                  <strong>Tier:</strong> {medal.tier} ({copy('Stage', 'Cấp')} {medal.stageLevel})
                </span>
                <span>·</span>
                <span>
                  <strong>{t('admin.medals.table.criteria', 'Điều kiện:')}</strong> &gt;={' '}
                  {medal.criteriaThreshold} {medal.criteriaUnit}
                </span>
                <span>·</span>
                <span>{medal.code}</span>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className={styles.filterBar}>
            <div className={styles.searchBox}>
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                className={styles.searchInput}
                placeholder={t(
                  'admin.medals.recipients.searchUser',
                  'Tìm kiếm theo tên hoặc email...'
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.clearSearchBtn}
                  onClick={() => setSearchQuery('')}
                  title={copy('Clear search', 'Xóa tìm kiếm')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {availableRoles.length > 1 && (
              <select
                className={styles.filterSelect}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="ALL">{t('admin.medals.filter.allRoles', 'Tất cả vai trò')}</option>
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            )}

            <select
              className={styles.filterSelect}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">{copy('All grant types', 'Mọi hình thức cấp')}</option>
              <option value="AUTO">{t('admin.medals.recipients.typeAuto', 'Tự động')}</option>
              <option value="MANUAL">{t('admin.medals.recipients.typeManual', 'Admin trao')}</option>
            </select>
          </div>

          {/* Recipients Table */}
          <div className={styles.tableCard}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{copy('User', 'Người dùng')}</th>
                    <th>{copy('Role', 'Vai trò')}</th>
                    <th>{t('admin.medals.recipients.unlockedDate', 'Ngày đạt')}</th>
                    <th>{t('admin.medals.recipients.progress', 'Tiến độ')}</th>
                    <th>{t('admin.medals.recipients.grantType', 'Hình thức cấp')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipients.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className={styles.emptyState}>
                          <Users size={32} color="#94a3b8" />
                          <p>
                            {t(
                              'admin.medals.recipients.empty',
                              'Chưa có người dùng nào đạt huy hiệu này'
                            )}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecipients.map((item) => (
                      <tr key={`${item.userId}_${item.userMedalId}`}>
                        <td>
                          <div className={styles.userCell}>
                            <div className={styles.userAvatar}>
                              {item.avatarUrl ? (
                                <img src={item.avatarUrl} alt="" />
                              ) : (
                                item.fullName.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className={styles.userInfo}>
                              <span className={styles.userName}>{item.fullName}</span>
                              <span className={styles.userEmail}>{item.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={styles.roleBadge}>{item.roleName}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8125rem', color: '#475569' }}>
                            {formatDate(item.unlockedAt)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#16a34a' }}>
                            {item.currentProgress} / {item.criteriaThreshold} {medal.criteriaUnit} (100%)
                          </span>
                        </td>
                        <td>
                          {item.awardedByAdminId ? (
                            <span
                              className={styles.typeManual}
                              title={item.awardedReason ? `${copy('Reason:', 'Lý do:')} ${item.awardedReason}` : undefined}
                            >
                              <ShieldCheck size={12} />
                              <span>{t('admin.medals.recipients.typeManual', 'Admin trao')}</span>
                            </span>
                          ) : (
                            <span className={styles.typeAuto}>
                              <Sparkles size={12} />
                              <span>{t('admin.medals.recipients.typeAuto', 'Tự động')}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
          >
            {t('admin.medals.modal.cancel', 'Đóng')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MedalRecipientsModal;