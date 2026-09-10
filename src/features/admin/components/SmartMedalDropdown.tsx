import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronDown,
  Search,
  X,
  BookOpen,
  GraduationCap,
  Users,
  MessageSquare,
  Clock,
  CheckCircle2,
  Filter,
  type LucideIcon,
} from 'lucide-react';
import {
  type Medal,
  type MedalTier,
  type UserMedal,
  criteriaUnitLabel,
  medalService,
} from '../../../services/medal.service';
import {
  getMedalCategory,
  isMedalCompatibleWithRole,
  medalAnalyticsService,
  type MedalCategoryKey,
} from '../../../services/medalAnalytics.service';
import { SafeMedalBadge } from './SafeMedalBadge';
import { useI18n } from '../../../i18n/I18nContext';
import styles from './SmartMedalDropdown.module.css';

export interface SmartMedalDropdownProps {
  value?: string | null; // medal code or id
  onChange: (medal: Medal | null) => void;
  targetRole?: string | null;
  targetUserId?: number | string | null;
  medals?: Medal[];
  placeholder?: string;
  disabled?: boolean;
  showProgress?: boolean;
  className?: string;
}

const CATEGORY_ICONS: Record<MedalCategoryKey, LucideIcon> = {
  research: BookOpen,
  mentorship: GraduationCap,
  seminars: Users,
  community: MessageSquare,
};

