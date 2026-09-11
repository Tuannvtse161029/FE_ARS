/**
 * LecturerPublicView — burgundy "Academic Coordination Board" for
 * Lecturer profiles. Surface: identity, upcoming public seminars table,
 * coordination record tiles (seminars hosted / research groups / materials),
 * and a public-groups list.
 *
 * Privacy contract: only PUBLIC seminars and PUBLIC groups are surfaced.
 * Private student memberships, feedback, and milestone evaluations are
 * hidden — they live behind their existing authenticated surfaces.
 */
import { ShieldCheck } from 'lucide-react';
import type {
  PublicProfileData,
  PublicProfileRole,
  PublicSeminarRow,
  PublicGroupRow,
} from '../../../hooks/usePublicProfileData';
import { PublicSectionShell } from './shared/PublicSectionShell';
import { MetricTile } from './shared/MetricTile';
import { RoleBadgeChip } from './shared/RoleBadgeChip';
import { useI18n } from '../../../i18n/I18nContext';
import { parseApiDateTimeAsUtc } from '../../../utils/datetime';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/datetime';
import styles from './LecturerPublicView.module.css';

export interface LecturerPublicViewProps {
  data: PublicProfileData;
  displayName: string;
  showPrivacyFootnote: boolean;
  locale: 'en' | 'vi';
}

const seminarStateLabel = (
  raw: string,
  t: (key: string, fallback: string) => string,
): string => {
  const v = raw.toLowerCase();
  if (v === 'upcoming') return t('profile.publicView.lecturer.stateUpcoming', 'Upcoming');
  if (v === 'in progress') return t('profile.publicView.lecturer.stateInProgress', 'In progress');
  if (v === 'completed') return t('profile.publicView.lecturer.stateCompleted', 'Completed');
  if (v === 'draft') return t('profile.publicView.lecturer.stateDraft', 'Draft');
  if (v === 'inactive') return t('profile.publicView.lecturer.stateInactive', 'Inactive');
  return raw;
};

const seminarStateToneClass = (raw: string): string => {
  const v = raw.toLowerCase();
  if (v === 'completed') return styles.stateCompleted;
  if (v === 'in progress') return styles.stateInProgress;
  if (v === 'inactive') return styles.stateInactive;
  if (v === 'draft') return styles.stateDraft;
  return styles.stateUpcoming;
};

const formatSeminarDate = (
  start: string | null,
  end: string | null,
  locale: 'en' | 'vi',
): string => {
  if (!start) return '—';
  const startDate = parseApiDateTimeAsUtc(start);
  const endDate = parseApiDateTimeAsUtc(end);
  if (!startDate) return '—';
  const base = formatDisplayDate(startDate, locale);
  if (!endDate) return base;
  return `${base} · ${formatDisplayTime(startDate, locale)}–${formatDisplayTime(endDate, locale)}`;
};

const memberCountLabel = (
  count: number | null,
  t: (key: string, fallback: string) => string,
): string => {
  if (count == null) return '—';
  return t('profile.publicView.lecturer.memberCount', '{count} members').replace(
    '{count}',
    String(count),
  );
};

const groupStatusLabel = (
  active: boolean | null,
  t: (key: string, fallback: string) => string,
): string => {
  if (active === true) return t('profile.publicView.lecturer.groupActive', 'Active');
  if (active === false) return t('profile.publicView.lecturer.groupArchived', 'Archived');
  return t('profile.publicView.notAvailable', 'Not available');
};

const groupStatusTone = (active: boolean | null): string =>
  active === true
    ? styles.groupStateActive
    : active === false
      ? styles.groupStateArchived
      : styles.groupStateUnknown;

