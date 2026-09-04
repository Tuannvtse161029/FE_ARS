import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ROUTES } from './routes/paths';
import { buildConfigureMilestonesUrl } from './utils/topicRouting';
import { PrivateRoute, PublicRoute } from './routes/PrivateRoute';
import { RoleRouteGuard } from './routes/RoleRouteGuard';
import { SubscriptionRouteGuard } from './routes/SubscriptionRouteGuard';
import { AuthProvider } from './context/AuthContext';
import { AuthLayout } from './layouts/AuthLayout';
import { MainLayout } from './layouts/MainLayout';
import { DelayedLoadingOverlay } from './components/DelayedLoadingOverlay';
import { GlobalLoadingOverlay } from './components/GlobalLoadingOverlay';
import './styles/globals.css';

// Public auth pages — kept as eager imports because every cold-load starts
// on one of them and they share no heavy dependencies with each other.
import { Login } from './pages/Login';
import { Register } from './pages/Register';
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));
import ForgotPassword from './pages/ResetPassword/ForgotPassword';
import VerifyOtp from './pages/ResetPassword/VerifyOtp';
import ResetPassword from './pages/ResetPassword/ResetPassword';
import { GoogleCallback } from './pages/GoogleCallback';
import { CompleteGoogleRegistration } from './pages/CompleteGoogleRegistration/CompleteGoogleRegistration';
// Agent email-verification — public deep-link landing for the
// registration email verification link. Lives inside `PublicRoute` +
// `AuthLayout` because the recipient of the link is not authenticated
// yet.
import { EmailVerificationLanding } from './pages/Auth/EmailVerificationLanding';
// FE_ORCID_CONNECT_CALLBACK_FIX_TICKET — public ORCID OAuth callback
// landing page. Lives outside `PublicRoute` because the page itself
// decides where to continue based on the URL fragment (`context`).
// Registration callbacks happen before a user has an ARS JWT, and
// account-link callbacks already have one — the page must accept both.
const OrcidCallback = lazy(() =>
  import('./pages/OrcidCallback/OrcidCallback').then((m) => ({ default: m.OrcidCallback })),
);

