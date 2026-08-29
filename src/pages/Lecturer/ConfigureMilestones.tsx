import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Loader,
  Save,
  FileText,
  CheckCircle2,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { useResearchTopics } from '../../hooks/useResearchTopics';
import { useResearchGroups } from '../../hooks/useResearchGroups';
import {
  phasedReportService,
  type PhasedReport,
} from '../../services/phasedReport.service';
import type { TopicPhaseItem } from '../../types/researchWorkflowDtos';
import styles from './ConfigureMilestones.module.css';

const DEFAULT_PHASES: { phaseNumber: number; milestoneTitle: string; defaultDays: number }[] = [
  {
    phaseNumber: 1,
    milestoneTitle: 'Phase 1: Tổng quan tài liệu & Xác định bài toán',
    defaultDays: 14,
  },
  {
    phaseNumber: 2,
    milestoneTitle: 'Phase 2: Thiết kế kiến trúc & Thu thập dữ liệu',
    defaultDays: 30,
  },
  {
    phaseNumber: 3,
    milestoneTitle: 'Phase 3: Xây dựng Model AI & Huấn luyện',
    defaultDays: 60,
  },
  {
    phaseNumber: 4,
    milestoneTitle: 'Phase 4: Đánh giá mô hình & Thử nghiệm',
    defaultDays: 90,
  },
  {
    phaseNumber: 5,
    milestoneTitle: 'Phase 5: Báo cáo tổng kết & Nghiệm thu',
    defaultDays: 120,
  },
];

const getDefaultDeadline = (days: number): string => {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  d.setHours(23, 59, 59, 0);
  return d.toISOString().slice(0, 16);
};

