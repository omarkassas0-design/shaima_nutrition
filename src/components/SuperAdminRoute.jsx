import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

/**
 * Route guard — only allows super_admin users.
 * Non-super-admin users are redirected to the main dashboard.
 *
 * Uses effectiveRole from AuthContext — the single authoritative role resolved
 * by getCurrentUserRole. Never reads user.role (the JWT role).
 */
export default function SuperAdminRoute({ children }) {
  const { isAuthenticated, isLoadingAuth, authChecked, effectiveRole } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (effectiveRole !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}