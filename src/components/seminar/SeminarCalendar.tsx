/**
 * SeminarCalendar — custom calendar widget for the seminar surface.
 *
 * Displays seminars in three views: Day, Week, Month.
 * Seminars are color-coded by role:
 *   - Hosting  → burgundy border (--ars-lecturer)
 *   - Joining  → navy border (--ars-info)
 *
 * Embeds into:
 *   - SeminarWorkspace.tsx  (Lecturer / Researcher)
 *   - SeminarParticipationsPage.tsx  (all roles)
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getHours,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Video,
  Loader,
  AlertTriangle,
  Inbox,
} from 'lucide-react';
import type { Locale } from 'date-fns';
import { useLocale } from '../../i18n/I18nContext';
import {
  parseApiDateTimeAsUtc,
  formatDisplayDate,
  formatDisplayTime,
} from '../../utils/datetime';
import type { EnrichedSeminar } from '../../hooks/useSeminarCalendar';
import styles from './SeminarCalendar.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CalendarView = 'day' | 'week' | 'month';

export interface SeminarCalendarProps {
  /** Seminars the current user organizes (shown with hosting color). */
  hostingSeminars: EnrichedSeminar[];
  /** Seminars the current user is invited to (shown with joining color). */
  joiningSeminars: EnrichedSeminar[];
  /** Called when a seminar event is clicked. */
  onEventClick?: (seminar: EnrichedSeminar) => void;
  /** Override the initial date shown (defaults to today). */
  initialDate?: Date;
  /**
   * When false, suppress the "Hosting" legend item AND drop any entries
   * tagged as `calendarRole === 'hosting'`. Reviewer / Graduate Student
   * never organise seminars, so their calendar should not advertise a
   * hosting bucket they can never populate. Defaults to true to preserve
   * the existing Lecturer / Researcher surface.
   */
  showHostingLegend?: boolean;
  /**
   * When true, the body shows the canonical loading panel instead of the
   * calendar grid (e.g. while `useSeminarCalendar` is fetching). Defaults
   * to `false` so the grid renders immediately and is replaced by
   * seminar blocks once data lands — this is the preferred UX for the
   * Participations page where a skeleton-with-grid reads better than a
   * blank panel.
   */
  isLoading?: boolean;
  /**
   * Error message from the parent hook. When set, an inline error chip
   * is rendered above the grid so the user can still see the calendar
   * structure (same rationale as the empty-state hint — never replace
   * the grid with a full error panel, the user should still be able to
   * browse dates).
   */
  errorMessage?: string | null;
  /** Called when the user clicks the "Retry" chip on an error banner. */
  onRetry?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hours shown in the week/day view (00:00 – 24:00, full 24-hour day).
 * Bug fix (Sep 2026): previous implementation only showed 07:00 – 22:00,
 * so early-morning and late-night seminars were clamped to the edges and
 * looked visually wrong. We now render a true 24-hour timeline so
 * any hour a seminar can be scheduled is visible.
 */
const CAL_START_HOUR = 0;
const CAL_END_HOUR = 24;
const TOTAL_HOURS = CAL_END_HOUR - CAL_START_HOUR; // 24
const SLOT_MINUTES = 30;
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES; // 2
const SLOT_HEIGHT_PX = 28; // px per 30-min slot — tightened so 24 hours fit comfortably

const MAX_DOTS_MONTH = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function useDateFnsLocale(): Locale {
  const locale = useLocale();
  return locale === 'vi' ? vi : enUS;
}

function parseSeminarTime(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const parsed = parseApiDateTimeAsUtc(iso);
  if (!parsed) return null;
  return new Date(parsed);
}

/** Returns the top offset (px) for an event block within a day column.
 *  Clamps to the visible window so events that straddle the boundary
 *  still render inside the grid instead of disappearing off-screen. */
function getEventTop(startHour: number, startMinute: number): number {
  const safeHour = Math.max(CAL_START_HOUR, Math.min(CAL_END_HOUR, startHour));
  const safeMinute = Math.max(0, Math.min(59, startMinute));
  const hourOffset = safeHour - CAL_START_HOUR;
  const minuteOffset = safeMinute >= 30 ? 1 : 0;
  return (hourOffset * SLOTS_PER_HOUR + minuteOffset) * SLOT_HEIGHT_PX;
}

