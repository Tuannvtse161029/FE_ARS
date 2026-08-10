import { useState } from 'react';
import styles from './SeminarWorkspace.module.css';

export const SeminarWorkspace = () => {
  const [topicTitle, setTopicTitle] = useState('Distributed Ledger Implementations in Modern Cloud Architectures');
  const [abstract, setAbstract] = useState('');
  const [startDate, setStartDate] = useState('2026-08-15T14:00');
  const [endDate, setEndDate] = useState('2026-08-15T16:00');
  
  // Dynamic list of invitees
  const [invitees, setInvitees] = useState(['Student_Group_A', 'Res_A_Nguyen']);
  const [searchText, setSearchText] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleAddInvitee = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchText.trim()) {
      if (!invitees.includes(searchText.trim())) {
        setInvitees([...invitees, searchText.trim()]);
      }
      setSearchText('');
    }
  };

  const handleRemoveInvitee = (name: string) => {
    setInvitees(invitees.filter((x) => x !== name));
  };

  const handleCreateSeminar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicTitle.trim()) {
      alert('Please enter a seminar topic title.');
      return;
    }
    setIsSuccess(true);
  };

  return (
    <div className={styles.seminarWorkspace}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; Seminar Hub &gt; <span className={styles.activeBreadcrumb}>Schedule Academic Seminar</span>
      </div>

      {/* Page Title */}
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Seminar Studio</h1>
      </div>

      {/* Main card */}
      <div className={styles.configCard}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>SEMINAR CONFIGURATION PANEL</h2>
          <p className={styles.cardSubtitle}>
            Complete all required fields to provision a scheduled seminar event.
          </p>
        </div>

        <form className={styles.form} onSubmit={handleCreateSeminar}>
          {/* Topic Title */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>* SEMINAR TOPIC TITLE</label>
            <input
              type="text"
              className={styles.formInput}
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              placeholder="e.g. Distributed Ledger Implementations in Modern Cloud Architectures"
              required
            />
          </div>

          {/* Abstract Overview */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>* ABSTRACT OVERVIEW</label>
            <textarea
              className={styles.formTextarea}
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Describe the seminar topic details, research focus, and outline of the academic study..."
              rows={6}
              required
            />
          </div>

          {/* Date Row */}
          <div className={styles.rowFormGroup}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>* START DATE-TIME</label>
              <div className={styles.inputIconWrapper}>
                <input
                  type="datetime-local"
                  className={styles.formDateInput}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>* END DATE-TIME</label>
              <div className={styles.inputIconWrapper}>
                <input
                  type="datetime-local"
                  className={styles.formDateInput}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Invite participants */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>* INVITE PARTICIPANTS (STUDENTS / RESEARCHERS)</label>
            <div className={styles.multiSelectInputWrapper}>
              <span className={styles.searchIcon}>🔍</span>
              
              {/* Tags */}
              <div className={styles.tagsContainer}>
                {invitees.map((item) => (
                  <span key={item} className={styles.inviteeTag}>
                    {item}
                    <button
                      type="button"
                      className={styles.removeTagBtn}
                      onClick={() => handleRemoveInvitee(item)}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>

              {/* Text input to add new invitees */}
              <input
                type="text"
                className={styles.multiSelectInput}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={handleAddInvitee}
                placeholder={invitees.length === 0 ? "Type and press Enter to invite accounts..." : ""}
              />
            </div>
            <span className={styles.helperText}>
              Type to search registered accounts by username, group ID, or researcher handle.
            </span>
          </div>

          {/* Footer buttons */}
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn}>
              Create Seminar Event
            </button>
          </div>
        </form>
      </div>

      {/* Success Modal */}
      {isSuccess && (
        <div className={styles.modalOverlay}>
          <div className={styles.successModalCard}>
            <div className={styles.successIconCircle}>✓</div>
            <h3 className={styles.successModalTitle}>Seminar Event Scheduled!</h3>
            <p className={styles.successModalText}>
              The seminar "<b>{topicTitle}</b>" has been successfully provisioned. Invitations have been dispatched to all selected students and research cohorts.
            </p>
            <button className={styles.successBtn} onClick={() => setIsSuccess(false)}>
              Back to Workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeminarWorkspace;
