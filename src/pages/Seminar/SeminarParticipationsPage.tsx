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
import { useSeminarRoleContext } from '../../hooks/useSeminar';
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

export const SeminarParticipationsPage: React.FC = () => {
  const locale = useLocale();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);
  const { user } = useAuth();
  const { currentRole } = useSeminarRoleContext();
  const roleLabel = currentRole ? formatRole(currentRole, locale) : 'Participant';
  const displayName = user?.username || user?.email || copy('researcher', 'người dùng');

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

        <ParticipationTable />
      </div>
    </div>
  );
};

export default SeminarParticipationsPage;