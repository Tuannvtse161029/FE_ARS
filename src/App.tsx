import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './routes/paths';
import { PrivateRoute, PublicRoute } from './routes/PrivateRoute';
import { RoleRouteGuard } from './routes/RoleRouteGuard';
import { AuthProvider } from './context/AuthContext';
import { AuthLayout } from './layouts/AuthLayout';
import { MainLayout } from './layouts/MainLayout';
import { AppConfig } from './config/app';
import './styles/globals.css';

// Public auth pages — kept as eager imports because every cold-load starts
// on one of them and they share no heavy dependencies with each other.
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import ForgotPassword from './pages/ResetPassword/ForgotPassword';
import VerifyOtp from './pages/ResetPassword/VerifyOtp';
import ResetPassword from './pages/ResetPassword/ResetPassword';
import { GoogleCallback } from './pages/GoogleCallback';
import { CompleteGoogleRegistration } from './pages/CompleteGoogleRegistration/CompleteGoogleRegistration';

// Every authenticated page is split into its own chunk via React.lazy so
// the initial bundle only carries the route the user opens. Recharts
// (AdminDashboard), pdfjs (any PDF-bearing review/research page), and the
// larger role dashboards only download when their route activates.
const Forum = lazy(() => import('./pages/Forum/Forum').then((m) => ({ default: m.Forum })));
const Papers = lazy(() => import('./pages/Papers/Papers').then((m) => ({ default: m.Papers })));
const DiscoverReviewers = lazy(() => import('./pages/Researcher/DiscoverReviewers').then((m) => ({ default: m.DiscoverReviewers })));
const EvaluationDesk = lazy(() => import('./pages/Reviewer/EvaluationDesk').then((m) => ({ default: m.EvaluationDesk })));
const SeminarWorkspace = lazy(() => import('./pages/Lecturer/SeminarWorkspace').then((m) => ({ default: m.SeminarWorkspace })));
const ResearchGroup = lazy(() => import('./pages/Lecturer/ResearchGroup').then((m) => ({ default: m.ResearchGroup })));
const ConfigureMilestones = lazy(() => import('./pages/Lecturer/ConfigureMilestones').then((m) => ({ default: m.ConfigureMilestones })));
const EvaluateReports = lazy(() => import('./pages/Lecturer/EvaluateReports').then((m) => ({ default: m.EvaluateReports })));
const LecturerGroupDetail = lazy(() => import('./pages/Lecturer/GroupDetail').then((m) => ({ default: m.LecturerGroupDetail })));
const GuidanceProjects = lazy(() => import('./pages/Lecturer/GuidanceProjects').then((m) => ({ default: m.GuidanceProjects })));
const SubmitReport = lazy(() => import('./pages/GraduateStudent/SubmitReport').then((m) => ({ default: m.SubmitReport })));
const StudentResearchGroups = lazy(() => import('./pages/GraduateStudent/StudentResearchGroups').then((m) => ({ default: m.StudentResearchGroups })));
const GraduateStudentDashboard = lazy(() => import('./pages/GraduateStudent/GraduateStudentDashboard').then((m) => ({ default: m.GraduateStudentDashboard })));
const EarningsWallet = lazy(() => import('./pages/Reviewer/EarningsWallet').then((m) => ({ default: m.EarningsWallet })));
const AssignedReviews = lazy(() => import('./pages/Reviewer/AssignedReviews').then((m) => ({ default: m.AssignedReviews })));
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
const CheckoutReturn = lazy(() => import('./pages/Payment/CheckoutReturn').then((m) => ({ default: m.default })));
const PremiumPackagesPreview = lazy(() => import('./pages/PremiumPackages/PremiumPackagesPreview').then((m) => ({ default: m.default })));

/**
 * Suspense fallback used by every lazy route. Keep it intentionally neutral
 * (no spinner brand) so it never conflicts with the role-themed spinners
 * inside individual pages — those pages render once their module finishes
 * downloading.
 */
