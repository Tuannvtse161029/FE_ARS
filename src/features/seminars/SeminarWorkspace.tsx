/**
 * SeminarWorkspace — main page component
 *
 * Refactored from src/pages/Lecturer/SeminarWorkspace.tsx
 * Uses extracted components:
 *   - SeminarList (seminar list and card rendering)
 *   - SummaryDialog (create confirmation dialog)
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Plus,
  RefreshCw,
  Loader,
  Check,
  X,
  FileText,
  Inbox,
  Lock,
} from 'lucide-react';
import { useLocale } from '../../i18n/I18nContext';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { SkeletonRow } from '../../components/SkeletonRow';
import { Button } from '../../components/Button/Button';
import {
  deriveEffectiveStatus,
  seminarService,
  type SeminarCard,
} from '../../services/seminar.service';
import {
  useSeminars,
  useCreateSeminar,
  useSeminarRoleContext,
} from '../../hooks/useSeminar';
import { SeminarList } from './components/SeminarList';
import { SummaryDialog } from './components/SummaryDialog';
// CSS module kept at the original SeminarWorkspace CSS location for now.
import styles from '../../pages/Lecturer/SeminarWorkspace.module.css';

const SEMINARS_PER_PAGE = 3;

type TabKey = 'all' | 'upcoming' | 'completed' | 'drafts';

export const SeminarWorkspace = () => {
  const locale = useLocale();
  const isVi = locale === 'vi';
  const copy = (en: string, vi: string) => (isVi ? vi : en);

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [currentSeminarPage, setCurrentSeminarPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGeneratedModal, setShowGeneratedModal] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [bannerText, setBannerText] = useState('');
  const [bannerVariant, setBannerVariant] = useState<'success' | 'error'>('success');

  const [seminarName, setSeminarName] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [seminarDetails, setSeminarDetails] = useState('');
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [emailInputText, setEmailInputText] = useState('');
  const [sendReminder, setSendReminder] = useState(true);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [createModalError, setCreateModalError] = useState<string | null>(null);
  const [generatedMeetLink, setGeneratedMeetLink] = useState('');

  const {
    seminars,
    isLoading: isLoadingSeminars,
    error: loadSeminarsError,
    refetch,
    backendAvailability,
  } = useSeminars();

  const { currentRole, currentUserId, canModify } = useSeminarRoleContext();

  const handleCreateSuccess = useCallback(
    (created: { seminarId: number; onlineLink?: string | null }) => {
      setGeneratedMeetLink(created.onlineLink ?? '');
      setBannerText(`"${seminarName || 'Seminar'}" has been created.`);
      setBannerVariant('success');
      setShowSuccessBanner(true);
      setShowCreateModal(false);
      setShowGeneratedModal(true);
    },
    [seminarName],
  );

  const { createSeminar, isCreating: isCreatingSeminar } =
    useCreateSeminar(handleCreateSuccess, refetch);

  const seminarCounts = useMemo(
    () =>
      seminars.reduce(
        (counts, seminar) => {
          const effective = deriveEffectiveStatus(seminar.status, seminar.endTime);
          if (effective === 'UPCOMING' || effective === 'IN PROGRESS') counts.upcoming += 1;
          else if (effective === 'COMPLETED') counts.completed += 1;
          else if (effective === 'DRAFT') counts.drafts += 1;
          return counts;
        },
        { upcoming: 0, completed: 0, drafts: 0 },
      ),
    [seminars],
  );

  const filteredSeminars = useMemo(() => {
    return seminars.filter((sem) => {
      const effective = deriveEffectiveStatus(sem.status, sem.endTime);
      if (activeTab === 'upcoming') return effective === 'UPCOMING' || effective === 'IN PROGRESS';
      if (activeTab === 'completed') return effective === 'COMPLETED';
      if (activeTab === 'drafts') return effective === 'DRAFT';
      return true;
    });
  }, [activeTab, seminars]);

  const totalSeminarPages = Math.max(1, Math.ceil(filteredSeminars.length / SEMINARS_PER_PAGE));
  const safeSeminarPage = Math.min(currentSeminarPage, totalSeminarPages);

  const announce = useCallback(
    (message: string, variant: 'success' | 'error' = 'success') => {
      setBannerText(message);
      setBannerVariant(variant);
      setShowSuccessBanner(true);
    },
    [],
  );

  const handleAddEmail = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && emailInputText.trim()) {
      e.preventDefault();
      const candidate = emailInputText.trim();
      if (!guestEmails.includes(candidate)) {
        setGuestEmails([...guestEmails, candidate]);
      }
      setEmailInputText('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setGuestEmails(guestEmails.filter((x) => x !== email));
  };

  const minDateTime = useMemo(
    () => {
      const dt = new Date(Date.now() + 5 * 60 * 1000);
      const tz = dt.getTimezoneOffset() * 60 * 1000;
      return new Date(dt.getTime() - tz).toISOString().slice(0, 16);
    },
    [],
  );

  const handleCreateSeminarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModify) {
      announce('You do not have permission to create seminars.', 'error');
      return;
    }
    if (!seminarName.trim()) { announce('Please enter a seminar name.', 'error'); return; }
    if (!dateTime.trim()) { announce('Please select a date and time.', 'error'); return; }
    if (!seminarDetails.trim()) { announce('Please enter seminar details.', 'error'); return; }
    const minTime = new Date(Date.now() + 5 * 60 * 1000);
    if (new Date(dateTime) < minTime) {
      announce('Seminars must be scheduled at least 5 minutes in advance.', 'error');
      return;
    }
    const startTime = new Date(dateTime).toISOString();
    const endTime = new Date(new Date(dateTime).getTime() + 60 * 60 * 1000).toISOString();
    const fullContent = seminarName.trim() ? `[${seminarName.trim()}] ${seminarDetails.trim()}` : seminarDetails.trim();

    try {
      setCreateModalError(null);
      await createSeminar({
        startTime,
        endTime,
        content: fullContent,
        guestEmails: guestEmails.length > 0 ? guestEmails : undefined,
        isReminderSent: sendReminder,
        status: 'Upcoming',
        subFieldId: selectedSubId ?? undefined,
      });
      setSeminarName('');
      setDateTime('');
      setSeminarDetails('');
      setGuestEmails([]);
      setEmailInputText('');
      setSendReminder(true);
      setCreateModalError(null);
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { message?: string; title?: string } } })?.response;
      const status = resp?.status;
      let msg = resp?.data?.message || resp?.data?.title || (err instanceof Error ? err.message : '') || 'Failed to create seminar.';
      if (status === 403) {
        msg = copy(
          'Your account (Researcher) is not authorized by the Backend to create Seminars (403 Forbidden).',
          'Tài khoản của bạn (Researcher) chưa có quyền tạo Seminar trên Backend (Lỗi 403 Forbidden).',
        );
      }
      setCreateModalError(msg);
      announce(msg, 'error');
    }
  };

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'all', label: 'All Seminars', count: seminars.length },
    { key: 'upcoming', label: 'Upcoming', count: seminarCounts.upcoming },
    { key: 'completed', label: 'Completed', count: seminarCounts.completed },
    { key: 'drafts', label: 'Drafts', count: seminarCounts.drafts },
  ];

  const headerActions = (
    <>
      <Button
        variant="outline"
        size="md"
        leftIcon={isLoadingSeminars ? <Loader size={14} className={styles.spinning} aria-hidden /> : <RefreshCw size={14} aria-hidden />}
        onClick={() => void refetch()}
        disabled={isLoadingSeminars}
        aria-label="Refresh seminars"
      >
        {isLoadingSeminars ? 'Refreshing…' : 'Refresh'}
      </Button>
      {canModify && (
        <Button
          variant="primary"
          size="md"
          className={styles.actionBtnLecturer}
          leftIcon={<Plus size={16} aria-hidden />}
          onClick={() => setShowCreateModal(true)}
        >
          Create Seminar
        </Button>
      )}
    </>
  );

  return (
    <div className={styles.page} data-testid="lecturer-seminar-workspace">
      <PageHeader
        eyebrow={currentRole ? `${currentRole.toUpperCase()} WORKSPACE` : 'WORKSPACE'}
        title="Seminar & Workshop Management"
        description={canModify
          ? 'Manage your scheduled seminars, share resources, and collect feedback.'
          : 'Browse upcoming and completed seminars you have been invited to.'}
        actions={headerActions}
        accent="var(--ars-lecturer)"
      />

      {/* Banners */}
      {showSuccessBanner && (
        <div className={`${styles.banner} ${bannerVariant === 'error' ? styles.bannerError : ''}`} role={bannerVariant === 'error' ? 'alert' : 'status'}>
          <span className={styles.bannerIcon}>
            {bannerVariant === 'success' ? <Check size={14} strokeWidth={3} aria-hidden /> : <X size={14} aria-hidden />}
          </span>
          <div className={styles.bannerBody}>
            <span className={styles.bannerTitle}>{bannerVariant === 'success' ? 'Seminar Created Successfully' : 'Action Failed'}</span>
            <span className={styles.bannerText}>{bannerText}</span>
          </div>
          <button type="button" className={styles.bannerCloseBtn} onClick={() => setShowSuccessBanner(false)} aria-label="Dismiss">
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {loadSeminarsError && (
        <ErrorBanner
          tone="error"
          title="Failed to load seminars"
          message={loadSeminarsError}
          retry={<Button variant="outline" size="sm" onClick={() => void refetch()}>Retry</Button>}
        />
      )}

      {backendAvailability !== 'full' && (
        <div className={styles.backendBanner} role="status" aria-live="polite">
          <span className={styles.backendBannerIcon}><Lock size={14} aria-hidden /></span>
          <div className={styles.backendBannerBody}>
            <span className={styles.backendBannerTitle}>Seminar list unavailable for your role</span>
            <p className={styles.backendBannerText}>
              The seminar list is currently only available to the seminar organizer (Lecturer role).
            </p>
          </div>
        </div>
      )}

      <div className={styles.toolbarRow}>
        <div className={styles.tabs} role="tablist" aria-label="Filter seminars">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              className={`${styles.tabBtn} ${activeTab === t.key ? styles.tabActive : ''}`}
              onClick={() => { setActiveTab(t.key); setCurrentSeminarPage(1); }}
            >
              {t.label}
              <span className={styles.tabCount}>{t.count}</span>
            </button>
          ))}
        </div>
        <span className={styles.toolbarMeta}>
          Showing {filteredSeminars.length > 0
            ? `${(safeSeminarPage - 1) * SEMINARS_PER_PAGE + 1}–${Math.min(safeSeminarPage * SEMINARS_PER_PAGE, filteredSeminars.length)}`
            : '0'} of {filteredSeminars.length} seminars
        </span>
      </div>

      <SeminarList
        seminars={seminars}
        filteredSeminars={filteredSeminars}
        paginatedPage={safeSeminarPage}
        paginatedTotalPages={totalSeminarPages}
        onPageChange={setCurrentSeminarPage}
        pageSize={SEMINARS_PER_PAGE}
        isLoading={isLoadingSeminars}
        backendAvailability={backendAvailability}
        canModify={canModify}
        currentUserId={currentUserId}
        currentRole={currentRole}
        onRefetch={() => void refetch()}
        onShowSuccess={(text) => announce(text, 'success')}
      />

      {/* Modal: Create Seminar */}
      {showCreateModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={`${styles.modalCard} ${styles.modalCardLarge}`}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}><Plus size={18} aria-hidden /></span>
                <div>
                  <h3 className={styles.modalTitle}>{copy('Create New Academic Seminar', 'Tạo Buổi Hội Thảo Mới')}</h3>
                  <span className={styles.modalSubtitle}>{copy('A Google Meet link will be auto-generated.', 'Đường dẫn Google Meet sẽ được tạo tự động.')}</span>
                </div>
              </div>
              <button type="button" className={styles.closeBtn} onClick={() => { setShowCreateModal(false); setCreateModalError(null); }} aria-label="Close">
                <X size={18} aria-hidden />
              </button>
            </div>

            <form onSubmit={handleCreateSeminarSubmit} className={styles.modalBody}>
              {createModalError && (
                <div className={styles.modalErrorBanner}>
                  <X size={16} aria-hidden />
                  <span>{createModalError}</span>
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="seminar-name">{copy('Seminar Name', 'Tên buổi hội thảo')}</label>
                <input id="seminar-name" type="text" className={styles.formInput} value={seminarName} onChange={(e) => setSeminarName(e.target.value)} placeholder="Advanced Cloud Routing Architecture Seminar" required />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="seminar-date">{copy('Date & Time', 'Ngày & Giờ')}</label>
                <input id="seminar-date" type="datetime-local" className={styles.formInput} value={dateTime} min={minDateTime} onChange={(e) => setDateTime(e.target.value)} required />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="seminar-details">{copy('Seminar Details', 'Nội dung chi tiết')}</label>
                <textarea id="seminar-details" className={styles.formTextarea} value={seminarDetails} onChange={(e) => setSeminarDetails(e.target.value)} placeholder="Deep dive into modular backend routing networks..." required />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{copy('Guest Email Invitations', 'Mời người tham dự qua Email')}</label>
                <input type="text" className={styles.formInput} value={emailInputText} onChange={(e) => setEmailInputText(e.target.value)} onKeyDown={handleAddEmail} placeholder={copy('Type email and press Enter…', 'Nhập email và nhấn Enter…')} />
                <span className={styles.helperText}>{copy('Press Enter to add each address.', 'Nhấn Enter để thêm từng địa chỉ email.')}</span>
                {guestEmails.length > 0 && (
                  <div className={styles.emailPills}>
                    {guestEmails.map((email) => (
                      <span key={email} className={styles.emailPill}>
                        <X size={12} aria-hidden style={{ display: 'none' }} />
                        {email}
                        <button type="button" className={styles.emailPillRemove} onClick={() => handleRemoveEmail(email)} aria-label={`Remove ${email}`}>
                          <X size={12} aria-hidden />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <label className={styles.checkboxRow}>
                <input type="checkbox" className={styles.checkboxInput} checked={sendReminder} onChange={(e) => setSendReminder(e.target.checked)} />
                <span className={styles.checkboxLabel}>
                  <strong>Send Email Reminder</strong>
                  <span className={styles.checkboxSub}>Auto-send an email reminder to guests one day before the seminar starts.</span>
                </span>
              </label>

              <div className={styles.modalFooter}>
                <Button variant="outline" size="md" onClick={() => setShowCreateModal(false)} disabled={isCreatingSeminar}>Cancel</Button>
                <Button variant="primary" size="md" type="submit" className={styles.actionBtnLecturer} leftIcon={isCreatingSeminar ? <Loader size={14} className={styles.spinning} aria-hidden /> : <Plus size={14} aria-hidden />} disabled={isCreatingSeminar}>
                  {isCreatingSeminar ? 'Creating…' : 'Generate & Create Seminar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Meet Summary Dialog */}
      <SummaryDialog
        isOpen={showGeneratedModal}
        seminarTitle={seminarName}
        meetLink={generatedMeetLink}
        guestEmails={guestEmails}
        onCopyLink={() => { navigator.clipboard.writeText(generatedMeetLink); announce('Google Meet link copied.'); }}
        onLaunch={() => window.open(generatedMeetLink, '_blank', 'noopener')}
        onClose={() => {
          setShowGeneratedModal(false);
          setSeminarName('');
          setSeminarDetails('');
          setDateTime('');
          setGuestEmails([]);
          setEmailInputText('');
          setGeneratedMeetLink('');
        }}
      />
    </div>
  );
};

export default SeminarWorkspace;
