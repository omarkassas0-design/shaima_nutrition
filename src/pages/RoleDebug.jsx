import React, { useEffect, useState } from 'react';
import { appClient } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';
import { getRole, isDoctor, isClinicAdmin } from '@/lib/permissions';

/**
 * Diagnostic page — traces the role value through every stage in the REAL browser.
 * Visit /role-debug to see exactly where the role resolves and whether
 * effectiveRole matches the authoritative source.
 */
export default function RoleDebug() {
  const { user, effectiveRole, roleVersion } = useAuth();
  const [meResult, setMeResult] = useState(null);
  const [getCurrentUserRoleResult, setGetCurrentUserRoleResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // Stage 1: raw me() — profile and Supabase Auth values (NOT authoritative)
        const me = await appClient.auth.me();
        setMeResult({
          id: me?.id,
          role: me?.role,
          data_role: me?.data?.role,
          clinic_id: me?.clinic_id || me?.data?.clinic_id,
          signup_status: me?.signup_status || me?.data?.signup_status,
        });

        // Stage 2: getCurrentUserRole — the SINGLE role resolution function
        const roleRes = await appClient.functions.invoke('getCurrentUserRole', {});
        setGetCurrentUserRoleResult({
          role: roleRes?.data?.role,
          clinic_id: roleRes?.data?.clinic_id,
          user_id: roleRes?.data?.user_id,
        });
      } catch (e) {
        setError(e?.message || 'Unknown error');
      }
    })();
  }, [roleVersion]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Role Debug Trace</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">Error: {error}</p>
          </div>
        )}

        {/* Stage: AuthContext effectiveRole */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="font-semibold text-slate-800 mb-2">Stage A: AuthContext (effectiveRole)</h2>
          <pre className="text-sm bg-slate-50 p-3 rounded overflow-auto">
{JSON.stringify({
  user_id: user?.id,
  effectiveRole,
  roleVersion,
  user_data_role: user?.data?.role,
  getRole_result: getRole(user),
  isDoctor: isDoctor(user),
  isClinicAdmin: isClinicAdmin(user),
}, null, 2)}
          </pre>
        </div>

        {/* Stage: raw me() */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="font-semibold text-slate-800 mb-2">Stage B: raw appClient.auth.me() (JWT — NOT authoritative)</h2>
          <pre className="text-sm bg-slate-50 p-3 rounded overflow-auto">
{JSON.stringify(meResult, null, 2)}
          </pre>
        </div>

        {/* Stage: getCurrentUserRole */}
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="font-semibold text-slate-800 mb-2">Stage C: getCurrentUserRole (authoritative)</h2>
          <pre className="text-sm bg-slate-50 p-3 rounded overflow-auto">
{JSON.stringify(getCurrentUserRoleResult, null, 2)}
          </pre>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-800 text-sm">
            <strong>How to read this:</strong> Stage A <code>effectiveRole</code> should match Stage C
            <code>role</code>. Stage B (JWT) may differ — it is NOT authoritative and is never used for
            authorization. If A and C disagree, AuthContext is not updating from getCurrentUserRole.
          </p>
        </div>
      </div>
    </div>
  );
}
