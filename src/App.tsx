import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './routes/paths';
import { PrivateRoute, PublicRoute } from './routes/PrivateRoute';
import { AuthProvider } from './context/AuthContext';
import { AuthLayout } from './layouts/AuthLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { MainLayout } from './layouts/MainLayout';
import { Forum } from './pages/Forum';
import { Papers } from './pages/Papers';
import { Reviewers } from './pages/Reviewers';
import { EvaluationDesk } from './pages/Reviewers/components/EvaluationDesk';
import { SeminarWorkspace } from './pages/Lecturer/SeminarWorkspace';
import { ResearchGroup } from './pages/Lecturer/ResearchGroup';
import { ConfigureMilestones } from './pages/Lecturer/ConfigureMilestones';
import { SubmitReport } from './pages/Student/SubmitReport';
import { StudentResearchGroups } from './pages/Student/StudentResearchGroups';
import { EarningsWallet } from './pages/Reviewers/EarningsWallet';
import { ReviewTasks } from './pages/Reviewers/components/ReviewTasks';
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
            </Route>
          </Route>

          {/* Private Routes */}
          <Route element={<PrivateRoute />}>
            <Route element={<MainLayout />}>
              <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
              <Route path={ROUTES.FORUM} element={<Forum />} />
              <Route path={ROUTES.PAPERS} element={<Papers />} />
              <Route path={ROUTES.REVIEWERS} element={<Reviewers />} />
              <Route path={ROUTES.EVALUATION} element={<EvaluationDesk />} />
              <Route path={ROUTES.SEMINAR_WORKSPACE} element={<SeminarWorkspace />} />
              <Route path={ROUTES.RESEARCH_GROUP} element={<ResearchGroup />} />
              <Route path={ROUTES.CONFIGURE_MILESTONES} element={<ConfigureMilestones />} />
              <Route path={ROUTES.SUBMIT_REPORT} element={<SubmitReport />} />
              <Route path={ROUTES.STUDENT_RESEARCH_GROUPS} element={<StudentResearchGroups />} />
              <Route path={ROUTES.EARNINGS_WALLET} element={<EarningsWallet />} />
              <Route path={ROUTES.REVIEW_TASKS} element={<ReviewTasks />} />
              <Route path={ROUTES.HOME} element={<Navigate to={ROUTES.DASHBOARD} replace />} />
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
