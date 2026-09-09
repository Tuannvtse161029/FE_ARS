import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Search,
  UserPlus,
  X,
  Check,
  Loader,
  AlertTriangle,
  Mail,
  Users,
} from 'lucide-react';
import api from '../../services/axios';
import { fieldService } from '../../services/field.service';
import type { MajorField } from '../../types/domain';
import { seminarService, type SeminarCard } from '../../services/seminar.service';
import { useI18n } from '../../i18n/I18nContext';
import { GoogleMeetCapacityMeter } from './GoogleMeetCapacityMeter';
import styles from './InviteMoreParticipantsModal.module.css';

interface InviteMoreParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The seminar whose participants are being expanded. */
  seminar: SeminarCard;
  /** Current user — used to exclude self from candidate list. */
  currentUserId?: number | null;
  /** Called after a successful invite round. The argument is the count of
   *  successfully added / sent invitations as reported by the BE. */
  onSuccess?: (added: number, requested: number) => void;
}

interface InviteCandidate {
  userId: number;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  role?: string | null;
  roles: string[];
  subFieldId?: number | null;
  subFieldName?: string | null;
  majorFieldId?: number | null;
}

const ALL_ROLES_FILTER = 'all';

/** Roles the organiser can target. Admin is intentionally excluded — admin
 *  accounts operate the platform and should not be invited to a seminar. */
const INVITABLE_ROLES: string[] = [
  'Lecturer',
  'Researcher',
  'Reviewer',
  'Graduate Student',
];

function isInvitableRole(role: string): boolean {
  const lower = role.toLowerCase().replace(/\s+/g, '');
  if (lower === 'admin' || lower === 'administrator') return false;
  return INVITABLE_ROLES.some(
    (r) => r.toLowerCase().replace(/\s+/g, '') === lower,
  );
}

function normaliseRole(role: string): string {
  const lower = role.toLowerCase().replace(/\s+/g, '');
  if (lower === 'graduatestudent') return 'Graduate Student';
  return role;
}

export const InviteMoreParticipantsModal: React.FC<
  InviteMoreParticipantsModalProps
