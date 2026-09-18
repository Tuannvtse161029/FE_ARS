import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Award, ExternalLink } from 'lucide-react';
import { SafeMedalBadge } from '../../features/admin/components/SafeMedalBadge';
import { signalrService, type MedalAwardedPayload } from '../../services/signalr.service';
import type { MedalTier } from '../../services/medal.service';
import { useI18n, useLocale } from '../../i18n/I18nContext';
import { ROUTES } from '../../routes/paths';
import styles from './MedalCelebrationModal.module.css';

export interface MedalCelebrationModalProps {
  /** Optional controlled medal object. If omitted, the modal listens to SignalR MedalAwarded directly. */
  medal?: MedalAwardedPayload | null;
  /** Optional callback when modal is closed */
  onClose?: () => void;
  /** Optional callback when user clicks "View in Profile" */
  onViewProfile?: () => void;
}

const normalizeTier = (tier?: string): MedalTier => {
  if (!tier) return 'Gold';
  const lower = tier.toLowerCase();
  if (lower === 'bronze') return 'Bronze';
  if (lower === 'silver') return 'Silver';
  if (lower === 'gold') return 'Gold';
  if (lower === 'platinum') return 'Platinum';
  return 'Gold';
};

const getTierClass = (tier: MedalTier): string => {
  switch (tier) {
    case 'Bronze':
      return styles.tierBronze;
    case 'Silver':
      return styles.tierSilver;
    case 'Platinum':
      return styles.tierPlatinum;
    case 'Gold':
    default:
      return styles.tierGold;
  }
};

export const MedalCelebrationModal: React.FC<MedalCelebrationModalProps> = ({
  medal: controlledMedal,
  onClose,
  onViewProfile,
}) => {
  const [internalMedal, setInternalMedal] = useState<MedalAwardedPayload | null>(null);
  const navigate = useNavigate();
  const { t } = useI18n();
  const locale = useLocale();

  const isControlled = controlledMedal !== undefined;
  const currentMedal = isControlled ? controlledMedal : internalMedal;

  // Listen to SignalR MedalAwarded when running in uncontrolled mode
  useEffect(() => {
    if (isControlled) return;

    const unsubscribe = signalrService.onMedalAwarded((data) => {
      if (data && data.medalName) {
        setInternalMedal(data);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isControlled]);

  const handleClose = () => {
    if (!isControlled) {
      setInternalMedal(null);
    }
    onClose?.();
  };

  const handleViewProfile = () => {
    handleClose();
    if (onViewProfile) {
      onViewProfile();
    } else {
      navigate(ROUTES.PROFILE);
    }
  };

  // Prevent background scrolling and handle Escape key while open
  useEffect(() => {
    if (!currentMedal) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentMedal]);

  if (!currentMedal) return null;

  const tier = normalizeTier(currentMedal.medalTier);
  const tierClass = getTierClass(tier);

  const localizedTierName =
    locale === 'vi'
      ? tier === 'Gold'
        ? 'Hạng Vàng'
        : tier === 'Silver'
          ? 'Hạng Bạc'
          : tier === 'Bronze'
            ? 'Hạng Đồng'
            : 'Hạng Bạch Kim'
      : `${tier} Tier`;

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="medal-celebration-title"
      data-testid="medal-celebration-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className={styles.modal}>
        <div className={styles.ambientGlow} aria-hidden="true" />

        <button
          type="button"
          className={styles.closeButton}
          onClick={handleClose}
          aria-label={t('common.close', 'Close')}
          data-testid="medal-celebration-close"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <span className={styles.eyebrow}>
          <Sparkles size={14} aria-hidden="true" />
          {t('badges.celebration.eyebrow', locale === 'vi' ? 'DANH HIỆU MỚI MỞ KHÓA' : 'ACHIEVEMENT UNLOCKED')}
        </span>

        <h2 id="medal-celebration-title" className={styles.title}>
          {t('badges.celebration.title', locale === 'vi' ? 'Chúc mừng bạn!' : 'Congratulations!')}
        </h2>

        <div className={styles.badgeContainer}>
          <SafeMedalBadge
            tier={tier}
            imageUrl={currentMedal.iconUrl}
            code={currentMedal.medalName}
            size={96}
            alt={currentMedal.medalName}
          />
        </div>

        <h3 className={styles.medalName}>{currentMedal.medalName}</h3>

        <span className={`${styles.tierPill} ${tierClass}`}>
          {localizedTierName}
        </span>

        <p className={styles.description}>
          {currentMedal.description ||
            t(
              'badges.celebration.defaultDesc',
              locale === 'vi'
                ? 'Ghi nhận đóng góp học thuật xuất sắc của bạn trên nền tảng ARS.'
                : 'Recognized for your outstanding scholarly contributions on ARS.',
            )}
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleClose}
            data-testid="medal-celebration-claim"
          >
            <Award size={18} aria-hidden="true" />
            {t('badges.celebration.claim', locale === 'vi' ? 'Tuyệt vời!' : 'Awesome!')}
          </button>

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleViewProfile}
            data-testid="medal-celebration-profile"
          >
            <ExternalLink size={16} aria-hidden="true" />
            {t('badges.celebration.viewProfile', locale === 'vi' ? 'Xem trong hồ sơ' : 'View in Profile')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MedalCelebrationModal;