const RouteFallback = () => (
  <div
    role="status"
    aria-live="polite"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      color: '#64748b',
      fontSize: 14,
    }}
  >
    Loading…
  </div>
);

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicRoute />}>
              <Route element={<AuthLayout />}>
                <Route path={ROUTES.LOGIN} element={<Login />} />
                <Route path={ROUTES.REGISTER} element={<Register />} />
                <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
                <Route path={ROUTES.VERIFY_OTP} element={<VerifyOtp />} />
                <Route path={ROUTES.RESET_PASSWORD} element={<ResetPassword />} />
              </Route>
            </Route>

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

            {/* Private Routes */}
            <Route element={<PrivateRoute />}>
              <Route element={<MainLayout />}>

                {/* Lecturer-only routes */}
                <Route element={<RoleRouteGuard allow={['Lecturer']} />}>
                  <Route path={ROUTES.RESEARCH_GROUP} element={<ResearchGroup />} />
                  <Route path={ROUTES.CONFIGURE_MILESTONES} element={<ConfigureMilestones />} />
                  <Route path={ROUTES.LECTURER_EVALUATE_REPORTS} element={<EvaluateReports />} />
                  <Route path={ROUTES.LECTURER_GROUP_DETAIL} element={<LecturerGroupDetail />} />
                  <Route path={ROUTES.LECTURER_GUIDANCE_PROJECTS} element={<GuidanceProjects />} />
                </Route>

                {/* Seminar workspace is shared by Lecturer (manage) and
                    Graduate Student (accept / decline invitation, view
                    schedule). Per the notification-routing spec the dropdown
                    only marks-as-read and navigates — accept / decline lives
                    on the seminar page itself. */}
                <Route element={<RoleRouteGuard allow={['Lecturer', 'Graduate Student']} />}>
                  <Route path={ROUTES.SEMINAR_WORKSPACE} element={<SeminarWorkspace />} />
                </Route>

                {/* Graduate Student-only routes */}
                <Route element={<RoleRouteGuard allow={['Graduate Student']} />}>
                  <Route path={ROUTES.STUDENT_RESEARCH_GROUPS} element={<StudentResearchGroups />} />
                  <Route path={ROUTES.SUBMIT_REPORT} element={<SubmitReport />} />
                  <Route path={ROUTES.GRADUATE_STUDENT_DASHBOARD} element={<GraduateStudentDashboard />} />
                </Route>

                {/* Researcher-only routes */}
                <Route element={<RoleRouteGuard allow={['Researcher']} />}>
                  <Route path={ROUTES.PAPERS} element={<Papers />} />
                  <Route path={ROUTES.REVIEWERS} element={<DiscoverReviewers />} />
                </Route>

                {/* Reviewer-only routes */}
                <Route element={<RoleRouteGuard allow={['Reviewer']} />}>
                  <Route path={ROUTES.PROFESSIONAL_PROFILE} element={<ProfessionalProfile />} />
                </Route>

                {/* Shared / cross-role routes */}
                <Route path={ROUTES.FORUM} element={<Forum />} />
                <Route path={ROUTES.EVALUATION} element={<EvaluationDesk />} />
                <Route
                  path={ROUTES.EARNINGS_WALLET}
                  element={
                    AppConfig.features.enableWithdrawals
                      ? <EarningsWallet />
                      : <Navigate to={ROUTES.FORUM} replace />
                  }
                />
                <Route path={ROUTES.REVIEW_TASKS} element={<AssignedReviews />} />
                <Route path={ROUTES.PROFILE} element={<Profile />} />
                <Route path={ROUTES.ADMIN} element={<AdminDashboard />} />
                <Route path={ROUTES.ADMIN_ROLE_REQUESTS} element={<RoleRequests />} />
                <Route path={ROUTES.ADMIN_ACCOUNTS} element={<AccountsManagement />} />
                <Route path={ROUTES.ADMIN_TRANSACTIONS} element={<TransactionsManagement />} />
                <Route path={ROUTES.ADMIN_REPORTS} element={<ContentReports />} />
                <Route path={ROUTES.ADMIN_PACKAGES} element={<PremiumPackages />} />
                <Route path={ROUTES.ADMIN_AUDIT_LOGS} element={<AuditLogs />} />
                <Route path={ROUTES.PAYMENT_RETURN} element={<CheckoutReturn />} />
                <Route path={ROUTES.PREMIUM_PACKAGES} element={<PremiumPackagesPreview />} />
                <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.FORUM} replace />} />
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
