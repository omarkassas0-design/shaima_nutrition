import { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

/**
 * useRoleChangeEffect — registers a callback fired IMMEDIATELY whenever the
 * authenticated user's effective role changes (e.g. a super-admin demotes a
 * doctor to receptionist in another session).
 *
 * Dashboard widgets use this to refresh their role-scoped data the instant a
 * role update lands, without waiting for the next poll cycle or a manual
 * reload. The callback receives { oldRole, newRole, roleVersion }.
 *
 * The callback is only invoked on an ACTUAL role change — not on every poll
 * that returns the same role — so it is safe to call expensive refetches inside.
 *
 * Usage:
 *   useRoleChangeEffect(({ newRole }) => {
 *     refetchDashboardStats();
 *     refetchAppointments();
 *   });
 *
 * @param {(payload: { oldRole: string|null, newRole: string|null, roleVersion: number }) => void} callback
 */
export function useRoleChangeEffect(callback) {
  const { subscribeToRoleChange } = useAuth();

  useEffect(() => {
    // Subscribe on mount; unsubscribe on unmount. The callback identity is
    // captured once — pass a stable callback (or accept re-subscription on
    // every render, which is cheap because the subscriber set is tiny).
    return subscribeToRoleChange(callback);
  }, [subscribeToRoleChange]);
}

export default useRoleChangeEffect;
