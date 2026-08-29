/**
 * Packages — Admin subscription catalog management.
 *
 * Card-grid layout. Each card displays one package with role pill, price,
 * feature list, and toggle/delete actions. Uses shared PageHeader + Button.
 */
import { useCallback, useEffect, useState } from 'react';
import { Inbox, Plus } from 'lucide-react';
import styles from './PremiumPackages.module.css';
import { adminAuxiliaryService } from '../../services/adminAuxiliary.service';
import { CreatePackageModal } from '../../components/admin/CreatePackageModal';
import { useAdminGuard } from '../../hooks/useAdminGuard';
import type {
  PremiumPackage,
  PremiumPackageInput,
} from '../../types/adminAuxiliary';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';

const ROLE_ACCENT = 'var(--ars-admin)';

const ROLE_LABEL: Record<PremiumPackage['targetRole'], string> = {
  RESEARCHER: 'Researcher',
  REVIEWER: 'Reviewer',
  LECTURER: 'Lecturer',
};

export default function PremiumPackages(): JSX.Element {
  useAdminGuard();

  const [packages, setPackages] = useState<PremiumPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busyPackageId, setBusyPackageId] = useState<number | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminAuxiliaryService.getPremiumPackages();
      setPackages(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load packages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (input: PremiumPackageInput): Promise<void> => {
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      await adminAuxiliaryService.createPremiumPackage(input);
      setCreateOpen(false);
      await load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create package.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleToggle = async (pkg: PremiumPackage): Promise<void> => {
    setBusyPackageId(pkg.packageId);
    try {
      await adminAuxiliaryService.togglePremiumPackage(pkg.packageId, !pkg.isActive);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle package.');
    } finally {
      setBusyPackageId(null);
    }
  };

  const handleDelete = async (pkg: PremiumPackage): Promise<void> => {
    const ok = window.confirm(
      `Delete the package "${pkg.title}"? This cannot be undone.`,
    );
    if (!ok) return;
    setBusyPackageId(pkg.packageId);
    try {
      await adminAuxiliaryService.deletePremiumPackage(pkg.packageId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete package.');
    } finally {
      setBusyPackageId(null);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="ADMIN · SUBSCRIPTIONS"
        title="Packages"
        description="Create, toggle, and edit subscription packages offered to each role."
        accent={ROLE_ACCENT}
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={14} />}
            onClick={() => setCreateOpen(true)}
            data-testid="open-create-package"
          >
            Create New Package
          </Button>
        }
      />

      {loading ? (
        <div className={styles.placeholder} role="status">
          <SkeletonRow count={3} rowHeight={120} />
        </div>
      ) : error ? (
        <ErrorBanner
          tone="error"
          title="Could not load packages"
          message={error}
          retry={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? 'Retrying…' : 'Retry'}
            </Button>
          }
        />
      ) : packages.length === 0 ? (
        <EmptyState
          icon={<Inbox size={20} />}
          title="No packages yet"
          description="Create your first subscription package to start offering subscriptions to researchers, reviewers, or lecturers."
          action={
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus size={14} />}
              onClick={() => setCreateOpen(true)}
            >
              Create a Package
            </Button>
          }
        />
      ) : (
        <div className={styles.grid}>
          {packages.map((pkg) => {
            const busy = busyPackageId === pkg.packageId;
            return (
              <article
                key={pkg.packageId}
                className={`${styles.card} ${pkg.isActive ? '' : styles.cardInactive}`}
              >
                <header className={styles.cardHeader}>
                  <div className={styles.cardTitleBlock}>
                    <span className={styles.rolePill}>
                      {ROLE_LABEL[pkg.targetRole]}
                    </span>
                    <h2 className={styles.cardTitle}>{pkg.title}</h2>
                  </div>
                  <span
                    className={`${styles.statusPill} ${
                      pkg.isActive ? styles.statusActive : styles.statusInactive
                    }`}
                  >
                    {pkg.isActive ? 'Active' : 'Inactive'}
                  </span>
                </header>

                <p className={styles.price}>
                  <span className={styles.priceAmount}>
                    {pkg.priceVnd.toLocaleString('vi-VN')}
                  </span>
                  <span className={styles.priceCurrency}>VND</span>
                  <span className={styles.priceCycle}>
                    /{pkg.billingCycle.toLowerCase()}
                  </span>
                </p>

                <ul className={styles.features}>
                  {pkg.features.map((feature, idx) => (
                    <li key={idx} className={styles.featureItem}>
                      <span aria-hidden className={styles.featureBullet}>
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <footer className={styles.cardFooter}>
                  <span className={styles.subscriberCount}>
                    <strong>{pkg.subscriberCount.toLocaleString('vi-VN')}</strong>{' '}
                    subscribers
                  </span>
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.toggleSwitch}
                      onClick={() => handleToggle(pkg)}
                      disabled={busy}
                      aria-pressed={pkg.isActive}
                    >
                      {pkg.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => handleDelete(pkg)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <CreatePackageModal
        isOpen={createOpen}
        isSubmitting={createSubmitting}
        errorMessage={createError}
        onClose={() => {
          if (!createSubmitting) setCreateOpen(false);
        }}
        onConfirm={handleCreate}
      />
    </div>
  );
}
