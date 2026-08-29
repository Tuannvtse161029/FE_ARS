import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Crown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes/paths';
import { adminAuxiliaryService } from '../../services/adminAuxiliary.service';
import type { PremiumPackage } from '../../types/adminAuxiliary';
import styles from './PremiumPackagesPreview.module.css';

const normalizeRole = (role: string | null | undefined): string =>
  (role ?? '').trim().toUpperCase().replace(/\s+/g, '_');

const formatPrice = (value: number): string =>
  `${value.toLocaleString('vi-VN')} VND`;

const PremiumPackagesPreview = (): JSX.Element => {
  const { user } = useAuth();
  const [packages, setPackages] = useState<PremiumPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <section className={styles.page} aria-labelledby="premium-package-heading">
      <header className={styles.pageHeader}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link to={ROUTES.HOME}>Home</Link>
          <span aria-hidden="true">›</span>
          <span className={styles.breadcrumbCurrent}>Premium Packages</span>
        </nav>
        <div className={styles.headerRow}>
          <h1 id="premium-package-heading" className={styles.title}>
            <span aria-hidden="true" className={styles.titleIcon}>
              <Crown size={22} />
            </span>
            Premium Packages
          </h1>
        </div>
        <p className={styles.subtitle}>
          Active subscription packages available for your current role.
        </p>
      </header>

      {loading ? (
        <div className={styles.notice} role="status">Loading premium packages...</div>
      ) : error ? (
        <div className={styles.notice} role="alert">{error}</div>
      ) : available.length === 0 ? (
        <div className={styles.notice} role="status">
          No active premium package is configured for this role.
        </div>
      ) : (
        <div className={styles.planGrid}>
          {available.map((item) => (
            <article className={`${styles.planCard} ${styles.planCardPremium}`} key={item.packageId}>
              <header className={styles.planHeader}>
                <div>
                  <h2 className={styles.planTitle}>{item.title}</h2>
                  <p className={styles.planSubtitle}>{item.targetRole.replace(/_/g, ' ')}</p>
                </div>
                <span className={`${styles.planStatusBadge} ${styles.planStatusPremium}`}>
                  Active
                </span>
              </header>
              <div className={styles.pricingRow}>
                <span className={styles.pricingAmount}>{formatPrice(item.priceVnd)}</span>
                <span className={styles.pricingCycle}>{item.billingCycle}</span>
              </div>
              <ul className={styles.featureList}>
                {item.features.map((feature) => (
                  <li className={styles.featureItem} key={feature}>
                    <span className={`${styles.featureIcon} ${styles.featureIconAvailable}`} aria-hidden="true">
                      <Check size={18} />
                    </span>
                    <span className={styles.featureBody}>
                      <span className={styles.featureTitle}>{feature}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className={styles.upgradeHelp}>
                Purchase activation requires the backend membership-purchase flow.
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default PremiumPackagesPreview;
