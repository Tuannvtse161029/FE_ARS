/**
 * ManagePhasesModal — inline phase management for a single Research Topic.
 *
 * This modal integrates into the Research Topics table as a replacement for
 * navigating to the separate ConfigureMilestones page. It shows:
 *
 *   1. A group list panel (left side) showing all groups assigned to the topic.
 *   2. A phase editor panel (right side) that renders `PhaseEditorPanel` for
 *      the selected group, allowing lecturers to create, edit, delete phases.
 *
 * The component fetches groups on mount and phase counts per group to populate
 * the group list. It delegates all phase CRUD to `PhaseEditorPanel`.
 *
 * URL contract: none — all state is local to the modal instance.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Layers,
  Loader,
  Users,
  X,
} from 'lucide-react';
import { researchGroupService, type ResearchGroup } from '../../services/researchGroup.service';
import {
  researchTopicPhaseService,
  type ResearchTopicPhase,
} from '../../services/researchTopicPhase.service';
import { PhaseEditorPanel } from './PhaseEditorPanel';
import styles from './ManagePhasesModal.module.css';

interface ManagePhasesModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The research topic to manage phases for */
  topicId: number;
  topicTitle: string;
  /** Callback when modal requests close */
  onClose: () => void;
  /** Optional callback when phases are saved — parent can refetch topic data */
  onSaved?: () => void;
}

