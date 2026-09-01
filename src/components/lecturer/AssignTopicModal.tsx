import { useEffect, useMemo, useState, useRef } from 'react';

const useLocalDialogFocus = (open: boolean, busy: boolean, onClose: () => void) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) { openerRef.current?.focus(); return; }
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]')?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]'));
      if (!focusable.length) return;
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      if (index === 0 && event.shiftKey) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
      else if (index === focusable.length - 1 && !event.shiftKey) { event.preventDefault(); focusable[0].focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', handleKeyDown); };
  }, [open, busy, onClose]);
  return dialogRef;
};
import { Settings, Check, X, AlertTriangle, Loader, Users } from 'lucide-react';
import {
  assignTopicToGroups,
  type GroupAssignOutcome,
  type ResearchGroup,
} from '../../services/researchGroup.service';
import type { ResearchTopic } from '../../services/researchTopic.service';
import styles from './AssignTopicModal.module.css';

export interface AssignTopicModalProps {
  isOpen: boolean;
  topic: ResearchTopic | null;
  groups: ResearchGroup[];
  /** Lecturer id of the currently signed-in user — forwarded to the BE so
   *  the group's `lecturerId` field is preserved on PUT. */
  currentLecturerId?: number | null;
  onClose: () => void;
  onSuccess?: (outcomes: GroupAssignOutcome[]) => void;
}

export const AssignTopicModal = ({
  isOpen,
  topic,
  groups,
  currentLecturerId,
  onClose,
  onSuccess,
}: AssignTopicModalProps) => {
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<GroupAssignOutcome[] | null>(null);
  const dialogRef = useLocalDialogFocus(isOpen, isSubmitting, onClose);

  // Default: groups already assigned to this topic are pre-selected. Other
  // groups (with `topicId === null` OR assigned to a *different* topic) are
  // available but unchecked.
  useEffect(() => {
    if (isOpen && topic) {
      setSelectedGroupIds(new Set());
      setOutcomes(null);
      setSubmitError(null);
    }
  }, [isOpen, topic]);

  // Drop groups already locked to a *different* topic — they will conflict on
  // PUT and we don't want to confuse the lecturer. The BE conflict surface is
  // still surfaced in `outcomes` after submit.
  const availableGroups = useMemo(() => {
    if (!topic) return groups;
    return groups.filter(
      (g) => g.topicId === null || g.topicId === undefined || g.topicId === topic.id,
    );
  }, [groups, topic]);

  const lockedToOtherTopic = useMemo(() => {
    if (!topic) return [];
    return groups.filter(
      (g) => g.topicId !== null && g.topicId !== undefined && g.topicId !== topic.id,
    );
  }, [groups, topic]);

  if (!isOpen || !topic) return null;

  const toggleGroup = (groupId: number) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!topic.id) {
      setSubmitError('Topic has no id — cannot assign.');
      return;
    }
    const ids = Array.from(selectedGroupIds);
    if (ids.length === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await assignTopicToGroups(
        topic.id,
        ids,
        currentLecturerId ?? null,
      );
      setOutcomes(result);
      const failures = result.filter((r) => !r.ok);
      if (failures.length === 0) {
        onSuccess?.(result);
        onClose();
      } else {
        // Keep the modal open so the lecturer can see per-group outcomes.
        setSubmitError(
          `${failures.length} group(s) failed — likely locked by another topic.`,
        );
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to assign topic to groups.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = selectedGroupIds.size;

  return (
    <div ref={dialogRef} className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="assign-topic-title">
      <div className={styles.modalCard}>
        <div className={styles.modalHeaderRow}>
          <div className={styles.modalTitleBlock}>
            <span className={styles.modalIconCircle}>
              <Settings size={18} aria-hidden />
            </span>
            <div>
              <h3 id="assign-topic-title" className={styles.modalTitle}>Assign Research Topic to Groups</h3>
              <span className={styles.modalSubtitle}>
                Choose which groups receive this topic
              </span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Purple topic info box */}
        <div className={styles.topicInfoBox}>
          <span className={styles.topicInfoLabel}>TOPIC BEING ASSIGNED</span>
          <h4 className={styles.topicInfoTitle}>
            [{topic.id ?? '—'}] {topic.title ?? '(untitled topic)'}
          </h4>
          {topic.description && (
            <p className={styles.topicInfoDesc}>{topic.description}</p>
          )}
        </div>

        {/* Locked-to-other banner */}
        {lockedToOtherTopic.length > 0 && (
          <div className={styles.lockedBanner} role="status">
            <AlertTriangle size={14} aria-hidden />
            <span>
              {lockedToOtherTopic.length} group(s) are already locked to another
              topic and are not shown.
            </span>
          </div>
        )}

        {/* Groups list */}
        <div className={styles.selectGroupsSection}>
          <span className={styles.selectGroupsLabel}>SELECT RESEARCH GROUPS</span>
          {availableGroups.length === 0 ? (
            <div className={styles.emptyGroups}>No groups available.</div>
          ) : (
            <div className={styles.groupsCheckboxList}>
              {availableGroups.map((group) => {
                const gid = group.id;
                if (typeof gid !== 'number') return null;
                const isSelected = selectedGroupIds.has(gid);
                return (
                  <div
                    key={gid}
                    className={`${styles.groupCheckboxRow} ${
                      isSelected ? styles.selectedRow : ''
                    }`}
                    onClick={() => toggleGroup(gid)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleGroup(gid);
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={isSelected}
                      readOnly
                      aria-label={`Select group ${group.name ?? gid}`}
                    />
                    <span className={styles.checkboxGroupId}>
                      RG-{String(gid).padStart(3, '0')}
                    </span>
                    <span className={styles.checkboxGroupName}>
                      {group.name ?? '(unnamed group)'}
                    </span>
                    <span className={styles.checkboxMembersCount}>
                      <Users size={12} aria-hidden />
                      {group.deadline
                        ? `Due ${new Date(group.deadline).toISOString().slice(0, 10)}`
                        : 'No deadline'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Per-group outcome panel (after submit) */}
        {outcomes && outcomes.length > 0 && (
          <div className={styles.outcomesBox}>
            <span className={styles.outcomesLabel}>SERVER RESPONSE</span>
            <ul className={styles.outcomesList}>
              {outcomes.map((o) => (
                <li
                  key={o.groupId}
                  className={o.ok ? styles.outcomeOk : styles.outcomeFail}
                >
                  <b>Group #{o.groupId}</b>:{' '}
                  {o.ok
                    ? 'assigned'
                    : (o.error ?? 'unknown error')}
                </li>
              ))}
            </ul>
          </div>
        )}

        {submitError && (
          <div className={styles.errorBanner} role="alert">
            <AlertTriangle size={14} aria-hidden />
            <span>{submitError}</span>
          </div>
        )}

        <div className={styles.modalFooter}>
          <span className={styles.selectedCountText}>
            {selectedCount} group{selectedCount === 1 ? '' : 's'} selected
          </span>
          <div className={styles.footerBtnsRight}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.submitNavyBtn}
              onClick={handleConfirm}
              disabled={isSubmitting || selectedCount === 0}
            >
              {isSubmitting ? (
                <Loader size={14} className={styles.spinningIcon} aria-hidden />
              ) : (
                <Check size={14} aria-hidden />
              )}
              {isSubmitting ? 'Assigning…' : `Confirm Assignment (${selectedCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignTopicModal;