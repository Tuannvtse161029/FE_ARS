// Fallback to the live Swagger BE when no VITE_API_BASE_URL is provided.
// Without this, a production build (e.g. on Vercel) would default to
// http://localhost:5000 — which is unreachable from end-user browsers and
// produces a Network Timeout on login. Local dev can override this in
// .env.local with VITE_API_BASE_URL=http://localhost:5000.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://arsplatform.onrender.com';

// Frontend origin URL — used for OAuth callbacks, redirect URLs, and absolute links.
// Override in .env.production with VITE_APP_URL=https://your-app.vercel.app
export const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:3000';

/**
 * BE gap — temporary FE placeholder for `Seminar.endTime` on create.
 *
 * The current BE contract (Swagger `POST /api/Seminar` §9, ticket
 * `TICKET_SEMINAR_FE_INTEGRATION.md` §55.5) marks `endTime` as REQUIRED.
 * The lecturer has no "Mark as Completed" affordance yet, so without a
 * placeholder the BE rejects the create call entirely. We send
 * `startTime + PLACEHOLDER_DURATION_MS` as a stand-in and surface that
 * fact in the form helper copy.
 *
 * Once the BE team ships:
 *   • nullable `endTime` on `SeminarCreateRequest`, AND
 *   • a `POST /api/Seminar/{id}/complete` (or equivalent) that sets
 *     `endTime = DateTime.UtcNow` and flips status to `Completed`,
 * the FE will:
 *   • stop sending the placeholder (omit `endTime` entirely), and
 *   • call the new "complete" endpoint from a lecturer-only button.
 *
 * Until then, this constant is the single source of truth for the
 * placeholder duration so the two create-form copies stay in sync.
 *
 * See: tickets/backend/BE_SEMINAR_NULLABLE_ENDTIME.md
 */
