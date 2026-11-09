import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getDashboardType } from '@/lib/permissions';
import Dashboard from '@/pages/Dashboard';
import DoctorDashboard from '@/pages/DoctorDashboard';
import ReceptionistDashboard from '@/pages/ReceptionistDashboard';
import { AlertTriangle } from 'lucide-react';

/**
 * THE SINGLE DASHBOARD RESOLVER. Uses getDashboardType(effectiveRole) as the
 * one deterministic mapping from role → dashboard. When effectiveRole changes,
 * this component re-renders and swaps the dashboard immediately (no logout,
 * no refresh). AppLayout's key={effectiveRole} forces a full remount so all
 * child state, queries, and permissions rebuild for the new role.
 */
export default function RoleHome() {
  const { effectiveRole } = useAuth();
  const type = getDashboardType(effectiveRole);
  if (type === 'doctor') return <DoctorDashboard />;
  if (type === 'receptionist') return <ReceptionistDashboard />;
  if (type === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <AlertTriangle className="w-12 h-12 text-amber-500" />
        <h2 className="text-xl font-semibold">No Role Assigned</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Your account does not have a role assigned in this clinic. Please contact your clinic administrator.
        </p>
      </div>
    );
  }
  // clinic_admin → full clinic dashboard. super_admin is redirected to
  // /super-admin by AppLayout before reaching here.
  return <Dashboard />;
}