export const LecturerPublicView = ({
  data,
  displayName,
  showPrivacyFootnote,
  locale,
}: LecturerPublicViewProps) => {
  const { t } = useI18n();
  const roleData = data.lecturer;
  const profile = data.profile;
  const upcomingSeminars: PublicSeminarRow[] = roleData?.upcomingSeminars ?? [];
  const publicGroups: PublicGroupRow[] = roleData?.publicGroups ?? [];

  return (
    <div className={styles.view}>
      {/* ── Identity strip ───────────────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.eyebrow.lecturer', 'ARS / ACADEMIC COORDINATION BOARD')}
        title={displayName}
        subtitle={
          profile?.academicTitle ??
          t('profile.publicView.lecturer.subtitle', 'Lecturer / Research Group Coordinator')
        }
        action={
          <RoleBadgeChip
            label={t('profile.publicView.lecturer.chip', 'VERIFIED LECTURER')}
            hint={t('common.publicView', 'Public view')}
            data-testid="lecturer-role-chip"
          />
        }
        data-testid="lecturer-identity"
      >
        <div className={styles.identityGrid}>
          <div className={styles.identityItem}>
            <span className={styles.identityLabel}>
              {t('profile.publicView.lecturer.faculty', 'FACULTY')}
            </span>
            <p className={styles.identityValue}>{profile?.institution ?? '—'}</p>
          </div>
          <div className={styles.identityItem}>
            <span className={styles.identityLabel}>
              {t('profile.publicView.lecturer.academicFocus', 'ACADEMIC FOCUS')}
            </span>
            <p className={styles.identityValue}>
              {Array.isArray(profile?.keywords) && profile.keywords.length > 0
                ? profile.keywords.slice(0, 3).join(' / ')
                : '—'}
            </p>
          </div>
          <div className={styles.identityItem}>
            <span className={styles.identityLabel}>
              {t('profile.publicView.reviewer.activeSince', 'ACTIVE SINCE')}
            </span>
            <p className={styles.identityValue}>{data.joinedYear ?? '—'}</p>
          </div>
        </div>
      </PublicSectionShell>

      {/* ── Public academic calendar ─────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.calendar', 'PUBLIC ACADEMIC CALENDAR')}
        title={t('profile.publicView.lecturer.calendarTitle', 'Upcoming public seminars')}
        subtitle={t(
          'profile.publicView.lecturer.calendarSubtitle',
          'Seminars this lecturer hosts with public visibility on ARS.',
        )}
        data-testid="lecturer-calendar"
      >
        {upcomingSeminars.length === 0 ? (
          <p className={styles.empty}>
            {t(
              'profile.publicView.lecturer.calendarEmpty',
              'No upcoming seminars on the public calendar.',
            )}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.calendarTable}>
              <thead>
                <tr>
                  <th scope="col" className={styles.colDate}>
                    {t('profile.publicView.table.column.date', 'WHEN')}
                  </th>
                  <th scope="col" className={styles.colEvent}>
                    {t('profile.publicView.table.column.event', 'EVENT')}
                  </th>
                  <th scope="col" className={styles.colState}>
                    {t('profile.publicView.table.column.state', 'STATE')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {upcomingSeminars.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.colDate}>
                      <span className={styles.dateText}>
                        {formatSeminarDate(row.startTime, row.endTime, locale)}
                      </span>
                    </td>
                    <td className={styles.colEvent}>
                      <span className={styles.eventTitle}>{row.title}</span>
                    </td>
                    <td className={styles.colState}>
                      <span
                        className={`${styles.statePill} ${seminarStateToneClass(row.effectiveStatus)}`}
                      >
                        {seminarStateLabel(row.effectiveStatus, t)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PublicSectionShell>

      {/* ── Coordination record tiles ────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.contribution', 'COORDINATION RECORD')}
        title={t(
          'profile.publicView.lecturer.recordTitle',
          'Visible coordination footprint',
        )}
        subtitle={t(
          'profile.publicView.lecturer.recordSubtitle',
          'Counts public seminars, public research groups, and public learning materials this lecturer has contributed.',
        )}
        data-testid="lecturer-record"
      >
        <div className={styles.metricsRow}>
          <MetricTile
            label={t('profile.publicView.metric.seminarsHosted', 'SEMINARS HOSTED')}
            value={roleData?.seminarsHostedCount ?? 0}
            caption={t(
              'profile.publicView.lecturer.seminarsHostedCaption',
              'Public seminars where this lecturer is the host.',
            )}
            data-testid="lecturer-metric-seminars"
          />
          <MetricTile
            label={t('profile.publicView.metric.researchGroups', 'RESEARCH GROUPS')}
            value={publicGroups.length}
            caption={t(
              'profile.publicView.lecturer.researchGroupsCaption',
              'Public research groups led by this lecturer.',
            )}
            data-testid="lecturer-metric-groups"
          />
          <MetricTile
            label={t('profile.publicView.metric.materials', 'MATERIALS')}
            value={roleData?.materialsCount ?? 0}
            caption={t(
              'profile.publicView.lecturer.materialsCaption',
              'Learning materials contributed to the public library.',
            )}
            data-testid="lecturer-metric-materials"
          />
        </div>
      </PublicSectionShell>

      {/* ── Public groups list ────────────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.groups', 'PUBLIC GROUPS')}
        title={t('profile.publicView.lecturer.groupsTitle', 'Research groups on the public surface')}
        subtitle={t(
          'profile.publicView.lecturer.groupsSubtitle',
          'Names, member counts, and group status — only the public-facing fields the BE exposes.',
        )}
        data-testid="lecturer-groups"
      >
        {publicGroups.length === 0 ? (
          <p className={styles.empty}>
            {t(
              'profile.publicView.lecturer.groupsEmpty',
              'No public research groups led by this lecturer.',
            )}
          </p>
        ) : (
          <ul className={styles.groupList}>
            {publicGroups.map((group) => (
              <li key={group.id ?? group.name} className={styles.groupRow}>
                <div className={styles.groupMain}>
                  <p className={styles.groupName}>{group.name}</p>
                  {group.description ? (
                    <p className={styles.groupDescription}>{group.description}</p>
                  ) : null}
                  {group.topicTitle ? (
                    <p className={styles.groupTopic}>
                      <span className={styles.groupTopicLabel}>
                        {t('profile.publicView.lecturer.topic', 'TOPIC')}
                      </span>
                      <span>{group.topicTitle}</span>
                    </p>
                  ) : null}
                </div>
                <div className={styles.groupMeta}>
                  <span className={styles.memberCount}>
                    {memberCountLabel(group.memberCount, t)}
                  </span>
                  <span
                    className={`${styles.groupStatePill} ${groupStatusTone(group.isActive)}`}
                  >
                    {groupStatusLabel(group.isActive, t)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PublicSectionShell>

      {/* ── Privacy footnote ────────────────────────────────── */}
      {showPrivacyFootnote ? (
        <p className={styles.privacy} role="note">
          <ShieldCheck size={14} aria-hidden="true" />
          {t(
            'profile.publicView.privacy.lecturer',
            'Private group membership, student reports, feedback, and milestone evaluations are visible only to authorized members.',
          )}
        </p>
      ) : null}
    </div>
  );
};

export const LECTURER_PUBLIC_VIEW_ROLE: PublicProfileRole = 'Lecturer';

export default LecturerPublicView;