export const SEMINAR_PLACEHOLDER_DURATION_MS = 60 * 60 * 1000;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    SELECT_ROLE: '/api/Auth/select-role',
    REGISTER: '/api/auth/register',
    // Primary Google sign-in endpoint. FE ↔ BE contract:
    //   POST { credential: <Google ID token JWT> } → BE validates the
    //   credential, finds or creates the user, and returns the ARS
    //   session (same shape as the password login response, plus the
    //   `isNewUser` / `requiresOnboarding` routing signals).
    GOOGLE_LOGIN: '/api/auth/google-login',
    // Authorization Code redirect flow — kept for backwards compatibility
    // with the existing /auth/google/callback page; the credential flow
    // above is the agreed primary path.
    GOOGLE_OAUTH_LOGIN: '/api/auth/google-oauth-login',
    GOOGLE_CALLBACK: '/api/auth/google-callback',
    // The live CompleteGoogleRegistrationRequest requires credential,
    // pdfUrl, phoneNumber, and role. ORCID/consent persistence is tracked in
    // tickets/backend/BE_GOOGLE_ONBOARDING_COMPLETION_TICKET.md until Swagger
    // publishes those fields.
    COMPLETE_GOOGLE_REGISTRATION: '/api/auth/complete-google-registration',
    ORCID_REGISTRATION_START: '/api/Auth/orcid/registration/start',
    ORCID_ACCOUNT_START: '/api/Auth/orcid/account/start',
    ORCID_STATUS: '/api/Auth/orcid/status',
    ORCID_CALLBACK: '/api/Auth/orcid/callback',
    FORGOT_PASSWORD: '/api/Auth/forgot-password',
    VERIFY_OTP: '/api/Auth/verify-otp',
    RESET_PASSWORD: '/api/Auth/reset-password',
    RESEND_OTP: '/api/Auth/resend-otp',
    VERIFY_EMAIL: '/api/Auth/verify-email',
    SEND_APPROVAL_EMAIL: '/api/Auth/send-approval-email',
  },
  ROLE: {
    GET_ALL: '/api/Role',
  },
  USER: {
    BASE: '/api/user',
    GET_ALL: '/api/user',
    GET_BY_ID: (id: number) => `/api/user/${id}`,
    UPDATE: (id: number) => `/api/user/${id}`,
    DELETE: (id: number) => `/api/user/${id}`,
  },
  PAPER: {
    VERIFY_AUTHORSHIP: (id: number | string) => `/api/Paper/${id}/verify-authorship`,
    TEST_UPDATE_NO_VERIFY: (id: number | string) => `/api/Paper/test-update-no-verify/${id}`,
    BASE: '/api/paper',
    GET_ALL: '/api/paper',
    GET_BY_ID: (id: number | string) => `/api/paper/${id}`,
    CREATE: '/api/paper',
    UPDATE: (id: number | string) => `/api/paper/${id}`,
    DELETE: (id: number | string) => `/api/paper/${id}`,
    ASSIGN_REVIEWERS: (id: number | string) => `/api/Paper/${id}/assign-reviewers`,
    ASSIGN_REVIEWERS_MANUAL: (id: number | string) =>
      `/api/Paper/${id}/assign-reviewers-manual`,
  },
  OPEN_ALEX: {
    GET_WORK: (workId: string) => `/api/OpenAlex/works/${workId}`,
  },
  PROFESSIONAL_PROFILE: {
    GET_ALL: '/api/ProfessionalProfile',
    GET_BY_ID: (id: number) => `/api/ProfessionalProfile/${id}`,
    UPDATE: (id: number) => `/api/ProfessionalProfile/${id}`,
    UPDATE_AVAILABILITY: (id: number) => `/api/ProfessionalProfile/${id}/availability`,
  },
  PROFILE: {
    GET_CURRENT: '/api/Profile',
    GET_BY_ID: (id: number) => `/api/Profile/${id}`,
    UPDATE: (id: number) => `/api/Profile/${id}`,
    PATCH: (id: number) => `/api/Profile/${id}`,
    DELETE: (id: number) => `/api/Profile/${id}`,
  },
  REVIEW_REQUEST: {
    BASE: '/api/ReviewRequest',
    GET_ALL: '/api/ReviewRequest',
    CREATE: '/api/ReviewRequest',
    GET_BY_ID: (id: number) => `/api/ReviewRequest/${id}`,
    UPDATE: (id: number) => `/api/ReviewRequest/${id}`,
    DELETE: (id: number) => `/api/ReviewRequest/${id}`,
  },
  DETAILED_EVALUATION: {
    GET_ALL: '/api/DetailedEvaluation',
    GET_BY_ID: (id: number) => `/api/DetailedEvaluation/${id}`,
    UPDATE: (id: number) => `/api/DetailedEvaluation/${id}`,
  },
  SEMINAR: {
    BASE: '/api/Seminar',
    GET_ALL: '/api/Seminar',
    /** Paged owner list — ticket §8. Backed by `GET /api/Seminar/paged`. */
    PAGED: '/api/Seminar/paged',
    CREATE: '/api/Seminar',
    GET_BY_ID: (id: number) => `/api/Seminar/${id}`,
    UPDATE: (id: number) => `/api/Seminar/${id}`,
    DELETE: (id: number) => `/api/Seminar/${id}`,
    INVITE: (id: number) => `/api/Seminar/${id}/invite`,
    /** Canonical participant submit/edit endpoint — ticket §16. */
    FEEDBACK: (id: number) => `/api/Seminar/${id}/feedback`,
    /** Owner-only raw feedback list — ticket §21. */
    GET_FEEDBACK: (id: number) => `/api/Seminar/${id}/feedback`,
    /** Optional suggested-invitees grouping for the owner (ticket §25). */
    SUGGESTED_INVITEES: '/api/Seminar/suggested-invitees',
    /** Owner-only feedback-form save / read — ticket §13-14. */
    FEEDBACK_FORM: (id: number) => `/api/Seminar/${id}/feedback-form`,
    /** Legacy alias — kept only for back-compat (ticket §16). */
    FEEDBACK_ANSWERS: (id: number) => `/api/Seminar/${id}/feedback-answers`,
    /** Owner-only completion stats — ticket §23. */
    STATS: (id: number) => `/api/Seminar/${id}/stats`,
    /** Owner-only manual feedback reminder — ticket §24. */
    SEND_REMINDERS: (id: number) => `/api/Seminar/${id}/reminders/send`,
    /** Owner-only AI feedback summary regeneration — ticket §28-31. */
    SUMMARIZE_FEEDBACK: (id: number) => `/api/Seminar/${id}/summarize-feedback`,
    /** Owner-only AI audio summary upload — ticket §34-37. */
    SUMMARIZE_AUDIO: (id: number) => `/api/Seminar/${id}/summarize-audio`,
    /** My-invitations list (participant) — ticket §27. */
    MY_INVITATIONS: '/api/Seminar/my-invitations',
  },
  SEMINAR_PARTICIPANT: {
    BASE: '/api/SeminarParticipant',
    GET_ALL: '/api/SeminarParticipant',
    CREATE: '/api/SeminarParticipant',
    GET_BY_ID: (id: number) => `/api/SeminarParticipant/${id}`,
    UPDATE: (id: number) => `/api/SeminarParticipant/${id}`,
    DELETE: (id: number) => `/api/SeminarParticipant/${id}`,
    /** My-seminars participant-scoped list. */
    MY_SEMINARS: '/api/SeminarParticipant/my-seminars',
    /**
     * @deprecated Per ticket §40 the canonical submit/edit feedback endpoint
     * is `POST /api/Seminar/{seminarId}/feedback`. The BE 400s any feedback
     * payload submitted through these legacy SeminarParticipant paths.
     * Kept only so existing legacy callers still find the constant.
     */
    FEEDBACK: (seminarId: number) => `/api/SeminarParticipant/${seminarId}/feedback`,
    FEEDBACK_ANSWERS: (seminarId: number) => `/api/SeminarParticipant/${seminarId}/feedback-answers`,
  },
  FOLLOWER: {
    BASE: '/api/Follower',
    GET_ALL: '/api/Follower',
    GET_PAGED: '/api/Follower/paged',
    CREATE: '/api/Follower',
    DELETE: (followedId: number) => `/api/Follower/${followedId}`,
    TOGGLE: (followedId: number) => `/api/Follower/toggle/${followedId}`,
    IS_FOLLOWING: (followedId: number) => `/api/Follower/is-following/${followedId}`,
    COUNTS: (userId: number) => `/api/Follower/counts/${userId}`,
    FOLLOWERS_PAGED: (userId: number) => `/api/Follower/followers/${userId}/paged`,
    FOLLOWING_PAGED: (userId: number) => `/api/Follower/following/${userId}/paged`,
  },
  NOTIFICATION: {
    BASE: '/api/Notification',
    GET_ALL: '/api/Notification',
    GET_PAGED: '/api/Notification/paged',
    CREATE: '/api/Notification',
    GET_BY_ID: (id: number) => `/api/Notification/${id}`,
    UPDATE: (id: number) => `/api/Notification/${id}`,
    MARK_READ: (id: number) => `/api/Notification/${id}/read`,
    MARK_ALL_READ: '/api/Notification/mark-all-read',
    UNREAD_COUNT: '/api/Notification/unread-count',
    DELETE: (id: number) => `/api/Notification/${id}`,
  },
  USER_ROLE: {
    BASE: '/api/UserRole',
    GET_ALL: '/api/UserRole',
    CREATE: '/api/UserRole',
    GET_BY_ID: (id: number) => `/api/UserRole/${id}`,
    UPDATE: (id: number) => `/api/UserRole/${id}`,
    DELETE: (id: number) => `/api/UserRole/${id}`,
  },
  MAJOR_FIELD: {
    BASE: '/api/MajorField',
    GET_ALL: '/api/MajorField',
    CREATE: '/api/MajorField',
    GET_BY_ID: (id: number) => `/api/MajorField/${id}`,
    UPDATE: (id: number) => `/api/MajorField/${id}`,
    DELETE: (id: number) => `/api/MajorField/${id}`,
  },
  SUB_FIELD: {
    BASE: '/api/SubField',
    GET_ALL: '/api/SubField',
    CREATE: '/api/SubField',
    GET_BY_ID: (id: number) => `/api/SubField/${id}`,
    UPDATE: (id: number) => `/api/SubField/${id}`,
    DELETE: (id: number) => `/api/SubField/${id}`,
  },
  COMMENT_VOTE: {
    BASE: '/api/CommentVote',
    GET_ALL: '/api/CommentVote',
    CREATE: '/api/CommentVote',
    TOGGLE: (commentId: number) => `/api/CommentVote/${commentId}`,
    MY_VOTES: '/api/CommentVote/my-votes',
  },
  FORUM_POST: {
    BASE: '/api/ForumPost',
    GET_ALL: '/api/ForumPost',
    GET_BY_ID: (id: number) => `/api/ForumPost/${id}`,
    CREATE: '/api/ForumPost',
    TOGGLE_LIKE: (id: number) => `/api/ForumPost/${id}/like`,
    MY_LIKES: '/api/ForumPost/my-likes',
  },
  FORUM_COMMENT: {
    BASE: '/api/ForumComment',
    GET_ALL: '/api/ForumComment',
    GET_BY_ID: (id: number) => `/api/ForumComment/${id}`,
    CREATE: '/api/ForumComment',
    UPDATE: (id: number) => `/api/ForumComment/${id}`,
    DELETE: (id: number) => `/api/ForumComment/${id}`,
    TOGGLE_VOTE: (id: number) => `/api/ForumComment/${id}/vote`,
    MY_VOTES: '/api/ForumComment/my-votes',
  },
  // Admin surface — all paths below are production API contracts. Endpoints
  // missing from live Swagger must remain unavailable in the UI and receive a
  // backend ticket rather than a mock fallback.
  ADMIN: {
    ORCID_LOOKUP: '/api/Admin/orcid-lookup',
    ROLE_REQUESTS: {
      GET_ALL: '/api/RoleRequest',
      GET_BY_ID: (id: number) => `/api/RoleRequest/${id}`,
      APPROVE: (id: number) => `/api/RoleRequest/${id}/approve`,
      DENY: (id: number) => `/api/RoleRequest/${id}/deny`,
    },
    ACCOUNTS: {
      GET_ALL: '/api/Account',
      GET_BY_ID: (id: number) => `/api/Account/${id}`,
      SUSPEND: (id: number) => `/api/Account/${id}/suspend`,
      UNSUSPEND: (id: number) => `/api/Account/${id}/unsuspend`,
    },
    REPORTS: {
      GET_ALL: '/api/ViolationReport',
      GET_BY_ID: (id: number) => `/api/ViolationReport/${id}`,
      RESOLVE: (id: number) => `/api/ViolationReport/${id}/resolve`,
    },
    // ⚠️ BE BACKLOG: AnnualFee controller was dropped. FE keeps this contract
    // as a placeholder — the UI still needs to collect fees from researchers
    // and lecturers. BE team must re-implement /api/AnnualFee endpoints:
    //   GET /api/AnnualFee          — List all fee plans
    //   GET /api/AnnualFee/{id}     — Get single plan
    //   POST /api/AnnualFee         — Admin create
    //   PUT /api/AnnualFee/{id}     — Admin update
    //   DELETE /api/AnnualFee/{id}  — Admin delete
    //   POST /api/AnnualFee/{id}/toggle — Admin toggle active
    ANNUAL_FEES: {
      GET_ALL: '/api/AnnualFee',
      GET_BY_ID: (id: number) => `/api/AnnualFee/${id}`,
      CREATE: '/api/AnnualFee',
      UPDATE: (id: number) => `/api/AnnualFee/${id}`,
      TOGGLE: (id: number) => `/api/AnnualFee/${id}/toggle`,
      DELETE: (id: number) => `/api/AnnualFee/${id}`,
    },
    AUDIT_LOGS: {
      GET_ALL: '/api/AuditLog',
      EXPORT: '/api/AuditLog/export',
    },
  },
  ANALYTICS: {
    SUMMARY: '/api/Analytics/summary',
    TIMESERIES: '/api/Analytics/timeseries',
  },
  RESEARCH_WORKFLOW: {
    // NOTE: GuidanceProject feature has been removed from the backend.
    // Research workflow now uses ResearchGroup and ResearchTopic only.
    RESEARCH_TOPIC: {
      GET_ALL: '/api/ResearchTopic',
      GET_BY_ID: (id: number) => `/api/ResearchTopic/${id}`,
      CREATE: '/api/ResearchTopic',
      UPDATE: (id: number) => `/api/ResearchTopic/${id}`,
      DELETE: (id: number) => `/api/ResearchTopic/${id}`,
      MY_TOPICS: '/api/ResearchTopic/my-topics',
    },
    RESEARCH_GROUP: {
      GET_ALL: '/api/ResearchGroup',
      GET_BY_ID: (id: number) => `/api/ResearchGroup/${id}`,
      CREATE: '/api/ResearchGroup',
      UPDATE: (id: number) => `/api/ResearchGroup/${id}`,
      DELETE: (id: number) => `/api/ResearchGroup/${id}`,
      MY_GROUPS: '/api/ResearchGroup/my-groups',
      INVITE: (id: number) => `/api/ResearchGroup/${id}/invite`,
      // PATCH /api/ResearchGroup/{id}/active — BE ships a dedicated toggle
      // endpoint (gap ticket BE-RESEARCH-GROUP-ACTIVE-01) that flips the
      // `is_active` column without forcing the caller to PUT the full group
      // payload. Returns the updated ResearchGroupResponse.
      TOGGLE_ACTIVE: (id: number) => `/api/ResearchGroup/${id}/active`,
    },
    GROUP_MEMBER: {
      GET_ALL: '/api/GroupMember',
      GET_BY_ID: (id: number) => `/api/GroupMember/${id}`,
      CREATE: '/api/GroupMember',
      UPDATE: (id: number) => `/api/GroupMember/${id}`,
      DELETE: (id: number) => `/api/GroupMember/${id}`,
      SET_LEADER: (id: number) => `/api/GroupMember/${id}/set-leader`,
      SET_LEADER_BODY: '/api/GroupMember/set-leader',
      REMOVE_LEADER: (id: number) => `/api/GroupMember/${id}/remove-leader`,
    },
    PHASED_REPORT: {
      GET_ALL: '/api/PhasedReport',
      GET_BY_ID: (id: number) => `/api/PhasedReport/${id}`,
      CREATE: '/api/PhasedReport',
      UPDATE: (id: number) => `/api/PhasedReport/${id}`,
      DELETE: (id: number) => `/api/PhasedReport/${id}`,
      BY_GROUP: (groupId: number) => `/api/PhasedReport/group/${groupId}`,
      TOPIC_MILESTONES: '/api/PhasedReport/topic-milestones',
      BY_TOPIC: (topicId: number) => `/api/PhasedReport/topic/${topicId}`,
      MEMBERS_BY_TOPIC: (topicId: number) => `/api/PhasedReport/topic/${topicId}/members`,
      SUBMIT: '/api/PhasedReport/submit',
      EVALUATE: (id: number) => `/api/PhasedReport/${id}/evaluate`,
      EXTEND_DEADLINE: (id: number) => `/api/PhasedReport/${id}/extend-deadline`,
    },
    LEARNING_MATERIAL: {
      GET_ALL: '/api/LearningMaterial',
      GET_BY_ID: (id: number) => `/api/LearningMaterial/${id}`,
      CREATE: '/api/LearningMaterial',
      UPDATE: (id: number) => `/api/LearningMaterial/${id}`,
      DELETE: (id: number) => `/api/LearningMaterial/${id}`,
      GET_USAGES: (id: number) => `/api/LearningMaterial/${id}/usages`,
    },
    PHASE_MATERIAL: {
      GET_BY_PHASE:
        '/api/PhaseMaterial',
      ASSIGN: '/api/PhaseMaterial',
      DELETE: (id: number) => `/api/PhaseMaterial/${id}`,
    },
    SHARED_MATERIAL: {
      GET_ALL: '/api/SharedMaterial',
      GET_BY_ID: (id: number) => `/api/SharedMaterial/${id}`,
      CREATE: '/api/SharedMaterial',
      UPDATE: (id: number) => `/api/SharedMaterial/${id}`,
      DELETE: (id: number) => `/api/SharedMaterial/${id}`,
    },
  },
} as const;

export const STORAGE_KEYS = {
  TOKEN: 'ars_token',
  USER: 'ars_user',
  REMEMBER_ME: 'ars_remember',
  SAVED_EMAIL: 'ars_saved_email',
} as const;

export const ROLES = {
  RESEARCHER: 'Researcher',
  REVIEWER: 'Reviewer',
  LECTURER: 'Lecturer',
  GRADUATE_STUDENT: 'Graduate Student',
} as const;

export const REPORT = {
  BASE: '/api/Report',
  CREATE: '/api/Report',
  GET_ALL: '/api/Report',
  GET_BY_ID: (id: number) => `/api/Report/${id}`,
  UPDATE: (id: number) => `/api/Report/${id}`,
} as const;

export type RoleName = typeof ROLES[keyof typeof ROLES];

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  FORUM: '/forum',
  USERS: '/users',
  PAPERS: '/papers',
  PROFILE: '/profile',
  ACCOUNT_SETTINGS: '/account-settings',
  ADMIN: '/admin',
} as const;

export const PAPER_STATUS = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected',
} as const;
