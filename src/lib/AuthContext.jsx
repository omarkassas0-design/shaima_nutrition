import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { appClient } from '@/api/appClient';
import { requireSupabase } from '@/api/supabaseClient';

/**
 * AuthContext — the SINGLE frontend authority for the user's effective role.
 *
 * ARCHITECTURE:
 *   1. getCurrentUserRole (backend) is the ONE role-resolution function.
 *      It reads ClinicRoleAssignment (clinic roles) or UserSecurityProfile
 *      (platform super_admin). No fallback to User.role / JWT / cache.
 *   2. AuthContext stores the resolved role in ONE state value: effectiveRole.
 *      user.data.role is a mirror of effectiveRole (for backward compat with
 *      permissions.js getRole(user)), NOT an independent source.
 *   3. roleVersion bumps ONLY when effectiveRole actually changes. RoleSyncManager
 *      watches roleVersion and clears the React Query cache so no stale
 *      role-scoped data survives a role switch.
 *   4. refreshUser (called by polling, window-focus, and navigation) re-fetches
 *      the authoritative role so a super-admin role change propagates without
 *      logout or hard refresh.
 *
 * There is NO updateUserAuthRole, NO second role source, NO fallback chain.
 */
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [effectiveRole, setEffectiveRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [roleVersion, setRoleVersion] = useState(0);

  // Tracks the last effective role so roleVersion only bumps on an ACTUAL
  // role change — not on every refreshUser that returns the same role.
  const currentRoleRef = useRef(null);
  // Mirror of roleVersion in a ref so applyAuthState (a useCallback with no
  // deps) can read the current value without re-creating on every bump.
  const roleVersionRef = useRef(0);
  // Subscribers notified immediately when the effective role changes — lets
  // open dashboard widgets refresh their role-scoped data without waiting.
  const roleChangeSubscribers = useRef(new Set());

  // Retry counter for transient backend failures during deployment — prevents
  // infinite loops while giving the backend time to recover after a Republish.
  const authRetryCountRef = useRef(0);
  const MAX_AUTH_RETRIES = 15;

  // Register a callback fired on every actual role change. Returns an
  // unsubscribe function. Callback receives { oldRole, newRole, roleVersion }.
  const subscribeToRoleChange = useCallback((cb) => {
    roleChangeSubscribers.current.add(cb);
    return () => roleChangeSubscribers.current.delete(cb);
  }, []);

  // Single entry point for applying auth state. Sets effectiveRole (the
  // primary state) and mirrors it onto user.data.role for permissions.js.
  // Bumps roleVersion synchronously when the role actually changes.
  const applyAuthState = useCallback((meUser, newRole) => {
    const userWithRole = meUser
      ? { ...meUser, role: newRole, data: { ...(meUser.data || {}), role: newRole } }
      : null;
    setUser(userWithRole);
    setEffectiveRole(newRole);
    if (currentRoleRef.current !== newRole) {
      const oldRole = currentRoleRef.current;
      currentRoleRef.current = newRole;
      const newVersion = roleVersionRef.current + 1;
      roleVersionRef.current = newVersion;
      setRoleVersion(newVersion);
      // Notify all dashboard-widget subscribers immediately so they can
      // refresh their role-scoped data without waiting for the next render.
      roleChangeSubscribers.current.forEach((cb) => {
        try { cb({ oldRole, newRole, roleVersion: newVersion }); }
        catch (e) { /* subscriber error is non-fatal */ }
      });
    }
  }, []);

  // Fetch the authoritative role from getCurrentUserRole — the SINGLE role
  // resolution function. Returns { role, failed } so the caller can
  // distinguish a genuine "no role" (role=null, failed=false) from a
  // transient backend failure (role=null, failed=true). This is critical
  // during Republish: a failed call must NOT be treated as "No Role Assigned".
  const fetchEffectiveRole = useCallback(async () => {
    try {
      // A unique payload forces a fresh Worker round-trip so the latest
      // ClinicRoleAssignment is read.
      const res = await appClient.functions.invoke('getCurrentUserRole', { _ts: Date.now() });
      const data = res?.data || res;
      return { role: data?.role ?? null, account_status: data?.account_status ?? 'active', failed: false };
    } catch (e) {
      console.warn('[AuthContext] getCurrentUserRole failed:', e?.message);
      return { role: null, account_status: 'active', failed: true };
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    let retrying = false;

    // Timeout guard — if auth takes longer than 20 seconds (e.g. backend
    // is completely unresponsive), stop loading and show a controlled
    // error instead of an infinite spinner. The user can retry.
    const timeoutId = setTimeout(() => {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }, 20000);

    try {
      const meUser = await appClient.auth.me();
      if (meUser && meUser.id) {
        const { data: assurance, error: assuranceError } = await requireSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
        if (assuranceError) throw assuranceError;
        if (assurance.currentLevel === 'aal1' && assurance.nextLevel === 'aal2') {
          applyAuthState(null, null);
          setIsAuthenticated(false);
          setAuthError({ type: 'mfa_required' });
          return;
        }
        const { role, account_status, failed } = await fetchEffectiveRole();

        // If getCurrentUserRole failed (backend temporarily unavailable, e.g.
        // during a Republish), retry after a short delay. Keep isLoadingAuth=true
        // so the app shows a loading spinner instead of incorrectly showing
        // "No Role Assigned" while the CRA data still exists in the database.
        if (failed) {
          if (authRetryCountRef.current < MAX_AUTH_RETRIES) {
            authRetryCountRef.current++;
            retrying = true;
            setTimeout(() => checkUserAuth(), 2000);
            return;
          }
          // Max retries exceeded — fall through with null role (edge case
          // that should not happen under normal deployment conditions).
        }

        authRetryCountRef.current = 0;

        // Account status enforcement — server-side authoritative check.
        // If the Super Admin set the user's status to 'pending' (suspended) or
        // 'not_subscribed' (trial ended), block access immediately and show the
        // persistent status screen. This persists across login attempts until
        // the Super Admin changes the status back to 'active'.
        if (account_status === 'pending') {
          applyAuthState(meUser, role);
          setIsAuthenticated(false);
          setAuthError({ type: 'account_suspended' });
          return;
        }
        if (account_status === 'not_subscribed') {
          applyAuthState(meUser, role);
          setIsAuthenticated(false);
          setAuthError({ type: 'trial_ended' });
          return;
        }

        // ACCESS DECISION — SERVER-VERIFIED DATA ONLY.
        // `role` (and account_status above) come from getCurrentUserRole, which
        // resolves the authoritative ClinicRoleAssignment on the server. A user
        // without a role assignment is NOT an approved clinic user, whatever
        // their own profile says. The profile fields below are client-editable
        // and are used ONLY to choose which blocked screen to show — never to
        // grant access or to skip the waiting screen.
        const APPROVED_ROLES = ['super_admin', 'admin', 'clinic_admin', 'doctor', 'receptionist'];
        const hasServerRole = !!role && APPROVED_ROLES.includes(role);
        const profileStatusHint = meUser.signup_status || meUser.data?.signup_status;

        if (!hasServerRole) {
          // No clinic role on the server — awaiting approval or rejected.
          // Every clinic API refuses this account server-side.
          if (!profileStatusHint) {
            // Keeps a Google sign-in that never filled the registration form
            // visible in the Super Admin approval queue. Display only.
            try { await appClient.auth.updateMe({ signup_status: 'pending' }); } catch (_) {}
          }
          applyAuthState(null, null);
          setIsAuthenticated(false);
          setAuthError({ type: profileStatusHint === 'rejected' ? 'auth_required' : 'pending_approval' });
        } else {
          applyAuthState(meUser, role);
          setIsAuthenticated(true);
        }
      } else {
        applyAuthState(null, null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      applyAuthState(null, null);
      setIsAuthenticated(false);
      if (error?.data?.extra_data?.reason === 'user_not_registered') {
        setAuthError({ type: 'user_not_registered' });
      }
    } finally {
      clearTimeout(timeoutId);
      if (!retrying) {
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    }
  }, [applyAuthState, fetchEffectiveRole]);

  // Silent refresh — re-fetches the authoritative role WITHOUT toggling
  // isLoadingAuth, so ProtectedRoute doesn't unmount the app. Called by
  // RoleSyncManager (polling + window focus) and RoleRefreshOnNavigate.
  const refreshUser = useCallback(async () => {
    try {
      const meUser = await appClient.auth.me();
      if (meUser && meUser.id) {
        const { data: assurance, error: assuranceError } = await requireSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
        if (assuranceError) throw assuranceError;
        if (assurance.currentLevel === 'aal1' && assurance.nextLevel === 'aal2') {
          applyAuthState(null, null);
          setIsAuthenticated(false);
          setAuthError({ type: 'mfa_required' });
          return;
        }
        const { role, account_status, failed } = await fetchEffectiveRole();
        // Account status changed mid-session (Super Admin suspended the user
        // or trial ended) — re-run checkUserAuth to show the persistent status
        // screen and block access immediately.
        if (!failed && (account_status === 'pending' || account_status === 'not_subscribed')) {
          checkUserAuth();
          return;
        }
        // Only apply the new role if the backend succeeded AND the role is
        // non-null. A failed return means getCurrentUserRole was transiently
        // unavailable (e.g. during a Republish) — we must NOT wipe the user's
        // current role, or all role-filtered UI disappears until the next
        // successful poll.
        if (!failed && role !== null) {
          applyAuthState(meUser, role);
        }
        setIsAuthenticated(true);
      }
    } catch (error) {
      // silent — don't disrupt the UI on refresh failure
    }
  }, [applyAuthState, fetchEffectiveRole, checkUserAuth]);

  // PRIMARY auth trigger — runs once on mount. Without this, AuthenticatedApp
  // blocks on isLoadingAuth (initial true) and ProtectedRoute (the only other
  // caller of checkUserAuth) never mounts, creating a deadlock where the
  // loading spinner never clears.
  useEffect(() => {
    checkUserAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    applyAuthState(null, null);
    setIsAuthenticated(false);
    setAuthChecked(false);
    // CRITICAL: Clear ALL Supabase/auth sessions from browser storage BEFORE
    // calling the SDK logout. Without this, the Supabase session token
    // persists in localStorage and appClient.auth.me() restores it on the next
    // page load — auto-logging the user back in after explicit logout.
    try {
      const authKeyPatterns = [/^sb-/, /supabase/i, /auth[-._]?token/i];
      const clearStorage = (storage) => {
        for (let i = storage.length - 1; i >= 0; i--) {
          const key = storage.key(i);
          if (key && authKeyPatterns.some((p) => p.test(key))) {
            storage.removeItem(key);
          }
        }
      };
      clearStorage(localStorage);
      clearStorage(sessionStorage);
    } catch (e) {
      console.warn('[AuthContext] Failed to clear auth storage:', e);
    }
    // Clear any PWA service-worker caches so a previously stored response
    // can never be served to the next user on this shared browser.
    try {
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((k) => k.indexOf('auradental') === 0).map((k) => caches.delete(k))
        );
      }
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage('CLEAR_CACHE');
      }
    } catch (e) {
      // Best-effort only — never block logout on cache cleanup
    }
    // Best-effort server-side session invalidation — don't block on it
    // since the local session is already cleared.
    try {
      await appClient.auth.logout();
    } catch (e) {
      // Ignore — local session is already cleared
    }
    // Hard redirect to login to guarantee a completely fresh state
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      effectiveRole,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      authChecked,
      roleVersion,
      subscribeToRoleChange,
      checkUserAuth,
      refreshUser,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
