/**
 * RecognitionAct — landing-page section showcasing the four-tier
 * medal ladder (Bronze / Silver / Gold / Platinum) so visitors
 * understand that their work on the platform is recognized.
 *
 * Implementation notes:
 *
 * - This is a *static showcase*. It renders the existing medal SVG
 *   assets from `src/assets/badges/library/` rather than fetching
 *   live data from `medal.service.ts` — the badge SVGs are the
 *   single source of truth for what each tier looks like, and a
 *   live fetch would risk showing stale or empty data on first
 *   paint (no /api/medals call from anonymous visitors yet).
 *
 * - The actual medal system already exists for authenticated users:
 *   `src/components/medals/UserFlairBadge.tsx` renders inline
 *   badges next to author names in forum posts, and
 *   `src/features/admin/AdminMedals.tsx` is the admin catalog.
 *   This component is the marketing surface for that system — it
 *   tells the visitor "your work earns recognition" without
 *   overpromising live data they would not see.
 *
 * - Tier criterion copy is intentionally qualitative ("first
 *   milestone", "sustained contribution") rather than numeric
 *   thresholds because the actual thresholds are admin-configurable
 *   per medal and per tier (see `medal.service.ts` TierConfiguration).
 *   Hard-coding "3 papers" or "10 seminars" here would mislead
 *   visitors about what the platform actually rewards.
 *
 * - The section uses the same `useReveal` pattern as
 *   `.boundariesSection` / `.faqSection` / `.testimonialSection`:
 *   the CSS hides the section with `opacity: 0; translateY(24px)`
 *   until the IntersectionObserver fires, then adds the
 *   `.revealed` class to fade the section in. The observer check
 *   in `useReveal` short-circuits if the element is already on
 *   screen when the component mounts, so the section never stays
 *   invisible because the observer attached too late.
 *
 * i18n: the title, kicker, lead, and four (tierTitle, tierCriterion)
 * pairs all flow through the existing dictionary. See
 * `src/i18n/dictionaries/{en,vi}.ts` keys prefixed
 * `landing.recognition*`.
 */

import React from 'react';
import bronzeMedal from '../../assets/badges/library/medal-bronze.svg';
import silverMedal from '../../assets/badges/library/medal-silver.svg';
import goldMedal from '../../assets/badges/library/medal-gold.svg';
import platinumMedal from '../../assets/badges/library/medal-platinum.svg';
import { useT } from '../../i18n/I18nContext';
import { useReveal } from '../../hooks/useReveal';
import styles from './RecognitionAct.module.css';

interface TierSpec {
  /** Inline-imported SVG asset for the tier's medal artwork. */
  asset: string;
  /** i18n key for the tier title (e.g. `landing.recognitionTierGoldTitle`). */
  titleKey: string;
  /** i18n key for the tier criterion (e.g. `landing.recognitionTierGoldCriterion`). */
  criterionKey: string;
  /** Tier-specific fallback when the dictionary key is missing. */
  titleFallback: string;
  criterionFallback: string;
}

const TIERS: readonly TierSpec[] = [
  {
    asset: bronzeMedal,
    titleKey: 'landing.recognitionTierBronzeTitle',
    criterionKey: 'landing.recognitionTierBronzeCriterion',
    titleFallback: 'Bronze',
    criterionFallback:
      'First milestone — your first publication, review, or hosted seminar.',
  },
  {
    asset: silverMedal,
    titleKey: 'landing.recognitionTierSilverTitle',
    criterionKey: 'landing.recognitionTierSilverCriterion',
    titleFallback: 'Silver',
    criterionFallback:
      'Sustained contribution — multiple publications, reviews, or seminars.',
  },
  {
    asset: goldMedal,
    titleKey: 'landing.recognitionTierGoldTitle',
    criterionKey: 'landing.recognitionTierGoldCriterion',
    titleFallback: 'Gold',
    criterionFallback:
      'Established presence — recognized peer activity across the platform.',
  },
  {
    asset: platinumMedal,
    titleKey: 'landing.recognitionTierPlatinumTitle',
    criterionKey: 'landing.recognitionTierPlatinumCriterion',
    titleFallback: 'Platinum',
    criterionFallback:
      'Outstanding contributor — a standard for the community to follow.',
  },
] as const;

export const RecognitionAct: React.FC = () => {
  const t = useT();
  // useReveal returns `{ ref, seen }`; the ref attaches to the section
  // root and `seen` becomes true when the section enters the viewport
  // (or is already on screen at mount). The CSS class flips from the
  // hidden state (`opacity: 0; translateY(24px)`) to the visible state
  // the moment `seen` is true.
  const { ref, seen } = useReveal<HTMLElement>(0.15);

  return (
    <section
      ref={ref}
      id="recognition"
      className={`${styles.act}${seen ? ` ${styles.revealed}` : ''}`}
      aria-labelledby="recognition-title"
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.kicker}>
            {t('landing.recognitionKicker', 'Recognition')}
          </p>
          <h2 id="recognition-title" className={styles.title}>
            {t(
              'landing.recognitionHeading',
              'Your work earns recognition on the platform.',
            )}
          </h2>
          <p className={styles.lead}>
            {t(
              'landing.recognitionLead',
              'Every submission, review, and seminar moves you up a tier — from Bronze to Platinum.',
            )}
          </p>
        </header>

        <ol className={styles.tiers}>
          {TIERS.map((tier) => (
            <li key={tier.titleKey} className={styles.tier}>
              <img
                src={tier.asset}
                alt=""
                aria-hidden="true"
                className={styles.medal}
                width={96}
                height={96}
                loading="lazy"
                decoding="async"
              />
              <h3 className={styles.tierTitle}>
                {t(tier.titleKey, tier.titleFallback)}
              </h3>
              <p className={styles.tierCriterion}>
                {t(tier.criterionKey, tier.criterionFallback)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default RecognitionAct;
