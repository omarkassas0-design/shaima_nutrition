import React, { useState } from 'react';
import { Outlet, Link, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useLanguage } from '@/lib/useLanguage';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { useSuperAdmin } from '@/lib/SuperAdminContext';
import { isPathAccessible } from '@/lib/permissions';
import { AlertTriangle } from 'lucide-react';
import MobileBottomNav from './MobileBottomNav';
import ClinicSetupGuard from '@/components/clinic/ClinicSetupGuard';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isRTL } = useLanguage();
  const { clinic, loading } = useClinic();
  const { user, effectiveRole } = useAuth();
  const { isManaging } = useSuperAdmin();
  const { pathname } = useLocation();

  // Super admin without a managed clinic → redirect to the Super Admin Dashboard.
  // MUST NOT fire when already on /super-admin — otherwise the route renders
  // inside this layout's <Outlet /> and the redirect loops infinitely.
  if (effectiveRole === 'super_admin' && !isManaging && !loading && pathname !== '/super-admin') {
    return <Navigate to="/super-admin" replace />;
  }

  // ROLE-CHANGE REDIRECT: when effectiveRole changes mid-session, immediately
  // redirect away from any page the new role cannot access (e.g. a doctor who
  // was a clinic_admin and is still on /staff). This runs on every render, so
  // the moment the role updates the user is moved to an accessible page.
  if ((!effectiveRole || !isPathAccessible(effectiveRole, pathname)) && pathname !== '/dashboard') {
    return <Navigate to="/dashboard" replace />;
  }

  // key={effectiveRole} forces a FULL remount of the layout (sidebar + topbar +
  // page content) when the role changes. This guarantees the entire UI —
  // sidebar nav, dashboard, permissions, queries — rebuilds for the new role
  // without logout or hard refresh. Auth context is preserved (it lives above
  // this component), so the user stays logged in.
  return (
    <div key={effectiveRole} className="aura-app flex min-h-screen">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        {!loading && !clinic && effectiveRole !== 'super_admin' && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 px-4 py-2 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Your account is not linked to a clinic — </span>
            <Link to="/settings" className="underline font-semibold hover:text-amber-900">Go to Settings to select or create your clinic</Link>
            <span> before saving any data.</span>
          </div>
        )}
        <div className="flex-1 p-4 md:p-6 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <ClinicSetupGuard>
            <Outlet />
          </ClinicSetupGuard>
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}