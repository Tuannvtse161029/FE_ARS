/**
 * ResearcherPublicView — amber ochre "Publication Index" for Researcher
 * profiles. The visual centerpiece is the publication register table — a
 * true table (not a card list) with columns ID / YEAR / TYPE / TITLE / STATUS.
 *
 * Architecture (top → bottom):
 *   1. Researcher identity strip (role badge, ORCID, joined year)
 *   2. Research record tiles (H-Index / Citations / Publications / Active since)
 *   3. Publication register table (real <table>, not a card list)
 *   4. Publication stream chart (year→count)
 *   5. Research areas chips (Major / Subfield / Keywords)
 *   6. Forum activity
 *   7. Privacy footnote
 */
import { useMemo } from 'react';
import { ShieldCheck, Library, Quote, CalendarClock, BookOpenText } from 'lucide-react';
import type {
  PublicProfileData,
  PublicProfileRole,
  PublicationRow,
} from '../../../hooks/usePublicProfileData';
import { PublicSectionShell } from './shared/PublicSectionShell';
import { MetricTile } from './shared/MetricTile';
import { BarStreamChart } from './shared/BarStreamChart';
import { RoleBadgeChip } from './shared/RoleBadgeChip';
import { useI18n } from '../../../i18n/I18nContext';
import { ProfilePublicationsSection } from '../ProfilePublicationsSection';
import { ProfileForumSection } from '../ProfileForumSection';
import styles from './ResearcherPublicView.module.css';

export interface ResearcherPublicViewProps {
  data: PublicProfileData;
  displayName: string;
  showPrivacyFootnote: boolean;
}

const formatYear = (year: number | null): string => (year == null ? '—' : String(year));

const formatTitle = (row: PublicationRow): string =>
  row.title.length > 80 ? `${row.title.slice(0, 77)}…` : row.title;

const publicationTypeChipLabel = (
  type: string,
  t: (key: string, fallback: string) => string,
): string => {
  const v = type.toLowerCase();
  if (v.includes('journal')) return t('profile.publicView.researcher.typeJournal', 'Journal');
  if (v.includes('conference')) return t('profile.publicView.researcher.typeConference', 'Conference');
  return t('profile.publicView.researcher.typeArticle', 'Article');
};

