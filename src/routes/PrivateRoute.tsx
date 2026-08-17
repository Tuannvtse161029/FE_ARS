import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from './paths';
import { landingRouteForRoleName } from '../utils/roleNormalizer';

export const PrivateRoute = () => {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />;
};

// Route authenticated users to their role-appropriate landing page. We
// previously hard-coded ROUTES.FORUM here, which sent Admin users who opened
// a stale /login tab to /forum instead of /admin. The post-login redirect in
// AuthContext uses the same `landingRouteForRoleName` helper so the two paths
// stay in lock-step (see Phase C defect 3A).
export const PublicRoute = () => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Outlet />;
  const role = user?.role ?? null;
  return <Navigate to={landingRouteForRoleName(role)} replace />;
};

export default PrivateRoute;