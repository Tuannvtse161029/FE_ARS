/**
 * InviteParticipantsModal — invites additional participants to an existing seminar.
 *
 * Features:
 *   • Google Meet capacity meter (full variant) so the lecturer knows the room limit.
 *   • Search bar to find users by email or full name.
 *   • Three-tier grouped user list:
 *       1. Same subfield as the seminar
 *       2. Same major field as the seminar
 *       3. Everyone else (with a role filter)
 *   • Multi-select checkboxes for participants.
 *   • Calls `POST /api/Seminar/{id}/invite` on submit.
 *   • Fires `onSuccess` / `onError` callbacks so the parent can show a banner or toast.
 *
 * Props:
 *   seminarId       — required for the invite API call
 *   seminarTitle    — shown in the modal header
 *   subFieldId      — groups same-subfield users at the top
 *   majorFieldId    — groups same-major-field users in tier 2
 *   subFieldName    — human-readable label for the subfield
 *   majorFieldName  — human-readable label for the major field
 *   participantCount — current confirmed participants (for the capacity meter)
 *   maxParticipants  — optional cap from the BE; falls back to Google Meet free-account cap (100)
 *   existingEmails  — emails already invited (hidden from the list)
 *   onClose         — called on cancel / backdrop click / close button
 *   onSuccess       — called after a 2xx invite response; argument = invited count
 *   onError         — called on failure; argument = error message
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Search,
  Loader,
  UserPlus,
  Check,
  AlertCircle,
  Users,
} from 'lucide-react';
import api from '../../services/axios';
import { GoogleMeetCapacityMeter } from './GoogleMeetCapacityMeter';
import {
  GOOGLE_MEET_FREE_PARTICIPANT_CAP,
  seminarService,
} from '../../services/seminar.service';
import type { MajorField } from '../../types/domain';
import { useLocale } from '../../i18n/I18nContext';
import styles from './InviteParticipantsModal.module.css';

// ── User candidate shape ───────────────────────────────────────────────────────

interface InviteeUser {
  userId: number;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  role?: string | null;
  subFieldId?: number | null;
  subFieldName?: string | null;
  majorFieldId?: number | null;
  /** Inferred from the majorFieldId of the first professional profile found. */
  majorFieldName?: string | null;
}

type Tier = 'sameSubfield' | 'sameMajorField' | 'others';

interface GroupedUsers {
  tier: Tier;
  label: string;
  users: InviteeUser[];
}

// ── Role filter option ─────────────────────────────────────────────────────────

const ALL_ROLES = 'ALL';

const getRoleClass = (role?: string | null) => {
  const r = (role || '').toLowerCase();
  if (r.includes('lecturer') || r.includes('giảng viên')) return styles.roleLecturer;
  if (r.includes('researcher') || r.includes('nghiên cứu')) return styles.roleResearcher;
  if (r.includes('reviewer') || r.includes('phản biện')) return styles.roleReviewer;
  return styles.roleDefault;
};

// ── Component ─────────────────────────────────────────────────────────────────

export interface InviteParticipantsModalProps {
  seminarId: number;
  seminarTitle: string;
  subFieldId?: number | null;
  majorFieldId?: number | null;
  subFieldName?: string | null;
  majorFieldName?: string | null;
  participantCount?: number;
  maxParticipants?: number | null;
  existingEmails?: string[];
  onClose: () => void;
  onSuccess: (count: number) => void;
  onError: (message: string) => void;
}

