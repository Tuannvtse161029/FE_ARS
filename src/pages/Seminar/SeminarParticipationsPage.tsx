/**
 * SeminarParticipationsPage — top-level page for the Seminar Participations
 * surface. Mounted at `/seminar-participations` and reachable by
 * Reviewer / Graduate Student / Researcher / Lecturer (role-guarded).
 *
 * The page is a thin wrapper that mounts the shared `ParticipationTable`
 * under the standard PageHeader chrome. All data flow / status pills /
 * action buttons / modal hand-offs live in the table component so the
 * workspace-tab version (`SeminarWorkspace` → participate tab) can reuse
 * the same component without duplicating state.
 *
 * No mock fallback; if BE returns [] the table renders the canonical
 * EmptyState. Errors surface via the table's inline ErrorBanner.
 */

import { Info } from 'lucide-react';
import { useLocale } from '../../i18n/I18nContext';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { ParticipationTable } from '../../components/seminar/ParticipationTable';
import { SeminarCalendar } from '../../components/seminar/SeminarCalendar';
import { SeminarDetailModal } from '../../components/seminar/SeminarDetailModal';
import { useSeminarRoleContext, useSeminars } from '../../hooks/useSeminar';
import { useSeminarCalendar } from '../../hooks/useSeminarCalendar';
import { useState } from 'react';
import type { SeminarCard } from '../../services/seminar.service';
import styles from './SeminarParticipationsPage.module.css';

const formatRole = (role: string, locale: 'vi' | 'en'): string => {
  if (locale !== 'vi') return role;
  switch (role) {
    case 'Graduate Student':
      return 'Học viên cao học';
    case 'Lecturer':
      return 'Giảng viên';
    case 'Researcher':
      return 'Nhà nghiên cứu';
    case 'Reviewer':
      return 'Người phản biện';
    case 'Admin':
      return 'Quản trị viên';
    default:
      return role;
  }
};

export const SeminarParticipationsPage= () => {
  const locale = useLocale();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);
  const { user } = useAuth();
  const { currentRole, canModify } = useSeminarRoleContext();
  const roleLabel = currentRole ? formatRole(currentRole, locale) : 'Participant';
  const displayName = user?.username || user?.email || copy('researcher', 'người dùng');

  const {
    hostingSeminars,
    joiningSeminars,
    isLoading: isCalendarLoading,
    error: calendarError,
    refetch: refetchCalendar,
  } = useSeminarCalendar();

  // Pull seminar cards so the detail modal has full participant metadata.
  const { seminars: seminarCards } = useSeminars();

  // Detail modal state — opens when user clicks a calendar event.
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailSeminar, setDetailSeminar] = useState<SeminarCard | null>(null);

  const handleCalendarEventClick = (sem: { seminarId?: number | null }) => {
    if (sem.seminarId == null) return;
    const matched = seminarCards.find((s) => s.seminarId === sem.seminarId);
    if (matched) {
      setDetailSeminar(matched);
      setShowDetailModal(true);
    }
  };

  return (
    <div className={styles.page} data-testid="seminar-participations-page">
      <PageHeader
        eyebrow={copy('Workspace', 'Không gian làm việc')}
        title={copy('Seminar Participations', 'Lượt tham gia hội thảo')}
        description={copy(
          'Accept invitations, join live sessions, and submit feedback for the seminars you have been invited to.',
          'Chấp nhận lời mời, tham gia buổi trực tiếp và gửi phản hồi cho các hội thảo bạn được mời.',
        )}
        accent="var(--ars-lecturer)"
      />

      <div className={styles.body}>
        <div className={styles.noticeBanner} role="status">
          <span className={styles.noticeBannerIcon} aria-hidden>
            <Info size={16} />
          </span>
          <div>
            <strong>
              {copy(`Welcome, ${displayName} (${roleLabel})`, `Chào ${displayName} (${roleLabel})`)}
            </strong>
            <span>
              {copy(
                'Live data is fetched from the seminar participation API. The Google Meet URL is only ever opened through the Participate button — it is never displayed as a clickable link.',
                'Dữ liệu được lấy trực tiếp từ API lượt tham gia hội thảo. Liên kết Google Meet chỉ mở qua nút Tham gia — không bao giờ hiển thị dưới dạng liên kết.',
              )}
            </span>
          </div>
        </div>

        <SeminarCalendar
          hostingSeminars={hostingSeminars}
          joiningSeminars={joiningSeminars}
          // The participations page is reachable by every seminar viewer,
          // including Reviewer / Graduate Student. Only mutator roles
          // (Lecturer, Researcher) ever organise seminars, so hide the
          // "Hosting" legend dot for everyone else.
          showHostingLegend={canModify}
          onEventClick={handleCalendarEventClick}
          // Surface the calendar hook's loading/error state so the user
          // sees an inline banner (not a missing grid). The grid itself
          // still renders underneath — the banner is a status overlay,
          // not a replacement.
          isLoading={isCalendarLoading}
          errorMessage={calendarError}
          onRetry={() => void refetchCalendar()}
        />

        <ParticipationTable />
      </div>

      {showDetailModal && detailSeminar && (
        <SeminarDetailModal
          isOpen={showDetailModal}
          seminar={detailSeminar}
          onClose={() => {
            setShowDetailModal(false);
            setDetailSeminar(null);
          }}
        />
      )}
    </div>
  );
};

export default SeminarParticipationsPage;