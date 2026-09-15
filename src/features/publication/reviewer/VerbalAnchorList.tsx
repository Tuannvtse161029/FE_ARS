/**
 * VerbalAnchorList — vertical 10-row list of score/verbal-anchor pairs.
 *
 * Replaces the prior inline string format ("1 — Major flaws · 2 — ..."),
 * which was hard to read. Now each score has its own row so the reviewer
 * can quickly match the selected score to its descriptor without squinting.
 *
 *   1 — Major flaws
 *   2 — Significant issues
 *   3 — Below average
 *   …
 *   10 — Exemplary
 *
 * The currently-selected score (when known) is highlighted so reviewers
 * can verify their pick at a glance.
 */
import { useT } from '../../../i18n/I18nContext';
import reviewer from './reviewer.module.css';

export interface VerbalAnchorListProps {
  /** Min/max score range (typically 1..10, or 1..max for specialized rubrics). */
  min: number;
  max: number;
  /** Currently selected score — used to highlight the matching row. */
  selectedScore?: number | null | undefined;
  /** Optional i18n key prefix for both the value label and the descriptor.
   *  Defaults to `reviewer.detail.criterion.scaleAnchors` (1-10 anchors). */
  i18nPrefix?: string;
  /** Optional i18n key prefix for the "Score" column header. */
  legendLabelKey?: string;
}

export const VerbalAnchorList = ({
  min,
  max,
  selectedScore,
  i18nPrefix = 'reviewer.detail.criterion.scaleAnchors',
  legendLabelKey = 'reviewer.detail.criterion.score',
}: VerbalAnchorListProps) => {
  const t = useT();
  const scores: number[] = [];
  for (let v = min; v <= max; v += 1) scores.push(v);

  return (
    <ul className={reviewer.criterionAnchorList} aria-label={t(legendLabelKey, 'Verbal anchor')}>
      {scores.map((value) => {
        const isActive = typeof selectedScore === 'number' && selectedScore === value;
        return (
          <li
            key={value}
            className={`${reviewer.criterionAnchorItem} ${isActive ? reviewer.criterionAnchorItemActive : ''}`}
            aria-current={isActive ? 'true' : undefined}
          >
            <span className={reviewer.criterionAnchorValue}>{value}</span>
            <span className={reviewer.criterionAnchorDash} aria-hidden>—</span>
            <span className={reviewer.criterionAnchorLabel}>
              {t(`${i18nPrefix}.${value}`, String(value))}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default VerbalAnchorList;