export const InviteParticipantsModal = ({
  seminarId,
  seminarTitle,
  subFieldId,
  majorFieldId,
  subFieldName,
  majorFieldName,
  participantCount = 0,
  maxParticipants,
  existingEmails = [],
  onClose,
  onSuccess,
  onError,
}: InviteParticipantsModalProps) => {
  const locale = useLocale();
  const isVi = locale === 'vi';
  const copy = (en: string, vi: string) => (isVi ? vi : en);

  // ── Data loading ──────────────────────────────────────────────────────────

  const [majorFields, setMajorFields] = useState<MajorField[]>([]);
  const [allUsers, setAllUsers] = useState<InviteeUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoadingUsers(true);
      setLoadError(null);
      try {
        const [majorsResult, profResult, usersResult] = await Promise.allSettled([
          api.get<MajorField[]>('/api/MajorField'),
          api.get<Record<string, unknown>[]>('/api/ProfessionalProfile'),
          api.get<{ items?: Record<string, unknown>[]; data?: Record<string, unknown>[] }>('/api/User'),
        ]);

        if (cancelled) return;

        // 1. Major fields for name lookup
        if (majorsResult.status === 'fulfilled' && Array.isArray(majorsResult.value.data)) {
          setMajorFields(majorsResult.value.data);
        }

        // 2. Build userRole map from /api/User
        const userRoleMap = new Map<number, string>();
        if (usersResult.status === 'fulfilled' && usersResult.value.data) {
          const uData = usersResult.value.data;
          const uList = Array.isArray(uData) ? uData : (uData.items || []);
          for (const u of uList as Array<{ id?: number; roleName?: string; role?: string }>) {
            if (u.id) userRoleMap.set(u.id, u.roleName || u.role || '');
          }
        }

        // 3. Build user list from ProfessionalProfiles
        if (profResult.status === 'fulfilled' && Array.isArray(profResult.value.data)) {
          const profiles = profResult.value.data;
          const seenEmails = new Set<string>();
          const users: InviteeUser[] = [];

          for (const p of profiles as Array<{
            userId?: number;
            email?: string;
            fullName?: string;
            avatarUrl?: string;
            subFieldId?: number;
            subFieldName?: string;
            majorFieldId?: number;
            role?: string;
            reviewFee?: number;
          }>) {
            if (!p?.userId || !p?.email) continue;
            const email = p.email.trim().toLowerCase();
            if (seenEmails.has(email)) continue;
            // Skip already-invited users
            if (existingEmails.map((e) => e.toLowerCase()).includes(email)) continue;
            seenEmails.add(email);

            // Resolve the canonical role from BE data; null means "unknown / no role".
            // Only the five real ARS roles (Lecturer, Researcher, Reviewer,
            // Graduate Student, System Admin) are shown as a badge.
            const profileRole: string | null =
              (typeof p.role === 'string' && p.role.trim()) || null;
            const userRole: string | null =
              userRoleMap.get(p.userId) || null;
            const hasReviewFee: boolean =
              typeof p.reviewFee === 'number' && p.reviewFee > 0;
            const role: string | null =
              profileRole ||
              userRole ||
              (hasReviewFee ? 'Reviewer' : null);

            const majorField = majorFields.find((m) => m.id === p.majorFieldId);

            users.push({
              userId: p.userId,
              fullName: p.fullName || `User #${p.userId}`,
              email: p.email.trim(),
              avatarUrl: p.avatarUrl,
              role,
              subFieldId: p.subFieldId ?? null,
              subFieldName: p.subFieldName ?? null,
              majorFieldId: p.majorFieldId ?? null,
              majorFieldName: majorField?.name ?? null,
            });
          }

          setAllUsers(users);
        } else {
          setAllUsers([]);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : copy('Failed to load users.', 'Không thể tải danh sách người dùng.');
          setLoadError(msg);
          setAllUsers([]);
        }
      } finally {
        if (!cancelled) setIsLoadingUsers(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
    // majorFields is populated in the same run, so we re-run when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(existingEmails)]);

  // ── Filter / search state ─────────────────────────────────────────────────

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLES);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  // ── Unique roles for the role filter dropdown ─────────────────────────────

  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    for (const u of allUsers) {
      if (u.role) roles.add(u.role);
    }
    return ['All Roles', ...Array.from(roles).sort()];
  }, [allUsers]);

  // ── Grouped & filtered user list ──────────────────────────────────────────

  const groupedUsers = useMemo<GroupedUsers[]>(() => {
    const query = searchQuery.trim().toLowerCase();

    const matchUser = (u: InviteeUser): boolean => {
      // Exclude self
      // Already excluded during fetch

      // Role filter
      if (roleFilter !== ALL_ROLES && u.role !== roleFilter) return false;

      // Search filter
      if (query) {
        const nameMatch = (u.fullName || '').toLowerCase().includes(query);
        const emailMatch = (u.email || '').toLowerCase().includes(query);
        if (!nameMatch && !emailMatch) return false;
      }

      return true;
    };

    const sameSubfield: InviteeUser[] = [];
    const sameMajorField: InviteeUser[] = [];
    const others: InviteeUser[] = [];

    for (const u of allUsers) {
      if (!matchUser(u)) continue;
      if (subFieldId && u.subFieldId === subFieldId) {
        sameSubfield.push(u);
      } else if (majorFieldId && u.majorFieldId === majorFieldId) {
        sameMajorField.push(u);
      } else {
        others.push(u);
      }
    }

    const groups: GroupedUsers[] = [];
    if (sameSubfield.length > 0) {
      groups.push({
        tier: 'sameSubfield',
        label: copy(
          `Same subfield${subFieldName ? ` — ${subFieldName}` : ''}`,
          `Cùng chuyên ngành${subFieldName ? ` — ${subFieldName}` : ''}`,
        ),
        users: sameSubfield,
      });
    }
    if (sameMajorField.length > 0) {
      groups.push({
        tier: 'sameMajorField',
        label: copy(
          `Same major field${majorFieldName ? ` — ${majorFieldName}` : ''}`,
          `Cùng lĩnh vực${majorFieldName ? ` — ${majorFieldName}` : ''}`,
        ),
        users: sameMajorField,
      });
    }
    if (others.length > 0) {
      groups.push({
        tier: 'others',
        label: copy('All other participants', 'Tất cả người tham dự khác'),
        users: others,
      });
    }

    return groups;
  }, [allUsers, searchQuery, roleFilter, subFieldId, majorFieldId, subFieldName, majorFieldName, isVi]);

  // ── Selection helpers ───────────────────────────────────────────────────────

  const totalVisible = groupedUsers.reduce((sum, g) => sum + g.users.length, 0);

  const allVisibleSelected =
    totalVisible > 0 &&
    groupedUsers.every((g) => g.users.every((u) => selectedEmails.has(u.email)));

  const handleToggleAll = () => {
    if (allVisibleSelected) {
      setSelectedEmails(new Set());
    } else {
      const newSet = new Set(selectedEmails);
      for (const g of groupedUsers) {
        for (const u of g.users) {
          newSet.add(u.email);
        }
      }
      setSelectedEmails(newSet);
    }
  };

  const handleToggleUser = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (selectedEmails.size === 0) return;
    setIsSubmitting(true);
    try {
      await seminarService.invite(seminarId, Array.from(selectedEmails));
      onSuccess(selectedEmails.size);
    } catch (err) {
      const raw = (err as { response?: { data?: { message?: string; title?: string } } })?.response?.data;
      const msg =
        raw?.message ||
        raw?.title ||
        (err instanceof Error ? err.message : copy('Failed to send invitations.', 'Gửi lời mời thất bại.'));
      onError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedEmails, seminarId, onSuccess, onError, isVi, copy]);

  // ── Capacity meter ───────────────────────────────────────────────────────

  const cap = (maxParticipants && maxParticipants > 1)
    ? Math.min(maxParticipants, GOOGLE_MEET_FREE_PARTICIPANT_CAP)
    : GOOGLE_MEET_FREE_PARTICIPANT_CAP;

  // ── Close on backdrop click ───────────────────────────────────────────────

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      onClick={handleBackdropClick}
    >
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIconWrap}>
              <UserPlus size={18} aria-hidden />
            </div>
            <div>
              <h3 id="invite-modal-title" className={styles.headerTitle}>
                {copy('Invite Participants', 'Mời Người Tham Dự')}
              </h3>
              <p className={styles.headerSub}>{seminarTitle}</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={copy('Close', 'Đóng')}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Capacity meter */}
        <div className={styles.capacitySection}>
          <GoogleMeetCapacityMeter
            current={participantCount}
            cap={cap}
          />
        </div>

        {/* Search + role filter */}
        <div className={styles.filterRow}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} aria-hidden />
            <input
              type="search"
              className={styles.searchInput}
              placeholder={copy('Search by name or email…', 'Tìm theo tên hoặc email…')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={copy('Search participants', 'Tìm người tham dự')}
            />
          </div>
          <select
            className={styles.roleSelect}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label={copy('Filter by role', 'Lọc theo vai trò')}
          >
            {availableRoles.map((r) => (
              <option key={r} value={r === 'All Roles' ? ALL_ROLES : r}>
                {r === 'All Roles' ? copy('All Roles', 'Tất cả vai trò') : r}
              </option>
            ))}
          </select>
        </div>

        {/* Selection count + select-all */}
        {totalVisible > 0 && (
          <div className={styles.selectionRow}>
            <span className={styles.selectionCount}>
              <Check size={13} aria-hidden />
              {selectedEmails.size > 0
                ? copy(`${selectedEmails.size} selected`, `${selectedEmails.size} đã chọn`)
                : copy('None selected', 'Chưa chọn ai')}
            </span>
            <button
              type="button"
              className={styles.selectAllBtn}
              onClick={handleToggleAll}
            >
              {allVisibleSelected
                ? copy('Deselect all', 'Bỏ chọn tất cả')
                : copy('Select all visible', 'Chọn tất cả hiển thị')}
            </button>
          </div>
        )}

        {/* User list */}
        <div className={styles.userList} role="listbox" aria-multiselectable="true">
          {isLoadingUsers ? (
            <div className={styles.emptyState}>
              <Loader size={16} className={styles.spinning} aria-hidden />
              <span>{copy('Loading participants…', 'Đang tải danh sách…')}</span>
            </div>
          ) : loadError ? (
            <div className={styles.emptyState}>
              <AlertCircle size={16} aria-hidden />
              <span>{loadError}</span>
            </div>
          ) : groupedUsers.length === 0 ? (
            <div className={styles.emptyState}>
              <Users size={16} aria-hidden />
              <span>
                {searchQuery || roleFilter !== ALL_ROLES
                  ? copy('No participants match your search.', 'Không có người tham dự nào khớp tìm kiếm.')
                  : copy('No participants found.', 'Không tìm thấy người tham dự nào.')}
              </span>
            </div>
          ) : (
            groupedUsers.map((group) => (
              <div key={group.tier} className={styles.groupSection}>
                {groupedUsers.length > 1 && (
                  <div className={styles.groupLabel}>
                    <span>{group.label}</span>
                    <span className={styles.groupCount}>{group.users.length}</span>
                  </div>
                )}
                {group.users.map((user) => {
                  const checked = selectedEmails.has(user.email);
                  return (
                    <div
                      key={user.userId}
                      className={`${styles.userItem} ${checked ? styles.userItemActive : ''}`}
                      onClick={() => handleToggleUser(user.email)}
                      role="option"
                      aria-selected={checked}
                    >
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={checked}
                        onChange={() => {}}
                        aria-label={copy(`Select ${user.fullName}`, `Chọn ${user.fullName}`)}
                      />
                      <div className={styles.avatar}>
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.fullName} />
                        ) : (
                          user.fullName.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className={styles.userInfo}>
                        <div className={styles.userNameRow}>
                          <span className={styles.userName}>{user.fullName}</span>
                          {user.role && user.role.trim().toLowerCase() !== 'scholar' && (
                            <span className={`${styles.roleBadge} ${getRoleClass(user.role)}`}>
                              {user.role}
                            </span>
                          )}
                        </div>
                        <span className={styles.userEmail}>{user.email}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isSubmitting}
          >
            {copy('Cancel', 'Hủy')}
          </button>
          <button
            type="button"
            className={styles.inviteBtn}
            onClick={() => void handleSubmit()}
            disabled={selectedEmails.size === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader size={14} className={styles.spinning} aria-hidden />
                {copy('Sending…', 'Đang gửi…')}
              </>
            ) : (
              <>
                <UserPlus size={14} aria-hidden />
                {selectedEmails.size > 0
                  ? copy(`Invite ${selectedEmails.size} participant${selectedEmails.size !== 1 ? 's' : ''}`, `Mời ${selectedEmails.size} người`)
                  : copy('Invite', 'Mời')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteParticipantsModal;
