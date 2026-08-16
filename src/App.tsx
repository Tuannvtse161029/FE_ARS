import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './routes/paths';
import { PrivateRoute, PublicRoute } from './routes/PrivateRoute';
import { AuthProvider } from './context/AuthContext';
import { AuthLayout } from './layouts/AuthLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import ForgotPassword from './pages/ResetPassword/ForgotPassword';
import VerifyOtp from './pages/ResetPassword/VerifyOtp';
import ResetPassword from './pages/ResetPassword/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { MainLayout } from './layouts/MainLayout';
import { Forum } from './pages/Forum/Forum';
import { Papers } from './pages/Papers/Papers';
import { DiscoverReviewers } from './pages/Researcher/DiscoverReviewers';
import { EvaluationDesk } from './pages/Reviewer/EvaluationDesk';
import { SeminarWorkspace } from './pages/Lecturer/SeminarWorkspace';
import { ResearchGroup } from './pages/Lecturer/ResearchGroup';
import { ConfigureMilestones } from './pages/Lecturer/ConfigureMilestones';
import { SubmitReport } from './pages/GraduateStudent/SubmitReport';
import { StudentResearchGroups } from './pages/GraduateStudent/StudentResearchGroups';
import { EarningsWallet } from './pages/Reviewer/EarningsWallet';
import { AssignedReviews } from './pages/Reviewer/AssignedReviews';
import { Profile } from './pages/Profile/Profile';
import { AdminDashboard } from './pages/Admin/AdminDashboard';
import { AdminWithdrawalRequests } from './pages/Admin/AdminWithdrawalRequests';
import CheckoutReturn from './pages/Payment/CheckoutReturn';
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

          {/* Private Routes */}
          <Route element={<PrivateRoute />}>
            <Route element={<MainLayout />}>
              <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
              <Route path={ROUTES.FORUM} element={<Forum />} />
              <Route path={ROUTES.PAPERS} element={<Papers />} />
              <Route path={ROUTES.REVIEWERS} element={<DiscoverReviewers />} />
              <Route path={ROUTES.EVALUATION} element={<EvaluationDesk />} />
              <Route path={ROUTES.SEMINAR_WORKSPACE} element={<SeminarWorkspace />} />
              <Route path={ROUTES.RESEARCH_GROUP} element={<ResearchGroup />} />
              <Route path={ROUTES.CONFIGURE_MILESTONES} element={<ConfigureMilestones />} />
              <Route path={ROUTES.SUBMIT_REPORT} element={<SubmitReport />} />
              <Route path={ROUTES.STUDENT_RESEARCH_GROUPS} element={<StudentResearchGroups />} />
              <Route path={ROUTES.EARNINGS_WALLET} element={<EarningsWallet />} />
              <Route path={ROUTES.REVIEW_TASKS} element={<AssignedReviews />} />
              <Route path={ROUTES.PROFILE} element={<Profile />} />
              <Route path={ROUTES.ADMIN} element={<AdminDashboard />} />
              <Route path={ROUTES.ADMIN_WITHDRAWALS} element={<AdminWithdrawalRequests />} />
              <Route path={ROUTES.PAYMENT_RETURN} element={<CheckoutReturn />} />
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
