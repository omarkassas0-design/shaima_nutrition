import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { roleIsClinicAdmin, roleIsReadOnly, canRole } from '@/lib/permissions';

/**
 * Blocks a route for roles that shouldn't reach it, even by typing the URL.
 * This is a UX guard only — the real enforcement is entity RLS + backend checks.
 *
 * Derives access from effectiveRole (the single source of truth), NOT from
 * user.data.role / user.role / JWT.
 *
 * mode="admin"     → clinic administrators only (financial, staff, clinic settings)
 * capability="..." → requires a specific capability (e.g. "payments:write")
 */
export default function RoleRoute({ children, mode, capability }) {
  const { effectiveRole } = useAuth();

  const allowed =
    mode === 'admin' ? roleIsClinicAdmin(effectiveRole)
    : capability ? canRole(effectiveRole, capability)
    : !roleIsReadOnly(effectiveRole);

  if (!allowed) return <Navigate to="/dashboard" replace />;
  return children;
}