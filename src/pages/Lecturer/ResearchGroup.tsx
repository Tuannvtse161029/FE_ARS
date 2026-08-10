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
}

interface Topic {
  id: string;
  name: string;
  description: string;
  assignedGroup: string;
}

export const ResearchGroup = () => {
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateTopicModal, setShowCreateTopicModal] = useState(false);

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
      assignedGroup: 'RG-2026-008',
    },
  ]);

  // Modal form states
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTopic, setNewGroupTopic] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');

  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGroup: Group = {
      id: `RG-2026-${Math.floor(100 + Math.random() * 900)}`,
      name: newGroupName,
      topic: newGroupTopic || 'General Computer Science',
      description: newGroupDesc || 'Research guidance group for advanced computer systems.',
      dueDate: '2026-08-20',
      status: 'Active',
      members: ['student1@ars.edu.vn', 'student2@ars.edu.vn'],
    };

    setGroups([...groups, newGroup]);
    setShowCreateGroupModal(false);
    setNewGroupName('');
    setNewGroupTopic('');
    setNewGroupDesc('');
  };

  const handleCreateTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    const newTopic: Topic = {
      id: `RT-2026-${Math.floor(100 + Math.random() * 900)}`,
      name: newTopicName,
      description: newTopicDesc || 'Topic research study outline.',
      assignedGroup: 'Unassigned',
    };

    setTopics([...topics, newTopic]);
    setShowCreateTopicModal(false);
    setNewTopicName('');
    setNewTopicDesc('');
  };

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

      {/* SECTION 1: Active Research Groups */}
      <div className={styles.sectionHeaderRow}>
        <div className={styles.sectionTitleBlock}>
          <span className={styles.sectionIcon}>👥</span>
          <h3 className={styles.sectionTitle}>Active Research Groups</h3>
          <span className={styles.countBadge}>{groups.length} Group</span>
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
              </div>
              <span className={styles.dueDatePill}>
                🕒 Phase 3 Report Due: {grp.dueDate}
              </span>
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
                          idx === 0 ? '#ef4444' : idx === 1 ? '#3b82f6' : '#a855f7',
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
          <span className={styles.countBadge}>{topics.length} Topic</span>
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
                    <span className={styles.assignedGroupPill}>{topic.assignedGroup}</span>
                  </td>
                  <td>
                    <button
                      className={styles.assignGroupBtn}
                      onClick={() => alert(`Assigning topic ${topic.name}`)}
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

      {/* CREATE GROUP MODAL */}
      {showCreateGroupModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Create Active Research Group</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setShowCreateGroupModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateGroupSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Group Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Scalable Routing Architecture Group"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Research Topic</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={newGroupTopic}
                  onChange={(e) => setNewGroupTopic(e.target.value)}
                  placeholder="e.g. Distributed Systems Scalability"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description</label>
                <textarea
                  className={styles.formTextarea}
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Describe group research focus..."
                  rows={3}
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowCreateGroupModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TOPIC MODAL */}
      {showCreateTopicModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Create Research Topic</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setShowCreateTopicModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateTopicSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>* Topic Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder="e.g. Consensus Protocols in Distributed Databases"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description</label>
                <textarea
                  className={styles.formTextarea}
                  value={newTopicDesc}
                  onChange={(e) => setNewTopicDesc(e.target.value)}
                  placeholder="Describe topic outline..."
                  rows={3}
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowCreateTopicModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Create Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchGroup;
