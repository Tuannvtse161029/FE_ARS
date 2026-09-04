/**
 * Policy document types — backed by Firebase Firestore.
 *
 * Each Policy lives in its own Firestore document under the `policies`
 * collection. Document IDs are stable slugs (e.g. `privacy_policy`) so the
 * public-facing Register / LegalPolicy pages can fetch them by ID without
 * needing a secondary index lookup. See `src/services/policy.service.ts`.
 *
 * NOTE — schema-drift between Swagger and the BE: there is no BE endpoint
 * for policy documents by design. The admin team owns policy text directly
 * via Firestore, so the BE never sees these documents. The FE is therefore
 * the only writer and the only reader.
 */

export type PolicySlug =
  | 'privacy_policy'
  | 'terms_of_service'
  | 'researcher_responsibility'
  | 'reviewer_responsibility';

/** Stable registry — drives the Admin Policies list and the public read paths. */
export const POLICY_SLUGS: readonly PolicySlug[] = [
  'privacy_policy',
  'terms_of_service',
  'researcher_responsibility',
  'reviewer_responsibility',
] as const;

export interface PolicyMeta {
  /** i18n key suffix for the page header (resolved by the consumer page). */
  key: PolicySlug;
  /** Display title for the admin list — pure UI hint, NOT authoritative. */
  title: string;
  /** One-line summary shown on the admin card and the policy index. */
  summary: string;
}

/** Canonical metadata for every supported policy. Single source of truth. */
export const POLICY_META: Readonly<Record<PolicySlug, PolicyMeta>> = {
  privacy_policy: {
    key: 'privacy_policy',
    title: 'Privacy Policy',
    summary:
      'What user data ARS collects, how it is used, and the rights users have over their personal information.',
  },
  terms_of_service: {
    key: 'terms_of_service',
    title: 'Terms of Service',
    summary:
      'Acceptable-use rules, account responsibilities, and the conditions under which ARS may suspend or terminate access.',
  },
  researcher_responsibility: {
    key: 'researcher_responsibility',
    title: 'Researcher Responsibility',
    summary:
      'Standards researchers must follow when submitting a research paper request — original work, citation integrity, ethical authorship.',
  },
  reviewer_responsibility: {
    key: 'reviewer_responsibility',
    title: 'Reviewer Responsibility',
    summary:
      'Confidentiality, objectivity, and turnaround expectations reviewers agree to when they accept a peer-review assignment.',
  },
};

/**
 * Firestore document shape stored under `policies/{slug}`.
 *
 * Field naming uses snake_case to keep it compatible with a potential future
 * Firestore → .NET sync without forcing a rename. `version` increments on
 * every admin save so consumers can decide whether to refetch cached text.
 */
export interface PolicyDocument {
  title: string;
  /** Plain-text body. Line breaks are preserved; no markdown rendering. */
  content: string;
  /** Monotonically increasing revision number, starting at 1. */
  version: number;
  /** ISO 8601 timestamp of the last save. Empty string when never saved. */
  updatedAt: string;
  /** Display name of the admin who last saved. Best-effort only. */
  updatedBy: string | null;
}

/**
 * Hydrated view of a policy as the FE renders it. Wraps `PolicyDocument`
 * with the slug the FE asked for and a `fromFirestore` flag so the Admin
 * UI can show a "not saved yet" badge when the document is still on the
 * seed defaults.
 */
export interface PolicySnapshot extends PolicyDocument {
  slug: PolicySlug;
  fromFirestore: boolean;
}

/**
 * Default content shown the first time an admin opens a policy that has
 * never been written to Firestore. Mirrors the existing static English text
 * from `src/pages/Register/components/PolicyModal.tsx` so the public Register
 * page keeps working until the admin overwrites it.
 *
 * Researcher and Reviewer policies are new — the seed text is a starter the
 * admin can rewrite immediately.
 */
