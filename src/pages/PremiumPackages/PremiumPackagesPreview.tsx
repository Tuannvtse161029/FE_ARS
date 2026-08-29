import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Check, Crown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes/paths';
import { AppConfig } from '../../config/app';
import { adminAuxiliaryService } from '../../services/adminAuxiliary.service';
import type { PremiumPackage } from '../../types/adminAuxiliary';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import styles from './PremiumPackagesPreview.module.css';

// Premium accent — premium packages use ARS Blue by default.
const PREMIUM_ACCENT = 'var(--ars-blue)';

const normalizeRole = (role: string | null | undefined): string =>
  (role ?? '').trim().toUpperCase().replace(/\s+/g, '_');

const formatPrice = (value: number): string =>
  `${value.toLocaleString('vi-VN')} VND`;

const PremiumPackagesPreview = (): JSX.Element => {
  const { user } = useAuth();
  const [packages, setPackages] = useState<PremiumPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Backend-availability gate — if disabled, redirect to /forum.
  // Mirrors the App.tsx route-level redirect. Defensive double-check so
  // the page is safe even if the route is wired differently.
  if (!AppConfig.features.premiumPackagesEnabled) {
    return <Navigate to={ROUTES.FORUM} replace />;
  }

  useEffect(() => {
    let active = true;
    adminAuxiliaryService
      .getPremiumPackages()
      .then((items) => {
        if (active) setPackages(items.filter((item) => item.isActive));
      })
      .catch(() => {
        if (active) setError('Premium packages could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const available = useMemo(() => {
    const role = normalizeRole(user?.role);
    return packages.filter((item) => item.targetRole === role);
  }, [packages, user?.role]);

  const roleLabel = user?.role ? user.role.replace(/_/g, ' ') : 'this role';

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Premium Packages"
        title="Subscription packages"
        description={`Active subscription packages available for your current role${roleLabel ? ` (${roleLabel})` : ''}. Pricing reflects the live configuration; purchase activation requires the BE membership flow.`}
        accent={PREMIUM_ACCENT}
        breadcrumbs={
          <>
            Home <span aria-hidden>/</span>{' '}
            <span className={styles.breadcrumbsActive}>Premium Packages</span>
          </>
        }
        actions={
          <span className={styles.previewBadge}>
            <Crown size={14} />
            Preview
          </span>
        }
      />

      {loading ? (
        <SkeletonRow count={4} rowHeight={96} gap={16} withHeader />
      ) : error ? (
        <ErrorBanner
          tone="error"
          title="Couldn't load premium packages"
          message={error}
        />
      ) : available.length === 0 ? (
        <EmptyState
          icon={<Crown size={22} />}
          title="No active package for this role yet"
          description="The backend hasn't published an active package for your role. Check back later, or browse the forums in the meantime."
          compact
        />
      ) : (
        <div className={styles.planGrid}>
          {available.map((item) => (
            <article className={styles.planCard} key={item.packageId}>
              <header className={styles.planHeader}>
                <div>
                  <h2 className={styles.planTitle}>{item.title}</h2>
                  <p className={styles.planSubtitle}>
                    {item.targetRole.replace(/_/g, ' ')}
                  </p>
                </div>
                <span className={`${styles.planStatusBadge} ${styles.planStatusPremium}`}>
                  Active
                </span>
              </header>
              <div className={styles.pricingRow}>
                <span className={styles.pricingAmount}>
                  {formatPrice(item.priceVnd)}
                </span>
                <span className={styles.pricingCycle}>{item.billingCycle}</span>
              </div>
              <ul className={styles.featureList}>
                {item.features.map((feature) => (
                  <li className={styles.featureItem} key={feature}>
                    <span
                      className={`${styles.featureIcon} ${styles.featureIconAvailable}`}
                      aria-hidden
                    >
                      <Check size={16} />
                    </span>
                    <span className={styles.featureBody}>
                      <span className={styles.featureTitle}>{feature}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className={styles.upgradeHelp}>
                Purchase activation requires the backend membership-purchase
                flow. Until it ships, no upgrade button is rendered — we never
                pretend to take a payment that the BE hasn't confirmed.
              </p>
            </article>
          ))}
        </div>
      )}

      <p className={styles.footNote}>
        Looking for the administrator view?{' '}
        <Link to={ROUTES.ADMIN_PACKAGES} className={styles.footLink}>
          Open the Admin packages panel
        </Link>
        .
      </p>
    </div>
  );
};

export default PremiumPackagesPreview;