export const ConfigureMilestones = () => {
  const { topics, isLoading: isLoadingTopics } = useResearchTopics();
  const { groups } = useResearchGroups();

  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [existingPhases, setExistingPhases] = useState<PhasedReport[]>([]);
  const [isLoadingPhases, setIsLoadingPhases] = useState<boolean>(false);

  // Form phase items
  const [phaseItems, setPhaseItems] = useState<TopicPhaseItem[]>(
    DEFAULT_PHASES.map((p) => ({
      phaseNumber: p.phaseNumber,
      milestoneTitle: p.milestoneTitle,
      deadlineAt: getDefaultDeadline(p.defaultDays),
    }))
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [banner, setBanner] = useState<{ visible: boolean; text: string; variant: 'success' | 'error' }>({
    visible: false,
    text: '',
    variant: 'success',
  });

  // Auto-select first topic if available
  useEffect(() => {
    if (!selectedTopicId && topics.length > 0 && topics[0]?.id) {
      setSelectedTopicId(topics[0].id);
    }
  }, [topics, selectedTopicId]);

  // Find matching research group for the topic
  const matchingGroup = useMemo(() => {
    if (!selectedTopicId) return null;
    return groups.find((g) => g.topicId === selectedTopicId) ?? null;
  }, [groups, selectedTopicId]);

  // Load existing phases when topic changes
  const loadPhases = async (topicId: number) => {
    setIsLoadingPhases(true);
    try {
      const list = await phasedReportService.getByTopic(topicId);
      setExistingPhases(list);
      if (list.length > 0) {
        // Pre-fill form from existing phases if found
        setPhaseItems(
          DEFAULT_PHASES.map((dp) => {
            const match = list.find((p) => p.phaseNumber === dp.phaseNumber);
            return {
              phaseNumber: dp.phaseNumber,
              milestoneTitle: match?.milestoneTitle || dp.milestoneTitle,
              deadlineAt: match?.deadlineAt
                ? new Date(match.deadlineAt).toISOString().slice(0, 16)
                : getDefaultDeadline(dp.defaultDays),
            };
          })
        );
      }
    } catch {
      setExistingPhases([]);
    } finally {
      setIsLoadingPhases(false);
    }
  };

  useEffect(() => {
    if (selectedTopicId) {
      void loadPhases(selectedTopicId);
    }
  }, [selectedTopicId]);

  const handlePhaseTitleChange = (index: number, title: string) => {
    setPhaseItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], milestoneTitle: title };
      }
      return next;
    });
  };

  const handlePhaseDeadlineChange = (index: number, deadline: string) => {
    setPhaseItems((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], deadlineAt: deadline };
      }
      return next;
    });
  };

  const handleSaveMilestones = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicId) {
      setBanner({ visible: true, text: 'Vui lòng chọn Đề tài nghiên cứu (Research Topic).', variant: 'error' });
      return;
    }

    // Validate deadlines
    for (const p of phaseItems) {
      if (!p.milestoneTitle.trim()) {
        setBanner({ visible: true, text: `Vui lòng nhập tiêu đề cho Phase ${p.phaseNumber}.`, variant: 'error' });
        return;
      }
      if (!p.deadlineAt) {
        setBanner({ visible: true, text: `Vui lòng chọn thời hạn (Deadline) cho Phase ${p.phaseNumber}.`, variant: 'error' });
        return;
      }
    }

    setIsSaving(true);
    setBanner({ visible: false, text: '', variant: 'success' });

    try {
      const formattedPhases = phaseItems.map((p) => ({
        phaseNumber: p.phaseNumber,
        milestoneTitle: p.milestoneTitle.trim(),
        deadlineAt: new Date(p.deadlineAt).toISOString(),
      }));

      const created = await phasedReportService.setTopicMilestones({
        topicId: selectedTopicId,
        researchGroupId: matchingGroup?.id ?? null,
        phases: formattedPhases,
      });

      setExistingPhases(created);
      setBanner({
        visible: true,
        text: `Đã thiết lập thành công 5 cột mốc (Phase 1-5) cho Đề tài!`,
        variant: 'success',
      });
      await loadPhases(selectedTopicId);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể thiết lập 5 cột mốc. Vui lòng thử lại.';
      setBanner({ visible: true, text: msg, variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'Passed':
        return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
      case 'OnTime':
        return { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' };
      case 'Overdue':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' };
      case 'Rejected':
        return { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' };
      default:
        return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
    }
  };

  return (
    <div className={styles.configureMilestones}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; Guidance Group &gt; <span className={styles.activeBreadcrumb}>Configure Milestones</span>
      </div>

      {/* Banner */}
      {banner.visible && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            borderRadius: '8px',
            backgroundColor: banner.variant === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${banner.variant === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: banner.variant === 'success' ? '#166534' : '#991b1b',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          {banner.variant === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className={styles.configCard}>
        <div className={styles.cardHeader}>
          <div className={styles.headerTitleRow}>
            <span className={styles.headerLabel}>RESEARCH TOPIC MILESTONES</span>
            <h1 className={styles.pageTitle}>THIẾT LẬP 5 GIAI ĐOẠN BÁO CÁO TIẾN ĐỘ</h1>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 16,
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
            }}
          >
            <Layers size={14} /> 5-PHASE WORKFLOW
          </span>
        </div>

        {/* Topic Selector */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>
            Chọn Đề tài Nghiên cứu (Research Topic):
          </label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              style={{
                flex: '1 1 350px',
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                backgroundColor: '#ffffff',
                color: '#0f172a',
              }}
              value={selectedTopicId ?? ''}
              onChange={(e) => setSelectedTopicId(Number(e.target.value))}
              disabled={isLoadingTopics}
            >
              {topics.length === 0 ? (
                <option value="">Không có đề tài nào</option>
              ) : (
                topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title || `Topic #${t.id}`} {t.status ? `(${t.status})` : ''}
                  </option>
                ))
              )}
            </select>

            {matchingGroup && (
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Nhóm phụ trách: <strong style={{ color: '#0f172a' }}>{matchingGroup.name}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Form to configure 5 phases */}
        <form onSubmit={handleSaveMilestones} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {phaseItems.map((phase, idx) => {
              const existing = existingPhases.find((p) => p.phaseNumber === phase.phaseNumber);
              const statusStyle = getStatusColor(existing?.status);

              return (
                <div
                  key={phase.phaseNumber}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          backgroundColor: '#0f172a',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                        }}
                      >
                        {phase.phaseNumber}
                      </span>
                      <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                        Phase {phase.phaseNumber}
                      </strong>
                    </div>

                    {existing && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: statusStyle.bg,
                            color: statusStyle.text,
                            border: `1px solid ${statusStyle.border}`,
                          }}
                        >
                          {existing.status || 'Pending'}
                        </span>
                        {existing.lectureFeedback != null && (
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#15803d' }}>
                            Điểm: {existing.lectureFeedback}/10
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                        Tên cột mốc / Nội dung yêu cầu:
                      </label>
                      <input
                        type="text"
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.85rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.9rem',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                        }}
                        value={phase.milestoneTitle}
                        onChange={(e) => handlePhaseTitleChange(idx, e.target.value)}
                        placeholder={`Nhập tên cho Phase ${phase.phaseNumber}...`}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                        Hạn chót nộp bài (Deadline):
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="datetime-local"
                          style={{
                            width: '100%',
                            padding: '0.55rem 0.85rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.9rem',
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                          }}
                          value={phase.deadlineAt}
                          onChange={(e) => handlePhaseDeadlineChange(idx, e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {existing?.reportFileUrl && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={14} color="#0284c7" />
                      <span>Bài nộp của nhóm:</span>
                      <a
                        href={existing.reportFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#0284c7', textDecoration: 'underline', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                      >
                        Xem file PDF đã nộp <ExternalLink size={12} />
                      </a>
                      {existing.submittedAt && (
                        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                          (Nộp lúc: {new Date(existing.submittedAt).toLocaleString()})
                        </span>
                      )}
                    </div>
                  )}

                  {existing?.lecturerDescription && (
                    <div style={{ backgroundColor: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.825rem', color: '#334155' }}>
                      <strong>Nhận xét của Giảng viên:</strong> {existing.lecturerDescription}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.75rem 1.75rem',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: 600,
                border: 'none',
                cursor: isSaving || isLoadingPhases ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
              disabled={isSaving || isLoadingPhases}
            >
              {isSaving ? <Loader size={16} className={styles.spinningIcon} /> : <Save size={16} />}
              {isSaving ? 'Đang lưu 5 Phase…' : 'Lưu & Thiết lập 5 Cột mốc'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConfigureMilestones;