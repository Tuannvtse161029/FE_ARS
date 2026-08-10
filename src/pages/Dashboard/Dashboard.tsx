import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/Button';
import { ScorecardModal } from './components/ScorecardModal';
import { PdfViewer } from '../../components/PdfViewer';
import { ROUTES } from '../../routes/paths';
import styles from './Dashboard.module.css';

// SVG Icons
const PublishedIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.metricIconBlue}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
  </svg>
);

const ReviewsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.metricIconTeal}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);

const CitationsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.metricIconGreen}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const VideoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 7l-7 5 7 5V7z"></path>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
  </svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

interface Submission {
  id: string;
  name: string;
  date: string;
  status: 'Waiting for Review' | 'Under Review' | 'Accepted' | 'Rejected';
  hasNote: boolean;
}

interface ReviewerRecommendation {
  id: string;
  name: string;
  title: string;
  tag: string;
  reward: string;
  initials: string;
}

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Modal States
  const [selectedPaperForScorecard, setSelectedPaperForScorecard] = useState<string | null>(null);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  
  // Dynamic state for requested reviewers
  const [requestedReviewers, setRequestedReviewers] = useState<{ [id: string]: boolean }>({});

  const submissions: Submission[] = [
    { id: '1', name: 'Framework_Design.pdf', date: '2026-07-22', status: 'Waiting for Review', hasNote: false },
    { id: '2', name: 'Cloud_Routing_v1.pdf', date: '2026-07-15', status: 'Under Review', hasNote: false },
    { id: '3', name: 'Microservice_Consensus_v3.pdf', date: '2026-07-10', status: 'Accepted', hasNote: true },
    { id: '4', name: 'EdgeNet_Protocol_v2.pdf', date: '2026-07-03', status: 'Rejected', hasNote: true },
  ];

  const recommendedReviewers: ReviewerRecommendation[] = [
    { id: 'rev-1', name: 'Dr. Nguyen Van A', title: 'Senior Lecturer', tag: '#ComputerScience', reward: '500,000 VND', initials: 'NA' },
    { id: 'rev-2', name: 'Dr. Le Thi B', title: 'Associate Professor', tag: '#DistributedSystems', reward: '400,000 VND', initials: 'LB' },
  ];

  const handleRequestReviewer = (id: string) => {
    setRequestedReviewers({
      ...requestedReviewers,
      [id]: true
    });
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Waiting for Review': return styles.statusWaiting;
      case 'Under Review': return styles.statusReview;
      case 'Accepted': return styles.statusAccepted;
      case 'Rejected': return styles.statusRejected;
      default: return '';
    }
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.mainGrid}>
        
        {/* Left/Main Column */}
        <div className={styles.leftCol}>
          
          {/* Welcome Banner */}
          <div className={styles.welcomeBanner}>
            <div className={styles.bannerInfo}>
              <h2 className={styles.bannerTitle}>Welcome back, Researcher! 👋</h2>
              <p className={styles.bannerText}>
                Track your active paper progress or request peer reviews. Your research impact grows with every submission.
              </p>
            </div>
            <div className={styles.bannerActions}>
              <button 
                className={styles.bannerBtnUpload} 
                onClick={() => navigate(ROUTES.PAPERS)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Upload New Paper
              </button>
              <button className={styles.bannerBtnDiscover}>
                Discover Reviewers
              </button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span className={styles.metricTitle}>Published Papers</span>
                <PublishedIcon />
              </div>
              <span className={styles.metricValue}>4</span>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span className={styles.metricTitle}>Active Reviews</span>
                <ReviewsIcon />
              </div>
              <span className={styles.metricValue}>2</span>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span className={styles.metricTitle}>Citations / Views</span>
                <CitationsIcon />
              </div>
              <span className={styles.metricValue}>128</span>
            </div>
          </div>

          {/* Active Submissions Section */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>My Active Submissions</h3>
              <button className={styles.viewAllLink} onClick={() => navigate(ROUTES.PAPERS)}>View all</button>
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
                  {submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td className={styles.manuscriptCell}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.fileIcon}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span className={styles.fileNameText}>{sub.name}</span>
                      </td>
                      <td className={styles.dateCell}>{sub.date}</td>
                      <td>
                        <span className={`${styles.statusDotLabel} ${getStatusClass(sub.status)}`}>
                          ● {sub.status}
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
                          {sub.hasNote && (
                            <button 
                              className={`${styles.btnActionNote} ${sub.status === 'Accepted' ? styles.btnActionNoteAccept : styles.btnActionNoteReject}`}
                              onClick={() => setSelectedPaperForScorecard(sub.name)}
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Recommended Reviewers */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.titleWithAiBadge}>
                <h3 className={styles.sectionTitle}>AI Recommended Reviewers For You</h3>
                <span className={styles.aiBadge}>AI</span>
              </div>
              <button className={styles.viewAllLink}>See all</button>
            </div>

            <div className={styles.aiControlsRow}>
              <div className={styles.selectManuscriptWrapper}>
                <span className={styles.selectLabel}>Select Manuscript</span>
                <select className={styles.manuscriptDropdown}>
                  <option>Framework_Design_v2.pdf</option>
                  <option>Cloud_Routing_v1.pdf</option>
                </select>
              </div>
              <div className={styles.recommendedTags}>
                <span className={styles.tagPill}>#ComputerScience</span>
                <span className={styles.tagPill}>#DistributedSystems</span>
              </div>
            </div>

            {/* Reviewers List */}
            <div className={styles.reviewersList}>
              {recommendedReviewers.map((rev) => {
                const isRequested = !!requestedReviewers[rev.id];
                return (
                  <div key={rev.id} className={styles.reviewerCard}>
                    <div className={styles.reviewerCardHeader}>
                      <div className={styles.reviewerAvatarCircle}>{rev.initials}</div>
                      <div className={styles.reviewerInfoDetails}>
                        <span className={styles.reviewerName}>{rev.name}</span>
                        <span className={styles.reviewerTitle}>{rev.title}</span>
                        <div className={styles.reviewerMetaRow}>
                          <span className={styles.reviewerTagText}>{rev.tag}</span>
                          <span className={styles.reviewerRewardText}>{rev.reward}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      className={`${styles.requestBtn} ${isRequested ? styles.requestBtnRequested : ''}`}
                      disabled={isRequested}
                      onClick={() => handleRequestReviewer(rev.id)}
                    >
                      {isRequested ? 'Requested' : 'Request'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (Seminars) */}
        <div className={styles.rightCol}>
          
          {/* Upcoming Seminars */}
          <div className={styles.seminarsCard}>
            <div className={styles.seminarsHeader}>
              <h3 className={styles.sectionTitle}>Upcoming Academic Seminars</h3>
              <span className={styles.seminarsBookIcon}><CalendarIcon /></span>
            </div>

            <div className={styles.seminarsList}>
              {/* Seminar 1 - LIVE */}
              <div className={styles.seminarCard}>
                <div className={styles.seminarTitleRow}>
                  <h4 className={styles.seminarTitle}>Distributed Systems Architecture</h4>
                  <span className={styles.liveBadge}>Live</span>
                </div>
                <p className={styles.seminarAuthor}>by Prof. Tran Minh · Dept. of Computer Science</p>
                <div className={styles.seminarTimeRow}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span>Today at 14:00 ICT</span>
                </div>
                <a 
                  href="https://meet.google.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  className={styles.joinMeetBtn}
                >
                  <VideoIcon />
                  <span>Join Google Meet</span>
                </a>
              </div>

              {/* Seminar 2 */}
              <div className={styles.seminarCard}>
                <h4 className={styles.seminarTitle}>AI in Peer Review Workflows</h4>
                <p className={styles.seminarAuthor}>by Dr. Le Thi C · Research Methods Lab</p>
                <div className={styles.seminarTimeRow}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span>Tomorrow at 10:00 ICT</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Evaluation Scorecard Modal */}
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

export default Dashboard;
