// ShareApiContractPreview — visual mock of the backend endpoint the
// Materials "Share" feature actually needs. The Share button on the
// learning-material card triggers `POST /api/SharedMaterial` today and
// the BE rejects it with 403 because the request payload sends the
// material id in a field named `paperId` (designed for the research-
// paper domain, not the learning-material domain).
//
// Until the BE ships the right endpoint (see
// `tickets/backend/FE_MATERIAL_SHARE_403_TICKET.md`), this preview lets
// the BE team see the exact contract the FE wants to call, end-to-end:
// every status transition, every wire field, every payload example,
// including the 30-day expiry rules and the lifecycle states the FE
// already implements.
//
// Rendered behind a "View API contract" link in the Share modal so
// product / engineering can reference it during standups without the
// FE having to maintain a separate design doc.

import { useEffect, useRef } from 'react';
import { Code2, X, Server } from 'lucide-react';
import styles from './ShareApiContractPreview.module.css';

export interface ShareApiContractPreviewProps {
  isOpen: boolean;
  onClose: () => void;
}

const CODE_BLOCKS: ReadonlyArray<{ title: string; language: string; code: string }> = [
  {
    title: 'POST /api/SharedMaterial — invite a colleague',
    language: 'http',
    code: `POST /api/SharedMaterial HTTP/1.1
Host: arsplatform.onrender.com
Authorization: Bearer <lecturer-jwt>
Content-Type: application/json

{
  "lecturerId": 17,
  "learningMaterialId": 42,    // ← NOT paperId (the FE bug lives here today)
  "sharedWithColleagueId": 28,
  "sharedAt": "2026-09-05T10:30:00Z",
  "expiresAt": "2026-10-05T10:30:00Z",
  "status": "PENDING"
}`,
  },
  {
    title: '201 Created — full record returned',
    language: 'json',
    code: `{
  "sharedMaterialId": 91,
  "lecturerId": 17,
  "learningMaterialId": 42,
  "sharedWithColleagueId": 28,
  "sharedAt": "2026-09-05T10:30:00Z",
  "expiresAt": "2026-10-05T10:30:00Z",
  "status": "PENDING",
  "createdAt": "2026-09-05T10:30:00Z",
  "updatedAt": "2026-09-05T10:30:00Z"
}`,
  },
  {
    title: 'PATCH /api/SharedMaterial/{id} — recipient accepts / declines',
    language: 'http',
    code: `PATCH /api/SharedMaterial/91 HTTP/1.1
Host: arsplatform.onrender.com
Authorization: Bearer <recipient-jwt>
Content-Type: application/json

// Body when the recipient accepts
{ "status": "ACCEPTED", "respondedAt": "2026-09-06T08:15:00Z" }

// Body when the recipient declines
{ "status": "DECLINED", "respondedAt": "2026-09-06T08:15:00Z" }`,
  },
  {
    title: 'DELETE /api/SharedMaterial/{id} — sender revokes before expiry',
    language: 'http',
    code: `DELETE /api/SharedMaterial/91 HTTP/1.1
Host: arsplatform.onrender.com
Authorization: Bearer <sender-jwt>

// 204 No Content on success; 403 if the caller is not the sender.`,
  },
  {
    title: 'GET /api/SharedMaterial — feed for the current user',
    language: 'http',
    code: `GET /api/SharedMaterial?role=any HTTP/1.1
Host: arsplatform.onrender.com
Authorization: Bearer <lecturer-jwt>

// Returns rows where the caller is EITHER the sender OR the recipient,
// scoped to non-expired entries by default. Pass ?includeExpired=true
// to include history for the audit log.

200 OK
[
  {
    "sharedMaterialId": 91,
    "direction": "outbound",      // ← "outbound" (I'm the sender) or "inbound"
    "lecturerId": 17, "lecturerName": "Dr. An",
    "sharedWithColleagueId": 28, "sharedWithName": "Dr. Bình",
    "learningMaterialId": 42, "learningMaterialTitle": "Syllabus.pdf",
    "sharedAt": "2026-09-05T10:30:00Z",
    "expiresAt": "2026-10-05T10:30:00Z",
    "status": "PENDING",
    "canRevoke": true,            // ← FE uses this to enable the Stop button
    "canRespond": false           // ← FE uses this to enable Accept/Deny
  }
]`,
  },
  {
    title: 'Lifecycle state machine',
    language: 'text',
    code: `PENDING  ─► ACCEPTED   (recipient taps Accept, valid until expiresAt)
PENDING  ─► DECLINED   (recipient taps Deny, terminal)
PENDING  ─► REVOKED    (sender cancels before recipient responds)
PENDING  ─► EXPIRED    (30-day timer reached without response)
ACCEPTED ─► EXPIRED    (30-day timer reached after acceptance)

// Notes:
//  - ACCEPTED rows stay readable for the recipient until expiresAt, then
//    flip to EXPIRED on the next read. The FE never deletes them — it
//    just stops listing them in the active Shared Materials tab.
//  - REVOKED is the FE-only name for "sender cancelled". The BE may
//    store it as status='CANCELLED' if it prefers — the FE maps either
//    to the same UI affordance.`,
  },
];

