import { useState, useRef, useEffect } from 'react';
import { PdfViewer } from '../../components/PdfViewer';
import { ScorecardModal } from '../Reviewer/components/ScorecardModal';
import { storage } from '../../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { paperService } from '../../services/paper.service';
import {
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  FileText,
  Eye,
  Upload,
  Plus,
  Check,
  Trash2,
  Loader2,
} from 'lucide-react';
import styles from './Papers.module.css';

interface Paper {
  id: string;
  name: string;
  date: string;
  status: 'Waiting for Review' | 'Draft' | 'Accepted' | 'Rejected';
  hasNote: boolean;
  fileUrl?: string;
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
  const [paperToDelete, setPaperToDelete] = useState<Paper | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active filter tab state
  const [activeTab, setActiveTab] = useState<'all' | 'waiting' | 'accepted' | 'rejected' | 'draft'>('all');

  // Papers local state for interactive uploads
  const [papers, setPapers] = useState<Paper[]>([
    { id: 'local-1', name: 'Framework_Design.pdf', date: '2026-07-22', status: 'Waiting for Review', hasNote: false },
    { id: 'local-2', name: 'Cloud_Routing_v1.pdf', date: '2026-07-15', status: 'Draft', hasNote: false },
    { id: 'local-3', name: 'Microservice_Consensus_v3.pdf', date: '2026-07-10', status: 'Accepted', hasNote: true },
    { id: 'local-4', name: 'EdgeNet_Protocol_v2.pdf', date: '2026-07-03', status: 'Rejected', hasNote: true },
  ]);

