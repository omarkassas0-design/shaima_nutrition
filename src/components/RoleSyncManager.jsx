import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';

/**
 * Keeps the effective runtime role in sync with the authoritative source
 * (ClinicRoleAssignment via getAuthRole) and propagates role changes to
 * every role-dependent consumer — without logout, hard refresh, or manual
 * storage clearing.
 *
 * Four triggers, all calling AuthContext.refreshUser:
 *   1. 10-second polling — picks up role changes even when the user never
 *      navigates away from the current page.
 *   2. Window focus — refreshes immediately when the user returns to the tab.
 *   3. visibilitychange — catches tab switches that don't fire focus.
 *   4. RoleRefreshOnNavigate (separate component) — refreshes on route change.
 *
 * When the effective role actually changes, AuthContext bumps `roleVersion`.
 * This component watches `roleVersion` and clears the entire React Query
 * cache so every page refetches under the new role's permissions — no stale
 * doctor/admin data survives a role switch.
 */
const ROLE_POLL_INTERVAL_MS = 10000;

export default function RoleSyncManager() {
  const { isAuthenticated, user, refreshUser, roleVersion } = useAuth();
  const queryClient = useQueryClient();
  const mountedRef = useRef(false);

  // Poll + window-focus + visibilitychange refresh — re-fetches the
  // authoritative role so a change made by a super admin reaches this
  // session without navigation. visibilitychange catches tab switches
  // that don't fire focus (side-by-side windows, mobile tab switches).
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const poll = setInterval(() => {
      refreshUser();
    }, ROLE_POLL_INTERVAL_MS);

    const onFocus = () => refreshUser();
    window.addEventListener('focus', onFocus);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshUser();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuthenticated, user?.id, refreshUser]);

  // Clear ALL cached queries when the effective role changes, so every page
  // refetches under the new role's permissions. Skips the very first mount
  // (the initial null→role bump is a normal load, not a mid-session change).
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    queryClient.clear();
  }, [roleVersion, queryClient]);

  return null;
}