// Every authenticated page is split into its own chunk via React.lazy so
// the initial bundle only carries the route the user opens. Recharts
// (AdminDashboard), pdfjs (any PDF-bearing review/research page), and the
// larger role dashboards only download when their route activates.
const Forum = lazy(() => import('./pages/Forum/Forum').then((m) => ({ default: m.Forum })));
const HomeResearchCatalog = lazy(() => import('./features/publication/home/HomeResearchCatalog'));
const ResearcherSubmissions = lazy(() => import('./features/publication/researcher/ResearcherSubmissions'));
const ResearcherSubmissionForm = lazy(() => import('./features/publication/researcher/ResearcherSubmissionForm'));
const ResearcherSubmissionDetail = lazy(() => import('./features/publication/researcher/ResearcherSubmissionDetail'));
const ReviewerAssignments = lazy(() => import('./features/publication/reviewer/ReviewerAssignments'));
const ReviewerAssignmentDetail = lazy(() => import('./features/publication/reviewer/ReviewerAssignmentDetail'));
const AdminPaperSubmissions = lazy(() => import('./features/publication/admin/AdminPaperSubmissions'));
const AdminPaperSubmissionDetail = lazy(() => import('./features/publication/admin/AdminPaperSubmissionDetail'));
const AdminReviewerAssignments = lazy(() => import('./features/publication/admin/AdminPublicationLists').then((m) => ({ default: m.AdminReviewerAssignments })));
const AdminPublishedPapers = lazy(() => import('./features/publication/admin/AdminPublicationLists').then((m) => ({ default: m.AdminPublishedPapers })));
const SeminarWorkspace = lazy(() => import('./pages/Lecturer/SeminarWorkspace').then((m) => ({ default: m.SeminarWorkspace })));
const ResearchGroup = lazy(() => import('./pages/Lecturer/ResearchGroup').then((m) => ({ default: m.ResearchGroup })));
const ConfigureMilestones = lazy(() => import('./pages/Lecturer/ConfigureMilestones').then((m) => ({ default: m.ConfigureMilestones })));
const EvaluateReports = lazy(() => import('./pages/Lecturer/EvaluateReports').then((m) => ({ default: m.EvaluateReports })));
const PhaseReports = lazy(() => import('./pages/Lecturer/PhaseReports').then((m) => ({ default: m.PhaseReports })));
const LecturerGroupDetail = lazy(() => import('./pages/Lecturer/GroupDetail').then((m) => ({ default: m.LecturerGroupDetail })));
const GuidanceProjects = lazy(() => import('./pages/Lecturer/GuidanceProjects').then((m) => ({ default: m.GuidanceProjects })));
// Agent lecturer-navigation — top-level Lecturer surface for Research Topics.
// Shared, additive registration: see BACKEND_REQUESTS.md "Coordination".
const ResearchTopicsPage = lazy(() => import('./pages/Lecturer/ResearchTopics').then((m) => ({ default: m.ResearchTopicsPage })));
// Agent lecturer-navigation — combined Lecturer Materials page. Hosts both
// Learning Materials and Shared Materials via in-page tabs. The legacy
// routes are kept on the same page component for backward compatibility.
const LecturerMaterialsPage = lazy(() => import('./pages/Lecturer/Materials').then((m) => ({ default: m.LecturerMaterialsPage })));
const SubmitReport = lazy(() => import('./pages/GraduateStudent/SubmitReport').then((m) => ({ default: m.SubmitReport })));
const StudentResearchGroups = lazy(() => import('./pages/GraduateStudent/StudentResearchGroups').then((m) => ({ default: m.StudentResearchGroups })));
const GraduateStudentDashboard = lazy(() => import('./pages/GraduateStudent/GraduateStudentDashboard').then((m) => ({ default: m.GraduateStudentDashboard })));
const Profile = lazy(() => import('./pages/Profile/Profile').then((m) => ({ default: m.Profile })));
const ProfessionalProfile = lazy(() => import('./pages/Reviewer/ProfessionalProfile').then((m) => ({ default: m.ProfessionalProfile })));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const RoleRequests = lazy(() => import('./pages/Admin/RoleRequests').then((m) => ({ default: m.RoleRequests })));
const AccountsManagement = lazy(() => import('./pages/Admin/AccountsManagement').then((m) => ({ default: m.AccountsManagement })));
const TransactionsManagement = lazy(() => import('./pages/Admin/TransactionsManagement').then((m) => ({ default: m.TransactionsManagement })));
// These pages use default-only exports. The dynamic `import()` resolves
// to `{ default: <Component> }`, so we map it back to a real ESM module
// shape via `.then(m => ({ default: m.default }))`.
const ContentReports = lazy(() => import('./pages/Admin/ContentReports').then((m) => ({ default: m.default })));
const PremiumPackages = lazy(() => import('./pages/Admin/PremiumPackages').then((m) => ({ default: m.default })));
const AuditLogs = lazy(() => import('./pages/Admin/AuditLogs').then((m) => ({ default: m.default })));
// Admin Annual Fees tab. It renders an honest backend-unavailable state
// until the AnnualFee API ticket is implemented.
const AnnualFees = lazy(() => import('./pages/Admin/AnnualFees').then((m) => ({ default: m.default })));
const AdminMedals = lazy(() => import('./pages/Admin/AdminMedals').then((m) => ({ default: m.AdminMedals })));
// Researcher / Lecturer subscription page. Renders the current status,
// plans, and `Proceed to Pay` button. Lives behind the existing role
// guards so only Researcher / Lecturer reach it.
const Subscription = lazy(() => import('./pages/Subscription/Subscription').then((m) => ({ default: m.Subscription })));
// PayOS return landing. The BE redirects here after a PayOS checkout;
// the page verifies status via the BE and never unlocks access itself.
const SubscriptionReturn = lazy(() => import('./pages/Subscription/SubscriptionReturn').then((m) => ({ default: m.SubscriptionReturn })));
const LegalPolicy = lazy(() => import('./pages/Legal/LegalPolicy').then((m) => ({ default: m.LegalPolicy })));

