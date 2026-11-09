import { appClient } from '@/api/appClient';

/**
 * Reliably gets clinic_id for use in mutations.
 * Falls back from context → user profile → DB query.
 */
export async function getClinicId(clinic) {
  if (clinic?.id) return clinic.id;

  try {
    const me = await appClient.auth.me();
    const cid = me?.clinic_id || me?.data?.clinic_id;
    if (cid) return cid;
  } catch (_) {}

  throw new Error('No clinic found. Please go to Settings and create your clinic first.');
}