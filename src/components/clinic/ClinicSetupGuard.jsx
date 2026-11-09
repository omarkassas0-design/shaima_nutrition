import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useClinic } from '@/lib/useClinic';
import ClinicSetupForm from '@/components/clinic/ClinicSetupForm';

/**
 * Blocks normal clinic usage for Clinic Admins who haven't completed the
 * mandatory one-time clinic setup. Shows a full-screen setup form instead
 * of the normal page content (children).
 *
 * ONLY triggers for effectiveRole === 'clinic_admin' — never for super_admin,
 * doctor, or receptionist. The setup_completed flag lives on the Clinic record
 * (server-side), so it persists across refresh, logout/login, and devices.
 */
export default function ClinicSetupGuard({ children }) {
  const { effectiveRole } = useAuth();
  const { clinic, loading } = useClinic();

  const needsSetup =
    effectiveRole === 'clinic_admin' &&
    !loading &&
    clinic &&
    !clinic.setup_completed;

  if (needsSetup) {
    return <ClinicSetupForm />;
  }

  return children;
}