import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Check,
  Clock,
  Crown,
  Info,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes/paths';
import {
  FREE_TIER_FEATURES,
  resolvePremiumPreviewConfig,
} from './previewConfig';
import styles from './PremiumPackagesPreview.module.css';

const formatRoleLabel = (role: string): string => role;

const PremiumPackagesPreview = (): JSX.Element => {
  const { user } = useAuth();
  const activeRole = user?.role ?? null;

  const previewConfig = useMemo(
    () => resolvePremiumPreviewConfig(activeRole),
    [activeRole],
  );

  const roleLabel = activeRole ? formatRoleLabel(activeRole) : 'Your account';

  return (
    <section className={styles.page} aria-labelledby="premium-package-heading">
      <header className={styles.pageHeader}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link to={ROUTES.FORUM}>Home</Link>
          <span aria-hidden="true">›</span>
          <span className={styles.breadcrumbCurrent}>Premium Package</span>
        </nav>

        <div className={styles.headerRow}>
          <h1 id="premium-package-heading" className={styles.title}>
            <span aria-hidden="true" className={styles.titleIcon}>
              <Crown size={22} />
            </span>
            Premium Package
          </h1>
          <span
            className={styles.previewBadge}
            data-testid="preview-badge"
            aria-label="Preview badge"
          >
            <Sparkles size={14} aria-hidden="true" />
            Coming soon
          </span>
        </div>

        <p className={styles.subtitle}>{previewConfig.description}</p>
      </header>

      <div
        className={styles.currentPlanCard}
        data-testid="current-plan-summary"
        aria-label="Current plan summary"
      >
        <div>
          <p className={styles.currentPlanLabel}>Currently available tier</p>
          <p className={styles.currentPlanValue}>Free Tier</p>
          <p className={styles.currentPlanRole}>
            Showing preview for: <strong>{roleLabel}</strong>
          </p>
        </div>
        <span className={styles.currentPlanMeta}>
          <BadgeCheck size={16} aria-hidden="true" />
          Active
        </span>
      </div>

      <div className={styles.planGrid}>
        <article
          className={styles.planCard}
          data-testid="free-tier-card"
          aria-labelledby="free-tier-heading"
        >
          <header className={styles.planHeader}>
            <div>
              <h2 id="free-tier-heading" className={styles.planTitle}>
                Free Tier
              </h2>
              <p className={styles.planSubtitle}>
                Everything you need to participate in the research community.
              </p>
            </div>
            <span
              className={`${styles.planStatusBadge} ${styles.planStatusFree}`}
              data-testid="free-tier-status"
              aria-label="Free tier status"
            >
              Currently available
            </span>
          </header>

          <div className={styles.pricingRow}>
            <span className={styles.pricingAmount}>Free</span>
            <span className={styles.pricingCycle}>No subscription</span>
          </div>

          <ul className={styles.featureList} data-testid="free-tier-features">
            {FREE_TIER_FEATURES.map((feature) => (
              <li key={feature.id} className={styles.featureItem}>
                <span
                  className={`${styles.featureIcon} ${styles.featureIconAvailable}`}
                  aria-hidden="true"
                >
                  <Check size={18} />
                </span>
                <span className={styles.featureBody}>
                  <span className={styles.featureTitle}>{feature.title}</span>
                  <span className={styles.featureDescription}>
                    {feature.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className={styles.upgradeControl}>
            <button
              type="button"
              className={styles.upgradeButton}
              disabled
              aria-disabled="true"
              data-testid="free-tier-cta"
            >
              <BadgeCheck size={16} aria-hidden="true" />
              You're on Free Tier
            </button>
            <p className={styles.upgradeHelp}>Your current plan.</p>
          </div>
        </article>

        <article
          className={`${styles.planCard} ${styles.planCardPremium}`}
          data-testid="premium-preview-card"
          aria-labelledby="premium-preview-heading"
        >
          <header className={styles.planHeader}>
            <div>
              <h2
                id="premium-preview-heading"
                className={styles.planTitle}
                data-testid="premium-preview-heading"
              >
                {previewConfig.heading}
              </h2>
              <p className={styles.planSubtitle}>
                Planned capabilities for the {roleLabel.toLowerCase()} role.
              </p>
            </div>
            <span
              className={`${styles.planStatusBadge} ${styles.planStatusPremium}`}
              data-testid="premium-preview-status"
              aria-label="Premium preview status"
            >
              Coming soon
            </span>
          </header>

          <div className={styles.pricingRow}>
            <span className={styles.pricingAmount}>—</span>
            <span className={styles.pricingCycle}>Pricing to be announced</span>
          </div>
          <p className={styles.pricingNotice}>
            Premium subscriptions and billing are not connected yet.
          </p>

          <ul
            className={styles.featureList}
            data-testid="premium-preview-features"
          >
            {previewConfig.features.map((feature) => (
              <li key={feature.id} className={styles.featureItem}>
                <span
                  className={`${styles.featureIcon} ${styles.featureIconLocked}`}
                  aria-hidden="true"
                >
                  <Lock size={18} />
                </span>
                <span className={styles.featureBody}>
                  <span className={styles.featureTitle}>{feature.title}</span>
                  <span className={styles.featureDescription}>
                    {feature.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className={styles.upgradeControl}>
            <button
              type="button"
              className={styles.upgradeButton}
              disabled
              aria-disabled="true"
              data-testid="premium-upgrade-button"
            >
              <Clock size={16} aria-hidden="true" />
              Upgrade unavailable
            </button>
            <p className={styles.upgradeHelp}>
              Premium activation is not available yet.
            </p>
          </div>
        </article>
      </div>

      <div className={styles.notice} role="note" data-testid="preview-notice">
        <span className={styles.noticeIcon} aria-hidden="true">
          <Info size={18} />
        </span>
        <span>
          This is a feature preview. Premium subscriptions, billing, and AI
          entitlements are not connected yet.
        </span>
      </div>
    </section>
  );
};

export default PremiumPackagesPreview;
