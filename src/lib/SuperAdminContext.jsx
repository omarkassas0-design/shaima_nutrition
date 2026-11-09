import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from './AuthContext';

const SuperAdminContext = createContext();

/**
 * Manages the super-admin "managed clinic" mode — when a super admin is
 * viewing/operating a specific clinic's data.
 *
 * Uses effectiveRole from AuthContext (the single authoritative role) —
 * never user.role (the JWT role).
 */
export function SuperAdminProvider({ children }) {
  const { effectiveRole } = useAuth();
  const [managedClinicId, setManagedClinicId] = useState(null);

  // Restore managed clinic from sessionStorage on mount (survives navigation/refresh)
  useEffect(() => {
    if (effectiveRole === 'super_admin') {
      const stored = sessionStorage.getItem('managedClinicId');
      if (stored) setManagedClinicId(stored);
    }
  }, [effectiveRole]);

  // Clear managed clinic if user is not super admin or logs out
  useEffect(() => {
    if (effectiveRole !== 'super_admin') {
      setManagedClinicId(null);
      sessionStorage.removeItem('managedClinicId');
    }
  }, [effectiveRole]);

  const manageClinic = (clinicId) => {
    if (effectiveRole !== 'super_admin' || !clinicId) return;
    setManagedClinicId(clinicId);
    sessionStorage.setItem('managedClinicId', clinicId);
  };

  const exitManageMode = () => {
    setManagedClinicId(null);
    sessionStorage.removeItem('managedClinicId');
  };

  return (
    <SuperAdminContext.Provider
      value={{
        managedClinicId,
        manageClinic,
        exitManageMode,
        isManaging: !!managedClinicId,
      }}
    >
      {children}
    </SuperAdminContext.Provider>
  );
}

export function useSuperAdmin() {
  const ctx = useContext(SuperAdminContext);
  if (!ctx) throw new Error('useSuperAdmin must be used within SuperAdminProvider');
  return ctx;
}