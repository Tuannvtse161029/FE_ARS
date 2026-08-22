/**
 * ReviewerPolicyModal
 *
 * Product/legal review required before this wording is treated as final legal advice.
 *
 * Scope: displayed for a specific review request (reviewRequestId) and policy version.
 * Not stored in localStorage as a source of authority — sessionStorage is only a
 * short-lived defense-in-depth cache to avoid re-prompting within one tab session.
 * Backend enforcement is the authoritative gate (see BE Team Request).
 *
 * Swagger: NO endpoint for policy acceptance exists in
 * https://arsplatform.onrender.com/swagger/v1/swagger.json — FE gate is defense-in-depth;
 * backend enforcement is required (see BE Team Request).
 */
import { useEffect, useRef } from 'react';
import { X, FileText, AlertTriangle } from 'lucide-react';
import styles from './ReviewerPolicyModal.module.css';

export interface ReviewerPolicyProps {
  isOpen: boolean;
  /** Review request id this policy is scoped to */
  reviewRequestId: number;
  /** Policy version string, e.g. "v1.0.0" */
  policyVersion: string;
  /** Paper title for context */
  paperTitle?: string;
  onCancel: () => void;
  onAccept: () => void;
}

const SESSION_KEY_PREFIX = 'ars_reviewer_policy_accepted_';

/** Short-lived session cache key (per reviewRequestId). */
function sessionKey(reviewRequestId: number) {
  return `${SESSION_KEY_PREFIX}${reviewRequestId}`;
}

/**
 * Check sessionStorage for a previously accepted policy for this reviewRequestId.
 * Returns true only when both the key exists AND the stored version matches.
 * This avoids re-prompting within the same browser session for the same paper.
 */
export function hasAcceptedPolicySession(reviewRequestId: number, policyVersion: string): boolean {
  try {
    const raw = sessionStorage.getItem(sessionKey(reviewRequestId));
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { version: string; acceptedAt: number };
    return parsed.version === policyVersion;
  } catch {
    return false;
  }
}

/**
 * Persist accepted policy to sessionStorage (keyed by reviewRequestId).
 * sessionStorage clears on tab close — aligns with per-session policy acceptance.
 */
function persistAcceptance(reviewRequestId: number, policyVersion: string) {
  try {
    sessionStorage.setItem(
      sessionKey(reviewRequestId),
      JSON.stringify({ version: policyVersion, acceptedAt: Date.now() })
    );
  } catch {
    // sessionStorage may be unavailable in some environments; fail silently.
  }
}

export const ReviewerPolicyModal = ({
  isOpen,
  reviewRequestId,
  policyVersion,
  paperTitle,
  onCancel,
  onAccept,
}: ReviewerPolicyProps) => {
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLButtonElement>(null);

  // Focus trap: focus first element on open, restore on close.
  useEffect(() => {
    if (isOpen) {
      // Move focus to the cancel button (least destructive action) on open.
      requestAnimationFrame(() => firstFocusRef.current?.focus());
    } else {
      // Return focus to where it was — handled via ref pair below.
    }
  }, [isOpen]);

  // No body scroll while modal is open.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAccept = () => {
    persistAcceptance(reviewRequestId, policyVersion);
    onAccept();
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reviewer-policy-title"
      aria-describedby="reviewer-policy-body"
      data-testid="reviewer-policy-modal"
      data-review-request-id={reviewRequestId}
      data-policy-version={policyVersion}
      onClick={(e) => {
        // Click on backdrop = cancel.
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div className={styles.modal} role="document">
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <FileText size={20} className={styles.headerIcon} aria-hidden="true" />
            <div>
              <h2 id="reviewer-policy-title" className={styles.title}>
                Reviewer Policy Agreement
              </h2>
              <span className={styles.version} data-testid="policy-version">
                Policy Version {policyVersion}
              </span>
            </div>
          </div>
          <button
            ref={lastFocusRef}
            className={styles.closeBtn}
            onClick={handleCancel}
            aria-label="Close reviewer policy modal"
            data-testid="policy-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Paper context */}
        {paperTitle && (
          <div className={styles.paperContext}>
            <span className={styles.paperLabel}>Paper:</span>
            <span className={styles.paperTitle} data-testid="policy-paper-title">
              {paperTitle}
            </span>
          </div>
        )}

        {/* Body */}
        <div
          id="reviewer-policy-body"
          className={styles.body}
          tabIndex={-1}
          data-testid="policy-body"
        >
          <div className={styles.notice}>
            <AlertTriangle size={16} className={styles.noticeIcon} aria-hidden="true" />
            <p className={styles.noticeText}>
              You must read and accept the following policy before accessing the
              manuscript for this review request. Acceptance is required for each paper.
            </p>
          </div>

          <div className={styles.policyContent}>
            <h3 className={styles.policySectionTitle}>1. Confidentiality</h3>
            <p className={styles.policyParagraph}>
              Treat the manuscript and all review materials as confidential. Do not
              share, copy, or distribute them to anyone outside this assigned review.
            </p>

            <h3 className={styles.policySectionTitle}>2. No reuse or ownership claims</h3>
            <p className={styles.policyParagraph}>
              Do not reuse the research, results, figures, text, or ideas. Do not claim
              authorship, ownership, or credit for any manuscript content.
            </p>

            <h3 className={styles.policySectionTitle}>3. Review-only use and conflicts</h3>
            <p className={styles.policyParagraph}>
              Use the manuscript only for this assigned review. Disclose any conflict
              of interest immediately and stop reviewing when a conflict is identified.
            </p>

            <h3 className={styles.policySectionTitle}>4. Secure handling</h3>
            <p className={styles.policyParagraph}>
              Handle downloaded material securely, do not retain or redistribute it,
              and report accidental exposure or security incidents to ARS promptly.
            </p>

            <h3 className={styles.policySectionTitle}>5. Review standards</h3>
            <p className={styles.policyParagraph}>
              Provide constructive, evidence-based, respectful feedback through the ARS
              Platform within the stated deadline.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            ref={firstFocusRef}
            className={styles.cancelBtn}
            onClick={handleCancel}
            data-testid="policy-cancel-btn"
          >
            Cancel
          </button>
          <button
            className={styles.acceptBtn}
            onClick={handleAccept}
            data-testid="policy-accept-btn"
          >
            Accept &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewerPolicyModal;
