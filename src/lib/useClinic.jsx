import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { appClient } from '@/api/appClient';
import { useAuth } from './AuthContext';
import { useSuperAdmin } from './SuperAdminContext';

const ClinicContext = createContext();

export function ClinicProvider({ children }) {
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, effectiveRole } = useAuth();
  const { managedClinicId } = useSuperAdmin();
  const retryTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const MAX_CLINIC_RETRIES = 15;

  useEffect(() => {
    loadClinic();
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [managedClinicId, user?.clinic_id, user?.id]);

  async function loadClinic() {
    setLoading(true);
    try {
      // Use the backend function (asServiceRole) to bypass RLS —
      // guarantees the clinic is found if the user has a clinic_id.
      const overrideClinicId = (effectiveRole === 'super_admin' && managedClinicId) ? managedClinicId : null;
      const response = await appClient.functions.invoke('loadUserClinic', { clinic_id: overrideClinicId });
      const result = response.data || response;
      if (result?.error) throw new Error(result.error);
      setClinic(result?.clinic || null);
      retryCountRef.current = 0;
      setLoading(false);
      // Role is NOT read here — it comes exclusively from getCurrentUserRole
      // via AuthContext. loadUserClinic returns only the clinic object.
    } catch (e) {
      console.error('Failed to load clinic:', e?.message || 'Unknown error');
      // Don't overwrite an existing clinic on transient failure, and DON'T set
      // loading=false — the "not linked to a clinic" warning must NOT show while
      // the backend is temporarily unavailable (e.g. during a Republish). Retry
      // after a short delay; once the backend recovers, the clinic loads normally.
      if (retryCountRef.current < MAX_CLINIC_RETRIES) {
        retryCountRef.current++;
        retryTimeoutRef.current = setTimeout(() => loadClinic(), 2000);
      } else {
        // Max retries exceeded — give up so the UI doesn't hang forever.
        setLoading(false);
      }
    }
  }

  // Allow direct setting of clinic (used after saveClinicSettings returns the clinic)
  function setClinicDirectly(clinicData) {
    setClinic(clinicData);
    setLoading(false);
  }

  async function updateClinic(data) {
    if (!clinic) throw new Error('No clinic to update.');
    // Local state update only — persistence is handled by the saveClinicSettings
    // backend function. Never write directly to the Clinic entity from the client.
    const updated = { ...clinic, ...data };
    setClinic(updated);
    return updated;
  }

  return (
    <ClinicContext.Provider value={{ clinic, loading, updateClinic, refreshClinic: loadClinic, setClinicDirectly }}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error('useClinic must be used within ClinicProvider');
  return ctx;
}