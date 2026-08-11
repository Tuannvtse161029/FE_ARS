import { useState, useRef } from 'react';
import { PdfViewer } from '../../components/PdfViewer';
import { ScorecardModal } from '../Dashboard/components/ScorecardModal';
import { storage } from '../../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { paperService } from '../../services/paper.service';
import styles from './Papers.module.css';

interface Paper {
  id: string;
  name: string;
  date: string;
  status: 'Waiting for Review' | 'Draft' | 'Accepted' | 'Rejected';
  hasNote: boolean;
}

type UploadPhase = 'idle' | 'preview' | 'confirm' | 'delete';

// Hardcoded research field options
const RECOMMENDED_FIELDS = [
  'Machine Learning',
  'NLP',
  'Computer Vision',
  'Distributed Systems',
  'Cybersecurity',
  'Cloud Computing',
];

const SUBFIELD_OPTIONS = [
  'Deep Learning',
  'Reinforcement Learning',
  'Graph Neural Networks',
  'Federated Learning',
  'Quantum Computing',
  'Edge Computing',
  'Blockchain',
  'Computer Graphics',
  'Human-Computer Interaction',
  'Robotics',
];

export const Papers = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal States
  const [selectedPaperForScorecard, setSelectedPaperForScorecard] = useState<string | null>(null);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);

  // Active filter tab state
  const [activeTab, setActiveTab] = useState<'all' | 'waiting' | 'accepted' | 'rejected' | 'draft'>('all');

  // Papers local state for interactive uploads
  const [papers, setPapers] = useState<Paper[]>([
    { id: '1', name: 'Framework_Design.pdf', date: '2026-07-22', status: 'Waiting for Review', hasNote: false },
    { id: '2', name: 'Cloud_Routing_v1.pdf', date: '2026-07-15', status: 'Draft', hasNote: false },
    { id: '3', name: 'Microservice_Consensus_v3.pdf', date: '2026-07-10', status: 'Accepted', hasNote: true },
    { id: '4', name: 'EdgeNet_Protocol_v2.pdf', date: '2026-07-03', status: 'Rejected', hasNote: true },
  ]);

  // Upload flow state
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>(['Machine Learning']);
  const [isUploading, setIsUploading] = useState(false);
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.pdf')) {
      setSelectedFile(file);
      setSelectedFields(['Machine Learning']);
      setUploadPhase('preview');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleField = (field: string) => {
    setSelectedFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const handleUploadPaper = () => {
    if (selectedFields.length === 0) return;
    setUploadPhase('confirm');
  };

  const handleDeleteClick = () => {
    setUploadPhase('delete');
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile || selectedFields.length === 0 || !storage) return;
    setIsUploading(true);
    setUploadPhase('confirm');

    const storageRef = ref(storage, `papers/${Date.now()}_${selectedFile.name}`);
    const task = uploadBytesResumable(storageRef, selectedFile);

    task.on(
      'state_changed',
      () => {},
      (error) => {
        console.error('Upload failed:', error);
        setIsUploading(false);
        setUploadPhase('preview');
      },
      async () => {
        // 1. Get the Firebase download URL
        const pdfUrl = await getDownloadURL(task.snapshot.ref);

        // 2. Save paper record to backend database
        try {
          const paperTitle = selectedFile.name.replace(/\.pdf$/i, '');
          const createdPaper = await paperService.create({
            title: paperTitle,
            pdfUrl,
            researchFields: selectedFields,
          });

          // 3. Add to local state with the real DB id and Firebase URL
          const today = new Date().toISOString().split('T')[0];
          const newPaper: Paper = {
            id: createdPaper.id,
            name: selectedFile.name,
            date: today,
            status: 'Waiting for Review',
            hasNote: false,
          };
          setPapers(prev => [newPaper, ...prev]);
        } catch (apiError) {
          console.error('Failed to save paper to database:', apiError);
          // Paper is already uploaded to Firebase — still add to local state
          const today = new Date().toISOString().split('T')[0];
          const newPaper: Paper = {
            id: `${Date.now()}`,
            name: selectedFile.name,
            date: today,
            status: 'Waiting for Review',
            hasNote: false,
          };
          setPapers(prev => [newPaper, ...prev]);
        } finally {
          setSelectedFile(null);
          setSelectedFields(['Machine Learning']);
          setIsUploading(false);
          setUploadPhase('idle');
        }
      }
    );
  };

  const handleRemovePaper = () => {
    setSelectedFile(null);
    setSelectedFields(['Machine Learning']);
    setUploadPhase('idle');
    setShowFieldDropdown(false);
  };

  const handleCancelPopup = () => {
    setUploadPhase('preview');
  };

  // Filter papers based on active tab
  const filteredPapers = papers.filter((paper) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'waiting') return paper.status === 'Waiting for Review';
    if (activeTab === 'accepted') return paper.status === 'Accepted';
    if (activeTab === 'rejected') return paper.status === 'Rejected';
    if (activeTab === 'draft') return paper.status === 'Draft';
    return true;
  });

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Waiting for Review': return styles.statusWaiting;
      case 'Draft': return styles.statusDraft;
      case 'Accepted': return styles.statusAccepted;
      case 'Rejected': return styles.statusRejected;
      default: return '';
    }
  };

  return (
    <div className={styles.papersPage}>
      {/* Page Title */}
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Research Paper List</h1>
      </div>

      {/* Tabs Filter */}
      <div className={styles.tabsRow}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Research Paper
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'waiting' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('waiting')}
        >
          Waiting For Review
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'accepted' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('accepted')}
        >
          Accept Paper
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'rejected' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('rejected')}
        >
          Reject Paper
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'draft' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('draft')}
        >
          Draft
        </button>
      </div>

      {/* Papers Table Card */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>My Papers</h3>
          <div className={styles.sectionHeaderRight}>
            <span className={styles.manuscriptCount}>{filteredPapers.length} manuscripts</span>
            <button className={styles.refreshBtn}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>MANUSCRIPT</th>
                <th>SUBMITTED</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredPapers.length > 0 ? (
                filteredPapers.map((paper) => (
                  <tr key={paper.id}>
                    <td className={styles.manuscriptCell}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.fileIcon}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                      <span className={styles.fileNameText}>{paper.name}</span>
                    </td>
                    <td className={styles.dateCell}>{paper.date}</td>
                    <td>
                      <span className={`${styles.statusDotLabel} ${getStatusClass(paper.status)}`}>
                        ● {paper.status}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionCellBtns}>
                        <button
                          className={styles.btnActionView}
                          onClick={() => setPdfViewerUrl('/sample.pdf')}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                          View
                        </button>
                        {paper.hasNote && (
                          <button
                            className={`${styles.btnActionNote} ${paper.status === 'Accepted' ? styles.btnActionNoteAccept : styles.btnActionNoteReject}`}
                            onClick={() => setSelectedPaperForScorecard(paper.name)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', verticalAlign: 'middle' }}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            Reviewer Note
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className={styles.emptyRow}>
                    No manuscripts found under this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Box Container */}
      <div className={styles.sectionCard}>
        <h3 className={styles.uploadSectionTitle}>Upload New Research Paper</h3>

        <input
          type="file"
          accept=".pdf"
          ref={fileInputRef}
          onChange={handleFileChange}
          data-testid="papers-file-input"
          style={{ display: 'none' }}
        />

        <div className={styles.uploadZone} onClick={handleUploadClick}>
          <div className={styles.uploadIconWrapper}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <p className={styles.uploadZoneTitle}>Click to upload or drag & drop</p>
          <p className={styles.uploadZoneSubtitle}>PDF files only · Max 50 MB</p>
          <p className={styles.uploadZoneOr}>or</p>
          <button className={styles.browseFilesBtn} onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}>
            Browse Files
          </button>
        </div>
      </div>

      {/* Scorecard Modal */}
      {selectedPaperForScorecard && (
        <ScorecardModal
          isOpen={true}
          onClose={() => setSelectedPaperForScorecard(null)}
          fileName={selectedPaperForScorecard}
        />
      )}

      {/* Fullscreen PDF Viewer Modal Overlay */}
      {pdfViewerUrl && (
        <div className={styles.pdfViewerModalOverlay}>
          <div className={styles.pdfViewerModalCard}>
            <div className={styles.pdfViewerHeader}>
              <h3 className={styles.pdfViewerTitle}>Document Preview</h3>
              <button className={styles.closePdfBtn} onClick={() => setPdfViewerUrl(null)}>
                Close Preview
              </button>
            </div>
            <div className={styles.pdfViewerBody}>
              <PdfViewer url={pdfViewerUrl} />
            </div>
          </div>
        </div>
      )}

      {/* Upload Preview Modal */}
      {uploadPhase === 'preview' && selectedFile && (
        <div className={styles.uploadModalOverlay}>
          <div className={styles.uploadModalCard} data-testid="upload-preview-card">
            {/* Modal Header */}
            <div className={styles.uploadModalHeader}>
              <h3 className={styles.uploadModalTitle}>Upload Paper Preview</h3>
              <button className={styles.closeUploadBtn} data-testid="close-upload-btn" onClick={handleRemovePaper}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Modal Body: split layout */}
            <div className={styles.uploadModalBody}>
              {/* Left: PDF Viewer */}
              <div className={styles.uploadPreviewLeft}>
                <PdfViewer url={selectedFile} />
              </div>

              {/* Right: Research Fields */}
              <div className={styles.uploadPreviewRight}>
                <div className={styles.fieldsSection}>
                  <div className={styles.fieldsSectionHeader}>
                    <h4 className={styles.fieldsSectionTitle}>AI Recommended Research Fields</h4>
                    <span className={styles.fieldsSectionHint}>({selectedFields.length} selected)</span>
                  </div>

                  {/* Recommended field tags */}
                  <div className={styles.fieldTags}>
                    {RECOMMENDED_FIELDS.map(field => (
                      <button
                        key={field}
                        className={`${styles.fieldTag} ${selectedFields.includes(field) ? styles.fieldTagSelected : ''}`}
                        onClick={() => toggleField(field)}
                      >
                        {field}
                      </button>
                    ))}
                  </div>

                  {/* Add field dropdown */}
                  <div className={styles.addFieldWrapper}>
                    <button
                      className={styles.addFieldBtn}
                      onClick={() => setShowFieldDropdown(!showFieldDropdown)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      Add field
                    </button>
                    {showFieldDropdown && (
                      <div className={styles.fieldDropdown}>
                        {SUBFIELD_OPTIONS
                          .filter(opt => !RECOMMENDED_FIELDS.includes(opt))
                          .map(sub => (
                            <button
                              key={sub}
                              className={`${styles.fieldDropdownItem} ${selectedFields.includes(sub) ? styles.fieldDropdownItemSelected : ''}`}
                              onClick={() => {
                                toggleField(sub);
                                setShowFieldDropdown(false);
                              }}
                            >
                              {selectedFields.includes(sub) && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              )}
                              {sub}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Selected fields summary */}
                  {selectedFields.length > 0 && (
                    <div className={styles.selectedFieldsSummary}>
                      <span className={styles.selectedFieldsLabel}>Selected:</span>
                      <div className={styles.selectedFieldsChips}>
                        {selectedFields.map(f => (
                          <span key={f} className={styles.selectedChip}>
                            {f}
                            <button
                              className={styles.removeChipBtn}
                              onClick={() => toggleField(f)}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedFields.length === 0 && (
                    <p className={styles.fieldsWarning}>Please select at least one research field.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={styles.uploadModalFooter}>
              <div className={styles.uploadFooterLeft}>
                <button className={styles.deleteBtn} onClick={handleDeleteClick}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                  </svg>
                  Delete
                </button>
              </div>
              <div className={styles.uploadFooterRight}>
                <button className={styles.cancelBtn} onClick={handleRemovePaper}>
                  Cancel
                </button>
                <button
                  className={styles.uploadBtn}
                  onClick={handleUploadPaper}
                  disabled={selectedFields.length === 0}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Upload Paper
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Upload Popup */}
      {uploadPhase === 'confirm' && selectedFile && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupCard}>
            <div className={styles.popupIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <h3 className={styles.popupTitle}>Confirm Upload</h3>
            <p className={styles.popupSubtitle}>Please review your paper details before uploading.</p>

            <div className={styles.popupDetails}>
              <div className={styles.popupDetailRow}>
                <span className={styles.popupDetailLabel}>File Name</span>
                <span className={styles.popupDetailValue}>{selectedFile.name}</span>
              </div>
              <div className={styles.popupDetailRow}>
                <span className={styles.popupDetailLabel}>Submission Date</span>
                <span className={styles.popupDetailValue}>{new Date().toISOString().split('T')[0]}</span>
              </div>
              <div className={styles.popupDetailRow}>
                <span className={styles.popupDetailLabel}>Research Fields</span>
                <div className={styles.popupDetailFields}>
                  {selectedFields.map(f => (
                    <span key={f} className={styles.popupFieldChip}>{f}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.popupActions}>
              <button className={styles.popupCancelBtn} onClick={handleCancelPopup} disabled={isUploading}>
                Cancel
              </button>
              <button className={styles.popupConfirmBtn} onClick={handleConfirmUpload} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <span className={styles.spinner}></span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Confirm Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup */}
      {uploadPhase === 'delete' && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupCard}>
            <div className={`${styles.popupIcon} ${styles.popupIconDanger}`}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3 className={styles.popupTitle}>Remove this paper?</h3>
            <p className={styles.popupSubtitle}>
              You are about to discard <strong>{selectedFile?.name}</strong>. This action cannot be undone.
            </p>
            <div className={styles.popupActions}>
              <button className={styles.popupCancelBtn} onClick={handleCancelPopup}>
                Cancel
              </button>
              <button className={styles.popupDangerBtn} onClick={handleRemovePaper}>
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Papers;
