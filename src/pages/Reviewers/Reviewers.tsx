import { useState, useEffect } from 'react';
import { TopUpModal } from './components/TopUpModal';
import styles from './Reviewers.module.css';

interface Reviewer {
  id: string;
  name: string;
  title: string;
  initials: string;
  avatarBg: string;
  hIndex: number;
  publications: number;
  reviews: number;
  fee: number;
  tags: string[];
  orcid: string;
  specializations: string[];
}

interface ReviewRequest {
  id: string;
  manuscriptTitle: string;
  reviewerName: string;
  reviewerInitials: string;
  reviewerAvatarBg: string;
  date: string;
  fee: number;
  status: 'Pending' | 'Completed' | 'Rejected';
}

export const Reviewers = () => {
  // Navigation & Tabs state
  const [activeTab, setActiveTab] = useState<'discover' | 'requests'>('discover');
  const [screenState, setScreenState] = useState<'list' | 'create-request' | 'checkout'>('list');

  // Wallet state
  const [walletBalance, setWalletBalance] = useState(() => {
    const saved = localStorage.getItem('ars_wallet');
    return saved ? parseInt(saved, 10) : 1500000; // Default to 1,500,000 VND
  });

  // Selected reviewer for creating request
  const [selectedReviewer, setSelectedReviewer] = useState<Reviewer | null>(null);

  // Modal states
  const [topUpReviewer, setTopUpReviewer] = useState<Reviewer | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Form states
  const [selectedPaper, setSelectedPaper] = useState('Framework_Design_v2.pdf');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('Standard Priority');
  const [requestedByDate, setRequestedByDate] = useState('2024-12-31');

  // Checkout states
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Review requests history state
  const [requests, setRequests] = useState<ReviewRequest[]>([]);

  // Sync wallet balance
  useEffect(() => {
    const handleWalletUpdate = () => {
      const saved = localStorage.getItem('ars_wallet');
      setWalletBalance(saved ? parseInt(saved, 10) : 1500000);
    };
    window.addEventListener('wallet-update', handleWalletUpdate);
    return () => window.removeEventListener('wallet-update', handleWalletUpdate);
  }, []);

  const reviewers: Reviewer[] = [
    {
      id: 'rev-1',
      name: 'Dr. Nguyen Van A',
      title: 'Senior Lecturer',
      initials: 'NA',
      avatarBg: '#1D2A4A', // Deep navy
      hIndex: 24,
      publications: 87,
      reviews: 142,
      fee: 500000,
      tags: ['#ComputerScience', '#DistributedSystems'],
      orcid: '0000-0002-1823-xxxx',
      specializations: ['Machine Learning', 'Data Science', 'NLP', 'HCI']
    },
    {
      id: 'rev-2',
      name: 'Prof. Tran Minh B',
      title: 'Associate Professor',
      initials: 'TB',
      avatarBg: '#3b82f6', // Blue
      hIndex: 31,
      publications: 124,
      reviews: 203,
      fee: 750000,
      tags: ['#SoftwareEngineering', '#CloudComputing'],
      orcid: '0000-0003-9876-5432',
      specializations: ['Distributed Systems', 'Cloud Computing', 'Escrow Security']
    },
    {
      id: 'rev-3',
      name: 'Dr. Le Thi C',
      title: 'Research Fellow',
      initials: 'LC',
      avatarBg: '#f59e0b', // Amber
      hIndex: 18,
      publications: 62,
      reviews: 89,
      fee: 400000,
      tags: ['#DistributedSystems', '#NetworkSystems'],
      orcid: '0000-0001-5555-4444',
      specializations: ['Mobile Networks', 'IoT Protocols', 'Cyber Security']
    },
  ];

  const handleRequestClick = (reviewer: Reviewer) => {
    setSelectedReviewer(reviewer);
    setScreenState('create-request');
  };

  const handleProceedToPayment = () => {
    setScreenState('checkout');
  };

  const handlePinInput = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return; // numbers only
    const nextPin = [...pinDigits];
    nextPin[index] = val.slice(-1);
    setPinDigits(nextPin);

    // Auto-focus next input
    if (val && index < 5) {
      const nextEl = document.getElementById(`pin-${index + 1}`);
      nextEl?.focus();
    }

    // If fully filled, trigger payment processing
    if (nextPin.every((d) => d !== '') && index === 5) {
      setIsProcessingCheckout(true);
      setTimeout(() => {
        handleConfirmRequest();
      }, 1500);
    }
  };

  const handleConfirmRequest = () => {
    if (!selectedReviewer) return;

    const totalDeductible = selectedReviewer.fee + 25000; // Fee + processing tax

    // Deduct from wallet
    const newVal = walletBalance - totalDeductible;
    localStorage.setItem('ars_wallet', newVal.toString());
    window.dispatchEvent(new Event('wallet-update'));

    // Open Success Modal
    setIsProcessingCheckout(false);
    setShowSuccessModal(true);
  };

  const handleGoToRequests = () => {
    if (!selectedReviewer) return;

    const today = new Date().toISOString().split('T')[0];
    
    // Add to requests list
    const newRequest: ReviewRequest = {
      id: `REQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      manuscriptTitle: selectedPaper,
      reviewerName: selectedReviewer.name,
      reviewerInitials: selectedReviewer.initials,
      reviewerAvatarBg: selectedReviewer.avatarBg,
      date: today,
      fee: selectedReviewer.fee + 25000, // Total fee
      status: 'Pending',
    };

    setRequests([newRequest, ...requests]);
    setShowSuccessModal(false);
    setScreenState('list');
    setActiveTab('requests');
    setSelectedReviewer(null);
    setNotes('');
    setPinDigits(['', '', '', '', '', '']);
  };

  const handleTopUpSuccess = (amount: number) => {
    console.log(`Successfully topped up ${amount} VND`);
  };

  return (
    <div className={styles.reviewersPage}>
      {/* ─────────────────────────────────────────────────────────────────────────
         LIST SCREEN
         ─────────────────────────────────────────────────────────────────────── */}
      {screenState === 'list' && (
        <>
          {/* Page Title */}
          <div className={styles.header}>
            <h1 className={styles.pageTitle}>Reviewers List</h1>
          </div>

          {/* Navigation Tabs */}
          <div className={styles.tabsRow}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'discover' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('discover')}
            >
              Discover Reviewers
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'requests' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              My Review Requests
              {requests.length > 0 && (
                <span className={styles.requestsCountBadge}>{requests.length}</span>
              )}
            </button>
          </div>

          {/* TAB: Discover Reviewers */}
          {activeTab === 'discover' && (
            <div className={styles.discoverContainer}>
              {/* Manuscript Selector */}
              <div className={styles.manuscriptSelectorCard}>
                <span className={styles.selectorLabel}>Select Paper for Reviewer Recommendation</span>
                <select 
                  className={styles.selectorDropdown}
                  value={selectedPaper}
                  onChange={(e) => setSelectedPaper(e.target.value)}
                >
                  <option>Framework_Design_v2.pdf</option>
                  <option>Cloud_Routing_v1.pdf</option>
                  <option>Microservice_Consensus_v3.pdf</option>
                </select>
              </div>

              {/* Reviewers Grid */}
              <div className={styles.reviewersGrid}>
                {reviewers.map((reviewer) => {
                  const hasSufficientFunds = walletBalance >= reviewer.fee;
                  const shortfall = reviewer.fee - walletBalance;

                  return (
                    <div key={reviewer.id} className={styles.reviewerCard}>
                      {/* Avatar, name, title */}
                      <div className={styles.reviewerHeader}>
                        <div 
                          className={styles.avatarCircle} 
                          style={{ backgroundColor: reviewer.avatarBg }}
                        >
                          {reviewer.initials}
                        </div>
                        <div className={styles.authorMeta}>
                          <span className={styles.reviewerName}>{reviewer.name}</span>
                          <span className={styles.reviewerTitle}>{reviewer.title}</span>
                        </div>
                      </div>

                      {/* Stats (H-Index, Pubs, Reviews) */}
                      <div className={styles.statsRow}>
                        <div className={styles.statCol}>
                          <span className={styles.statVal}>{reviewer.hIndex}</span>
                          <span className={styles.statLabel}>H-Index</span>
                        </div>
                        <div className={styles.statCol}>
                          <span className={styles.statVal}>{reviewer.publications}</span>
                          <span className={styles.statLabel}>Publications</span>
                        </div>
                        <div className={styles.statCol}>
                          <span className={styles.statVal}>{reviewer.reviews}</span>
                          <span className={styles.statLabel}>Reviews</span>
                        </div>
                      </div>

                      {/* Review Fee Banner */}
                      <div className={`${styles.feeBox} ${hasSufficientFunds ? styles.feeBoxBlue : styles.feeBoxRed}`}>
                        <span className={styles.feeLabel}>Base Review Fee</span>
                        <span className={styles.feeVal}>{reviewer.fee.toLocaleString('vi-VN')} VND</span>
                      </div>

                      {/* Tags */}
                      <div className={styles.tagsRow}>
                        {reviewer.tags.map((tag, i) => (
                          <span key={i} className={styles.tagPill}>{tag}</span>
                        ))}
                      </div>

                      {/* Action buttons */}
                      {hasSufficientFunds ? (
                        <button 
                          className={styles.requestReviewBtn}
                          onClick={() => handleRequestClick(reviewer)}
                        >
                          Request Review
                        </button>
                      ) : (
                        <div className={styles.insufficientContainer}>
                          <button 
                            className={styles.addFundBtn}
                            onClick={() => setTopUpReviewer(reviewer)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                              <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                              <line x1="12" y1="20" x2="12" y2="4"></line>
                            </svg>
                            Add Fund to Wallet
                          </button>
                          <span className={styles.shortfallText}>
                            Need {shortfall.toLocaleString('vi-VN')} VND more to request
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: My Review Requests */}
          {activeTab === 'requests' && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>My Review Request</h3>
                <button className={styles.refreshBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                  </svg>
                  Refresh
                </button>
              </div>

              <div className={styles.tableResponsive}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>MANUSCRIPT TITLE</th>
                      <th>ASSIGNED REVIEWER</th>
                      <th>SUBMISSION DATE</th>
                      <th>REVIEW FEE</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.length > 0 ? (
                      requests.map((req) => (
                        <tr key={req.id}>
                          <td className={styles.manuscriptCell}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.fileIcon}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <span className={styles.fileNameText}>{req.manuscriptTitle}</span>
                          </td>
                          <td className={styles.reviewerCell}>
                            <div 
                              className={styles.avatarCircleSmall}
                              style={{ backgroundColor: req.reviewerAvatarBg }}
                            >
                              {req.reviewerInitials}
                            </div>
                            <span className={styles.reviewerNameText}>{req.reviewerName}</span>
                          </td>
                          <td className={styles.dateCell}>{req.date}</td>
                          <td className={styles.feeCell}>{req.fee.toLocaleString('vi-VN')} VND</td>
                          <td>
                            <span className={`${styles.statusDotLabel} ${styles.statusPending}`}>
                              ● Pending
                            </span>
                          </td>
                          <td>
                            <button className={styles.btnActionDetails}>View Details</button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className={styles.emptyRow}>
                          No review requests submitted yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {requests.length > 0 && (
                <div className={styles.tableFooter}>
                  <span>Showing {requests.length} of {requests.length} requests</span>
                  <span className={styles.footerTime}>
                    Last updated: {requests[0].date} at {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ICT
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
         CREATE PAID REVIEW REQUEST SCREEN (FRAME 1)
         ─────────────────────────────────────────────────────────────────────── */}
      {screenState === 'create-request' && selectedReviewer && (
        <div className={styles.createRequestContainer}>
          {/* Breadcrumbs */}
          <div className={styles.breadcrumbs}>
            Home &gt; Reviewer Directory &gt; Submit Manuscript Request
          </div>

          {/* Header title */}
          <div className={styles.header}>
            <h1 className={styles.pageTitle}>Create Peer Review Request</h1>
          </div>

          <div className={styles.formGrid}>
            {/* Left Column: Reviewer Profile */}
            <div className={styles.reviewerSummaryCard}>
              <div className={styles.sectionHeaderLabel}>REVIEWER PROFILE</div>
              <div className={styles.avatarCircleLarge} style={{ backgroundColor: selectedReviewer.avatarBg }}>
                {selectedReviewer.initials}
              </div>
              <h2 className={styles.formReviewerName}>{selectedReviewer.name}</h2>
              <span className={styles.formReviewerTitle}>{selectedReviewer.title}</span>

              {/* Stats Grid */}
              <div className={styles.formStatsGrid}>
                <div className={styles.formStatCol}>
                  <span className={styles.formStatVal}>{selectedReviewer.hIndex}</span>
                  <span className={styles.formStatLabel}>H-Index</span>
                </div>
                <div className={styles.formStatCol}>
                  <span className={styles.formStatVal}>{selectedReviewer.publications}</span>
                  <span className={styles.formStatLabel}>Publications</span>
                </div>
                <div className={styles.formStatCol}>
                  <span className={styles.formStatVal}>{selectedReviewer.reviews}</span>
                  <span className={styles.formStatLabel}>Reviews</span>
                </div>
              </div>

              {/* Base Fee */}
              <div className={styles.formFeeBox}>
                <span className={styles.formFeeLabel}>Base Review Fee</span>
                <span className={styles.formFeeVal}>{selectedReviewer.fee.toLocaleString('vi-VN')} VND</span>
              </div>

              {/* Specializations list */}
              <div className={styles.specializationsContainer}>
                <span className={styles.specLabel}>Specializations</span>
                <div className={styles.specTagsGrid}>
                  {selectedReviewer.specializations.map((spec, idx) => (
                    <span key={idx} className={styles.specTag}>{spec}</span>
                  ))}
                </div>
              </div>

              {/* ORCID Banner (Blue-grey styling matching Frame 1) */}
              <div className={styles.orcidBanner}>
                <span className={styles.orcidIcon}>🔗</span>
                <span className={styles.orcidLabel}>ORCID:</span>
                <span className={styles.orcidVal}>{selectedReviewer.orcid}</span>
              </div>
            </div>

            {/* Right Column: Manuscript Submission */}
            <div className={styles.formFieldsCard}>
              <div className={styles.sectionHeaderLabel}>MANUSCRIPT SUBMISSION</div>

              {/* Select Paper */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Select Paper</label>
                <div className={styles.selectWrapper}>
                  <select 
                    className={styles.formSelect}
                    value={selectedPaper}
                    onChange={(e) => setSelectedPaper(e.target.value)}
                  >
                    <option>Framework_Design_v2.pdf</option>
                    <option>Cloud_Routing_v1.pdf</option>
                    <option>Microservice_Consensus_v3.pdf</option>
                  </select>
                  <span className={styles.selectArrow}>&gt;</span>
                </div>
                <span className={styles.fieldHelper}>Choose the manuscript you wish to submit for peer review</span>
              </div>

              {/* Notes to Reviewer */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Notes to Reviewer</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Describe your review requirements, specific areas to focus on..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={5}
                />
                <span className={styles.charCounter}>{notes.length} / 500 characters</span>
              </div>

              {/* Priority & Date Row */}
              <div className={styles.rowFormGroup}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.formLabel}>Priority Level</label>
                  <div className={styles.priorityBox}>
                    <span className={styles.priorityDot}>●</span>
                    <select
                      className={styles.prioritySelect}
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option>Standard Priority</option>
                      <option>Urgent Priority (+100k)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.formLabel}>Requested By</label>
                  <input
                    type="text"
                    className={styles.formDateInput}
                    value={requestedByDate}
                    onChange={(e) => setRequestedByDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Estimated completion alert banner */}
              <div className={styles.estimateBanner}>
                <span className={styles.infoIcon}>🕒</span>
                <div className={styles.estimateTextWrapper}>
                  <span className={styles.estimateTitle}>Estimated Completion: 7 Days</span>
                </div>
                <span className={styles.estimateSub}>Based on reviewer availability</span>
              </div>
            </div>
          </div>

          {/* Bottom Confirmation status bar */}
          <div className={styles.confirmationStatusBar}>
            <span className={styles.confirmationText}>
              ✓ Review request will be sent to {selectedReviewer.name} upon confirmation
            </span>
            <div className={styles.confirmationActions}>
              <button 
                className={styles.formCancelBtn}
                onClick={() => { setScreenState('list'); setSelectedReviewer(null); }}
              >
                ✕ Cancel
              </button>
              <button className={styles.formConfirmBtn} onClick={handleProceedToPayment}>
                Confirm & Proceed to Payment &gt;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
         ESCROW CHECKOUT SCREEN (FRAME 2)
         ─────────────────────────────────────────────────────────────────────── */}
      {screenState === 'checkout' && selectedReviewer && (
        <div className={styles.createRequestContainer}>
          {/* Breadcrumbs */}
          <div className={styles.breadcrumbs}>
            Home &gt; My Wallet &gt; Escrow Checkout [Request ID: #REV-99211]
          </div>

          <div className={styles.formGrid}>
            {/* Left Card: Invoice Summary */}
            <div className={styles.formFieldsCard} style={{ gap: '20px' }}>
              <h3 className={styles.invoiceTitle}>INVOICE SUMMARY</h3>

              <div className={styles.invoiceTable}>
                <div className={styles.invoiceRow}>
                  <span className={styles.invoiceLabel}>Target Item</span>
                  <span className={styles.invoiceValue}>Peer Review Service</span>
                </div>
                <div className={styles.invoiceRow}>
                  <span className={styles.invoiceLabel}>Manuscript</span>
                  <span className={styles.invoiceValue}>{selectedPaper}</span>
                </div>
                <div className={styles.invoiceRow}>
                  <span className={styles.invoiceLabel}>Reviewer</span>
                  <span className={styles.invoiceValue}>{selectedReviewer.name}</span>
                </div>
              </div>

              <div className={styles.invoiceCalculation}>
                <div className={styles.calcRow}>
                  <span>Base Fee</span>
                  <span>{selectedReviewer.fee.toLocaleString('vi-VN')} VND</span>
                </div>
                <div className={styles.calcRow}>
                  <span>Processing Tax</span>
                  <span>25,000 VND</span>
                </div>
                <div className={`${styles.calcRow} ${styles.calcRowTotal}`}>
                  <span>Total Amount</span>
                  <span>{(selectedReviewer.fee + 25000).toLocaleString('vi-VN')} VND</span>
                </div>
              </div>

              {/* Escrow banner */}
              <div className={styles.escrowBanner}>
                <span className={styles.escrowShieldIcon}>🛡️</span>
                <span>Protected by Escrow — funds held until review confirmed</span>
              </div>
            </div>

            {/* Right Card: Integrated Wallet Checkout */}
            <div className={styles.formFieldsCard}>
              <h3 className={styles.invoiceTitle}>INTEGRATED WALLET CHECKOUT</h3>

              <div className={styles.checkoutGroup}>
                <span className={styles.checkoutLabel}>Current Available Balance</span>
                <div className={styles.checkoutBalanceVal}>
                  {walletBalance.toLocaleString('vi-VN')} VND
                </div>
              </div>

              <div className={styles.deductibleBox}>
                <span>Invoice Deductible Total</span>
                <span className={styles.deductibleAmount}>
                  -{(selectedReviewer.fee + 25000).toLocaleString('vi-VN')} VND
                </span>
              </div>

              {/* Sufficient balance alert */}
              <div className={styles.remainingBalanceBox}>
                <span className={styles.remainingIcon}>✓</span>
                <div className={styles.remainingTexts}>
                  <span className={styles.remainingTitle}>
                    Remaining Balance Post-Payment: {(walletBalance - (selectedReviewer.fee + 25000)).toLocaleString('vi-VN')} VND
                  </span>
                  <span className={styles.remainingSub}>Sufficient funds — ready to authorize payment</span>
                </div>
              </div>

              {/* PIN Code Box */}
              <div className={styles.pinCodeSection}>
                <label className={styles.pinLabel}>* Enter 6-Digit Wallet PIN</label>
                <div className={styles.pinInputsRow}>
                  {[0, 1, 2, 3, 4, 5].map((idx) => (
                    <input
                      key={idx}
                      id={`pin-${idx}`}
                      type="password"
                      maxLength={1}
                      className={styles.pinInputCircle}
                      value={pinDigits[idx]}
                      onChange={(e) => handlePinInput(idx, e.target.value)}
                      disabled={isProcessingCheckout}
                    />
                  ))}
                </div>

                {isProcessingCheckout && (
                  <div className={styles.processingLedger}>
                    <div className={styles.spinner}></div>
                    <span>Processing wallet isolation ledger...</span>
                  </div>
                )}
              </div>

              {/* Cancel transaction button */}
              <button 
                className={styles.cancelTransactionBtn}
                onClick={() => setScreenState('create-request')}
                disabled={isProcessingCheckout}
              >
                CANCEL TRANSACTION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Up Modal Overlay */}
      {topUpReviewer && (
        <TopUpModal
          isOpen={true}
          onClose={() => setTopUpReviewer(null)}
          onSuccess={handleTopUpSuccess}
          shortfallAmount={topUpReviewer.fee - walletBalance}
          reviewerName={topUpReviewer.name}
        />
      )}

      {/* Success Modal Overlay */}
      {showSuccessModal && selectedReviewer && (
        <div className={styles.modalOverlay}>
          <div className={styles.successModalCard}>
            <div className={styles.successIconWrapper}>
              <span className={styles.successCheckIcon}>✓</span>
            </div>
            <h3 className={styles.successTitle}>Review Request Submitted Successfully!</h3>
            <p className={styles.successDescription}>
              <b>{(selectedReviewer.fee + 25000).toLocaleString('vi-VN')} VND</b> has been deducted from your wallet escrow. Your request is routed to {selectedReviewer.name}.
            </p>

            {/* Info Box Details table */}
            <div className={styles.successDetailsTable}>
              <div className={styles.successTableRow}>
                <span className={styles.successTableLabel}>Request ID</span>
                <span className={styles.successTableVal}>#REQ-2026-8812</span>
              </div>
              <div className={styles.successTableRow}>
                <span className={styles.successTableLabel}>Status</span>
                <span className={`${styles.statusDotLabel} ${styles.statusWaiting}`}>Waiting for Review</span>
              </div>
              <div className={styles.successTableRow}>
                <span className={styles.successTableLabel}>Assigned to</span>
                <span className={styles.successTableVal}>{selectedReviewer.name}</span>
              </div>
            </div>

            <button className={styles.goToRequestsBtn} onClick={handleGoToRequests}>
              Go to My Review Requests &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reviewers;