export const SmartMedalDropdown: React.FC<SmartMedalDropdownProps> = ({
  value,
  onChange,
  targetRole,
  targetUserId,
  medals: passedMedals,
  placeholder,
  disabled = false,
  showProgress = true,
  className = '',
}) => {
  const { t, locale } = useI18n();
  const copy = (en: string, vi: string): string => (locale === 'vi' ? vi : en);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [medalsList, setMedalsList] = useState<Medal[]>(passedMedals || []);
  const [userProgress, setUserProgress] = useState<UserMedal | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load all medals if not passed
  useEffect(() => {
    if (passedMedals && passedMedals.length > 0) {
      setMedalsList(passedMedals);
    } else {
      let isMounted = true;
      void medalService.getAll().then((data) => {
        if (isMounted) setMedalsList(data);
      });
      return () => {
        isMounted = false;
      };
    }
  }, [passedMedals]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Find currently selected medal
  const selectedMedal = useMemo(() => {
    if (!value) return null;
    const target = value.trim().toUpperCase();
    return (
      medalsList.find(
        (m) => m.id === value || m.code.toUpperCase() === target
      ) ?? null
    );
  }, [value, medalsList]);

  // Fetch live progress when targetUserId or selectedMedal changes
  useEffect(() => {
    if (!showProgress || !targetUserId || !selectedMedal) {
      setUserProgress(null);
      return;
    }

    let isMounted = true;
    setIsLoadingProgress(true);

    void medalAnalyticsService
      .getUserProgressForMedal(targetUserId, selectedMedal.code)
      .then((progress) => {
        if (isMounted) {
          setUserProgress(progress);
          setIsLoadingProgress(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingProgress(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetUserId, selectedMedal, showProgress]);

  // Filter and group medals
  const groupedMedals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    // 1. Filter by role and search query
    const filtered = medalsList.filter((medal) => {
      if (!isMedalCompatibleWithRole(medal, targetRole)) {
        return false;
      }
      if (!query) return true;

      const titleVi = (medal.titleVi || '').toLowerCase();
      const titleEn = (medal.title || '').toLowerCase();
      const code = (medal.code || '').toLowerCase();
      const metric = (medal.criteriaMetric || '').toLowerCase();
      return (
        titleVi.includes(query) ||
        titleEn.includes(query) ||
        code.includes(query) ||
        metric.includes(query)
      );
    });

    // 2. Group into 4 categories
    const groups: Record<MedalCategoryKey, Medal[]> = {
      research: [],
      mentorship: [],
      seminars: [],
      community: [],
    };

    for (const m of filtered) {
      const cat = getMedalCategory(m);
      groups[cat].push(m);
    }

    return groups;
  }, [medalsList, targetRole, searchQuery]);

  const totalFilteredCount = useMemo(() => {
    return (
      groupedMedals.research.length +
      groupedMedals.mentorship.length +
      groupedMedals.seminars.length +
      groupedMedals.community.length
    );
  }, [groupedMedals]);

  const handleSelectMedal = (medal: Medal) => {
    onChange(medal);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const getTierClass = (tier: MedalTier) => {
    switch (tier) {
      case 'Bronze':
        return styles.tierBronze;
      case 'Silver':
        return styles.tierSilver;
      case 'Gold':
        return styles.tierGold;
      case 'Platinum':
        return styles.tierPlatinum;
      default:
        return '';
    }
  };

  const renderCategoryTitle = (catKey: MedalCategoryKey) => {
    switch (catKey) {
      case 'research':
        return t('admin.medals.category.research', 'Nghiên cứu & Bài báo');
      case 'mentorship':
        return t('admin.medals.category.mentorship', 'Giảng dạy & Đào tạo');
      case 'seminars':
        return t('admin.medals.category.seminars', 'Hoạt động Seminar');
      case 'community':
        return t('admin.medals.category.community', 'Tương tác Cộng đồng');
    }
  };

  return (
    <div className={`${styles.container} ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`${styles.dropdownTrigger} ${disabled ? styles.dropdownTriggerDisabled : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedMedal ? (
          <div className={styles.selectedContent}>
            <SafeMedalBadge
              imageUrl={selectedMedal.imageUrl}
              tier={selectedMedal.tier}
              size={28}
              alt=""
            />
            <div className={styles.selectedInfo}>
              <div className={styles.selectedTitle}>
                {locale === 'vi' ? selectedMedal.titleVi : selectedMedal.title}
              </div>
              <div className={styles.selectedMeta}>
                <span className={`${styles.tierTag} ${getTierClass(selectedMedal.tier)}`}>
                  {selectedMedal.tier}
                </span>
                <span>
                  {t('admin.medals.smartDropdown.thresholdLabel', 'Ngưỡng:')} &gt;={' '}
                  {selectedMedal.criteriaThreshold}{' '}
                  {criteriaUnitLabel(selectedMedal.criteriaUnit, locale as 'vi' | 'en')}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <span className={styles.placeholder}>
            {placeholder || t('admin.medals.smartDropdown.placeholder', 'Chọn huy hiệu...')}
          </span>
        )}

        <div className={styles.triggerIcons}>
          {selectedMedal && !disabled && (
            <span
              role="button"
              className={styles.clearBtn}
              onClick={handleClear}
              title={copy('Clear selection', 'Bỏ chọn')}
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} />
        </div>
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className={styles.popover}>
          <div className={styles.searchHeader}>
            <div className={styles.searchBox}>
              <Search size={15} color="#94a3b8" />
              <input
                type="text"
                className={styles.searchInput}
                placeholder={t(
                  'admin.medals.smartDropdown.searchPlaceholder',
                  'Tìm kiếm theo tên hoặc mã huy hiệu...'
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => setSearchQuery('')}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {targetRole && targetRole !== 'All' && targetRole !== 'ALL' && (
              <div className={styles.roleFilterBanner}>
                <Filter size={12} />
                <span>
                  {t('admin.medals.smartDropdown.roleFilterBadge', 'Đang lọc theo vai trò: {role}', {
                    role: targetRole,
                  })}
                </span>
              </div>
            )}
          </div>

          <div className={styles.optionsList} role="listbox">
            {totalFilteredCount === 0 ? (
              <div className={styles.emptyState}>
                {t(
                  'admin.medals.smartDropdown.noMedals',
                  'Không tìm thấy huy hiệu phù hợp với vai trò này'
                )}
              </div>
            ) : (
              (['research', 'mentorship', 'seminars', 'community'] as MedalCategoryKey[]).map(
                (catKey) => {
                  const items = groupedMedals[catKey];
                  if (items.length === 0) return null;
                  const CatIcon = CATEGORY_ICONS[catKey];

                  return (
                    <div key={catKey} className={styles.categorySection}>
                      <div className={styles.categoryHeader}>
                        <CatIcon size={14} />
                        <span>{renderCategoryTitle(catKey)}</span>
                        <span className={styles.categoryCount}>{items.length}</span>
                      </div>

                      {items.map((medal) => {
                        const isSelected = selectedMedal?.id === medal.id;
                        return (
                          <div
                            key={medal.id}
                            className={`${styles.optionItem} ${
                              isSelected ? styles.optionItemSelected : ''
                            }`}
                            onClick={() => handleSelectMedal(medal)}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <SafeMedalBadge
                              imageUrl={medal.imageUrl}
                              tier={medal.tier}
                              size={28}
                              alt=""
                            />

                            <div className={styles.optionText}>
                              <div className={styles.optionTitleRow}>
                                <span className={styles.optionTitle}>
                                  {locale === 'vi' ? medal.titleVi : medal.title}
                                </span>
                                <span className={`${styles.tierTag} ${getTierClass(medal.tier)}`}>
                                  {medal.tier}
                                </span>
                              </div>

                              <div className={styles.optionThreshold}>
                                <span>
                                  {t('admin.medals.smartDropdown.thresholdLabel', 'Ngưỡng:')} &gt;={' '}
                                  {medal.criteriaThreshold}{' '}
                                  {criteriaUnitLabel(medal.criteriaUnit, locale as 'vi' | 'en')}
                                </span>
                                <span>·</span>
                                <span>{medal.code}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
              )
            )}
          </div>
        </div>
      )}

      {/* Live User Progress Section */}
      {showProgress && targetUserId && selectedMedal && (
        <div className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>
              <Clock size={13} />
              <span>
                {t(
                  'admin.medals.smartDropdown.progressTitle',
                  'Tiến độ hiện tại của người dùng:'
                )}
              </span>
            </span>

            {isLoadingProgress ? (
              <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                {t('admin.medals.smartDropdown.progressLoading', 'Đang kiểm tra tiến trình...')}
              </span>
            ) : userProgress?.isUnlocked ? (
              <span className={styles.statusTagUnlocked}>
                <CheckCircle2 size={12} />
                <span>
                  {t(
                    'admin.medals.smartDropdown.progressStatusUnlocked',
                    'Đã mở khóa vào ngày {date}',
                    {
                      date: userProgress.unlockedAt
                        ? new Date(userProgress.unlockedAt).toLocaleDateString(
                            locale === 'vi' ? 'vi-VN' : 'en-US'
                          )
                        : '—',
                    }
                  )}
                </span>
              </span>
            ) : (
              <span className={styles.statusTagInProgress}>
                <Clock size={12} />
                <span>
                  {t(
                    'admin.medals.smartDropdown.progressStatusInProgress',
                    'Đang tích lũy: còn thiếu {remaining} {unit}',
                    {
                      remaining: Math.max(
                        0,
                        ((userProgress as any)?.criteriaThreshold ||
                          userProgress?.medal?.criteriaThreshold ||
                          selectedMedal.criteriaThreshold) -
                          (userProgress?.currentProgress || 0)
                      ),
                      unit: criteriaUnitLabel(
                        selectedMedal.criteriaUnit,
                        locale as 'vi' | 'en'
                      ),
                    }
                  )}
                </span>
              </span>
            )}
          </div>

          <div className={styles.progressBarContainer}>
            <div
              className={styles.progressBarFill}
              style={{
                width: `${Math.min(
                  100,
                  userProgress?.progressPercentage ??
                    (userProgress?.isUnlocked
                      ? 100
                      : Math.round(
                          ((userProgress?.currentProgress || 0) /
                            (selectedMedal.criteriaThreshold || 1)) *
                            100
                        ))
                )}%`,
              }}
            />
          </div>

          <div className={styles.progressFooter}>
            <span>
              {userProgress?.currentProgress ?? 0} / {selectedMedal.criteriaThreshold}{' '}
              {criteriaUnitLabel(selectedMedal.criteriaUnit, locale as 'vi' | 'en')}
            </span>
            <span>
              {Math.min(
                100,
                userProgress?.progressPercentage ??
                  (userProgress?.isUnlocked
                    ? 100
                    : Math.round(
                        ((userProgress?.currentProgress || 0) /
                          (selectedMedal.criteriaThreshold || 1)) *
                          100
                      ))
              )}
              %
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartMedalDropdown;