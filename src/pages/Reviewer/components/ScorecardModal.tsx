import {
  Check,
  X,
} from 'lucide-react';
import styles from './ScorecardModal.module.css';

interface CriteriaItem {
  number: number;
  title: string;
  score: number;
  comment: string;
}

interface ScorecardData {
  fileName: string;
  decision: 'Accept' | 'Reject';
  reviewer: string;
  date: string;
  criteria: CriteriaItem[];
}

interface ScorecardModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
}

export const ScorecardModal = ({ isOpen, onClose, fileName }: ScorecardModalProps) => {
  if (!isOpen) return null;

  // Mock data selection based on file name
  const isAccepted = fileName.toLowerCase().includes('consensus');
  
  const data: ScorecardData = isAccepted 
    ? {
        fileName: 'Microservice_Consensus_v3.pdf',
        decision: 'Accept',
        reviewer: 'Dr. Nguyen Van A',
        date: '2026-07-20',
        criteria: [
          {
            number: 1,
            title: 'ORIGINALITY',
            score: 5,
            comment: 'The paper presents a genuinely novel approach to modular backend routing that distinguishes itself clearly from prior art. The concept of decoupled orchestration layers is well-motivated.',
          },
          {
            number: 2,
            title: 'LITERATURE REVIEW',
            score: 4,
            comment: 'The literature review is comprehensive and covers the relevant works in distributed systems. A few recent 2025 publications on CAP theorem extensions could strengthen the survey.',
          },
          {
            number: 3,
            title: 'METHODOLOGY',
            score: 5,
            comment: 'Methodology is rigorous and reproducible. The three production-scale environment benchmarks are well-documented with clear threat-to-validity analysis.',
          },
          {
            number: 4,
            title: 'RESULTS & DISCUSSION',
            score: 4,
            comment: 'Results are clearly presented. The 47% throughput improvement claim is well-supported by the experimental data. Discussion of limitations is honest and appropriate.',
          },
          {
            number: 5,
            title: 'FORMATTING & STRUCTURE',
            score: 5,
            comment: 'Paper adheres strictly to the Journal of Distributed Computing style guide. Figures are crisp and properly captioned. References are consistently formatted.',
          },
        ]
      }
    : {
        fileName: 'EdgeNet_Protocol_v2.pdf',
        decision: 'Reject',
        reviewer: 'Dr. Nguyen Van A',
        date: '2026-07-20',
        criteria: [
          {
            number: 1,
            title: 'ORIGINALITY',
            score: 2,
            comment: 'The core idea of edge-network protocol optimization has been explored extensively. The paper does not sufficiently differentiate its contribution from existing work by Chen et al. (2024) and Park et al. (2023).',
          },
          {
            number: 2,
            title: 'LITERATURE REVIEW',
            score: 3,
            comment: 'The literature review covers foundational works adequately but misses several key 2024-2025 publications in the edge computing space that are directly relevant to the claims made.',
          },
          {
            number: 3,
            title: 'METHODOLOGY',
            score: 2,
            comment: 'The experimental setup lacks sufficient baselines for comparison. Only a single hardware configuration was tested, raising serious questions about generalizability across heterogeneous edge deployments.',
          },
          {
            number: 4,
            title: 'RESULTS & DISCUSSION',
            score: 2,
            comment: 'Scalability claims in Section 4 are not substantiated by the presented data. The evaluation does not address failure scenarios or network partition conditions, which are critical for the claimed use cases.',
          },
          {
            number: 5,
            title: 'FORMATTING & STRUCTURE',
            score: 3,
            comment: 'The paper generally follows formatting guidelines but several figures lack axis labels. The abstract exceeds the 250-word limit specified in submission guidelines.',
          },
        ]
      };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitleArea}>
            <h2 className={styles.title}>CRITERIA EVALUATION SCORECARD</h2>
            <span className={styles.fileName}>{data.fileName}</span>
          </div>
          <div className={styles.headerActions}>
            <span className={`${styles.badge} ${data.decision === 'Accept' ? styles.badgeAccept : styles.badgeReject}`}>
              {data.decision === 'Accept' ? (
                <>
                  <Check size={12} strokeWidth={3} style={{ verticalAlign: 'middle' }} /> Accept
                </>
              ) : (
                <>
                  <X size={12} strokeWidth={3} style={{ verticalAlign: 'middle' }} /> Reject
                </>
              )}
            </span>
            <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className={styles.body}>
          {data.criteria.map((item) => (
            <div key={item.number} className={styles.criteriaCard}>
              <div className={styles.criteriaHeader}>
                <h3 className={styles.criteriaTitle}>
                  {item.number}. {item.title}
                </h3>
                {/* Score Pills 1 to 5 */}
                <div className={styles.scorePills}>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <span
                      key={num}
                      className={`${styles.scorePill} ${
                        item.score === num ? styles.scorePillActive : ''
                      }`}
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>
              <p className={styles.commentText}>{item.comment}</p>
            </div>
          ))}

          {/* Final Decision row */}
          <div className={styles.criteriaCard}>
            <div className={styles.criteriaHeader}>
              <h3 className={styles.criteriaTitle}>6. FINAL DECISION</h3>
              <span className={`${styles.decisionText} ${data.decision === 'Accept' ? styles.textAccept : styles.textReject}`}>
                {data.decision === 'Accept' ? 'ACCEPTED' : 'REJECTED'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer info & Close */}
        <div className={styles.footer}>
          <span className={styles.reviewerInfo}>
            ● Reviewer: {data.reviewer} <b>·</b> Submitted {data.date}
          </span>
          <button className={styles.footerCloseBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
export default ScorecardModal;
