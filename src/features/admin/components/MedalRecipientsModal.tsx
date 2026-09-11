/**
 * MedalRecipientsModal — full recipient list with tier filters and revoke/reinstate
 *
 * Used in two surfaces:
 *   1. The "Bảng phân tích & Người sở hữu" tab — opens for a single tier
 *      of a medal (single-tile flow), one medal passed as `primaryMedal`.
 *   2. The medal catalog cards — opens for the whole metric family
 *      (Bronze+Silver+Gold+Platinum grouped under one `familyName`),
 *      with tier filter tabs at the top so the admin can scope the
 *      recipient table to one tier at a time.
 *
 * Each row shows the user identity (avatar, full name, email), the tier
 * they earned, when they earned it, current status (Active / Revoked),
 * and a per-row revoke / reinstate toggle. The revoke action opens a
 * confirm modal with a textarea where the admin types a reason — that
 * reason travels with the audit trail (see `medalAnalyticsService.revokeMedal`).
 */
import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Users,
  ShieldCheck,
  AlertTriangle,
  Check,
  RotateCcw,
  EyeOff,
} from 'lucide-react';
import type { Medal, MedalTier } from '../../../services/medal.service';
import type { MedalRecipientInfo } from '../../../services/medalAnalytics.service';
import { SafeMedalBadge } from './SafeMedalBadge';
import { Button } from '../../../components/Button/Button';
import { useI18n } from '../../../i18n/I18nContext';
import styles from './MedalRecipientsModal.module.css';

export interface MedalRecipientsModalProps {
  /** The family name (e.g. "Prolific Author") shown in the header */
  familyName: string;
  /** Primary medal (used for icon + base metadata; any tier in the family works) */
  primaryMedal: Medal;
  /** Every tier in this family, used to render the tier filter tabs */
  familyTiers?: Medal[];
  /** Recipients to render in the table — already aggregated across tiers when applicable */
  recipients: MedalRecipientInfo[];
  /** Locale for bilingual copy */
  locale: string;
  /** Fired when the admin clicks close (X, overlay, or cancel) */
  onClose: () => void;
  /** Fired when the admin revokes a recipient — the modal optimistically updates state */
  onRevoke?: (recipient: MedalRecipientInfo, reason: string) => Promise<void> | void;
  /** Fired when the admin reinstates a previously revoked recipient */
  onReinstate?: (recipient: MedalRecipientInfo, note?: string) => Promise<void> | void;
}

type TierFilter = MedalTier | 'ALL';
type RecipientStatusFilter = 'ALL' | 'ACTIVE' | 'REVOKED';

const TIER_FILTERS: { value: TierFilter; key: string; en: string; vi: string }[] = [
  { value: 'ALL', key: 'all', en: 'All tiers', vi: 'Mọi cấp' },
  { value: 'Bronze', key: 'bronze', en: 'Bronze', vi: 'Đồng' },
  { value: 'Silver', key: 'silver', en: 'Silver', vi: 'Bạc' },
  { value: 'Gold', key: 'gold', en: 'Gold', vi: 'Vàng' },
  { value: 'Platinum', key: 'platinum', en: 'Platinum', vi: 'Bạch Kim' },
];

const TIER_LABEL: Record<MedalTier, { en: string; vi: string }> = {
  Bronze: { en: 'Bronze', vi: 'Đồng' },
  Silver: { en: 'Silver', vi: 'Bạc' },
  Gold: { en: 'Gold', vi: 'Vàng' },
  Platinum: { en: 'Platinum', vi: 'Bạch Kim' },
};

