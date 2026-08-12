import { useState } from 'react';
import styles from './StudentResearchGroups.module.css';

interface AssignedTopic {
  id: string;
  title: string;
  dueDate: string;
  lecturer: string;
  status: 'Pending upload' | 'Submitted' | 'Reviewed';
  submittedFile?: string;
  fileSize?: string;
  notes?: string;
  grade?: string;
  feedbackComment?: string;
  annotatedFile?: string;
}

export const StudentResearchGroups = () => {
  const [viewMode, setViewMode] = useState<'overview' | 'workspace'>('overview');
  const [showInvitationBanner, setShowInvitationBanner] = useState(true);

  // Filters state
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modals state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<AssignedTopic | null>(null);

  // Submit Modal File Upload State (Frame 3 & 4)
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: string } | null>(null);
  const [lecturerNotes, setLecturerNotes] = useState('');

  // Topics state
  const [topics, setTopics] = useState<AssignedTopic[]>([
    {
      id: 'TOPIC-001',
      title: 'Telemetry Data Optimization',
      dueDate: 'Aug 15, 2026',
      lecturer: 'Prof. Tran Minh B',
      status: 'Pending upload',
    },
    {
      id: 'TOPIC-002',
      title: 'Consensus Protocols Benchmark',
      dueDate: 'Aug 01, 2026',
      lecturer: 'Prof. Tran Minh B',
      status: 'Submitted',
      submittedFile: 'file.pdf',
      fileSize: '2.1 MB',
    },
    {
      id: 'TOPIC-003',
      title: 'Microservice Topology Review',
      dueDate: 'Jul 20, 2026',
      lecturer: 'Prof. Tran Minh B',
      status: 'Reviewed',
      submittedFile: 'Microservice_Topology_Submission.pdf',
      grade: '9.5 / 10',
      feedbackComment:
        'Excellent analysis of stateful vs stateless microservices. The telemetry benchmark results are clear and well-documented. Approved for final group report.',
      annotatedFile: 'Microservice_Topology_Annotated.pdf',
    },
  ]);

  const handleAcceptInvitation = () => {
    alert('You have accepted the group invitation from Prof. Tran Minh B for "Distributed Systems Lab 2026".');
    setShowInvitationBanner(false);
  };

  const handleDeclineInvitation = () => {
    setShowInvitationBanner(false);
  };

  const handleOpenSubmitModal = (topic: AssignedTopic) => {
    setSelectedTopic(topic);
    if (topic.submittedFile) {
      setAttachedFile({ name: topic.submittedFile, size: topic.fileSize || '2.1 MB' });
    } else {
      setAttachedFile(null);
    }
    setLecturerNotes('');
    setShowSubmitModal(true);
  };

  const handleOpenGradeModal = (topic: AssignedTopic) => {
    setSelectedTopic(topic);
    setShowGradeModal(true);
  };

  const handleConfirmSubmitPDF = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopic) return;

    const fileToSubmit = attachedFile ? attachedFile.name : 'file.pdf';
    setTopics(
      topics.map((t) =>
        t.id === selectedTopic.id
          ? {
              ...t,
              status: 'Submitted',
              submittedFile: fileToSubmit,
              fileSize: attachedFile ? attachedFile.size : '2.1 MB',
              notes: lecturerNotes,
            }
          : t
      )
    );

    setShowSubmitModal(false);
    alert(`Successfully submitted assignment for ${selectedTopic.title}!`);
  };

  const filteredTopics = topics.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus =
      statusFilter === 'All' || statusFilter === '' || t.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className={styles.studentResearchPage}>
      {/* Overview Mode (Frame 1) */}
      {viewMode === 'overview' && (
        <div className={styles.overviewContainer}>
          {/* New Group Invitation Notification Box */}
          {showInvitationBanner && (
            <div className={styles.invitationBox}>
              <div className={styles.invitationLeft}>
                <div className={styles.mailIconCircle}>✉️</div>
                <div>
                  <h4 className={styles.invitationTitle}>New Group Invitation</h4>
                  <p className={styles.invitationSub}>
                    You have a new group invitation from <b>Prof. Tran Minh B</b> for <b>"Distributed Systems Lab 2026"</b>.
                  </p>
                </div>
              </div>
              <div className={styles.invitationActions}>
                <button className={styles.acceptBtn} onClick={handleAcceptInvitation}>
                  Accept Invitation
                </button>
                <button className={styles.declineBtn} onClick={handleDeclineInvitation}>
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Section: My Joined Research Groups */}
          <div className={styles.joinedGroupsSection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>My Joined Research Groups</h3>
              <p className={styles.sectionSubtitle}>
                Collaborate with lecturers and complete assigned topics.
              </p>
            </div>

            {/* Joined Group Card */}
            <div className={styles.joinedGroupCard}>
              <div className={styles.groupCardLeft}>
                <div className={styles.groupIconCircle}>👥</div>
                <div className={styles.groupInfoBlock}>
                  <div className={styles.groupTitleRow}>
                    <h4 className={styles.groupName}>AI & Edge Computing Lab</h4>
                    <span className={styles.activeStatusPill}>Active</span>
                  </div>
                  <div className={styles.groupMetaRow}>
                    <span><b>Lecturer:</b> Prof. Tran Minh B</span>
                    <span className={styles.metaDivider}>|</span>
                    <span><b>Members:</b> 5 Students</span>
                    <span className={styles.metaDivider}>|</span>
                    <span><b>Active Topics:</b> 3 Assigned</span>
                  </div>
                </div>
              </div>

              <div className={styles.groupCardRight}>
                <button
                  className={styles.openWorkspaceBlueBtn}
                  onClick={() => setViewMode('workspace')}
                >
                  Open Group Workspace
                </button>
                <button
                  className={styles.leaveGroupRedBtn}
                  onClick={() => alert('Leaving group...')}
                >
                  Leave Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Mode (Frame 2) */}
      {viewMode === 'workspace' && (
        <div className={styles.workspaceContainer}>
          {/* Back to Research Groups link */}
          <button className={styles.backLinkBtn} onClick={() => setViewMode('overview')}>
            ← Back to Research Groups
          </button>

          {/* Group Header Banner */}
          <div className={styles.workspaceHeaderCard}>
            <div className={styles.workspaceHeaderLeft}>
              <div className={styles.workspaceIconCircle}>👥</div>
              <div>
                <h2 className={styles.workspaceTitle}>AI & Edge Computing Lab</h2>
                <p className={styles.workspaceSubtitle}>
                  Supervised by Prof. Tran Minh B · Department of Computer Science
                </p>
              </div>
            </div>

            <div className={styles.workspaceHeaderRight}>
              <div className={styles.membersAvatarGroup}>
                <span className={styles.avatarPill} style={{ backgroundColor: '#2563eb' }}>S1</span>
                <span className={styles.avatarPill} style={{ backgroundColor: '#10b981' }}>S2</span>
                <span className={styles.avatarPill} style={{ backgroundColor: '#f59e0b' }}>S3</span>
                <span className={styles.avatarPill} style={{ backgroundColor: '#ef4444' }}>S4</span>
                <span className={styles.avatarPill} style={{ backgroundColor: '#8b5cf6' }}>PT</span>
              </div>
              <button
                className={styles.leaveGroupRedBtn}
                onClick={() => {
                  alert('Left research group');
                  setViewMode('overview');
                }}
              >
                Leave Group
              </button>
            </div>
          </div>

          {/* Assigned Topics Section */}
          <div className={styles.topicsTableCard}>
            <div className={styles.topicsTableHeader}>
              <h3 className={styles.assignedTopicsTitle}>Assigned Topics</h3>

              <div className={styles.filterControls}>
                <input
                  type="text"
                  className={styles.topicSearchInput}
                  placeholder="Search topics..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <select
                  className={styles.statusFilterSelect}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending upload">Pending upload</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Reviewed">Reviewed</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>TOPIC TITLE</th>
                    <th>DUE DATE</th>
                    <th>LECTURER</th>
                    <th>STATUS</th>
                    <th style={{ textTransform: 'uppercase' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTopics.map((tp) => (
                    <tr key={tp.id}>
                      <td className={styles.topicTitleText}>{tp.title}</td>
                      <td className={styles.dueDateText}>{tp.dueDate}</td>
                      <td className={styles.lecturerText}>{tp.lecturer}</td>
                      <td>
                        {tp.status === 'Pending upload' && (
                          <span className={styles.pendingUploadPill}>Pending upload</span>
                        )}
                        {tp.status === 'Submitted' && (
                          <span className={styles.submittedPill}>Submitted</span>
                        )}
                        {tp.status === 'Reviewed' && (
                          <span className={styles.reviewedPill}>Reviewed</span>
                        )}
                      </td>
                      <td>
                        {tp.status === 'Pending upload' && (
                          <button
                            className={styles.submitAssignmentBlueBtn}
                            onClick={() => handleOpenSubmitModal(tp)}
                          >
                            Submit Assignment
                          </button>
                        )}
                        {tp.status === 'Submitted' && (
                          <button
                            className={styles.reuploadOutlineBtn}
                            onClick={() => handleOpenSubmitModal(tp)}
                          >
                            Re-upload Assignment
                          </button>
                        )}
                        {tp.status === 'Reviewed' && (
                          <button
                            className={styles.viewReviewOutlineBtn}
                            onClick={() => handleOpenGradeModal(tp)}
                          >
                            View Review & Grade
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* FRAMES 3 & 4: SUBMIT TOPIC ASSIGNMENT MODAL */}
      {showSubmitModal && selectedTopic && (
        <div className={styles.modalOverlay}>
          <div className={styles.submitModalCard}>
            <div className={styles.modalHeaderRow}>
              <h3 className={styles.modalTitle}>
                Submit Topic Assignment &mdash; {selectedTopic.title}
              </h3>
              <button className={styles.closeBtn} onClick={() => setShowSubmitModal(false)}>×</button>
            </div>

            <p className={styles.modalSubtitleText}>
              Upload or update your completed research assignment in PDF format for lecturer evaluation.
            </p>

            <form onSubmit={handleConfirmSubmitPDF} className={styles.modalForm}>
              {/* Dropzone Area (Frame 3) or Attached Card (Frame 4) */}
              {!attachedFile ? (
                <div
                  className={styles.pdfDropzone}
                  onClick={() => setAttachedFile({ name: 'file.pdf', size: '2.1 MB' })}
                >
                  <span className={styles.cloudIcon}>☁️</span>
                  <span className={styles.dropzoneMainText}>
                    Drag & drop verification document here, or <span className={styles.browseBlueText}>browse files</span>
                  </span>
                  <span className={styles.dropzoneSubText}>PDF format only · Max 10MB</span>
                </div>
              ) : (
                <div className={styles.attachedPdfCard}>
                  <div className={styles.pdfCardLeft}>
                    <span className={styles.pdfIcon}>📄</span>
                    <div>
                      <span className={styles.pdfFileName}>{attachedFile.name}</span>
                      <span className={styles.pdfFileSize}>{attachedFile.size}</span>
                    </div>
                  </div>
                  <div className={styles.pdfCardRight}>
                    <span className={styles.checkCircleGreenIcon}>✓</span>
                    <button
                      type="button"
                      className={styles.removePdfBtn}
                      onClick={() => setAttachedFile(null)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Notes for Lecturer (Optional) */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Notes for Lecturer (Optional)</label>
                <textarea
                  className={styles.formTextarea}
                  value={lecturerNotes}
                  onChange={(e) => setLecturerNotes(e.target.value)}
                  placeholder="Add any notes or context about your submission..."
                  rows={3}
                />
              </div>

              {/* Footer */}
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.modalCancelBtn}
                  onClick={() => setShowSubmitModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.confirmSubmitBlueBtn}>
                  Confirm & Submit PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FRAME 5: LECTURER REVIEW & GRADE MODAL */}
      {showGradeModal && selectedTopic && (
        <div className={styles.modalOverlay}>
          <div className={styles.gradeModalCard}>
            <div className={styles.modalHeaderRow}>
              <h3 className={styles.modalTitle}>
                Lecturer Review & Grade &mdash; {selectedTopic.title}
              </h3>
              <button className={styles.closeBtn} onClick={() => setShowGradeModal(false)}>×</button>
            </div>

            {/* Green Header Banner */}
            <div className={styles.gradeStatusBanner}>
              <div className={styles.gradeStatusLeft}>
                <span className={styles.gradeCheckIcon}>✓</span>
                <span className={styles.gradeStatusText}>Status: Reviewed & Approved</span>
              </div>
              <span className={styles.gradeScoreBadge}>Grade: {selectedTopic.grade || '9.5 / 10'}</span>
            </div>

            {/* Lecturer Comment Box */}
            <div className={styles.lecturerCommentCard}>
              <div className={styles.lecturerInfoRow}>
                <div className={styles.lecturerAvatarCircle}>PT</div>
                <div>
                  <span className={styles.lecturerNameText}>{selectedTopic.lecturer}</span>
                  <span className={styles.commentDateText}>Jul 22, 2026</span>
                </div>
              </div>
              <p className={styles.commentBodyText}>
                {selectedTopic.feedbackComment ||
                  'Excellent analysis of stateful vs stateless microservices. The telemetry benchmark results are clear and well-documented. Approved for final group report.'}
              </p>
            </div>

            {/* Annotated File Box */}
            <div className={styles.annotatedFileCard}>
              <div className={styles.annotatedLeft}>
                <span className={styles.annotatedPdfIcon}>📄</span>
                <div>
                  <span className={styles.annotatedFileName}>
                    {selectedTopic.annotatedFile || 'Microservice_Topology_Annotated.pdf'}
                  </span>
                  <span className={styles.annotatedSubText}>Annotated by lecturer</span>
                </div>
              </div>
              <button
                className={styles.downloadBlueBtn}
                onClick={() => alert(`Downloading ${selectedTopic.annotatedFile || 'Microservice_Topology_Annotated.pdf'}`)}
              >
                📥 Download
              </button>
            </div>

            {/* Footer */}
            <div className={styles.gradeModalFooter}>
              <button
                className={styles.closeReviewNavyBtn}
                onClick={() => setShowGradeModal(false)}
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentResearchGroups;
