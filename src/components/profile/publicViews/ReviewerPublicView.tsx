/**
 * ReviewerPublicView — forest-green "Trust ledger" for Reviewer profiles.
 *
 * Information architecture (top → bottom):
 *   1. Reviewer identity strip (role badge, verified chip, ORCID, availability)
 *   2. Reviewer contribution section (H-Index / Citations / Publications)
 *   3. Expertise area chips (Major / Subfield / Keywords)
 *   4. Publication stream (year→count bars)
 *   5. Forum activity strip (uses ProfileForumSection when present)
 *   6. Privacy footnote (visitors only)
 */
import { useMemo } from 'react';
import { ShieldCheck, BookOpenCheck, CalendarCheck2, UserCheck, BadgeCheck } from 'lucide-react';
import type { PublicProfileData, PublicProfileRole } from '../../../hooks/usePublicProfileData';
import { PublicSectionShell } from './shared/PublicSectionShell';
import { MetricTile } from './shared/MetricTile';
import { BarStreamChart } from './shared/BarStreamChart';
import { RoleBadgeChip } from './shared/RoleBadgeChip';
import { useI18n } from '../../../i18n/I18nContext';
import { ProfilePublicationsSection } from '../ProfilePublicationsSection';
import { ProfileForumSection } from '../ProfileForumSection';
import styles from './ReviewerPublicView.module.css';

export interface ReviewerPublicViewProps {
  data: PublicProfileData;
  displayName: string;
  showPrivacyFootnote: boolean;
}

export const ReviewerPublicView = ({
  data,
  displayName,
  showPrivacyFootnote,
}: ReviewerPublicViewProps) => {
  const { t } = useI18n();
  const roleData = data.reviewer;
  const profile = data.profile;
  const expertiseChips = useMemo(() => {
    const list: string[] = [];
    if (roleData?.majorFieldName) list.push(roleData.majorFieldName);
    if (roleData?.subFieldName) list.push(roleData.subFieldName);
    if (Array.isArray(profile?.keywords)) list.push(...(profile.keywords ?? []));
    // Dedupe + trim empties
    return Array.from(
      new Set(list.map((c) => (typeof c === 'string' ? c.trim() : '')).filter(Boolean)),
    );
  }, [roleData?.majorFieldName, roleData?.subFieldName, profile?.keywords]);

  const availabilityLabel = useMemo(() => {
    if (roleData?.isAvailable === true) return t('profile.publicView.reviewer.available', 'Accepting reviews');
    if (roleData?.isAvailable === false) return t('profile.publicView.reviewer.unavailable', 'Paused');
    return t('profile.publicView.reviewer.availabilityUnknown', 'Status not set');
  }, [roleData?.isAvailable, t]);

  const availabilityTone =
    roleData?.isAvailable === true
      ? 'positive'
      : roleData?.isAvailable === false
        ? 'attention'
        : 'muted';

  return (
    <div className={styles.view}>
      {/* ── Identity strip ─────────────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.eyebrow.reviewer', 'ARS / PUBLIC PROFILE — REVIEWER')}
        title={displayName}
        subtitle={t(
          'profile.publicView.reviewer.subtitle',
          'Public academic presence for peer review on the ARS platform.',
        )}
        action={
          <RoleBadgeChip
            label={t('profile.publicView.reviewer.chip', 'VERIFIED REVIEWER')}
            hint={t('common.publicView', 'Public view')}
            data-testid="reviewer-role-chip"
          />
        }
        data-testid="reviewer-identity"
      >
        <div className={styles.identityGrid}>
          <div className={styles.identityItem}>
            <span className={styles.identityLabel}>
              {t('profile.publicView.reviewer.orcid', 'ORCID')}
            </span>
            <p className={styles.identityValue}>
              {profile?.orcidId ? (
                <span className={styles.orcid}>
                  <BadgeCheck size={14} aria-hidden="true" />
                  <code>{profile.orcidId}</code>
                </span>
              ) : (
                <span className={styles.muted}>—</span>
              )}
            </p>
          </div>
          <div className={styles.identityItem}>
            <span className={styles.identityLabel}>
              {t('profile.publicView.reviewer.availability', 'AVAILABILITY')}
            </span>
            <p className={styles.identityValue}>
              <span className={`${styles.availabilityPill} ${styles[`tone-${availabilityTone}`]}`}>
                <UserCheck size={14} aria-hidden="true" />
                {availabilityLabel}
              </span>
            </p>
          </div>
          <div className={styles.identityItem}>
            <span className={styles.identityLabel}>
              {t('profile.publicView.reviewer.activeSince', 'ACTIVE SINCE')}
            </span>
            <p className={styles.identityValue}>
              {data.joinedYear ?? (
                <span className={styles.muted}>
                  {t('profile.publicView.notAvailable', 'Not available')}
                </span>
              )}
            </p>
          </div>
        </div>
      </PublicSectionShell>

      {/* ── Reviewer contribution ──────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.contribution', 'REVIEWER CONTRIBUTION')}
        title={t('profile.publicView.reviewer.contributionTitle', 'Verified academic signal')}
        subtitle={t(
          'profile.publicView.reviewer.contributionSubtitle',
          'Metrics shown here are managed by the editorial Admin team and sourced from the BE /api/ProfessionalProfile endpoint.',
        )}
        data-testid="reviewer-contribution"
      >
        <div className={styles.metricsRow}>
          <MetricTile
            label={t('profile.publicView.metric.hindex', 'H-INDEX')}
            value={roleData?.hindex ?? '—'}
            caption={t(
              'profile.publicView.reviewer.hindexCaption',
              'Author-level citation impact.',
            )}
            icon={<BookOpenCheck size={18} aria-hidden="true" />}
            data-testid="reviewer-metric-hindex"
          />
          <MetricTile
            label={t('profile.publicView.metric.citations', 'CITATIONS')}
            value={
              typeof roleData?.totalCitations === 'number'
                ? roleData.totalCitations.toLocaleString()
                : '—'
            }
            caption={t(
              'profile.publicView.reviewer.citationsCaption',
              'Total citations across the catalog.',
            )}
            icon={<ShieldCheck size={18} aria-hidden="true" />}
            data-testid="reviewer-metric-citations"
          />
          <MetricTile
            label={t('profile.publicView.metric.publicationCount', 'PUBLICATIONS')}
            value={roleData?.publicationCount ?? '—'}
            caption={t(
              'profile.publicView.reviewer.publicationsCaption',
              'Published papers on ARS.',
            )}
            icon={<CalendarCheck2 size={18} aria-hidden="true" />}
            data-testid="reviewer-metric-publications"
          />
        </div>
      </PublicSectionShell>

      {/* ── Expertise areas ───────────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.expertise', 'EXPERTISE AREAS')}
        title={t('profile.publicView.reviewer.expertiseTitle', 'Matching reviewers with papers')}
        subtitle={t(
          'profile.publicView.reviewer.expertiseSubtitle',
          'Tags surface this reviewer in the Admin queue when matching manuscripts to expertise.',
        )}
        data-testid="reviewer-expertise"
      >
        {expertiseChips.length === 0 ? (
          <p className={styles.empty}>
            {t(
              'profile.publicView.reviewer.expertiseEmpty',
              'No expertise tags set yet. Update your Professional Profile to surface relevant papers.',
            )}
          </p>
        ) : (
          <ul className={styles.chips} aria-label={t('profile.publicView.section.expertise', 'Expertise areas')}>
            {expertiseChips.map((chip) => (
              <li key={chip} className={styles.chip}>
                {chip}
              </li>
            ))}
          </ul>
        )}
      </PublicSectionShell>

      {/* ── Contribution stream ────────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.stream', 'CONTRIBUTION HISTORY')}
        title={t('profile.publicView.reviewer.streamTitle', 'Published papers by year')}
        subtitle={t(
          'profile.publicView.reviewer.streamSubtitle',
          'Counts published papers surfaced via /api/Paper. Past years carry the highest signal.',
        )}
        data-testid="reviewer-stream"
      >
        <BarStreamChart
          data={roleData?.yearStream ?? []}
          empty={!roleData?.yearStream?.length}
          emptyLabel={t('profile.publicView.reviewer.streamEmpty', 'No publication years on record yet.')}
          data-testid="reviewer-year-stream"
        />
      </PublicSectionShell>

      {/* ── Publications detail list (re-uses existing section) ─── */}
      {data.extras.publications.length > 0 ? (
        <ProfilePublicationsSection
          publications={data.extras.publications}
          isLoading={false}
          error={null}
          isOwner={false}
        />
      ) : null}

      {/* ── Forum activity (re-uses existing section when available) ─── */}
      {data.extras.forumPosts.length > 0 ? (
        <ProfileForumSection
          posts={data.extras.forumPosts}
          isLoading={false}
          error={null}
          isOwner={false}
        />
      ) : null}

      {/* ── Privacy footnote ────────────────────────────────────── */}
      {showPrivacyFootnote ? (
        <p className={styles.privacy} role="note">
          <ShieldCheck size={14} aria-hidden="true" />
          {t(
            'profile.publicView.privacy.reviewer',
            'Manuscript titles, authors, comments, and recommendations are never displayed on this public record.',
          )}
        </p>
      ) : null}
    </div>
  );
};

// Type marker so parent dispatch can match role — keeps the relationship
// between role name and component local.
export const REVIEWER_PUBLIC_VIEW_ROLE: PublicProfileRole = 'Reviewer';

export default ReviewerPublicView;
