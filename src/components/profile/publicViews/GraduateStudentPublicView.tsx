/**
 * GraduateStudentPublicView — slate-blue "Research Journey Log" for
 * Graduate Student profiles.
 *
 * Architecture (top → bottom):
 *   1. Identity strip (role badge, ORCID, primary research group)
 *   2. Current research path — horizontal phase strip from phased reports
 *   3. Public activity card (research groups, seminars attended, interests)
 *   4. Contribution markers (honest, derived from real data)
 *   5. Academic snapshot (joined year, reports submitted, seminars attended)
 *   6. Privacy footnote
 */
import { useMemo } from 'react';
import {
  ShieldCheck,
  Users2,
  BookOpen,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import type {
  PublicProfileData,
  PublicProfileRole,
  ReportMilestoneRow,
} from '../../../hooks/usePublicProfileData';
import { PublicSectionShell } from './shared/PublicSectionShell';
import { MetricTile } from './shared/MetricTile';
import { RoleBadgeChip } from './shared/RoleBadgeChip';
import { useI18n } from '../../../i18n/I18nContext';
import { ProfileForumSection } from '../ProfileForumSection';
import styles from './GraduateStudentPublicView.module.css';

export interface GraduateStudentPublicViewProps {
  data: PublicProfileData;
  displayName: string;
  showPrivacyFootnote: boolean;
}

type MilestoneStatusTone = 'muted' | 'positive' | 'attention' | 'rejected';

const milestoneStatusIcon = (
  status: string,
): React.ReactNode => {
  const v = status.toLowerCase();
  if (v === 'submitted' || v === 'on time') return <CheckCircle2 size={14} aria-hidden="true" />;
  if (v === 'waiting') return <Clock size={14} aria-hidden="true" />;
  if (v === 'rejected') return <XCircle size={14} aria-hidden="true" />;
  if (v === 'evaluated' || v === 'passed') return <CheckCircle2 size={14} aria-hidden="true" />;
  return <AlertCircle size={14} aria-hidden="true" />;
};

const milestoneStatusTone = (status: string): MilestoneStatusTone => {
  const v = status.toLowerCase();
  if (v === 'submitted' || v === 'on time') return 'positive';
  if (v === 'waiting') return 'muted';
  if (v === 'rejected') return 'rejected';
  if (v === 'evaluated' || v === 'passed') return 'positive';
  return 'muted';
};

const contributionMarkers = (
  milestoneCount: number,
  seminarsAttended: number,
  forumPosts: number,
): Array<{ label: string; count: number | null; tone: MilestoneStatusTone }> => {
  const list = [
    {
      label: 'Research Group Member',
      count: milestoneCount > 0 ? milestoneCount : null,
      tone: milestoneCount > 0 ? 'positive' : 'muted' as MilestoneStatusTone,
    },
    {
      label: 'Seminar Participant',
      count: seminarsAttended > 0 ? seminarsAttended : null,
      tone: seminarsAttended > 0 ? 'positive' : 'muted' as MilestoneStatusTone,
    },
    {
      label: 'Forum Contributor',
      count: forumPosts > 0 ? forumPosts : null,
      tone: forumPosts > 0 ? 'positive' : 'muted' as MilestoneStatusTone,
    },
  ];
  return list;
};

export const GraduateStudentPublicView = ({
  data,
  displayName,
  showPrivacyFootnote,
}: GraduateStudentPublicViewProps) => {
  const { t } = useI18n();
  const roleData = data.graduateStudent;
  const profile = data.profile;
  const milestones: ReportMilestoneRow[] = roleData?.reportMilestones ?? [];

  const milestonesWithPhase = useMemo(() => {
    if (!milestones.length) return [];
    return milestones.map((m, idx) => ({
      ...m,
      phaseLabel: m.phaseNumber != null ? String(m.phaseNumber) : String(idx + 1),
    }));
  }, [milestones]);

  const markers = contributionMarkers(
    roleData?.groups?.length ?? 0,
    roleData?.seminarsAttendedCount ?? 0,
    data.extras.forumPosts.length,
  );

  const primaryGroup = roleData?.primaryGroup;
  const researchKeywords = useMemo(() => {
    if (!Array.isArray(profile?.keywords) || profile.keywords.length === 0) return null;
    return profile.keywords;
  }, [profile?.keywords]);

  return (
    <div className={styles.view}>
      {/* ── Identity strip ─────────────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.eyebrow.gradStudent', 'ARS / RESEARCH JOURNEY LOG')}
        title={displayName}
        subtitle={
          profile?.academicTitle ??
          t('profile.publicView.gradStudent.subtitle', 'Graduate Student on ARS')
        }
        action={
          <RoleBadgeChip
            label={t('profile.publicView.gradStudent.chip', 'GRADUATE STUDENT')}
            hint={t('common.publicView', 'Public view')}
            data-testid="gradstudent-role-chip"
          />
        }
        data-testid="gradstudent-identity"
      >
        <div className={styles.identityGrid}>
          <div className={styles.identityItem}>
            <span className={styles.identityLabel}>
              {t('profile.publicView.gradStudent.primaryGroup', 'PRIMARY GROUP')}
            </span>
            <p className={styles.identityValue}>
              {primaryGroup ? (
                <span className={styles.groupName}>{primaryGroup.name}</span>
              ) : (
                <span className={styles.muted}>
                  {t('profile.publicView.gradStudent.noGroup', 'Not yet in a group')}
                </span>
              )}
            </p>
          </div>
          <div className={styles.identityItem}>
            <span className={styles.identityLabel}>
              {t('profile.publicView.gradStudent.joinedYear', 'JOINED YEAR')}
            </span>
            <p className={styles.identityValue}>
              {roleData?.joinedYear ?? '—'}
            </p>
          </div>
          {profile?.orcidId ? (
            <div className={styles.identityItem}>
              <span className={styles.identityLabel}>ORCID</span>
              <p className={styles.identityValue}>
                <code className={styles.orcidCode}>{profile.orcidId}</code>
              </p>
            </div>
          ) : null}
        </div>
      </PublicSectionShell>

      {/* ── Current research path ─────────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.path', 'CURRENT RESEARCH PATH')}
        title={t('profile.publicView.gradStudent.pathTitle', 'Research milestones')}
        subtitle={t(
          'profile.publicView.gradStudent.pathSubtitle',
          'Phases of the research journey drawn from submitted reports. Only scheduled and submitted phases appear.',
        )}
        data-testid="gradstudent-path"
      >
        {milestonesWithPhase.length === 0 ? (
          <p className={styles.empty}>
            {t(
              'profile.publicView.gradStudent.pathEmpty',
              'No research milestones scheduled yet. Your supervising lecturer will assign phases through the research group.',
            )}
          </p>
        ) : (
          <div className={styles.phaseStrip}>
            {milestonesWithPhase.map((m, idx) => {
              const tone = milestoneStatusTone(m.status);
              return (
                <div key={m.id} className={styles.phaseNode}>
                  <div className={styles.phaseConnector}>
                    {idx > 0 ? <div className={styles.phaseLine} aria-hidden="true" /> : null}
                    <div
                      className={`${styles.phaseDot} ${styles[`dot-${tone}`]}`}
                      title={m.status}
                    >
                      {milestoneStatusIcon(m.status)}
                    </div>
                    {idx < milestonesWithPhase.length - 1 ? (
                      <div className={styles.phaseLine} aria-hidden="true" />
                    ) : null}
                  </div>
                  <div className={styles.phaseCard}>
                    <span className={styles.phaseNumber}>Phase {m.phaseLabel}</span>
                    <span className={styles.phaseTitle}>{m.milestoneTitle ?? '—'}</span>
                    <span className={`${styles.phaseStatus} ${styles[`status-${tone}`]}`}>
                      {m.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PublicSectionShell>

      {/* ── Public activity card ────────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.activity', 'PUBLIC ACTIVITY')}
        title={t('profile.publicView.gradStudent.activityTitle', 'What is visible')}
        subtitle={t(
          'profile.publicView.gradStudent.activitySubtitle',
          'Only publicly declared affiliations and verified activities are shown.',
        )}
        data-testid="gradstudent-activity"
      >
        <div className={styles.activityGrid}>
          <div className={styles.activityItem}>
            <span className={styles.activityLabel}>
              {t('profile.publicView.gradStudent.researchGroup', 'RESEARCH GROUP')}
            </span>
            <p className={styles.activityValue}>
              {primaryGroup ? (
                <span className={styles.groupName}>
                  <Users2 size={14} aria-hidden="true" />
                  {primaryGroup.name}
                </span>
              ) : (
                <span className={styles.muted}>
                  {t('profile.publicView.gradStudent.noGroup', 'Not in a group yet')}
                </span>
              )}
            </p>
          </div>
          <div className={styles.activityItem}>
            <span className={styles.activityLabel}>
              {t('profile.publicView.metric.seminarsAttended', 'SEMINARS ATTENDED')}
            </span>
            <p className={styles.activityValue}>
              {roleData?.seminarsAttendedCount != null && roleData.seminarsAttendedCount > 0 ? (
                <span>
                  <BookOpen size={14} aria-hidden="true" />
                  {t('profile.publicView.gradStudent.seminarsCount', '{n} verified activities', {
                    n: roleData.seminarsAttendedCount,
                  })}
                </span>
              ) : (
                <span className={styles.muted}>—</span>
              )}
            </p>
          </div>
          {researchKeywords && researchKeywords.length > 0 ? (
            <div className={`${styles.activityItem} ${styles.activityFull}`}>
              <span className={styles.activityLabel}>
                {t('profile.publicView.gradStudent.interests', 'RESEARCH INTERESTS')}
              </span>
              <ul className={styles.chips} aria-label={t('profile.publicView.gradStudent.interests', 'Research interests')}>
                {researchKeywords.map((kw: string) => (
                  <li key={kw} className={styles.chip}>{kw}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </PublicSectionShell>

      {/* ── Contribution markers ──────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.contribution', 'CONTRIBUTION MARKERS')}
        title={t('profile.publicView.gradStudent.markersTitle', 'Activity on ARS')}
        subtitle={t(
          'profile.publicView.gradStudent.markersSubtitle',
          'Verified participation markers earned through activity on the platform.',
        )}
        data-testid="gradstudent-markers"
      >
        <ul className={styles.markerList}>
          {markers.map((marker) => (
            <li
              key={marker.label}
              className={`${styles.marker} ${styles[`marker-${marker.tone}`]}`}
            >
              <span className={styles.markerDot} aria-hidden="true" />
              <span className={styles.markerLabel}>{marker.label}</span>
              {marker.count != null ? (
                <span className={styles.markerCount}>
                  [{String(marker.count).padStart(2, '0')}]
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </PublicSectionShell>

      {/* ── Academic snapshot ─────────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.snapshot', 'ACADEMIC SNAPSHOT')}
        title={t('profile.publicView.gradStudent.snapshotTitle', 'Platform record')}
        data-testid="gradstudent-snapshot"
      >
        <div className={styles.metricsRow}>
          <MetricTile
            label={t('profile.publicView.metric.joinedYear', 'JOINED YEAR')}
            value={roleData?.joinedYear ?? '—'}
            caption={t('profile.publicView.gradStudent.joinedCaption', 'Year joined ARS.')}
            data-testid="gradstudent-metric-joined"
          />
          <MetricTile
            label={t('profile.publicView.metric.reportsSubmitted', 'REPORTS SUBMITTED')}
            value={roleData?.reportsSubmittedCount ?? 0}
            caption={t(
              'profile.publicView.gradStudent.reportsCaption',
              'Reports submitted to the supervising lecturer.',
            )}
            data-testid="gradstudent-metric-reports"
          />
          <MetricTile
            label={t('profile.publicView.metric.seminarsAttended', 'SEMINARS ATTENDED')}
            value={roleData?.seminarsAttendedCount ?? 0}
            caption={t(
              'profile.publicView.gradStudent.seminarsCaption',
              'Verified seminar participations.',
            )}
            data-testid="gradstudent-metric-seminars"
          />
        </div>
      </PublicSectionShell>

      {/* ── Forum activity (re-uses existing section) ─── */}
      {data.extras.forumPosts.length > 0 ? (
        <ProfileForumSection
          posts={data.extras.forumPosts}
          isLoading={false}
          error={null}
          isOwner={false}
        />
      ) : null}

      {/* ── Privacy footnote ────────────────────────────────── */}
      {showPrivacyFootnote ? (
        <p className={styles.privacy} role="note">
          <ShieldCheck size={14} aria-hidden="true" />
          {t(
            'profile.publicView.privacy.gradStudent',
            'Draft reports, supervisor feedback, grades, private milestones, and group details remain private by default.',
          )}
        </p>
      ) : null}
    </div>
  );
};

export const GRADUATE_STUDENT_PUBLIC_VIEW_ROLE: PublicProfileRole = 'Graduate Student';

export default GraduateStudentPublicView;
