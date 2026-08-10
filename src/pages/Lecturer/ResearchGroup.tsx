import { useState } from 'react';
import styles from './ResearchGroup.module.css';

interface Group {
  id: string;
  name: string;
  topic: string;
  description: string;
  dueDate: string;
  status: 'Active' | 'Pending';
  members: string[];
  isNew?: boolean;
}

interface Topic {
  id: string;
  name: string;
  description: string;
  assignedGroups: string[];
}

export const ResearchGroup = () => {
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateTopicModal, setShowCreateTopicModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Success Toast Banner State (Frame 43)
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [bannerText, setBannerText] = useState('');

  // Groups list
  const [groups, setGroups] = useState<Group[]>([
    {
      id: 'RG-2026-012',
      name: 'Scalable Routing Architecture Group',
      topic: 'Distributed Systems Scalability',
      description: 'Focusing on WebRTC media streaming optimization and horizontal backend scaling.',
      dueDate: '2026-08-05',
      status: 'Active',
      members: ['student1@ars.edu.vn', 'student2@ars.edu.vn', 'student3@ars.edu.vn'],
    },
  ]);

  // Topics list
  const [topics, setTopics] = useState<Topic[]>([
    {
      id: 'RT-2026-004',
      name: 'Consensus Protocols in Distributed Databases',
      description: 'Evaluating Raft vs Paxos performance under network partition conditions.',
      assignedGroups: ['RG-2026-008'],
    },
  ]);

  // Create Group Modal Form (Frame 40)
  const [groupName, setGroupName] = useState('AI Speech-to-Text Research Team');
  const [groupTopic, setGroupTopic] = useState('NLP Audio Transcription Benchmarks');
  const [groupDesc, setGroupDesc] = useState('Investigating Whisper AI model accuracy across regional dialects.');
  const [groupEmails, setGroupEmails] = useState(['student4@ars.edu.vn', 'student5@ars.edu.vn']);
  const [emailInput, setEmailInput] = useState('');

  // Create Topic Modal Form (Frame 41)
  const [topicName, setTopicName] = useState('High-Concurrency Load Balancing in Microservices');
  const [topicDesc, setTopicDesc] = useState('Architectural strategies for decoupling routing logic from orchestration layers.');
  const [attachedMaterials, setAttachedMaterials] = useState([
    'Distributed_Systems_Syllabus.pdf',
    'Raft_Paper_v2.pdf',
  ]);

  // Assign Topic Modal State (Frame 42)
  const [selectedTopicForAssign, setSelectedTopicForAssign] = useState<Topic | null>(null);
  const [selectedGroupCheckboxes, setSelectedGroupCheckboxes] = useState<{ [id: string]: boolean }>({
    'RG-2026-012': true,
    'RG-2026-015': true,
    'RG-2026-009': false,
  });

  const handleAddEmail = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && emailInput.trim()) {
      if (!groupEmails.includes(emailInput.trim())) {
        setGroupEmails([...groupEmails, emailInput.trim()]);
      }
      setEmailInput('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setGroupEmails(groupEmails.filter((x) => x !== email));
  };

  const handleRemoveMaterial = (fileName: string) => {
    setAttachedMaterials(attachedMaterials.filter((x) => x !== fileName));
  };

  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const newGroup: Group = {
      id: 'RG-2026-015',
      name: groupName,
      topic: groupTopic || 'NLP Audio Transcription Benchmarks',
      description: groupDesc || 'Investigating Whisper AI model accuracy across regional dialects.',
      dueDate: '2026-08-15',
      status: 'Active',
      members: groupEmails.length > 0 ? groupEmails : ['student4@ars.edu.vn', 'student5@ars.edu.vn'],
      isNew: true,
    };

    setGroups([...groups, newGroup]);
    setShowCreateGroupModal(false);
    setBannerText(`Research Group ${newGroup.id} ("${groupName}") created successfully.`);
    setShowSuccessBanner(true);
  };

  const handleCreateTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicName.trim()) return;

    const newTopic: Topic = {
      id: 'RT-2026-009',
      name: topicName,
      description: topicDesc || 'Architectural strategies for decoupling routing logic from orchestration layers.',
      assignedGroups: [],
    };

    setTopics([...topics, newTopic]);
    setShowCreateTopicModal(false);
    setBannerText(`Research Topic ${newTopic.id} ("${topicName}") created successfully.`);
    setShowSuccessBanner(true);
  };

  const handleOpenAssignModal = (topic: Topic) => {
    setSelectedTopicForAssign(topic);
    setShowAssignModal(true);
  };

  const handleConfirmAssignment = () => {
    if (!selectedTopicForAssign) return;

    const assignedIds = Object.keys(selectedGroupCheckboxes).filter(
      (id) => selectedGroupCheckboxes[id]
    );

    setTopics(
      topics.map((t) =>
        t.id === selectedTopicForAssign.id
          ? { ...t, assignedGroups: assignedIds.length > 0 ? assignedIds : ['Unassigned'] }
          : t
      )
    );

    setShowAssignModal(false);
    setBannerText(
      `Topic ${selectedTopicForAssign.id} successfully assigned to ${assignedIds.length} Research Groups.\n${assignedIds.join(' and ')} have been updated with the new topic assignment.`
    );
    setShowSuccessBanner(true);
  };

  const toggleGroupCheckbox = (id: string) => {
    setSelectedGroupCheckboxes({
      ...selectedGroupCheckboxes,
      [id]: !selectedGroupCheckboxes[id],
    });
  };

  const selectedGroupsCount = Object.values(selectedGroupCheckboxes).filter(Boolean).length;

  return (
    <div className={styles.researchGroupPage}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Research Management</span>
      </div>

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>Research Groups & Topics Management</h1>
          <p className={styles.pageSubtitle}>
            Manage active research groups, assign topics, and track member progress.
          </p>
        </div>
        <button
          className={styles.createGroupBtn}
          onClick={() => setShowCreateGroupModal(true)}
        >
          ＋ Create Research Group
        </button>
      </div>

      {/* SUCCESS TOAST BANNER (Frame 43) */}
      {showSuccessBanner && (
        <div className={styles.successToastBanner}>
          <div className={styles.toastLeft}>
            <span className={styles.toastCheckIcon}>✓</span>
            <div>
              <span className={styles.toastTitle}>Action Successful</span>
              <p className={styles.toastSub}>{bannerText}</p>
            </div>
          </div>
          <div className={styles.toastRight}>
            <span className={styles.justNowText}>Just now</span>
            <button className={styles.toastCloseBtn} onClick={() => setShowSuccessBanner(false)}>✕</button>
          </div>
        </div>
      )}

      {/* SECTION 1: Active Research Groups */}
      <div className={styles.sectionHeaderRow}>
        <div className={styles.sectionTitleBlock}>
          <span className={styles.sectionIcon}>👥</span>
          <h3 className={styles.sectionTitle}>Active Research Groups</h3>
          <span className={styles.countBadge}>{groups.length} Groups</span>
        </div>
      </div>

      {/* Groups Grid */}
      <div className={styles.groupsGrid}>
        {groups.map((grp) => (
          <div className={styles.groupCard} key={grp.id}>
            {/* Header badges */}
            <div className={styles.cardTopRow}>
              <div className={styles.leftPills}>
                <span className={styles.groupIdPill}>{grp.id}</span>
                <span className={styles.activePill}>● Active</span>
                {grp.isNew && <span className={styles.newBadgePill}>NEW</span>}
              </div>
              {grp.dueDate && (
                <span className={styles.dueDatePill}>
                  🕒 Phase 3 Report Due: {grp.dueDate}
                </span>
              )}
            </div>

            {/* Title & Topic */}
            <h4 className={styles.groupCardTitle}>{grp.name}</h4>
            <div className={styles.groupTopicText}>Topic: {grp.topic}</div>
            <p className={styles.groupDescText}>{grp.description}</p>

            {/* Roster Members */}
            <div className={styles.membersSection}>
              <span className={styles.membersLabel}>MEMBERS ({grp.members.length})</span>
              <div className={styles.memberPillsRow}>
                {grp.members.map((email, idx) => (
                  <span key={email} className={styles.memberPillTag}>
                    <span
                      className={styles.memberAvatarIcon}
                      style={{
                        backgroundColor:
                          idx === 0 ? '#10b981' : idx === 1 ? '#f59e0b' : '#3b82f6',
                      }}
                    >
                      {email.slice(0, 2).toUpperCase()}
                    </span>
                    {email}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer buttons */}
            <div className={styles.groupCardFooter}>
              <div className={styles.iconButtonsLeft}>
                <button className={styles.actionIconBtn} title="Edit group">✏️</button>
                <button className={styles.actionIconBtn} title="Delete group">🗑️</button>
              </div>
              <button
                className={styles.viewGroupNavyBtn}
                onClick={() => alert(`Opening workspace for group ${grp.name}`)}
              >
                👥 View Group
              </button>
            </div>
          </div>
        ))}

        {/* Create New Group Card */}
        <div
          className={styles.createGroupDashedCard}
          onClick={() => setShowCreateGroupModal(true)}
        >
          <span className={styles.plusIconLarge}>＋</span>
          <span className={styles.createDashedText}>Create New Group</span>
        </div>
      </div>

      {/* SECTION 2: Research Topics Library */}
      <div className={styles.sectionHeaderRow} style={{ marginTop: '24px' }}>
        <div className={styles.sectionTitleBlock}>
          <span className={styles.sectionIcon}>📖</span>
          <h3 className={styles.sectionTitle}>Research Topics Library</h3>
          <span className={styles.countBadge}>{topics.length} Topics</span>
        </div>
        <button
          className={styles.createTopicOutlineBtn}
          onClick={() => setShowCreateTopicModal(true)}
        >
          ＋ Create Research Topic
        </button>
      </div>

      {/* Topics Table Card */}
      <div className={styles.tableCard}>
        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>TOPIC ID & NAME</th>
                <th>DESCRIPTION</th>
                <th>ASSIGNED GROUP(S)</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((topic) => (
                <tr key={topic.id}>
                  <td>
                    <span className={styles.topicIdBadge}>{topic.id}</span>
                    <span className={styles.topicNameText}>{topic.name}</span>
                  </td>
                  <td className={styles.topicDescText}>{topic.description}</td>
                  <td>
                    <div className={styles.assignedPillsRow}>
                      {topic.assignedGroups.length === 0 || topic.assignedGroups.includes('Unassigned') ? (
                        <span className={styles.unassignedPill}>Unassigned</span>
                      ) : (
                        topic.assignedGroups.map((gId) => (
                          <span key={gId} className={styles.assignedGroupPill}>
                            {gId}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      className={styles.assignGroupBtn}
                      onClick={() => handleOpenAssignModal(topic)}
                    >
                      ⚙️ Assign to Group
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FRAME 40: CREATE NEW RESEARCH GROUP MODAL */}
      {showCreateGroupModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            {/* Success alert banner inside modal */}
            <div className={styles.innerModalSuccessBanner}>
              <span className={styles.innerCheckIcon}>✓</span>
              <div className={styles.innerBannerMeta}>
                <b>Research Group Created Successfully!</b>
                <span>Group ID: RG-2026-015 assigned.</span>
              </div>
              <button className={styles.innerBannerClose} type="button" onClick={() => setShowCreateGroupModal(false)}>✕</button>
            </div>

            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle}>👥</span>
                <div>
                  <h3 className={styles.modalTitle}>Create New Research Group</h3>
                  <span className={styles.modalSubtitle}>Fill in the details below to create a new group</span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowCreateGroupModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Research Group Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="AI Speech-to-Text Research Team"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Topic Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={groupTopic}
                  onChange={(e) => setGroupTopic(e.target.value)}
                  placeholder="NLP Audio Transcription Benchmarks"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* RG Description</label>
                <textarea
                  className={styles.formTextarea}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Investigating Whisper AI model accuracy across regional dialects."
                  rows={3}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Member Invitations (Emails)</label>
                <div className={styles.emailsInputBox}>
                  <input
                    type="text"
                    className={styles.emailRawInput}
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={handleAddEmail}
                    placeholder="Type email and press Enter..."
                  />
                  <div className={styles.emailTagsContainer}>
                    {groupEmails.map((email) => (
                      <span key={email} className={styles.emailPill}>
                        ✓ {email}
                        <button
                          type="button"
                          className={styles.removeEmailCross}
                          onClick={() => handleRemoveEmail(email)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowCreateGroupModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.submitNavyBtn}>
                  ✔ Create Research Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FRAME 41: CREATE NEW RESEARCH TOPIC MODAL */}
      {showCreateTopicModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            {/* Success alert banner inside modal */}
            <div className={styles.innerModalSuccessBanner}>
              <span className={styles.innerCheckIcon}>✓</span>
              <div className={styles.innerBannerMeta}>
                <b>Research Topic Created Successfully!</b>
                <span>Topic ID: RT-2026-009 added.</span>
              </div>
              <button className={styles.innerBannerClose} type="button" onClick={() => setShowCreateTopicModal(false)}>✕</button>
            </div>

            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle} style={{ backgroundColor: '#faf5ff', color: '#7c3aed' }}>💡</span>
                <div>
                  <h3 className={styles.modalTitle}>Create New Research Topic</h3>
                  <span className={styles.modalSubtitle}>Define a topic to be assigned to research groups</span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowCreateTopicModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateTopicSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Topic Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  placeholder="High-Concurrency Load Balancing in Microservices"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Topic Description</label>
                <textarea
                  className={styles.formTextarea}
                  value={topicDesc}
                  onChange={(e) => setTopicDesc(e.target.value)}
                  placeholder="Architectural strategies for decoupling routing logic from orchestration layers."
                  rows={3}
                  required
                />
              </div>

              {/* Material Addition */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Material Addition (Optional)</label>
                <div className={styles.materialsBox}>
                  <div className={styles.materialTagsList}>
                    {attachedMaterials.map((mat) => (
                      <span key={mat} className={styles.materialPillTag}>
                        📄 [X] {mat}
                        <button
                          type="button"
                          className={styles.removeMatCross}
                          onClick={() => handleRemoveMaterial(mat)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      className={styles.addMoreMatBtn}
                      onClick={() => {
                        const newDoc = prompt('Enter document name:');
                        if (newDoc) setAttachedMaterials([...attachedMaterials, newDoc]);
                      }}
                    >
                      + Add more...
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowCreateTopicModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.submitNavyBtn}>
                  ✔ Create Research Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FRAME 42: ASSIGN RESEARCH TOPIC TO GROUPS MODAL */}
      {showAssignModal && selectedTopicForAssign && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: '560px' }}>
            <div className={styles.modalHeaderRow}>
              <div className={styles.modalTitleBlock}>
                <span className={styles.modalIconCircle} style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>⚙️</span>
                <div>
                  <h3 className={styles.modalTitle}>Assign Research Topic to Groups</h3>
                  <span className={styles.modalSubtitle}>Choose which groups receive this topic</span>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowAssignModal(false)}>×</button>
            </div>

            {/* Purple Topic Info Box */}
            <div className={styles.purpleTopicBox}>
              <span className={styles.topicBeingAssignedLabel}>TOPIC BEING ASSIGNED</span>
              <h4 className={styles.purpleTopicTitle}>
                [{selectedTopicForAssign.id}] {selectedTopicForAssign.name}
              </h4>
              <p className={styles.purpleTopicDesc}>{selectedTopicForAssign.description}</p>
            </div>

            {/* Select Research Groups */}
            <div className={styles.selectGroupsSection}>
              <span className={styles.selectGroupsLabel}>SELECT RESEARCH GROUPS</span>

              <div className={styles.groupsCheckboxList}>
                {/* Group 1 */}
                <div
                  className={`${styles.groupCheckboxRow} ${
                    selectedGroupCheckboxes['RG-2026-012'] ? styles.selectedRow : ''
                  }`}
                  onClick={() => toggleGroupCheckbox('RG-2026-012')}
                >
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={!!selectedGroupCheckboxes['RG-2026-012']}
                    readOnly
                  />
                  <span className={styles.checkboxGroupId}>RG-2026-012</span>
                  <span className={styles.checkboxGroupName}>Scalable Routing Architecture Group</span>
                  <span className={styles.checkboxMembersCount}>👥 3 Members</span>
                </div>

                {/* Group 2 */}
                <div
                  className={`${styles.groupCheckboxRow} ${
                    selectedGroupCheckboxes['RG-2026-015'] ? styles.selectedRow : ''
                  }`}
                  onClick={() => toggleGroupCheckbox('RG-2026-015')}
                >
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={!!selectedGroupCheckboxes['RG-2026-015']}
                    readOnly
                  />
                  <span className={styles.checkboxGroupId}>RG-2026-015</span>
                  <span className={styles.checkboxGroupName}>AI Speech-to-Text Research Team</span>
                  <span className={styles.checkboxMembersCount}>👥 2 Members</span>
                </div>

                {/* Group 3 */}
                <div
                  className={`${styles.groupCheckboxRow} ${
                    selectedGroupCheckboxes['RG-2026-009'] ? styles.selectedRow : ''
                  }`}
                  onClick={() => toggleGroupCheckbox('RG-2026-009')}
                >
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={!!selectedGroupCheckboxes['RG-2026-009']}
                    readOnly
                  />
                  <span className={styles.checkboxGroupId}>RG-2026-009</span>
                  <span className={styles.checkboxGroupName}>Graph Neural Networks Team</span>
                  <span className={styles.checkboxMembersCount}>👥 4 Members</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={styles.assignModalFooter}>
              <span className={styles.selectedCountText}>{selectedGroupsCount} groups selected</span>
              <div className={styles.assignFooterBtnsRight}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </button>
                <button
                  className={styles.submitNavyBtn}
                  onClick={handleConfirmAssignment}
                >
                  ✔ Confirm Assignment ({selectedGroupsCount} Groups Selected)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchGroup;