export const ResearcherPublicView = ({
  data,
  displayName,
  showPrivacyFootnote,
}: ResearcherPublicViewProps) => {
  const { t } = useI18n();
  const roleData = data.researcher;
  const profile = data.profile;

  const researchAreaChips = useMemo(() => {
    const list: string[] = [];
    if (roleData?.majorFieldName) list.push(roleData.majorFieldName);
    if (roleData?.subFieldName) list.push(roleData.subFieldName);
    if (Array.isArray(profile?.keywords)) list.push(...(profile.keywords ?? []));
    return Array.from(
      new Set(list.map((c) => (typeof c === 'string' ? c.trim() : '')).filter(Boolean)),
    );
  }, [roleData?.majorFieldName, roleData?.subFieldName, profile?.keywords]);

  const publicationRows = roleData?.publications ?? [];

  return (
    <div className={styles.view}>
      {/* ── Identity strip ───────────────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.eyebrow.researcher', 'ARS / PUBLIC RESEARCH INDEX')}
        title={displayName}
        subtitle={profile?.academicTitle ?? t('profile.publicView.researcher.subtitle', 'Researcher on ARS')}
        action={
          <RoleBadgeChip
            label={t('profile.publicView.researcher.chip', 'VERIFIED RESEARCHER')}
            hint={t('common.publicView', 'Public view')}
            data-testid="researcher-role-chip"
          />
        }
        data-testid="researcher-identity"
      >
        <div className={styles.identityGrid}>
          <div className={styles.identityItem}>
            <span className={styles.identityLabel}>
              {t('profile.publicView.reviewer.orcid', 'ORCID')}
            </span>
            <p className={styles.identityValue}>
              {profile?.orcidId ? (
                <span className={styles.orcid}>
                  <ShieldCheck size={14} aria-hidden="true" />
                  <code>{profile.orcidId}</code>
                </span>
              ) : (
                <span className={styles.muted}>—</span>
              )}
            </p>
          </div>
          <div className={styles.identityItem}>
            <span className={styles.identityLabel}>
              {t('profile.publicView.researcher.institution', 'INSTITUTION')}
            </span>
            <p className={styles.identityValue}>{profile?.institution ?? '—'}</p>
          </div>
          <div className={styles.identityItem}>
            <span className={styles.identityLabel}>
              {t('profile.publicView.reviewer.activeSince', 'ACTIVE SINCE')}
            </span>
            <p className={styles.identityValue}>{roleData?.activeSinceYear ?? '—'}</p>
          </div>
        </div>
      </PublicSectionShell>

      {/* ── Research record tiles ────────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.contribution', 'RESEARCH RECORD')}
        title={t('profile.publicView.researcher.recordTitle', 'Verified research metrics')}
        subtitle={t(
          'profile.publicView.researcher.recordSubtitle',
          'Metrics shown here are managed by the editorial Admin team via /api/ProfessionalProfile.',
        )}
        data-testid="researcher-record"
      >
        <div className={styles.metricsRow}>
          <MetricTile
            label={t('profile.publicView.metric.publishedPapers', 'PUBLISHED PAPERS')}
            value={roleData?.publicationCount ?? '—'}
            caption={t(
              'profile.publicView.researcher.publishedPapersCaption',
              'Total papers on the ARS catalog.',
            )}
            icon={<Library size={18} aria-hidden="true" />}
            data-testid="researcher-metric-publications"
          />
          <MetricTile
            label={t('profile.publicView.metric.hindex', 'H-INDEX')}
            value={roleData?.hindex ?? '—'}
            caption={t('profile.publicView.reviewer.hindexCaption', 'Author-level citation impact.')}
            icon={<BookOpenText size={18} aria-hidden="true" />}
            data-testid="researcher-metric-hindex"
          />
          <MetricTile
            label={t('profile.publicView.metric.citations', 'CITATIONS')}
            value={
              typeof roleData?.totalCitations === 'number'
                ? roleData.totalCitations.toLocaleString()
                : '—'
            }
            caption={t(
              'profile.publicView.researcher.citationsFootnote',
              'Display only when sourced from an approved external integration.',
            )}
            icon={<Quote size={18} aria-hidden="true" />}
            data-testid="researcher-metric-citations"
          />
          <MetricTile
            label={t('profile.publicView.metric.activeSince', 'ACTIVE SINCE')}
            value={roleData?.activeSinceYear ?? '—'}
            caption={t(
              'profile.publicView.researcher.activeSinceCaption',
              'Year the researcher joined ARS.',
            )}
            icon={<CalendarClock size={18} aria-hidden="true" />}
            data-testid="researcher-metric-active-since"
          />
        </div>
      </PublicSectionShell>

      {/* ── Publication register table ────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.publicationRegister', 'PUBLICATION REGISTER')}
        title={t('profile.publicView.researcher.registerTitle', 'Recent publications')}
        subtitle={t(
          'profile.publicView.researcher.registerSubtitle',
          'Published papers drawn from /api/Paper, filtered by authorId. The full research catalog is browsable from the home page.',
        )}
        data-testid="researcher-register"
      >
        {publicationRows.length === 0 ? (
          <p className={styles.empty}>
            {t(
              'profile.publicView.researcher.registerEmpty',
              'No published papers on record yet for this researcher.',
            )}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.registerTable}>
              <thead>
                <tr>
                  <th scope="col" className={styles.colId}>
                    {t('profile.publicView.table.column.id', 'ID')}
                  </th>
                  <th scope="col" className={styles.colYear}>
                    {t('profile.publicView.table.column.year', 'YEAR')}
                  </th>
                  <th scope="col" className={styles.colType}>
                    {t('profile.publicView.table.column.type', 'TYPE')}
                  </th>
                  <th scope="col" className={styles.colTitle}>
                    {t('profile.publicView.table.column.title', 'TITLE')}
                  </th>
                  <th scope="col" className={styles.colStatus}>
                    {t('profile.publicView.table.column.status', 'STATUS')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {publicationRows.map((row: PublicationRow) => (
                  <tr key={row.id}>
                    <td className={styles.colId}>
                      <code className={styles.idCode}>#{String(row.id).padStart(3, '0')}</code>
                    </td>
                    <td className={styles.colYear}>{formatYear(row.year)}</td>
                    <td className={styles.colType}>
                      <span className={styles.typeChip}>
                        {publicationTypeChipLabel(row.type, t)}
                      </span>
                    </td>
                    <td className={styles.colTitle}>{formatTitle(row)}</td>
                    <td className={styles.colStatus}>
                      <span className={`${styles.statusPill} ${styles[`status-${row.status.toLowerCase()}`] ?? ''}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PublicSectionShell>

      {/* ── Publication stream chart ─────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.stream', 'PUBLICATION STREAM')}
        title={t('profile.publicView.researcher.streamTitle', 'Publications by year')}
        subtitle={t(
          'profile.publicView.researcher.streamSubtitle',
          'Counts published papers across each calendar year. Counts only.',
        )}
        data-testid="researcher-stream"
      >
        <BarStreamChart
          data={roleData?.yearStream ?? []}
          empty={!roleData?.yearStream?.length}
          emptyLabel={t('profile.publicView.reviewer.streamEmpty', 'No publication years on record yet.')}
          data-testid="researcher-year-stream"
        />
      </PublicSectionShell>

      {/* ── Research areas chips ────────────────────────────── */}
      <PublicSectionShell
        eyebrow={t('profile.publicView.section.expertise', 'RESEARCH AREAS')}
        title={t('profile.publicView.researcher.areasTitle', 'Where to place this work')}
        subtitle={t(
          'profile.publicView.researcher.areasSubtitle',
          'Major field, subfield, and keyword tags help the catalog match this researcher to readers.',
        )}
        data-testid="researcher-areas"
      >
        {researchAreaChips.length === 0 ? (
          <p className={styles.empty}>
            {t(
              'profile.publicView.researcher.areasEmpty',
              'No research area tags set yet. Add them on the Professional Profile page.',
            )}
          </p>
        ) : (
          <ul className={styles.chips} aria-label={t('profile.publicView.section.expertise', 'Research areas')}>
            {researchAreaChips.map((chip) => (
              <li key={chip} className={styles.chip}>
                {chip}
              </li>
            ))}
          </ul>
        )}
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

      {/* ── Privacy footnote ────────────────────────────────── */}
      {showPrivacyFootnote ? (
        <p className={styles.privacy} role="note">
          <ShieldCheck size={14} aria-hidden="true" />
          {t(
            'profile.publicView.privacy.researcher',
            'Drafts, private reviews, and rejected submissions stay private.',
          )}
        </p>
      ) : null}
    </div>
  );
};

export const RESEARCHER_PUBLIC_VIEW_ROLE: PublicProfileRole = 'Researcher';

export default ResearcherPublicView;