> = ({ isOpen, onClose, seminar, currentUserId, onSuccess }) => {
  const { t, locale } = useI18n();
  const isVi = locale === 'vi';

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLES_FILTER);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [candidates, setCandidates] = useState<InviteCandidate[]>([]);
  const [majorFields, setMajorFields] = useState<MajorField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Reset modal state when it opens / closes.
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setRoleFilter(ALL_ROLES_FILTER);
      setSelectedEmails(new Set());
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  // Escape key closes the modal.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Build the candidate pool whenever the modal opens. We pull profiles
  // AND users so we can join role information onto each profile.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const [majorsRes, profilesRes, usersRes] = await Promise.allSettled([
          fieldService.getAllMajor(),
          api.get('/api/ProfessionalProfile'),
          api.get('/api/User', { params: { role: 'ALL', pageSize: 1000 } }),
        ]);

        if (cancelled) return;

        // 1. Major fields — needed to map seminar.subFieldId → majorId.
        const majors: MajorField[] =
          majorsRes.status === 'fulfilled' && Array.isArray(majorsRes.value)
            ? majorsRes.value
            : [];
        setMajorFields(majors);

        // 2. userId → roles map.
        const userRolesMap = new Map<number, string[]>();
        if (usersRes.status === 'fulfilled' && usersRes.value?.data) {
          const uData = usersRes.value.data;
          const uList = Array.isArray(uData)
            ? uData
            : (uData.items ?? []);
          for (const u of uList) {
            if (!u || !u.id) continue;
            const rList: string[] = Array.isArray(u.roles) && u.roles.length > 0
              ? (u.roles as string[]).map((r) => String(r))
              : u.roleName
                ? [String(u.roleName)]
                : u.role
                  ? [String(u.role)]
                  : [];
            userRolesMap.set(u.id, rList);
          }
        }

        // 3. ProfessionalProfile rows → InviteCandidate rows.
        if (profilesRes.status === 'fulfilled' && Array.isArray(profilesRes.value?.data)) {
          const next: InviteCandidate[] = [];
          for (const p of profilesRes.value.data) {
            if (!p || !p.userId || !p.email) continue;
            const rList: string[] = userRolesMap.has(p.userId)
              ? userRolesMap.get(p.userId)!
              : p.reviewFee != null
                ? ['Reviewer']
                : ['Scholar'];
            const invitableRoles = rList
              .map(normaliseRole)
              .filter(isInvitableRole);
            // Skip candidates with no invitable role (e.g. Admin-only accounts).
            if (invitableRoles.length === 0) continue;
            next.push({
              userId: p.userId,
              fullName: p.fullName || `User #${p.userId}`,
              email: String(p.email).trim(),
              avatarUrl: p.avatarUrl ?? null,
              role: invitableRoles.join(' • '),
              roles: invitableRoles,
              subFieldId: p.subFieldId ?? null,
              subFieldName: p.subFieldName ?? null,
              majorFieldId: p.majorFieldId ?? null,
            });
          }
          setCandidates(next);
        } else {
          setCandidates([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            isVi
              ? 'Không thể tải danh sách người dùng. Vui lòng thử lại.'
              : 'Unable to load the participant list. Please try again.',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, isVi]);

  // Existing invitees for this seminar — used to exclude them from the
  // candidate pool so we don't show people already invited.
  const alreadyInvited = useMemo(() => {
    const emails = new Set<string>();
    const userIds = new Set<number>();
    const list = seminar.participants ?? [];
    for (const p of list) {
      if (p.userId != null) userIds.add(p.userId);
      const e = (p.invitedEmail || p.userEmail || '').toLowerCase().trim();
      if (e) emails.add(e);
    }
    return { emails, userIds };
  }, [seminar.participants]);

  // Compute the seminar's majorId from subFieldId + the loaded major fields.
  const seminarMajorId = useMemo(() => {
    if (!seminar.subFieldId) return null;
    for (const m of majorFields) {
      if ((m.subFields || []).some((s) => s.id === seminar.subFieldId)) {
        return m.id;
      }
    }
    return null;
  }, [majorFields, seminar.subFieldId]);

  // Filter candidates: exclude admin, self, and existing invitees.
  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (currentUserId != null && c.userId === currentUserId) return false;
      if (alreadyInvited.userIds.has(c.userId)) return false;
      if (alreadyInvited.emails.has(c.email.toLowerCase())) return false;
      if (roleFilter !== ALL_ROLES_FILTER) {
        const target = roleFilter.toLowerCase().replace(/\s+/g, '');
        const hasMatch = c.roles.some(
          (r) => r.toLowerCase().replace(/\s+/g, '') === target,
        );
        if (!hasMatch) return false;
      }
      if (q) {
        const name = (c.fullName || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [candidates, currentUserId, alreadyInvited, roleFilter, search]);

  // Three sections:
  //   • Top row     — same subFieldId as the seminar
  //   • Middle row  — same majorFieldId but different subFieldId
  //   • Bottom row  — everyone else (invitable role, not admin)
  //
  // IDs coming from the BE can be either number or string depending on
  // the serializer path, so compare with both forms.
  const sameSubfield = useMemo(
    () =>
      seminar.subFieldId != null
        ? filteredCandidates.filter(
            (c) =>
              c.subFieldId === seminar.subFieldId ||
              (c.subFieldId != null &&
                String(c.subFieldId) === String(seminar.subFieldId)),
          )
        : [],
    [filteredCandidates, seminar.subFieldId],
  );

  const sameMajor = useMemo(() => {
    if (seminarMajorId == null) return [];
    return filteredCandidates.filter((c) => {
      const majorMatch =
        c.majorFieldId === seminarMajorId ||
        (c.majorFieldId != null &&
          String(c.majorFieldId) === String(seminarMajorId));
      const differentSubfield =
        c.subFieldId !== seminar.subFieldId &&
        String(c.subFieldId ?? '') !== String(seminar.subFieldId ?? '');
      return majorMatch && differentSubfield;
    });
  }, [filteredCandidates, seminarMajorId, seminar.subFieldId]);

  const other = useMemo(
    () =>
      filteredCandidates.filter((c) => {
        const sameSub =
          seminar.subFieldId != null &&
          (c.subFieldId === seminar.subFieldId ||
            (c.subFieldId != null &&
              String(c.subFieldId) === String(seminar.subFieldId)));
        const sameMajorMatch =
          seminarMajorId != null &&
          (c.majorFieldId === seminarMajorId ||
            (c.majorFieldId != null &&
              String(c.majorFieldId) === String(seminarMajorId)));
        return !(sameSub || sameMajorMatch);
      }),
    [filteredCandidates, seminarMajorId, seminar.subFieldId],
  );

  const totalVisible = sameSubfield.length + sameMajor.length + other.length;

  const toggleEmail = useCallback((email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }, []);

  const toggleSection = useCallback(
    (list: InviteCandidate[]) => {
      if (list.length === 0) return;
      const emails = list.map((c) => c.email);
      const allSelected = emails.every((e) => selectedEmails.has(e));
      setSelectedEmails((prev) => {
        const next = new Set(prev);
        if (allSelected) {
          for (const e of emails) next.delete(e);
        } else {
          for (const e of emails) next.add(e);
        }
        return next;
      });
    },
    [selectedEmails],
  );

  const handleSubmit = useCallback(async () => {
    if (selectedEmails.size === 0 || isSubmitting) return;
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const resp = (await seminarService.invite(
        seminar.seminarId,
        Array.from(selectedEmails),
      )) as {
        seminarId?: number;
        requested?: number;
        added?: number;
        sent?: number;
        skipped?: number;
        failedEmails?: string[];
      } | null;

      const requested = resp?.requested ?? selectedEmails.size;
      const added = resp?.added ?? resp?.sent ?? requested;
      const skipped = resp?.skipped ?? 0;
      const failed = resp?.failedEmails ?? [];

      const okMsg = isVi
        ? `Đã gửi lời mời đến ${added} người tham dự.${
            skipped > 0 ? ` (${skipped} đã bỏ qua, ${failed.length} lỗi.)` : ''
          }`
        : `Invitations sent to ${added} participant${
            added === 1 ? '' : 's'
          }.${skipped > 0 ? ` (${skipped} skipped, ${failed.length} failed.)` : ''}`;

      setSuccessMessage(okMsg);
      setSelectedEmails(new Set());
      onSuccess?.(added, requested);

      // Close on success after a short delay so the user sees the count.
      window.setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: unknown) {
      const e = err as {
        response?: { status?: number; data?: { message?: string; title?: string } };
        message?: string;
      };
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.title ||
        e?.message ||
        (isVi
          ? 'Gửi lời mời thất bại. Vui lòng thử lại.'
          : 'Failed to send invitations. Please try again.');
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedEmails, isSubmitting, seminar.seminarId, onClose, onSuccess, isVi]);

  const renderSection = (
    title: string,
    subtitle: string,
    list: InviteCandidate[],
  ) => {
    if (list.length === 0) return null;
    const allSelected =
      list.length > 0 && list.every((c) => selectedEmails.has(c.email));
    return (
      <section className={styles.inviteSection}>
        <header className={styles.inviteSectionHeader}>
          <div className={styles.inviteSectionTitleBlock}>
            <h4 className={styles.inviteSectionTitle}>
              {title}
              <span className={styles.inviteSectionTitleCount}>
                {' '}({list.length})
              </span>
            </h4>
            <p className={styles.inviteSectionSubtitle}>{subtitle}</p>
          </div>
          <button
            type="button"
            className={styles.inviteSectionToggleBtn}
            onClick={() => toggleSection(list)}
          >
            {allSelected
              ? isVi
                ? 'Bỏ chọn nhóm'
                : 'Deselect group'
              : isVi
                ? 'Chọn cả nhóm'
                : 'Select group'}
          </button>
        </header>
        <div className={styles.inviteSectionList}>
          {list.map((c) => {
            const checked = selectedEmails.has(c.email);
            return (
              <label
                key={`row_${c.userId}_${c.email}`}
                className={`${styles.inviteRow} ${checked ? styles.inviteRowActive : ''}`}
              >
                <input
                  type="checkbox"
                  className={styles.inviteCheckbox}
                  checked={checked}
                  onChange={() => toggleEmail(c.email)}
                  aria-label={`Select ${c.fullName}`}
                />
                <div className={styles.inviteAvatar}>
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt={c.fullName} />
                  ) : (
                    (c.fullName || '?').slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className={styles.inviteInfo}>
                  <span className={styles.inviteName}>{c.fullName}</span>
                  <span className={styles.inviteMeta}>
                    <Mail size={11} aria-hidden /> {c.email}
                  </span>
                </div>
                <div className={styles.inviteRoles}>
                  {c.roles.map((r) => (
                    <span
                      key={`chip_${c.userId}_${r}`}
                      className={`${styles.inviteRoleChip} ${roleChipClass(r)}`}
                    >
                      {formatRoleLabel(r, isVi)}
                    </span>
                  ))}
                </div>
              </label>
            );
          })}
        </div>
      </section>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-more-title"
      >
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>
              <UserPlus size={20} aria-hidden />
            </span>
            <div>
              <h2 id="invite-more-title" className={styles.title}>
                {isVi ? 'Mời thêm người tham dự' : 'Invite more participants'}
              </h2>
              <p className={styles.subtitle}>
                {isVi
                  ? `Mời thêm người dùng vào buổi hội thảo "${seminar.title || `#${seminar.seminarId}`}".`
                  : `Invite more users to "${seminar.title || `#${seminar.seminarId}`}".`}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            disabled={isSubmitting}
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className={styles.capacityBar}>
          <GoogleMeetCapacityMeter
            current={
              (seminar.participantCount ?? 0) + selectedEmails.size
            }
            cap={100}
          />
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchField}>
            <Search size={14} aria-hidden className={styles.searchIcon} />
            <input
              ref={searchInputRef}
              type="text"
              className={styles.searchInput}
              placeholder={
                isVi
                  ? 'Tìm theo họ tên hoặc email…'
                  : 'Search by name or email…'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={isVi ? 'Tìm kiếm' : 'Search'}
            />
          </div>

          <div className={styles.roleFilter}>
            <label className={styles.roleFilterLabel} htmlFor="invite-role-filter">
              {isVi ? 'Lọc theo vai trò' : 'Filter by role'}
            </label>
            <select
              id="invite-role-filter"
              className={styles.roleFilterSelect}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value={ALL_ROLES_FILTER}>
                {isVi ? 'Tất cả vai trò' : 'All roles'}
              </option>
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {formatRoleLabel(r, isVi)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.selectedCount} aria-live="polite">
            <Users size={12} aria-hidden />
            {isVi
              ? `Đã chọn: ${selectedEmails.size}`
              : `Selected: ${selectedEmails.size}`}
          </div>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            <AlertTriangle size={14} aria-hidden />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className={styles.successBanner} role="status">
            <Check size={14} aria-hidden />
            <span>{successMessage}</span>
          </div>
        )}

        <div className={styles.body}>
          {isLoading ? (
            <div className={styles.emptyState}>
              <Loader size={16} className={styles.spinner} aria-hidden />
              {isVi ? 'Đang tải danh sách…' : 'Loading participants…'}
            </div>
          ) : totalVisible === 0 ? (
            <div className={styles.emptyState}>
              {search.trim() || roleFilter !== ALL_ROLES_FILTER
                ? isVi
                  ? 'Không có người dùng nào khớp với bộ lọc.'
                  : 'No participants match your search.'
                : isVi
                  ? 'Không còn người dùng nào có thể mời.'
                  : 'No more users available to invite.'}
            </div>
          ) : (
            <>
              {renderSection(
                isVi ? 'Cùng chuyên ngành' : 'Same subfield',
                isVi
                  ? 'Ưu tiên hàng đầu — người dùng có cùng chuyên ngành với buổi hội thảo.'
                  : 'Top priority — users sharing the seminar subfield.',
                sameSubfield,
              )}
              {renderSection(
                isVi ? 'Cùng lĩnh vực' : 'Same major field',
                isVi
                  ? 'Người dùng cùng lĩnh vực lớn nhưng khác chuyên ngành.'
                  : 'Users in the same major field, different subfield.',
                sameMajor,
              )}
              {renderSection(
                isVi ? 'Những người dùng khác' : 'Other participants',
                isVi
                  ? 'Các tài khoản khả dụng khác trong hệ thống (đã loại trừ vai trò Quản trị viên).'
                  : 'Other available accounts (admin role excluded).',
                other,
              )}
            </>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isSubmitting}
          >
            {isVi ? 'Hủy' : 'Cancel'}
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={isSubmitting || selectedEmails.size === 0}
          >
            {isSubmitting ? (
              <>
                <Loader size={14} className={styles.spinner} aria-hidden />
                {isVi ? 'Đang gửi…' : 'Sending…'}
              </>
            ) : (
              <>
                <UserPlus size={14} aria-hidden />
                {isVi
                  ? `Mời ${selectedEmails.size} người`
                  : `Invite ${selectedEmails.size}`}
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};

function formatRoleLabel(roleName: string, isVi: boolean): string {
  const lower = roleName.toLowerCase().replace(/\s+/g, '');
  if (lower === 'graduatestudent') {
    return isVi ? 'Học viên' : 'Graduate Student';
  }
  if (lower === 'researcher') return isVi ? 'Nghiên cứu viên' : 'Researcher';
  if (lower === 'lecturer') return isVi ? 'Giảng viên' : 'Lecturer';
  if (lower === 'reviewer') return isVi ? 'Phản biện' : 'Reviewer';
  return roleName;
}

function roleChipClass(role: string): string {
  const lower = role.toLowerCase().replace(/\s+/g, '');
  if (lower === 'lecturer') return styles.roleChipLecturer ?? '';
  if (lower === 'researcher') return styles.roleChipResearcher ?? '';
  if (lower === 'reviewer') return styles.roleChipReviewer ?? '';
  if (lower === 'graduatestudent') return styles.roleChipGraduate ?? '';
  return styles.roleChipDefault ?? '';
}

export default InviteMoreParticipantsModal;
