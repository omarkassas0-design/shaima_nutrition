import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

/**
 * Re-fetches the authoritative role from ClinicRoleAssignment (via getAuthRole)
 * on every route change. This ensures a role change made by a super admin is
 * reflected in the UI without requiring a full page refresh — covering the
 * "navigate between pages" verification scenario.
 *
 * Renders nothing; it's a side-effect-only listener placed inside the Router.
 */
export default function RoleRefreshOnNavigate() {
  const { isAuthenticated, user, refreshUser } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    refreshUser();
     
  }, [location.pathname]);

  return null;
}