export const ManagePhasesModal = ({
  isOpen,
  topicId,
  topicTitle,
  onClose,
  onSaved,
}: ManagePhasesModalProps) => {
  const [groups, setGroups] = useState<ResearchGroup[]>([]);
  const [phaseCounts, setPhaseCounts] = useState<Map<number, number>>(new Map());
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'group-list' | 'phase-editor'>('group-list');

  // ── Fetch groups assigned to this topic ─────────────────────
  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    setGroupsError(null);
    try {
      const allGroups = await researchGroupService.getAll();
      const assignedGroups = allGroups.filter(
        (g) => typeof g.topicId === 'number' && g.topicId === topicId,
      );
      setGroups(assignedGroups);

      // Fetch phase counts per group
      const counts = new Map<number, number>();
      if (assignedGroups.length > 0) {
        const phaseResults = await Promise.allSettled(
          assignedGroups.map((g) => {
            const gid = typeof g.id === 'number' ? g.id : null;
            return gid !== null
              ? researchTopicPhaseService.getByTopic(topicId).then((phases) => ({
                  gid,
                  count: phases.filter(
                    (p) => p.report?.researchGroupId === gid,
                  ).length,
                }))
              : Promise.resolve({ gid: -1, count: 0 });
          }),
        );
        for (const result of phaseResults) {
          if (result.status === 'fulfilled') {
            counts.set(result.value.gid, result.value.count);
          }
        }
      }
      setPhaseCounts(counts);

      // Auto-select first group if only one exists
      if (assignedGroups.length === 1 && typeof assignedGroups[0].id === 'number') {
        setSelectedGroupId(assignedGroups[0].id);
        setViewMode('phase-editor');
      }
    } catch (err) {
      setGroupsError(
        err instanceof Error ? err.message : 'Unable to load research groups.',
      );
    } finally {
      setLoadingGroups(false);
    }
  }, [topicId]);

  useEffect(() => {
    if (isOpen) {
      void loadGroups();
      setSelectedGroupId(null);
      setViewMode('group-list');
    }
  }, [isOpen, loadGroups]);

  // ── Handle group selection ──────────────────────────────────
  const handleSelectGroup = (groupId: number) => {
    setSelectedGroupId(groupId);
    setViewMode('phase-editor');
  };

  // ── Handle back to group list ──────────────────────────────
  const handleBackToGroups = () => {
    setViewMode('group-list');
    setSelectedGroupId(null);
  };

  // ── Handle phase saved ──────────────────────────────────────
  const handleSaved = useCallback(
    (phases: ResearchTopicPhase[]) => {
      // Update the phase count for the selected group
      if (selectedGroupId !== null) {
        setPhaseCounts((prev) => {
          const next = new Map(prev);
          next.set(selectedGroupId, phases.length);
          return next;
        });
      }
      onSaved?.();
    },
    [selectedGroupId, onSaved],
  );

  // ── Render ─────────────────────────────────────────────────
  if (!isOpen) return null;

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-phases-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modalCard}>
        {/* Modal Header */}
        <div className={styles.modalHeaderRow}>
          <div className={styles.modalTitleBlock}>
            <span className={styles.modalIconCircle}>
              <Layers size={18} aria-hidden />
            </span>
            <div>
              <h3
                id="manage-phases-modal-title"
                className={styles.modalTitle}
              >
                {viewMode === 'phase-editor' && selectedGroup
                  ? selectedGroup.name ?? `Group #${selectedGroup.id}`
                  : 'Manage Phases'}
              </h3>
              <span className={styles.modalSubtitle}>
                {viewMode === 'phase-editor' && selectedGroup
                  ? `Topic: ${topicTitle}`
                  : `Topic: ${topicTitle} · ${groups.length} group${groups.length !== 1 ? 's' : ''} assigned`}
              </span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close phase manager"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Left Panel: Group List */}
          <div
            className={`${styles.groupPanel} ${
              viewMode === 'phase-editor' ? styles.groupPanelHidden : ''
            }`}
          >
            <div className={styles.panelHeader}>
              <span className={styles.panelHeaderLabel}>
                <Users size={14} aria-hidden />
                ASSIGNED GROUPS
              </span>
              <span className={styles.panelHeaderCount}>{groups.length}</span>
            </div>

            {loadingGroups ? (
              <div className={styles.loadingState}>
                <Loader
                  size={16}
                  className={styles.spinningIcon}
                  aria-hidden
                />
                Loading groups…
              </div>
            ) : groupsError ? (
              <div className={styles.errorState}>
                <AlertTriangle size={16} aria-hidden />
                <span>{groupsError}</span>
              </div>
            ) : groups.length === 0 ? (
              <div className={styles.emptyState}>
                No groups are assigned to this topic yet. Assign a group first
                to manage their phases.
              </div>
            ) : (
              <div className={styles.groupList}>
                {groups.map((group) => {
                  const gid = typeof group.id === 'number' ? group.id : -1;
                  const phaseCount = phaseCounts.get(gid) ?? 0;
                  const memberCount =
                    typeof group.memberCount === 'number' ? group.memberCount : 0;
                  return (
                    <button
                      key={gid}
                      type="button"
                      className={styles.groupCard}
                      onClick={() => handleSelectGroup(gid)}
                      data-testid={`group-card-${gid}`}
                    >
                      <div className={styles.groupCardLeft}>
                        <span className={styles.groupName}>
                          {group.name ?? `Group #${gid}`}
                        </span>
                        <span className={styles.groupMeta}>
                          <Users size={11} aria-hidden />
                          {memberCount} member{memberCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className={styles.groupCardRight}>
                        <span className={styles.phaseCountBadge}>
                          {phaseCount} phase{phaseCount !== 1 ? 's' : ''}
                        </span>
                        <ChevronRight size={14} aria-hidden />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel: Phase Editor */}
          <div
            className={`${styles.phasePanel} ${
              viewMode === 'group-list' ? styles.phasePanelHidden : ''
            }`}
          >
            {/* Back button */}
            <button
              type="button"
              className={styles.backBtn}
              onClick={handleBackToGroups}
            >
              <ArrowLeft size={14} aria-hidden />
              Back to groups
            </button>

            {/* Phase Editor */}
            {selectedGroupId !== null && (
              <div className={styles.phaseEditorWrapper}>
                <PhaseEditorPanel
                  topicId={topicId}
                  groupId={selectedGroupId}
                  onSaved={handleSaved}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagePhasesModal;
