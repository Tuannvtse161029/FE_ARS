import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './routes/paths';
import { PrivateRoute, PublicRoute } from './routes/PrivateRoute';
import { RoleRouteGuard } from './routes/RoleRouteGuard';
import { AuthProvider } from './context/AuthContext';
import { AuthLayout } from './layouts/AuthLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import ForgotPassword from './pages/ResetPassword/ForgotPassword';
import VerifyOtp from './pages/ResetPassword/VerifyOtp';
import ResetPassword from './pages/ResetPassword/ResetPassword';
import { MainLayout } from './layouts/MainLayout';
import { Forum } from './pages/Forum/Forum';
import { Papers } from './pages/Papers/Papers';
import { DiscoverReviewers } from './pages/Researcher/DiscoverReviewers';
import { EvaluationDesk } from './pages/Reviewer/EvaluationDesk';
import { SeminarWorkspace } from './pages/Lecturer/SeminarWorkspace';
import { ResearchGroup } from './pages/Lecturer/ResearchGroup';
import { ConfigureMilestones } from './pages/Lecturer/ConfigureMilestones';
import { EvaluateReports } from './pages/Lecturer/EvaluateReports';
import { LecturerGroupDetail } from './pages/Lecturer/GroupDetail';
import { GuidanceProjects } from './pages/Lecturer/GuidanceProjects';
import { SubmitReport } from './pages/GraduateStudent/SubmitReport';
import { StudentResearchGroups } from './pages/GraduateStudent/StudentResearchGroups';
import { GraduateStudentDashboard } from './pages/GraduateStudent/GraduateStudentDashboard';
import { EarningsWallet } from './pages/Reviewer/EarningsWallet';
import { AssignedReviews } from './pages/Reviewer/AssignedReviews';
import { Profile } from './pages/Profile/Profile';
import { ProfessionalProfile } from './pages/Reviewer/ProfessionalProfile';
import { AdminDashboard } from './pages/Admin/AdminDashboard';
import { RoleRequests } from './pages/Admin/RoleRequests';
import { AccountsManagement } from './pages/Admin/AccountsManagement';
import { TransactionsManagement } from './pages/Admin/TransactionsManagement';
import ContentReports from './pages/Admin/ContentReports';
import PremiumPackages from './pages/Admin/PremiumPackages';
import AuditLogs from './pages/Admin/AuditLogs';
import CheckoutReturn from './pages/Payment/CheckoutReturn';
import PremiumPackagesPreview from './pages/PremiumPackages';
import { CompleteGoogleRegistration } from './pages/CompleteGoogleRegistration/CompleteGoogleRegistration';
import './styles/globals.css';

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
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

          {/* Private Routes */}
          <Route element={<PrivateRoute />}>
            <Route element={<MainLayout />}>

              {/* Lecturer-only routes */}
              <Route element={<RoleRouteGuard allow={['Lecturer']} />}>
                <Route path={ROUTES.SEMINAR_WORKSPACE} element={<SeminarWorkspace />} />
                <Route path={ROUTES.RESEARCH_GROUP} element={<ResearchGroup />} />
                <Route path={ROUTES.CONFIGURE_MILESTONES} element={<ConfigureMilestones />} />
                <Route path={ROUTES.LECTURER_EVALUATE_REPORTS} element={<EvaluateReports />} />
                <Route path={ROUTES.LECTURER_GROUP_DETAIL} element={<LecturerGroupDetail />} />
                <Route path={ROUTES.LECTURER_GUIDANCE_PROJECTS} element={<GuidanceProjects />} />
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
              <Route path={ROUTES.EARNINGS_WALLET} element={<EarningsWallet />} />
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
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