  // Upload flow state
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>(['Machine Learning']);
  const [isUploading, setIsUploading] = useState(false);
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);

  // Paper metadata for upload
  const [paperTitle, setPaperTitle] = useState('');
  const [paperAbstract, setPaperAbstract] = useState('');
  const MAX_ABSTRACT_WORDS = 500;

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [titleError, setTitleError] = useState(false);
  const [abstractError, setAbstractError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Word count for abstract
  const abstractWordCount = paperAbstract.trim() ? paperAbstract.trim().split(/\s+/).length : 0;

  // Auto-dismiss toast after 2 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.pdf')) {
      setSelectedFile(file);
      setSelectedFields(['Machine Learning']);
      setPaperTitle('');
      setPaperAbstract('');
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
    if (!paperTitle.trim()) {
      setTitleError(true);
      return;
    }
    if (selectedFields.length === 0) return;
    setUploadPhase('confirm');
  };

  const handleDeleteClick = () => {
    setUploadPhase('delete');
  };

  const handleConfirmUpload = async () => {
    const trimmedTitle = paperTitle.trim();
    const trimmedAbstract = paperAbstract.trim();
    let hasError = false;

    if (!trimmedTitle) {
      setTitleError(true);
      hasError = true;
    }
    if (!trimmedAbstract) {
      setAbstractError(true);
      hasError = true;
    }
    if (hasError) return;

    if (!selectedFile || selectedFields.length === 0 || !storage) return;
    setIsUploading(true);

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
        const pdfUrl = await getDownloadURL(task.snapshot.ref);

        try {
          const createdPaper = await paperService.create({
            title: paperTitle,
            abstract: paperAbstract.trim() || undefined,
            fileUrl: pdfUrl,
            issn: false,
            isOpenAccess: false,
            quartile: undefined,
            subFieldId: undefined,
          });

          // Verify the paper was saved by fetching it back
          try {
            await paperService.getById(createdPaper.id);
            setToastMessage({ text: 'Document uploaded successfully', type: 'success' });
          } catch {
            setToastMessage({ text: 'Paper uploaded but verification failed.', type: 'error' });
          }

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
          setToastMessage({ text: 'Failed to upload paper. Please try again.', type: 'error' });
        } finally {
          setSelectedFile(null);
          setSelectedFields(['Machine Learning']);
          setPaperTitle('');
          setPaperAbstract('');
          setIsUploading(false);
          setUploadPhase('idle');
        }
      }
    );
  };

  const handleRemovePaper = () => {
    setSelectedFile(null);
    setSelectedFields(['Machine Learning']);
    setPaperTitle('');
    setPaperAbstract('');
    setTitleError(false);
    setUploadPhase('idle');
    setShowFieldDropdown(false);
  };

  const handleDeleteTablePaper = (paper: Paper) => {
    setPaperToDelete(paper);
  };

  const handleConfirmDelete = async () => {
    if (!paperToDelete) return;
    setIsDeleting(true);
    try {
      await paperService.delete(paperToDelete.id);
      setPapers((prev) => prev.filter((p) => p.id !== paperToDelete.id));
      setToastMessage({ text: 'Paper deleted successfully', type: 'success' });
    } catch (err) {
      console.error('Failed to delete paper:', err);
      setToastMessage({
        text: `Failed to delete paper: ${(err as Error)?.message ?? 'Unknown error'}`,
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
      setPaperToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setPaperToDelete(null);
  };

  const handleCancelPopup = () => {
    setTitleError(false);
    setUploadPhase('preview');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await paperService.getAll();
      const mapped: Paper[] = result.items.map((p) => {
        const created = p.createdAt ? new Date(p.createdAt) : null;
        const updated = p.updatedAt ? new Date(p.updatedAt) : null;
        const hasScorecard =
          created !== null &&
          updated !== null &&
          updated.getTime() - created.getTime() > 1000;
        const rawStatus = p.status ?? 'Waiting for Review';
        const allowedStatuses: Paper['status'][] = ['Waiting for Review', 'Draft', 'Accepted', 'Rejected'];
        const status: Paper['status'] = allowedStatuses.includes(rawStatus as Paper['status'])
          ? (rawStatus as Paper['status'])
          : 'Waiting for Review';
        return {
          id: String(p.id),
          name: p.title || p.fileUrl?.split('/').pop() || 'Untitled',
          date: p.createdAt ? p.createdAt.split('T')[0] : '',
          status,
          hasNote: hasScorecard,
          fileUrl: p.fileUrl,
        };
      });
      setPapers(mapped);
    } catch {
      setToastMessage({ text: 'Failed to refresh papers.', type: 'error' });
    } finally {
      setIsRefreshing(false);
    }
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

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`${styles.toast} ${toastMessage.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{toastMessage.text}</span>
          <button className={styles.toastClose} onClick={() => setToastMessage(null)}>
            <X size={14} />
          </button>
        </div>
      )}

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
            <button className={styles.refreshBtn} onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw
                size={14}
                style={{
                  marginRight: '6px',
                  verticalAlign: 'middle',
                  animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
                }}
              />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
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
                      <FileText size={16} className={styles.fileIcon} />
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
                          onClick={() => {
                            if (!paper.fileUrl) return;
                            setPdfViewerUrl(paper.fileUrl);
                          }}
                          disabled={!paper.fileUrl}
                        >
                          <Eye size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                          View
                        </button>
                        {paper.status !== 'Waiting for Review' && (
                          <button
                            className={`${styles.btnActionNote} ${paper.status === 'Accepted' ? styles.btnActionNoteAccept : styles.btnActionNoteReject}`}
                            onClick={() => setSelectedPaperForScorecard(paper.name)}
                          >
                            <FileText size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            Reviewer Note
                          </button>
                        )}
                        <button
                          className={styles.btnActionDelete}
                          onClick={() => handleDeleteTablePaper(paper)}
                          title={`Delete "${paper.name}"`}
                        >
                          <Trash2 size={12} style={{ verticalAlign: 'middle' }} />
                          Delete
                        </button>
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
            <Upload size={32} />
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
                <X size={16} />
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
                {/* Paper Metadata Section */}
                <div className={styles.paperMetaSection}>
                  <div className={styles.paperMetaSectionHeader}>
                    <h4 className={styles.paperMetaSectionTitle}>Paper Details</h4>
                  </div>

                  {/* Title input (required) */}
                  <div className={styles.paperMetaField}>
                    <label className={styles.paperMetaLabel}>
                      Title <span className={styles.requiredStar}>*</span>
                    </label>
                    <input
                      type="text"
                      className={`${styles.paperMetaInput} ${titleError ? styles.paperMetaInputError : ''}`}
                      placeholder="e.g., A Modular Backend Network Protocol..."
                      value={paperTitle}
                      onChange={(e) => {
                        setPaperTitle(e.target.value);
                        if (e.target.value.trim()) setTitleError(false);
                        setAbstractError(false);
                      }}
                    />
                    {titleError && (
                      <span className={styles.paperMetaError}>Title is required.</span>
                    )}
                  </div>

                  {/* Abstract textarea (optional, word-limited) */}
                  <div className={styles.paperMetaField}>
                    <label className={styles.paperMetaLabel}>
                      Abstract <span className={styles.requiredStar}>*</span>
                    </label>
                    <textarea
                      className={styles.paperMetaTextarea}
                      placeholder="Summarize your research paper..."
                      value={paperAbstract}
                      onChange={(e) => {
                        const words = e.target.value.trim() ? e.target.value.trim().split(/\s+/).length : 0;
                        if (words <= MAX_ABSTRACT_WORDS) {
                          setPaperAbstract(e.target.value);
                        }
                        setAbstractError(false);
                      }}
                      rows={4}
                    />
                    {abstractError && (
                      <span className={styles.paperMetaError}>Abstract is required.</span>
                    )}
                    <span className={`${styles.wordCount} ${abstractWordCount > MAX_ABSTRACT_WORDS ? styles.wordCountError : ''}`}>
                      {abstractWordCount} / {MAX_ABSTRACT_WORDS} words
                    </span>
                  </div>
                </div>

                {/* Fields Section */}
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
                      <Plus size={14} />
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
                                <Check size={12} strokeWidth={2.5} />
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
                  <Trash2 size={14} />
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
                  disabled={!paperTitle.trim() || selectedFields.length === 0}
                >
                  <Upload size={14} />
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
              <FileText size={32} color="#2563eb" />
            </div>
            <h3 className={styles.popupTitle}>Confirm Upload</h3>
            <p className={styles.popupSubtitle}>Please review your paper details before uploading.</p>

            <div className={styles.popupDetails}>
              <div className={styles.popupDetailRow}>
                <span className={styles.popupDetailLabel}>Title</span>
                <span className={styles.popupDetailValue}>{paperTitle}</span>
              </div>
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
                    <Check size={14} />
                    Confirm Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {paperToDelete && (
        <div className={styles.popupOverlay}>
          <div className={styles.popupCard}>
            <div className={`${styles.popupIcon} ${styles.popupIconDanger}`}>
              <AlertCircle size={32} color="#ef4444" />
            </div>
            <h3 className={styles.popupTitle}>Delete Paper?</h3>
            <p className={styles.popupSubtitle}>
              Are you sure you want to delete <strong>"{paperToDelete.name}"</strong>?
              This action cannot be undone.
            </p>
            <div className={styles.popupActions}>
              <button
                className={styles.popupCancelBtn}
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className={styles.popupDangerBtn}
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className={styles.spinningIcon} />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete Paper
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Papers;
