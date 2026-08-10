import { useState, useRef } from 'react';
import { PdfViewer } from '../../components/PdfViewer';
import { ScorecardModal } from '../Dashboard/components/ScorecardModal';
import styles from './Papers.module.css';

interface Paper {
  id: string;
  name: string;
  date: string;
  status: 'Waiting for Review' | 'Draft' | 'Accepted' | 'Rejected';
  hasNote: boolean;
}

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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.pdf')) {
      const today = new Date().toISOString().split('T')[0];
      const newPaper: Paper = {
        id: `${Date.now()}`,
        name: file.name,
        date: today,
        status: 'Waiting for Review',
        hasNote: false
      };
      setPapers([...papers, newPaper]);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    </div>
  );
};

export default Papers;