export const ShareApiContractPreview = ({
  isOpen,
  onClose,
}: ShareApiContractPreviewProps) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-api-contract-title"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <span className={styles.iconCircle}>
              <Server size={18} aria-hidden />
            </span>
            <div>
              <h3
                id="share-api-contract-title"
                className={styles.title}
              >
                Backend contract — Learning Material Share
              </h3>
              <span className={styles.subtitle}>
                Reference for the BE team to design the real endpoint. The
                FE ships against this shape as soon as it is live.
              </span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close API contract preview"
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        <div className={styles.body}>
          <p className={styles.intro}>
            <Code2 size={14} aria-hidden /> The share button on every
            learning-material card calls <code>POST /api/SharedMaterial</code>
            {' '}today, and the BE rejects the request with{' '}
            <strong>403 Forbidden</strong> because the payload&apos;s{' '}
            <code>paperId</code> field was designed for research-paper
            sharing, not for
            learning-material sharing. The FE wants the contract below —
            the BE can either repurpose the existing endpoint or stand up
            a sibling <code>/api/LearningMaterialShare</code>; both shapes
            are accepted on the FE side.
          </p>

          <ol className={styles.contractList}>
            {CODE_BLOCKS.map((block) => (
              <li key={block.title} className={styles.contractItem}>
                <header className={styles.contractHeader}>
                  <span className={styles.contractIndex}>
                    {CODE_BLOCKS.indexOf(block) + 1}
                  </span>
                  <h4 className={styles.contractTitle}>{block.title}</h4>
                  <span className={styles.contractLang}>{block.language}</span>
                </header>
                <pre className={styles.codeBlock} data-lang={block.language}>
                  <code>{block.code}</code>
                </pre>
              </li>
            ))}
          </ol>

          <section className={styles.acceptanceSection}>
            <h4 className={styles.acceptanceTitle}>Acceptance criteria</h4>
            <ul className={styles.acceptanceList}>
              <li>
                <strong>Field rename</strong> — the payload accepts{' '}
                <code>learningMaterialId</code> (preferred) and continues
                to accept <code>paperId</code> as a legacy alias until
                FE removes it.
              </li>
              <li>
                <strong>Authorization</strong> — only the lecturer who
                owns the material can create a share; only the
                addressee can <code>PATCH</code> the status; only the
                sender can <code>DELETE</code>.
              </li>
              <li>
                <strong>Status enum</strong> — server-side enum exposes{' '}
                <code>PENDING</code>, <code>ACCEPTED</code>,{' '}
                <code>DECLINED</code>, <code>REVOKED</code>,{' '}
                <code>EXPIRED</code>. The FE maps <code>REVOKED</code> ↔{' '}
                <code>CANCELLED</code> if the BE prefers the latter.
              </li>
              <li>
                <strong>Expiry</strong> — server stamps{' '}
                <code>expiresAt = sharedAt + 30 days</code> on create; the
                FE never sends a custom expiry value.
              </li>
              <li>
                <strong>List query</strong> — <code>GET /api/SharedMaterial</code>{' '}
                returns rows where the caller is sender or recipient,
                including a computed <code>direction</code>{' '}
                (<code>outbound</code> / <code>inbound</code>) and{' '}
                <code>canRevoke</code> / <code>canRespond</code> flags.
              </li>
              <li>
                <strong>Error contract</strong> — <code>403</code> when
                the caller is not authorized, <code>404</code> when the
                referenced material id is not found, <code>409</code>{' '}
                when a duplicate share already exists with status{' '}
                <code>PENDING</code>.
              </li>
            </ul>
          </section>
        </div>

        <footer className={styles.footer}>
          <span className={styles.footerHint}>
            See <code>tickets/backend/FE_MATERIAL_SHARE_403_TICKET.md</code>
            {' '}for the full issue write-up.
          </span>
          <button
            type="button"
            className={styles.closeFooterBtn}
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ShareApiContractPreview;