export const POLICY_SEED_CONTENT: Readonly<Record<PolicySlug, string>> = {
  privacy_policy: `1. Information We Collect

When you register and use the Academic Research Sharing (ARS) platform, we collect the following types of personal and academic information:

- Account Identity: Full Name, Email Address, Phone Number, and hashed credentials.
- Academic Credentials: Selected Role (Researcher, Reviewer, Lecturer, Graduate Student), Affiliated University/Institution, and ORCID iD.
- Verification Documents: Academic portfolio PDFs, student enrollment certificates, or proof of faculty appointment uploaded for role verification.

2. How We Use Your Data

Your data is strictly used for the following platform purposes:

- Verifying academic authenticity and approving requested business roles.
- Facilitating blind peer review assignments based on verified scholarly expertise.
- Sending critical notifications regarding paper reviews, milestone evaluations, and account updates.
- Securing academic research assets and preventing fraudulent submissions.

3. Storage & Document Security

All uploaded verification PDFs and sensitive manuscripts are stored in encrypted cloud storage (Firebase Cloud Storage & Azure Secure Blobs). Only verified Platform Administrators have restricted access to inspect verification proofs during account review.

4. User Rights & Data Protection

You have the right to review, update, or request the deletion of your personal account data at any time through Account Settings or by contacting ARS Platform Administration.`,

  terms_of_service: `1. Academic Integrity & Ethics

By creating an account on ARS, you agree to adhere to standard international scientific ethics:

- All submitted research, evaluation reports, and seminar materials must be original and free of plagiarism.
- Falsification of academic affiliations, credentials, or ORCID identity is grounds for immediate account termination.

2. Platform Roles & Responsibilities

- Researcher: Responsible for accurate metadata, citation integrity, and ethical preprint distribution.
- Reviewer: Bound by strict confidentiality. Manuscript contents must not be shared, duplicated, or utilized prior to formal publication.
- Lecturer & Graduate Student: Obligated to maintain authentic milestone reports, supervision logs, and seminar materials.

3. Account Verification & Status

Newly created accounts start in a Pending verification state. You will have guest access to community forums until an Administrator verifies your credentials and approves your designated role.

4. Termination & Policy Updates

ARS reserves the right to suspend or terminate accounts that breach peer review confidentiality, post abusive content, or violate academic research standards. Policy text may be updated annually to reflect new academic regulations.`,

  researcher_responsibility: `1. Originality & Plagiarism

Every research paper you submit to ARS must be your own original work, or work you are explicitly authorized to distribute (for example, a preprint uploaded by a co-author). ARS runs every submission through a plagiarism-screening pipeline before peer review. Submissions flagged above the platform's similarity threshold are returned to you for revision or rejected.

2. Accurate Metadata

You are responsible for the accuracy of every field on the submission form:

- Title, abstract, and keyword list must reflect the manuscript as uploaded.
- Author names, affiliations, and ORCID iDs must match the people who actually contributed to the work.
- Funding sources and conflict-of-interest declarations must be complete and current.

3. Citation Integrity

- Cite every source that influenced your methodology, results, or framing.
- Do not include citations you have not read.
- Self-citation must be limited to genuine prior work, never used to inflate metrics.

4. Versioning & Revisions

When you upload a revised manuscript, retain a clear changelog inside the document so reviewers can trace what changed between rounds. Do not silently overwrite a previous submission in a way that hides reviewer-visible edits.

5. Co-author Consent

Every named co-author must have reviewed and approved the version of the manuscript you upload. Adding or removing authors after submission requires written justification in the revision notes.

6. Compliance With Local Research Ethics

If your study required IRB / ethics-board approval, upload the approval letter (or a redacted summary) together with the manuscript. ARS may reject submissions that cannot evidence ethics clearance for human-subjects research.`,

  reviewer_responsibility: `1. Confidentiality

The manuscripts ARS assigns to you are confidential pre-publication material. You must not:

- Share, forward, or upload the manuscript — in whole or in part — to anyone outside the assigned review panel.
- Discuss the work with colleagues, students, or on social media before the paper is formally published.
- Use findings, data, or ideas from the manuscript in your own research before publication without explicit written permission from the authors.

2. Objectivity & Constructive Feedback

A useful review identifies strengths as well as weaknesses. When you raise a concern:

- Anchor every criticism in a specific section, figure, or claim in the manuscript.
- Suggest concrete improvements the authors can act on.
- Distinguish clearly between "showstopper" issues (invalidating the work) and "nice-to-have" issues (improving clarity).

3. Conflicts of Interest

Decline the assignment immediately if you have:

- A personal or financial relationship with any of the authors.
- Co-authored, co-PI'd, or co-supervised any of the authors in the past 24 months.
- A competing research program that would benefit from delaying or rejecting the paper.

4. Timeliness

Reviews are due within the window the platform assigns to your assignment (typically 14 days). If you cannot meet the deadline, decline or request an extension before the deadline lapses — never after.

5. Prohibited Behaviour

ARS has zero tolerance for reviewers who:

- Use the review process to extract unpublished data for their own work.
- Demand citations to their own papers as a condition of acceptance.
- Contact authors directly outside the ARS review workflow to negotiate outcomes.

Such behaviour results in immediate removal from the reviewer pool and revocation of any pending payouts.`,
};