/**
 * Suspense fallback used by every lazy route. Keep it intentionally neutral
 * (no spinner brand) so it never conflicts with the role-themed spinners
 * inside individual pages — those pages render once their module finishes
 * downloading.
 */
const RouteFallback = () => <DelayedLoadingOverlay isLoading label="Loading page" />;

/**
 * Lecturer topic-scoped deep link.
 *
 * `/lecturer/research-topics/:topicId/milestones` is the canonical
 * "Manage Phases" URL surfaced in the Research Topics table. We redirect
 * to `/configure-milestones?topicId=<id>` so the page reads its context
 * from a single query-string source of truth. Invalid ids land on the
 * Research Topics index instead of a half-broken page.
 */
const TopicMilestonesRedirect = () => {
  const { topicId } = useParams<{ topicId: string }>();
  const parsed = Number(topicId);
  const safe =
    typeof topicId === 'string' && /^\d+$/.test(topicId) && parsed > 0;
  if (!safe) {
    return <Navigate to={ROUTES.LECTURER_RESEARCH_TOPICS} replace />;
  }
  return <Navigate to={buildConfigureMilestonesUrl(parsed)} replace />;
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GlobalLoadingOverlay />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public project introduction. It intentionally sits outside
                PublicRoute so both signed-out and returning users can visit it. */}
            <Route path={ROUTES.LANDING} element={<Landing />} />

            {/* Public Routes */}
            <Route element={<PublicRoute />}>
              <Route element={<AuthLayout />}>
                <Route path={ROUTES.LOGIN} element={<Login />} />
                <Route path={ROUTES.REGISTER} element={<Register />} />
                <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
                <Route path={ROUTES.VERIFY_OTP} element={<VerifyOtp />} />
                <Route path={ROUTES.RESET_PASSWORD} element={<ResetPassword />} />
                <Route path={ROUTES.VERIFY_EMAIL} element={<EmailVerificationLanding />} />
              </Route>
            </Route>

            {/* Legal pages - Publicly accessible */}
            <Route path={ROUTES.PRIVACY_POLICY} element={<LegalPolicy />} />
            <Route path={ROUTES.TERMS_OF_SERVICE} element={<LegalPolicy />} />

            {/* Agent 52 — First-time Google-user onboarding. Renders outside
                the AuthLayout / PublicRoute chain because the page controls
                its own auth state. If the user is not authenticated, the
                page bounces to /login. See BTR-AGENT52-04 for the
                refresh-safe handoff. */}
            <Route
              path={ROUTES.COMPLETE_GOOGLE_REGISTRATION}
              element={<CompleteGoogleRegistration />}
            />

            {/* Agent 54 — Google OAuth callback landing page. The BE redirects
                the browser here after /api/Auth/google-callback. The page
                parses ?code=&error= once, persists the session through the
                existing ARS auth-storage path, then navigates with replace:
                true so the code never lingers in history. Public route — the
                page itself enforces auth-state handoff. */}
            <Route path={ROUTES.GOOGLE_OAUTH_CALLBACK} element={<GoogleCallback />} />

            {/* FE_ORCID_CONNECT_CALLBACK_FIX_TICKET — ORCID OAuth callback
                landing page. The BE redirects the browser here after
                /api/Auth/orcid/callback. The page parses the URL fragment
                (#success=&context=...) once, branches on `context`, and
                replaces itself with /profile (account link) or /register
                (registration). Public route — must accept both authenticated
                users (account link) and unauthenticated visitors
                (registration) because the registration callback runs before
                a JWT exists. The page itself is responsible for not leaking
                OAuth codes / provider tokens into sessionStorage. */}
            <Route path={ROUTES.ORCID_OAUTH_CALLBACK} element={<OrcidCallback />} />

            {/* Private Routes */}
            <Route element={<PrivateRoute />}>
              <Route element={<MainLayout />}>

                {/* Lecturer-only routes. Wrapped in SubscriptionRouteGuard so a
                    Lecturer with a missing / inactive / expired subscription is
                    redirected to /subscription instead of seeing an empty
                    workspace. /subscription and /subscription/return are
                    themselves mounted OUTSIDE this guard so the user can
                    always reach them to renew or see verification status. */}
                <Route element={<RoleRouteGuard allow={['Lecturer']} />}>
                  <Route element={<SubscriptionRouteGuard />}>
                    <Route path={ROUTES.RESEARCH_GROUP} element={<ResearchGroup />} />
                    <Route path={ROUTES.CONFIGURE_MILESTONES} element={<ConfigureMilestones />} />
                    {/* Topic-scoped deep-link: lands on /configure-milestones?topicId=<id>. */}
                    <Route
                      path={ROUTES.LECTURER_TOPIC_MILESTONES}
                      element={<TopicMilestonesRedirect />}
                    />
                    <Route path={ROUTES.LECTURER_EVALUATE_REPORTS} element={<EvaluateReports />} />
                    <Route path={ROUTES.LECTURER_PHASE_REPORTS} element={<PhaseReports />} />
                    <Route path={ROUTES.LECTURER_GROUP_DETAIL} element={<LecturerGroupDetail />} />
                    <Route path={ROUTES.LECTURER_GUIDANCE_PROJECTS} element={<GuidanceProjects />} />
                    <Route path={ROUTES.LECTURER_RESEARCH_TOPICS} element={<ResearchTopicsPage />} />
                    <Route path={ROUTES.LECTURER_MATERIALS} element={<LecturerMaterialsPage />} />
                    {/* Backward compatibility: old routes redirect to the new combined page */}
                    <Route path={ROUTES.LECTURER_LEARNING_MATERIALS} element={<Navigate to={ROUTES.LECTURER_MATERIALS} replace />} />
                    <Route path={ROUTES.LECTURER_SHARED_MATERIALS} element={<Navigate to={ROUTES.LECTURER_MATERIALS} replace />} />
                  </Route>
                  {/* Subscription management routes — always reachable for
                      Lecturer, even when the subscription is missing / expired.
                      This is the page the gate redirects users TO. */}
                  <Route path={ROUTES.SUBSCRIPTION} element={<Subscription />} />
                  <Route path={ROUTES.SUBSCRIPTION_RETURN} element={<SubscriptionReturn />} />
                </Route>

                {/* Seminar workspace is shared by Lecturer (manage) and
                    Researcher (view schedule, join Meet, submit feedback).
                    Wrapped in the subscription gate so a missing / expired
                    subscription locks out both roles. */}
                <Route element={<RoleRouteGuard allow={['Lecturer', 'Researcher']} />}>
                  <Route element={<SubscriptionRouteGuard />}>
                    <Route path={ROUTES.SEMINAR_WORKSPACE} element={<SeminarWorkspace />} />
                  </Route>
                </Route>

                {/* Graduate Student & Lecturer routes */}
                <Route element={<RoleRouteGuard allow={['Graduate Student', 'Lecturer']} />}>
                  <Route path={ROUTES.STUDENT_RESEARCH_GROUPS} element={<StudentResearchGroups />} />
                  <Route path={ROUTES.SUBMIT_REPORT} element={<SubmitReport />} />
                  <Route path={ROUTES.GRADUATE_STUDENT_DASHBOARD} element={<GraduateStudentDashboard />} />
                </Route>

                {/* Researcher-only publication routes. Reviewer selection is Admin-owned.
                    Wrapped in SubscriptionRouteGuard so a Researcher with a missing
                    or expired subscription is bounced to /subscription instead of
                    seeing an empty /papers workspace. */}
                <Route element={<RoleRouteGuard allow={['Researcher']} />}>
                  <Route element={<SubscriptionRouteGuard />}>
                    <Route path={ROUTES.PAPERS} element={<Navigate to={ROUTES.RESEARCHER_SUBMISSIONS} replace />} />
                    <Route path={ROUTES.RESEARCHER_SUBMISSIONS} element={<ResearcherSubmissions />} />
                    <Route path={ROUTES.RESEARCHER_SUBMISSION_NEW} element={<ResearcherSubmissionForm />} />
                    <Route path={ROUTES.RESEARCHER_SUBMISSION_DETAIL} element={<ResearcherSubmissionDetail />} />
                    <Route path={ROUTES.REVIEWERS} element={<Navigate to={ROUTES.RESEARCHER_SUBMISSIONS} replace />} />
                  </Route>
                  {/* Subscription management routes — always reachable for
                      Researcher, even when the subscription is missing / expired. */}
                  <Route path={ROUTES.SUBSCRIPTION} element={<Subscription />} />
                  <Route path={ROUTES.SUBSCRIPTION_RETURN} element={<SubscriptionReturn />} />
                </Route>

                {/* Reviewer-only publication routes. Reviewers cannot publish or assign. */}
                <Route element={<RoleRouteGuard allow={['Reviewer']} />}>
                  <Route path={ROUTES.PROFESSIONAL_PROFILE} element={<ProfessionalProfile />} />
                  <Route path={ROUTES.REVIEWER_ASSIGNMENTS} element={<ReviewerAssignments />} />
                  <Route path={ROUTES.REVIEWER_ASSIGNMENT_DETAIL} element={<ReviewerAssignmentDetail />} />
                  <Route path={ROUTES.EVALUATION} element={<Navigate to={ROUTES.REVIEWER_ASSIGNMENTS} replace />} />
                  <Route path={ROUTES.REVIEW_TASKS} element={<Navigate to={ROUTES.REVIEWER_ASSIGNMENTS} replace />} />
                </Route>

                {/* Admin-only editorial routes. */}
                <Route element={<RoleRouteGuard allow={['Admin']} />}>
                  <Route path={ROUTES.ADMIN_PAPER_SUBMISSIONS} element={<AdminPaperSubmissions />} />
                  <Route path={ROUTES.ADMIN_PAPER_SUBMISSION_DETAIL} element={<AdminPaperSubmissionDetail />} />
                  <Route path={ROUTES.ADMIN_REVIEWER_ASSIGNMENTS} element={<AdminReviewerAssignments />} />
                  <Route path={ROUTES.ADMIN_PUBLISHED_PAPERS} element={<AdminPublishedPapers />} />
                </Route>

                {/* Authenticated discovery catalog. */}
                <Route element={<RoleRouteGuard allow={['Researcher', 'Reviewer', 'Lecturer', 'Graduate Student']} />}>
                  <Route path={ROUTES.HOME} element={<HomeResearchCatalog />} />
                </Route>

                {/* Shared / cross-role routes */}
                <Route path={ROUTES.FORUM} element={<Forum />} />
                <Route path={ROUTES.PROFILE} element={<Profile />} />
                {/* Public profile viewing: forum authors/commenters of every
                    authenticated role must be able to open another user's
                    profile. Only the Admin workspace routes remain guarded
                    below. */}
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/professional-profile/:userId" element={<Profile />} />
                <Route path="/professional-profile" element={<Profile />} />
                <Route element={<RoleRouteGuard allow={['Admin']} />}>
                  <Route path={ROUTES.ADMIN} element={<AdminDashboard />} />
                  <Route path={ROUTES.ADMIN_ROLE_REQUESTS} element={<RoleRequests />} />
                  <Route path={ROUTES.ADMIN_ACCOUNTS} element={<AccountsManagement />} />
                  <Route path={ROUTES.ADMIN_TRANSACTIONS} element={<TransactionsManagement />} />
                  <Route path={ROUTES.ADMIN_REPORTS} element={<ContentReports />} />
                  <Route path={ROUTES.ADMIN_PACKAGES} element={<PremiumPackages />} />
                  <Route path={ROUTES.ADMIN_ANNUAL_FEES} element={<AnnualFees />} />
                  <Route path={ROUTES.ADMIN_MEDALS} element={<AdminMedals />} />
                  <Route path={ROUTES.ADMIN_AUDIT_LOGS} element={<AuditLogs />} />
                </Route>
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
