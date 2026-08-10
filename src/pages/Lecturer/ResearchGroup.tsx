import { useState } from 'react';
import styles from './ResearchGroup.module.css';

interface Student {
  id: string;
  name: string;
  email: string;
  field: string;
}

export const ResearchGroup = () => {
  const [projectName, setProjectName] = useState('Core Automation Network V3');
  const [semester, setSemester] = useState('V');
  const [searchText, setSearchText] = useState('Pham Duy Phuong');
  const [isSuccess, setIsSuccess] = useState(false);

  // Student roster list state
  const [roster, setRoster] = useState<Student[]>([
    { id: 'ST-9912', name: 'Nguyen Van Student', email: 'studentnv@uni.edu.vn', field: 'Computer Science' }
  ]);

  // Available students to search and add
  const searchableStudents: Student[] = [
    { id: 'ST-2847', name: 'Pham Duy Phuong', email: 'phuongpd@uni.edu.vn', field: 'Computer Science' },
    { id: 'ST-3199', name: 'Le Thi Student', email: 'studentlt@uni.edu.vn', field: 'Data Analytics' }
  ];

  // Filter students based on search input
  const foundStudents = searchableStudents.filter((student) => {
    // Hide if already in roster
    if (roster.some((r) => r.id === student.id)) return false;
    return student.name.toLowerCase().includes(searchText.toLowerCase());
  });

  const handleAddStudent = (student: Student) => {
    if (roster.length >= 5) {
      alert('Maximum group size of 5 students reached.');
      return;
    }
    setRoster([...roster, student]);
  };

  const handleRemoveStudent = (id: string) => {
    setRoster(roster.filter((s) => s.id !== id));
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      alert('Please enter a research project name.');
      return;
    }
    setIsSuccess(true);
  };

  return (
    <div className={styles.researchGroupPage}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; Guidance Management &gt; <span className={styles.activeBreadcrumb}>Initialize Research Group</span>
      </div>

      {/* Page Title & Sub */}
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Initialize Research Group</h1>
        <p className={styles.pageSubtitle}>
          Configure and register a new student guidance group for the upcoming semester.
        </p>
      </div>

      {/* Main Grid */}
      <div className={styles.groupGrid}>
        
        {/* Left Column: Registry Core */}
        <div className={styles.registryCard}>
          <div className={styles.cardHeader}>
            <div className={styles.headerTitleWrapper}>
              <span className={styles.icon}>📖</span>
              <h3 className={styles.cardTitle}>REGISTRY CORE</h3>
            </div>
            <span className={styles.counterBadge}>{roster.length}/5</span>
          </div>

          <div className={styles.cardBody}>
            {/* Project Name */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>* Research Project Name</label>
              <input
                type="text"
                className={styles.formInput}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Core Automation Network V3"
                required
              />
            </div>

            {/* Target Semester */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>* Target Semester</label>
              <select
                className={styles.formSelect}
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              >
                <option value="V">Semester V</option>
                <option value="VI">Semester VI</option>
                <option value="VII">Semester VII</option>
              </select>
            </div>

            {/* Current Assigned Roster Table */}
            <div className={styles.rosterSection}>
              <span className={styles.sectionLabel}>CURRENT ASSIGNED ROSTER</span>
              
              <div className={styles.tableResponsive}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>#</th>
                      <th>Name</th>
                      <th>ID</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((student, index) => (
                      <tr key={student.id}>
                        <td>{index + 1}</td>
                        <td className={styles.studentNameText}>{student.name}</td>
                        <td className={styles.studentIdText}>{student.id}</td>
                        <td>
                          {index > 0 && (
                            <button
                              type="button"
                              className={styles.removeRowBtn}
                              onClick={() => handleRemoveStudent(student.id)}
                              title="Remove student"
                            >
                              &times;
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
        </div>

        {/* Right Column: Student Roster Search */}
        <div className={styles.searchCard}>
          <div className={styles.cardHeader}>
            <div className={styles.headerTitleWrapper}>
              <span className={styles.icon}>🔍</span>
              <h3 className={styles.cardTitle}>STUDENT ROSTER SEARCH</h3>
            </div>
          </div>

          <div className={styles.cardBody}>
            {/* Search Input */}
            <div className={styles.searchBox}>
              <input
                type="text"
                className={styles.searchInput}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search students by name..."
              />
            </div>

            {/* Results */}
            <div className={styles.resultsHeader}>
              RESULTS &mdash; {foundStudents.length} FOUND
            </div>

            <div className={styles.studentsList}>
              {foundStudents.map((student) => (
                <div key={student.id} className={styles.studentSearchCard}>
                  <div className={styles.studentCardMain}>
                    <div className={styles.studentAvatarCircle}>
                      {student.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className={styles.studentCardMeta}>
                      <div className={styles.studentNameRow}>
                        <span className={styles.studentSearchName}>{student.name}</span>
                        <span className={styles.studentSearchId}>{student.id}</span>
                      </div>
                      <span className={styles.studentSearchEmail}>{student.email}</span>
                      <span className={styles.studentSearchField}>{student.field}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.addToGroupBtn}
                    onClick={() => handleAddStudent(student)}
                  >
                    + Add to Group
                  </button>
                </div>
              ))}

              {foundStudents.length === 0 && (
                <div className={styles.noStudentsText}>
                  No matching students available to add.
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className={styles.infoBox}>
              <span className={styles.infoIcon}>ℹ</span>
              <div className={styles.infoTextWrapper}>
                <span className={styles.infoTitle}>INFO</span>
                <span className={styles.infoSub}>
                  Max 5 members per group. Current count: {roster.length}/5.
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Sticky Action Bar */}
      <div className={styles.bottomActionBar}>
        <button type="button" className={styles.discardBtn}>
          ✕ Discard Research Group
        </button>
        <button type="button" className={styles.createBtn} onClick={handleCreateGroup}>
          ✓ Create Research Group
        </button>
      </div>

      {/* Success Modal */}
      {isSuccess && (
        <div className={styles.modalOverlay}>
          <div className={styles.successModalCard}>
            <div className={styles.successIconCircle}>✓</div>
            <h3 className={styles.successModalTitle}>Research Group Initialized!</h3>
            <p className={styles.successModalText}>
              The guidance group for project "<b>{projectName}</b>" has been successfully initialized for Semester {semester}.
            </p>
            <button className={styles.successBtn} onClick={() => setIsSuccess(false)}>
              Back to Guidance
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchGroup;