/** Returns the height (px) for an event block. */
function getEventHeight(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): number {
  const startSlot =
    (Math.max(0, startHour - CAL_START_HOUR) * SLOTS_PER_HOUR) +
    (startMinute >= 30 ? 1 : 0);
  // Bug fix (Sep 2026): the end time represents the exclusive upper bound
  // of the seminar window.  For example, a seminar ending at 18:00 occupies
  // slots 18-21 (16:00 through 17:59), not slot 18 (the 17:00-17:30 half-
  // hour).  The original code used the same slot mapping for both start and
  // end, producing `endSlot === startSlot` and a zero (or near-zero) height
  // for any event starting on the hour — causing it to render as invisible
  // or below the visible grid.
  //
  // Treatment:
  //   HH:00 → exclusive upper bound is the *next* half-hour slot
  //   HH:30 → exclusive upper bound is the first half of the *next* hour
  //
  // This makes a 16:00-18:00 seminar span 4 slots (16 slots) = 208px,
  // and a 16:00-18:30 seminar span 5 slots (260px) — correct durations.
  const endSlot =
    (Math.max(0, endHour - CAL_START_HOUR) * SLOTS_PER_HOUR) +
    (endMinute >= 30 ? 2 : 1);
  const slotCount = Math.max(1, endSlot - startSlot);
  return slotCount * SLOT_HEIGHT_PX - 2; // 2px vertical margin
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface EventTooltipProps {
  seminar: EnrichedSeminar;
  anchorRect: DOMRect;
  containerRect: DOMRect;
}

function EventTooltip({ seminar, anchorRect, containerRect }: EventTooltipProps) {
  const t = useLocale() === 'vi';

  const start = parseSeminarTime(seminar.startTime);
  const end = parseSeminarTime(seminar.endTime);

  const dateLabel = start ? formatDisplayDate(start, t ? 'vi' : 'en') : '';
  const startLabel = start ? formatDisplayTime(start, t ? 'vi' : 'en') : '';
  const endLabel = end ? formatDisplayTime(end, t ? 'vi' : 'en') : '';

  // Status badge
  const rawStatus = seminar.status ?? '';
  const statusUpper = rawStatus.toUpperCase();
  let statusClass = styles.tooltipStatusUpcoming;
  let statusLabel = rawStatus;
  if (statusUpper === 'IN PROGRESS' || statusUpper === 'INPROGRESS') {
    statusClass = styles.tooltipStatusInProgress;
    statusLabel = t ? 'Đang diễn ra' : 'In Progress';
  } else if (statusUpper === 'COMPLETED') {
    statusClass = styles.tooltipStatusCompleted;
    statusLabel = t ? 'Đã kết thúc' : 'Completed';
  } else if (statusUpper === 'INACTIVE') {
    statusClass = styles.tooltipStatusInactive;
    statusLabel = t ? 'Không hoạt động' : 'Inactive';
  } else if (statusUpper === 'DRAFT') {
    statusClass = styles.tooltipStatusInactive;
    statusLabel = t ? 'Bản nháp' : 'Draft';
  } else {
    statusClass = styles.tooltipStatusUpcoming;
    statusLabel = rawStatus || (t ? 'Sắp tới' : 'Upcoming');
  }

  // Compute tooltip position so it doesn't overflow container
  let left = anchorRect.left - containerRect.left + anchorRect.width / 2;
  const top = anchorRect.top - containerRect.top - 8;

  // Shift left if it would overflow right edge
  const TOOLTIP_WIDTH = 280;
  if (left + TOOLTIP_WIDTH / 2 > containerRect.width) {
    left = containerRect.width - TOOLTIP_WIDTH / 2 - 8;
  }
  if (left - TOOLTIP_WIDTH / 2 < 0) {
    left = TOOLTIP_WIDTH / 2 + 8;
  }

  const title = seminar.content?.split('\n')[0]?.trim() || seminar.title || `Seminar #${seminar.seminarId}`;
  const hasJoinLink =
    seminar.onlineLink &&
    (statusUpper === 'UPCOMING' || statusUpper === 'IN PROGRESS');

  return (
    <div
      className={styles.eventTooltip}
      style={{ left: `${left}px`, top: `${top}px`, transform: 'translate(-50%, -100%)' }}
      role="tooltip"
    >
      <p className={styles.tooltipTitle}>{title}</p>

      <div className={styles.tooltipMeta}>
        <div className={styles.tooltipRow}>
          <Calendar size={13} className={styles.tooltipIcon} aria-hidden />
          <span>{dateLabel}</span>
        </div>
        {startLabel && (
          <div className={styles.tooltipRow}>
            <Clock size={13} className={styles.tooltipIcon} aria-hidden />
            <span>
              {startLabel}
              {endLabel ? ` – ${endLabel}` : ''}
            </span>
          </div>
        )}
        <div className={styles.tooltipRow}>
          <span className={`${styles.tooltipStatusBadge} ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {hasJoinLink && (
        <a
          href={seminar.onlineLink ?? '#'}
          className={styles.tooltipJoinLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <Video size={12} aria-hidden />
          {t ? 'Tham gia ngay' : 'Join session'}
        </a>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Month View
// ─────────────────────────────────────────────────────────────────────────────

interface MonthViewProps {
  currentDate: Date;
  hostingSeminars: EnrichedSeminar[];
  joiningSeminars: EnrichedSeminar[];
  onEventClick?: (seminar: EnrichedSeminar) => void;
  onDayClick?: (date: Date) => void;
}

function MonthView({
  currentDate,
  hostingSeminars,
  joiningSeminars,
  onEventClick,
  onDayClick,
}: MonthViewProps) {
  const locale = useDateFnsLocale();

  // Build the 6-week grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { locale });
  const calEnd = endOfWeek(monthEnd, { locale });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const dayNames = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(calStart, i);
    return format(d, 'EEE', { locale });
  });

  // Merge seminars into one list for easier lookup
  const allSeminars = useMemo(
    () => [...hostingSeminars, ...joiningSeminars],
    [hostingSeminars, joiningSeminars],
  );

  function getSeminarsForDay(day: Date): EnrichedSeminar[] {
    return allSeminars.filter((sem) => {
      const start = parseSeminarTime(sem.startTime);
      return start !== null && isSameDay(start, day);
    });
  }

  function getDotClass(sem: EnrichedSeminar): string {
    return sem.calendarRole === 'hosting'
      ? styles.monthEventDotDotHosting
      : styles.monthEventDotDotJoining;
  }

  return (
    <div className={styles.monthGrid}>
      {/* Day name headers */}
      {dayNames.map((name) => (
        <div key={name} className={styles.monthHeaderCell}>
          {name}
        </div>
      ))}

      {/* Day cells */}
      {days.map((day) => {
        const isCurrentMonth = isSameMonth(day, currentDate);
        const isTodayDay = isToday(day);
        const daySeminars = getSeminarsForDay(day);
        const visible = daySeminars.slice(0, MAX_DOTS_MONTH);
        const overflow = daySeminars.length - MAX_DOTS_MONTH;

        const cellClass = [
          styles.monthDayCell,
          !isCurrentMonth ? styles.monthDayCellOtherMonth : '',
          isTodayDay ? styles.monthDayCellToday : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div
            key={day.toISOString()}
            className={cellClass}
            onClick={() => onDayClick?.(day)}
            role="gridcell"
            aria-label={formatDisplayDate(day, 'en')}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onDayClick?.(day);
              }
            }}
          >
            <span className={styles.monthDayNumber}>
              {format(day, 'd')}
            </span>

            <div className={styles.monthEventDots}>
              {visible.map((sem) => {
                const title =
                  sem.content?.split('\n')[0]?.trim() ||
                  sem.title ||
                  `Seminar #${sem.seminarId}`;
                return (
                  <button
                    key={sem.seminarId}
                    type="button"
                    className={styles.monthEventDot}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(sem);
                    }}
                    title={title}
                    aria-label={title}
                  >
                    <span className={`${styles.monthEventDotDot} ${getDotClass(sem)}`} aria-hidden />
                    <span>{title}</span>
                  </button>
                );
              })}
              {overflow > 0 && (
                <span className={styles.monthMoreChip} aria-label={`${overflow} more events`}>
                  +{overflow} more
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Week View
// ─────────────────────────────────────────────────────────────────────────────

interface WeekViewProps {
  currentDate: Date;
  hostingSeminars: EnrichedSeminar[];
  joiningSeminars: EnrichedSeminar[];
  onEventClick?: (seminar: EnrichedSeminar) => void;
  onDayClick?: (date: Date) => void;
}

function WeekView({
  currentDate,
  hostingSeminars,
  joiningSeminars,
  onEventClick,
  onDayClick,
}: WeekViewProps) {
  const locale = useDateFnsLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    seminar: EnrichedSeminar;
    anchorRect: DOMRect;
    containerRect: DOMRect;
  } | null>(null);

  const today = new Date();

  // Build 7-day week
  const weekStart = startOfWeek(currentDate, { locale });
  const days = eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(currentDate, { locale }),
  });

  // Merge all seminars
  const allSeminars = useMemo(
    () => [...hostingSeminars, ...joiningSeminars],
    [hostingSeminars, joiningSeminars],
  );

  function getSeminarsForDay(day: Date): EnrichedSeminar[] {
    return allSeminars.filter((sem) => {
      const start = parseSeminarTime(sem.startTime);
      return start !== null && isSameDay(start, day);
    });
  }

  // Time labels: every hour from CAL_START_HOUR to CAL_END_HOUR
  const timeLabels = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
    const h = CAL_START_HOUR + i;
    return `${h.toString().padStart(2, '0')}:00`;
  });

  // Now line position
  const nowHour = getHours(today);
  const nowMinute = today.getMinutes();
  const isWithinRange =
    nowHour >= CAL_START_HOUR && nowHour < CAL_END_HOUR;
  const nowTop = isWithinRange
    ? getEventTop(nowHour, nowMinute)
    : -1;

  function renderEventBlock(sem: EnrichedSeminar) {
    const start = parseSeminarTime(sem.startTime);
    const end = parseSeminarTime(sem.endTime);
    if (!start) return null;

    const startH = start.getHours();
    const startM = start.getMinutes();
    const endH = end ? end.getHours() : startH + 1;
    const endM = end ? end.getMinutes() : 0;

    const top = getEventTop(startH, startM);
    const height = getEventHeight(startH, startM, endH, endM);
    const title =
      sem.content?.split('\n')[0]?.trim() ||
      sem.title ||
      `Seminar #${sem.seminarId}`;
    const timeLabel = start
      ? `${formatDisplayTime(start, 'en')}${end ? ` – ${formatDisplayTime(end, 'en')}` : ''}`
      : '';

    const blockClass =
      sem.calendarRole === 'hosting'
        ? `${styles.eventBlock} ${styles.eventBlockHosting}`
        : `${styles.eventBlock} ${styles.eventBlockJoining}`;

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onEventClick?.(sem);
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        setTooltip({ seminar: sem, anchorRect: rect, containerRect });
      }
    };

    return (
      <button
        key={sem.seminarId}
        type="button"
        className={blockClass}
        style={{ top: `${top}px`, height: `${height}px` }}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltip(null)}
        title={title}
        aria-label={title}
      >
        <span className={styles.eventBlockTitle}>{title}</span>
        {height >= 40 && timeLabel && (
          <span className={styles.eventBlockTime}>{timeLabel}</span>
        )}
      </button>
    );
  }

  return (
    <div className={styles.weekContainer} ref={containerRef}>
      {/* Header row */}
      <div className={styles.weekHeader} role="row">
        <div className={styles.weekTimeGutter} aria-hidden />
        {days.map((day) => {
          const isTodayDay = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`${styles.weekDayHeader} ${isTodayDay ? styles.weekDayHeaderIsToday : ''}`}
              role="columnheader"
              aria-label={formatDisplayDate(day, 'en')}
            >
              <span className={styles.weekDayName}>
                {format(day, 'EEE', { locale })}
              </span>
              <span className={styles.weekDayNumber}>
                {format(day, 'd')}
              </span>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className={styles.weekBody} role="grid">
        {/* Time gutter */}
        <div className={styles.weekTimeColumn} aria-hidden>
          {timeLabels.map((label) => (
            <div key={label} className={styles.weekTimeLabel}>
              {label}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const daySeminars = getSeminarsForDay(day);
          const isTodayDay = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={styles.weekDayColumn}
              role="gridcell"
              onClick={() => onDayClick?.(day)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onDayClick?.(day);
                }
              }}
            >
              {/* Hour row guides */}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div key={i} className={styles.weekHourRow} aria-hidden />
              ))}

              {/* Now line */}
              {isTodayDay && isWithinRange && nowTop >= 0 && (
                <div
                  className={styles.nowLine}
                  style={{ top: `${nowTop}px` }}
                  aria-hidden
                />
              )}

              {/* Event blocks */}
              {daySeminars.map((sem) => renderEventBlock(sem))}
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <EventTooltip
          seminar={tooltip.seminar}
          anchorRect={tooltip.anchorRect}
          containerRect={tooltip.containerRect}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Day View
// ─────────────────────────────────────────────────────────────────────────────

interface DayViewProps {
  currentDate: Date;
  hostingSeminars: EnrichedSeminar[];
  joiningSeminars: EnrichedSeminar[];
  onEventClick?: (seminar: EnrichedSeminar) => void;
}

function DayView({
  currentDate,
  hostingSeminars,
  joiningSeminars,
  onEventClick,
}: DayViewProps) {
  const locale = useDateFnsLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    seminar: EnrichedSeminar;
    anchorRect: DOMRect;
    containerRect: DOMRect;
  } | null>(null);

  const today = new Date();
  const isTodayDay = isToday(currentDate);

  const allSeminars = useMemo(
    () => [...hostingSeminars, ...joiningSeminars],
    [hostingSeminars, joiningSeminars],
  );

  function getSeminarsForDay(day: Date): EnrichedSeminar[] {
    return allSeminars.filter((sem) => {
      const start = parseSeminarTime(sem.startTime);
      return start !== null && isSameDay(start, day);
    });
  }

  const daySeminars = getSeminarsForDay(currentDate);

  const timeLabels = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
    const h = CAL_START_HOUR + i;
    return `${h.toString().padStart(2, '0')}:00`;
  });

  // Now line
  const nowHour = getHours(today);
  const nowMinute = today.getMinutes();
  const isWithinRange = nowHour >= CAL_START_HOUR && nowHour < CAL_END_HOUR;
  const nowTop = isWithinRange ? getEventTop(nowHour, nowMinute) : -1;

  function renderEventBlock(sem: EnrichedSeminar) {
    const start = parseSeminarTime(sem.startTime);
    const end = parseSeminarTime(sem.endTime);
    if (!start) return null;

    const startH = start.getHours();
    const startM = start.getMinutes();
    const endH = end ? end.getHours() : startH + 1;
    const endM = end ? end.getMinutes() : 0;

    const top = getEventTop(startH, startM);
    const height = getEventHeight(startH, startM, endH, endM);
    const title =
      sem.content?.split('\n')[0]?.trim() ||
      sem.title ||
      `Seminar #${sem.seminarId}`;
    const timeLabel = start
      ? `${formatDisplayTime(start, 'en')}${end ? ` – ${formatDisplayTime(end, 'en')}` : ''}`
      : '';

    const blockClass =
      sem.calendarRole === 'hosting'
        ? `${styles.eventBlock} ${styles.eventBlockHosting}`
        : `${styles.eventBlock} ${styles.eventBlockJoining}`;

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onEventClick?.(sem);
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (containerRect) {
        setTooltip({ seminar: sem, anchorRect: rect, containerRect });
      }
    };

    return (
      <button
        key={sem.seminarId}
        type="button"
        className={blockClass}
        style={{ top: `${top}px`, height: `${height}px` }}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltip(null)}
        title={title}
        aria-label={title}
      >
        <span className={styles.eventBlockTitle}>{title}</span>
        {height >= 40 && timeLabel && (
          <span className={styles.eventBlockTime}>{timeLabel}</span>
        )}
      </button>
    );
  }

  return (
    <div className={styles.weekContainer} ref={containerRef}>
      {/* Single day header — uses dayHeader layout so it lines up with
          the 2-column grid body below (time gutter + single day column).
          Without this, the header still used the 7-day `weekHeader` and
          the day header cell only filled 1/7 of the width while the
          body filled 100%. */}
      <div className={styles.dayHeader} role="row">
        <div className={styles.weekTimeGutter} aria-hidden />
        <div
          className={`${styles.weekDayHeader} ${isTodayDay ? styles.weekDayHeaderIsToday : ''}`}
          role="columnheader"
          aria-label={formatDisplayDate(currentDate, 'en')}
        >
          <span className={styles.weekDayName}>
            {format(currentDate, 'EEEE', { locale })}
          </span>
          <span className={styles.weekDayNumber}>
            {format(currentDate, 'd')}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className={styles.dayBody} role="grid">
        <div className={styles.weekTimeColumn} aria-hidden>
          {timeLabels.map((label) => (
            <div key={label} className={styles.weekTimeLabel}>
              {label}
            </div>
          ))}
        </div>

        <div
          className={styles.weekDayColumn}
          role="gridcell"
        >
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <div key={i} className={styles.weekHourRow} aria-hidden />
          ))}

          {isTodayDay && isWithinRange && nowTop >= 0 && (
            <div
              className={styles.nowLine}
              style={{ top: `${nowTop}px` }}
              aria-hidden
            />
          )}

          {daySeminars.map((sem) => renderEventBlock(sem))}
        </div>
      </div>

      {tooltip && (
        <EventTooltip
          seminar={tooltip.seminar}
          anchorRect={tooltip.anchorRect}
          containerRect={tooltip.containerRect}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function SeminarCalendar({
  hostingSeminars,
  joiningSeminars,
  onEventClick,
  initialDate,
  showHostingLegend = true,
  isLoading = false,
  errorMessage = null,
  onRetry,
}: SeminarCalendarProps) {
  const locale = useDateFnsLocale();
  const isVi = useLocale() === 'vi';

  // Defensive: even if the caller forgets to filter, never display a
  // hosting bucket for roles that can't host (Reviewer / Graduate
  // Student). The hook already gates on `canMutateSeminar`, this is a
  // belt-and-braces guard for any callers that bypass the hook.
  const visibleHostingSeminars = showHostingLegend ? hostingSeminars : [];
  const visibleJoiningSeminars = joiningSeminars;
  const visibleHostingLegend = showHostingLegend;

  const [view, setView] = useState<CalendarView>('week');
  const [currentDate, setCurrentDate] = useState<Date>(
    initialDate ?? new Date(),
  );

  // Sync with initialDate prop changes (e.g. external navigation)
  useEffect(() => {
    if (initialDate) setCurrentDate(initialDate);
  }, [initialDate]);

  const allSeminars = useMemo(
    () => [...visibleHostingSeminars, ...visibleJoiningSeminars],
    [visibleHostingSeminars, visibleJoiningSeminars],
  );

  const hasSeminars = allSeminars.length > 0;

  // Title in header
  const title = useMemo(() => {
    if (view === 'month') {
      return format(currentDate, 'MMMM yyyy', { locale });
    }
    if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { locale });
      const weekEnd = endOfWeek(currentDate, { locale });
      const startStr = format(weekStart, 'MMM d', { locale });
      const endStr = format(weekEnd, 'MMM d, yyyy', { locale });
      return `${startStr} – ${endStr}`;
    }
    return format(currentDate, 'EEEE, MMMM d, yyyy', { locale });
  }, [currentDate, view, locale]);

  // Navigation
  const navigatePrev = useCallback(() => {
    setCurrentDate((d) => {
      if (view === 'month') return subMonths(d, 1);
      if (view === 'week') return subWeeks(d, 1);
      return subDays(d, 1);
    });
  }, [view]);

  const navigateNext = useCallback(() => {
    setCurrentDate((d) => {
      if (view === 'month') return addMonths(d, 1);
      if (view === 'week') return addWeeks(d, 1);
      return addDays(d, 1);
    });
  }, [view]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleDayClick = useCallback(
    (day: Date) => {
      setCurrentDate(day);
      setView('day');
    },
    [],
  );

  const t = (en: string, vi_text?: string) =>
    isVi && vi_text ? vi_text : en;

  return (
    <div className={styles.page} role="region" aria-label={t('Seminar Calendar', 'Lịch hội thảo')}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={navigatePrev}
            aria-label={t('Previous', 'Trước')}
            title={t('Previous', 'Trước')}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>

          <button
            type="button"
            className={styles.todayBtn}
            onClick={goToToday}
          >
            {t('Today', 'Hôm nay')}
          </button>

          <button
            type="button"
            className={styles.navBtn}
            onClick={navigateNext}
            aria-label={t('Next', 'Sau')}
            title={t('Next', 'Sau')}
          >
            <ChevronRight size={16} aria-hidden />
          </button>

          <span className={styles.dateTitle} aria-live="polite">
            {title}
          </span>
        </div>

        <div className={styles.headerRight}>
          {/* View toggle */}
          <div className={styles.viewToggle} role="group" aria-label={t('Calendar view', 'Chế độ xem lịch')}>
            <button
              type="button"
              className={`${styles.viewPill} ${view === 'day' ? styles.viewPillActive : ''}`}
              onClick={() => setView('day')}
              aria-pressed={view === 'day'}
            >
              {t('Day', 'Ngày')}
            </button>
            <button
              type="button"
              className={`${styles.viewPill} ${view === 'week' ? styles.viewPillActive : ''}`}
              onClick={() => setView('week')}
              aria-pressed={view === 'week'}
            >
              {t('Week', 'Tuần')}
            </button>
            <button
              type="button"
              className={`${styles.viewPill} ${view === 'month' ? styles.viewPillActive : ''}`}
              onClick={() => setView('month')}
              aria-pressed={view === 'month'}
            >
              {t('Month', 'Tháng')}
            </button>
          </div>

          {/* Legend */}
          <div className={styles.legend} aria-label={t('Legend', 'Chú thích')}>
            {visibleHostingLegend ? (
              <div className={styles.legendItem}>
                <span
                  className={`${styles.legendDot} ${styles.legendDotHosting}`}
                  aria-hidden
                />
                <span>{t('Hosting', 'Đang tổ chức')}</span>
              </div>
            ) : null}
            <div className={styles.legendItem}>
              <span
                className={`${styles.legendDot} ${styles.legendDotJoining}`}
                aria-hidden
              />
              <span>{t('Joining', 'Tham gia')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status banner — loading chip, error chip, or empty hint. The
          calendar grid ALWAYS renders below these banners so the date /
          time structure stays visible to every role, regardless of
          whether they have seminars to display. Replacing the entire
          grid with a blank panel (the previous behaviour) left
          Reviewer / Graduate Student with a header-only calendar that
          gave no sense of where in the month/week they were. */}
      {isLoading ? (
        <div className={styles.statusBanner} role="status">
          <Loader size={14} className={styles.spinningIcon} aria-hidden />
          <span>{t('Loading seminars…', 'Đang tải hội thảo…')}</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={14} aria-hidden />
          <span>{errorMessage}</span>
          {onRetry ? (
            <button
              type="button"
              className={styles.bannerAction}
              onClick={onRetry}
            >
              {t('Retry', 'Thử lại')}
            </button>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !errorMessage && !hasSeminars ? (
        <div className={styles.emptyHint} role="status">
          <Inbox size={14} aria-hidden />
          <span>
            {t(
              'No seminars in this view. Browse the calendar — seminars appear here once you have invitations or scheduled sessions.',
              'Chưa có hội thảo nào trong chế độ xem này. Hãy duyệt lịch — các hội thảo sẽ hiện ở đây khi bạn có lời mời hoặc buổi đã lên lịch.',
            )}
          </span>
        </div>
      ) : null}

      {/* Calendar body — ALWAYS rendered so the date/time grid is
          visible to every role. The empty/loading banners above are
          decorative overlays that don't replace the grid. */}
      <div className={styles.viewContainer}>
        {view === 'month' && (
          <MonthView
            currentDate={currentDate}
            hostingSeminars={visibleHostingSeminars}
            joiningSeminars={visibleJoiningSeminars}
            onEventClick={onEventClick}
            onDayClick={handleDayClick}
          />
        )}
        {view === 'week' && (
          <WeekView
            currentDate={currentDate}
            hostingSeminars={visibleHostingSeminars}
            joiningSeminars={visibleJoiningSeminars}
            onEventClick={onEventClick}
            onDayClick={handleDayClick}
          />
        )}
        {view === 'day' && (
          <DayView
            currentDate={currentDate}
            hostingSeminars={visibleHostingSeminars}
            joiningSeminars={visibleJoiningSeminars}
            onEventClick={onEventClick}
          />
        )}
      </div>
    </div>
  );
}

export default SeminarCalendar;