export const MedalRecipientsModal: React.FC<MedalRecipientsModalProps> = ({
  familyName,
  primaryMedal,
  familyTiers,
  recipients,
  locale,
  onClose,
  onRevoke,
  onReinstate,
}) => {
  const { t } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);

  // ─── Filters ────────────────────────────────────────────────────────
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<RecipientStatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Local "revoked" overlay ───────────────────────────────────────
  // The BE removes the row on revoke, but we keep the row visible so the
  // admin can reinstate from the same place. We track the locally-revoked
  // `userMedalId`s separately from the prop list.
  const [revokedIds, setRevokedIds] = useState<Set<number>>(new Set());
  const [revokedReasons, setRevokedReasons] = useState<Map<number, string>>(new Map());
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // ─── Revoke confirm modal state ────────────────────────────────────
  const [confirmTarget, setConfirmTarget] = useState<MedalRecipientInfo | null>(null);
  const [confirmReason, setConfirmReason] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);

  // ─── Available tiers for the tab strip ─────────────────────────────
  // If familyTiers is provided we use that; otherwise we derive from the
  // tiers we actually see in the recipient list.
  const availableTiers = useMemo<TierFilter[]>(() => {
    const tierSet = new Set<MedalTier>();
    if (Array.isArray(familyTiers) && familyTiers.length > 0) {
      for (const tierObj of familyTiers) tierSet.add(tierObj.tier);
    } else {
      for (const r of recipients) {
        if (r.tier) tierSet.add(r.tier);
      }
    }
    const ordered: TierFilter[] = ['ALL'];
    for (const tier of ['Bronze', 'Silver', 'Gold', 'Platinum'] as MedalTier[]) {
      if (tierSet.has(tier)) ordered.push(tier);
    }
    return ordered;
  }, [familyTiers, recipients]);

  // ─── Filtered recipients ───────────────────────────────────────────
  const filteredRecipients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return recipients.filter((r) => {
      if (tierFilter !== 'ALL' && r.tier !== tierFilter) return false;
      const isRevoked = revokedIds.has(r.userMedalId);
      if (statusFilter === 'ACTIVE' && isRevoked) return false;
      if (statusFilter === 'REVOKED' && !isRevoked) return false;
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.roleName.toLowerCase().includes(q)
      );
    });
  }, [recipients, tierFilter, statusFilter, searchQuery, revokedIds]);

  // ─── Counts shown in the tab labels ────────────────────────────────
  const countsByTier = useMemo(() => {
    const counts: Record<string, number> = { ALL: recipients.length };
    for (const tier of ['Bronze', 'Silver', 'Gold', 'Platinum'] as MedalTier[]) {
      counts[tier] = recipients.filter((r) => r.tier === tier).length;
    }
    return counts;
  }, [recipients]);

  const activeCount = useMemo(
    () => recipients.filter((r) => !revokedIds.has(r.userMedalId)).length,
    [recipients, revokedIds],
  );
  const revokedCount = revokedIds.size;

  // ─── Date formatter ────────────────────────────────────────────────
  const formatDate = useCallback(
    (isoDate: string | null): string => {
      if (!isoDate) return '—';
      try {
        return new Date(isoDate).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return isoDate;
      }
    },
    [locale],
  );

  // ─── Open revoke confirm ───────────────────────────────────────────
  const openRevokeConfirm = (recipient: MedalRecipientInfo) => {
    if (!onRevoke) return;
    setConfirmTarget(recipient);
    setConfirmReason('');
  };

  const closeRevokeConfirm = () => {
    if (confirmBusy) return;
    setConfirmTarget(null);
    setConfirmReason('');
  };

  const handleConfirmRevoke = async () => {
    if (!confirmTarget) return;
    const reason = confirmReason.trim() || 'Revoked by admin';
    setConfirmBusy(true);
    try {
      await onRevoke?.(confirmTarget, reason);
      setRevokedIds((prev) => {
        const next = new Set(prev);
        next.add(confirmTarget.userMedalId);
        return next;
      });
      setRevokedReasons((prev) => {
        const next = new Map(prev);
        next.set(confirmTarget.userMedalId, reason);
        return next;
      });
      setBanner({
        kind: 'success',
        text: copy(
          `Revoked badge from "${confirmTarget.fullName}".`,
          `Đã thu hồi huy hiệu của "${confirmTarget.fullName}".`,
        ),
      });
      setConfirmTarget(null);
      setConfirmReason('');
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        copy('Failed to revoke the badge.', 'Không thể thu hồi huy hiệu.');
      setBanner({ kind: 'error', text: msg });
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleReinstate = async (recipient: MedalRecipientInfo) => {
    if (!onReinstate) return;
    try {
      await onReinstate(recipient, undefined);
      setRevokedIds((prev) => {
        const next = new Set(prev);
        next.delete(recipient.userMedalId);
        return next;
      });
      setRevokedReasons((prev) => {
        const next = new Map(prev);
        next.delete(recipient.userMedalId);
        return next;
      });
      setBanner({
        kind: 'success',
        text: copy(
          `Reinstated badge for "${recipient.fullName}".`,
          `Đã khôi phục huy hiệu cho "${recipient.fullName}".`,
        ),
      });
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        copy('Failed to reinstate the badge.', 'Không thể khôi phục huy hiệu.');
      setBanner({ kind: 'error', text: msg });
    }
  };

  const tierBadgeClasses: Record<MedalTier, string> = {
    Bronze: 'tierPill_Bronze',
    Silver: 'tierPill_Silver',
    Gold: 'tierPill_Gold',
    Platinum: 'tierPill_Platinum',
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
            {t(
              'admin.medals.recipients.modalTitle',
              'Danh sách người dùng đạt huy hiệu',
            )}
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label={copy('Close', 'Đóng')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Medal Summary Card */}
          <div className={styles.medalSummaryCard}>
            <SafeMedalBadge
              imageUrl={primaryMedal.imageUrl}
              code={primaryMedal.code}
              criteriaMetric={primaryMedal.criteriaMetric}
              tier={primaryMedal.tier}
              size={64}
              alt={familyName}
            />
            <div className={styles.medalSummaryInfo}>
              <div className={styles.medalTitleRow}>
                <span className={styles.medalTitle}>{familyName}</span>
                <span className={styles.statBadge}>
                  {recipients.length} {copy('recipients', 'người đã đạt')}
                </span>
                {revokedCount > 0 && (
                  <span className={`${styles.statBadge} ${styles.statBadgeDanger}`}>
                    {revokedCount} {copy('revoked', 'đã thu hồi')}
                  </span>
                )}
              </div>
              <p className={styles.medalDescription}>
                {locale === 'vi'
                  ? primaryMedal.descriptionVi || primaryMedal.description
                  : primaryMedal.description || primaryMedal.descriptionVi}
              </p>
              <div className={styles.medalStatsRow}>
                <span>
                  <strong>{copy('Metric:', 'Chỉ số:')}</strong>{' '}
                  <code>{primaryMedal.criteriaMetric}</code>
                </span>
                <span>·</span>
                <span>
                  <strong>{copy('Active:', 'Còn hiệu lực:')}</strong>{' '}
                  {activeCount}
                </span>
              </div>
            </div>
          </div>

          {/* Tier Tabs (only when there are multiple tiers) */}
          {availableTiers.length > 2 && (
            <div className={styles.tierTabs} role="tablist">
              {TIER_FILTERS.filter((tf) => availableTiers.includes(tf.value)).map(
                (tf) => {
                  const isActive = tierFilter === tf.value;
                  const count = countsByTier[tf.value] ?? 0;
                  return (
                    <button
                      key={tf.value}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`${styles.tierTab} ${
                        isActive ? styles.tierTabActive : ''
                      } ${styles[`tierTab_${tf.value}`] ?? ''}`}
                      onClick={() => setTierFilter(tf.value)}
                    >
                      <span className={styles.tierTabLabel}>
                        {copy(tf.en, tf.vi)}
                      </span>
                      <span className={styles.tierTabCount}>{count}</span>
                    </button>
                  );
                },
              )}
            </div>
          )}

          {/* Search + status filter row */}
          <div className={styles.filterBar}>
            <div className={styles.searchBox}>
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                className={styles.searchInput}
                placeholder={t(
                  'admin.medals.recipients.searchUser',
                  'Tìm kiếm theo tên hoặc email...',
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

            <div className={styles.statusFilterGroup} role="radiogroup">
              {(
                [
                  { value: 'ALL', icon: Users, en: 'All', vi: 'Tất cả' },
                  {
                    value: 'ACTIVE',
                    icon: Check,
                    en: 'Active',
                    vi: 'Còn hiệu lực',
                  },
                  {
                    value: 'REVOKED',
                    icon: AlertTriangle,
                    en: 'Revoked',
                    vi: 'Đã thu hồi',
                  },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const isActive = statusFilter === opt.value;
                const count =
                  opt.value === 'ALL'
                    ? recipients.length
                    : opt.value === 'ACTIVE'
                      ? activeCount
                      : revokedCount;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={`${styles.statusFilter} ${
                      isActive ? styles.statusFilterActive : ''
                    } ${
                      isActive && opt.value !== 'ALL'
                        ? styles[`statusFilter_${opt.value}`] ?? ''
                        : ''
                    }`}
                    onClick={() => setStatusFilter(opt.value)}
                  >
                    <Icon size={12} />
                    <span>{copy(opt.en, opt.vi)}</span>
                    <span className={styles.statusFilterCount}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Banner */}
          {banner && (
            <div
              className={`${styles.banner} ${
                banner.kind === 'success'
                  ? styles.bannerSuccess
                  : styles.bannerError
              }`}
              role={banner.kind === 'error' ? 'alert' : 'status'}
            >
              <span>{banner.text}</span>
              <button
                type="button"
                onClick={() => setBanner(null)}
                aria-label={copy('Dismiss', 'Đóng')}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Recipients Table */}
          <div className={styles.tableCard}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{copy('User', 'Người dùng')}</th>
                    <th>{copy('Tier', 'Cấp')}</th>
                    <th>
                      {t('admin.medals.recipients.unlockedDate', 'Ngày đạt')}
                    </th>
                    <th>{copy('Status', 'Trạng thái')}</th>
                    <th style={{ textAlign: 'right' }}>
                      {copy('Action', 'Thao tác')}
                    </th>
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
                              'Chưa có người dùng nào đạt huy hiệu này',
                            )}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecipients.map((item) => {
                      const isRevoked = revokedIds.has(item.userMedalId);
                      const revokeReason = revokedReasons.get(item.userMedalId);
                      return (
                        <tr
                          key={`${item.userMedalId}_${item.userId}`}
                          className={isRevoked ? styles.rowRevoked : undefined}
                        >
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
                                <span className={styles.userName}>
                                  {item.fullName}
                                </span>
                                <span className={styles.userEmail}>
                                  {item.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            {item.tier ? (
                              <span
                                className={`${styles.tierPill} ${
                                  styles[tierBadgeClasses[item.tier]] ?? ''
                                }`}
                              >
                                {copy(
                                  TIER_LABEL[item.tier].en,
                                  TIER_LABEL[item.tier].vi,
                                )}
                              </span>
                            ) : (
                              <span className={styles.tierPillNone}>
                                {copy('Unlocked', 'Đã mở')}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={styles.dateCell}>
                              {formatDate(item.unlockedAt)}
                            </span>
                          </td>
                          <td>
                            {isRevoked ? (
                              <span
                                className={`${styles.statusPill} ${styles.statusPillRevoked}`}
                                title={
                                  revokeReason
                                    ? `${copy('Reason:', 'Lý do:')} ${revokeReason}`
                                    : undefined
                                }
                              >
                                <AlertTriangle size={12} />
                                <span>{copy('Revoked', 'Đã thu hồi')}</span>
                              </span>
                            ) : (
                              <span
                                className={`${styles.statusPill} ${styles.statusPillActive}`}
                              >
                                <Check size={12} />
                                <span>{copy('Active', 'Còn hiệu lực')}</span>
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isRevoked ? (
                              <button
                                type="button"
                                className={`${styles.rowAction} ${styles.rowActionReinstate}`}
                                onClick={() => void handleReinstate(item)}
                                disabled={!onReinstate}
                                title={copy(
                                  'Reinstate this badge for the user',
                                  'Khôi phục huy hiệu cho người dùng này',
                                )}
                              >
                                <RotateCcw size={12} />
                                <span>{copy('Reinstate', 'Khôi phục')}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={`${styles.rowAction} ${styles.rowActionDanger}`}
                                onClick={() => openRevokeConfirm(item)}
                                disabled={!onRevoke}
                                title={copy(
                                  'Revoke this badge from the user',
                                  'Thu hồi huy hiệu của người dùng này',
                                )}
                              >
                                <EyeOff size={12} />
                                <span>{copy('Revoke', 'Thu hồi')}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('admin.medals.modal.cancel', 'Đóng')}
          </Button>
        </div>
      </div>

      {/* Inline revoke confirm modal with reason textarea */}
      {confirmTarget && (
        <div
          className={styles.reasonModalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-reason-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeRevokeConfirm();
          }}
        >
          <div className={styles.reasonModal}>
            <div className={styles.reasonModalHeader}>
              <AlertTriangle size={20} color="#d97706" />
              <h3 id="revoke-reason-title" className={styles.reasonModalTitle}>
                {copy(
                  'Why are you revoking this badge?',
                  'Lý do thu hồi huy hiệu này?',
                )}
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={closeRevokeConfirm}
                aria-label={copy('Close', 'Đóng')}
                disabled={confirmBusy}
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.reasonModalBody}>
              <p className={styles.reasonModalDescription}>
                {copy(
                  `Tell "${confirmTarget.fullName}" why this badge is being revoked. The reason will be visible in the audit trail.`,
                  `Hãy cho "${confirmTarget.fullName}" biết lý do thu hồi huy hiệu này. Lý do sẽ được lưu trong lịch sử kiểm tra.`,
                )}
              </p>
              <textarea
                className={styles.reasonTextarea}
                value={confirmReason}
                onChange={(e) => setConfirmReason(e.target.value)}
                placeholder={copy(
                  'Reason for revoking (optional but recommended)...',
                  'Lý do thu hồi (không bắt buộc nhưng nên ghi)...',
                )}
                rows={4}
                autoFocus
                disabled={confirmBusy}
              />
            </div>
            <div className={styles.reasonModalActions}>
              <Button
                variant="secondary"
                type="button"
                onClick={closeRevokeConfirm}
                disabled={confirmBusy}
              >
                {copy('Cancel', 'Hủy')}
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={() => void handleConfirmRevoke()}
                disabled={confirmBusy}
                className={styles.confirmRevokeBtn}
              >
                <ShieldCheck size={14} />
                <span>
                  {confirmBusy
                    ? copy('Revoking…', 'Đang thu hồi…')
                    : copy('Confirm revoke', 'Xác nhận thu hồi')}
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};

export default MedalRecipientsModal;
