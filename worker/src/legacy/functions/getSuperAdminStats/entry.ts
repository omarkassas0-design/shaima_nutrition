/**
 * Super Admin — Returns all clinics with per-clinic statistics.
 * Aggregates doctor, staff, patient, and appointment counts server-side.
 *
 * Super_admin only. Clinic_admin / doctor / receptionist / assistant → 403.
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { requireSuperAdmin } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { fetchAllRecords } from '../../shared/paginatedFetch.ts';

export default async function(req) {
  try {
    const { error, user, base44 } = await requireSuperAdmin(req);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'getSuperAdminStats');
    if (rateLimitResponse) return rateLimitResponse;

    const svc = base44.asServiceRole;

    // Fetch all clinics (1 API call)
    const clinics = await svc.entities.Clinic.list('name', 500);

    // Fetch ALL records per entity ONCE globally, then group by clinic_id in memory.
    // This reduces API calls from 4×N (N = clinic count, ~40+ calls) to ~5 total,
    // preventing platform rate-limit (Base44Error: Rate limit exceeded) failures
    // that caused the persistent "failed_to_load_dashboard" error.
    const [allDoctors, allStaff, allPatients, allAppointments, allUsers] = await Promise.all([
      fetchAllRecords(svc, 'Doctor', {}, 'name'),
      fetchAllRecords(svc, 'Staff', {}, 'full_name'),
      fetchAllRecords(svc, 'Patient', {}, '-created_date'),
      fetchAllRecords(svc, 'Appointment', {}, '-date'),
      fetchAllRecords(svc, 'User', {}, '-created_date'),
    ]);

    // Group counts by clinic_id in memory — no per-clinic API calls needed
    const countByClinic = (records) => {
      const counts = {};
      for (const r of records) {
        if (r.clinic_id) counts[r.clinic_id] = (counts[r.clinic_id] || 0) + 1;
      }
      return counts;
    };

    const doctorCounts = countByClinic(allDoctors);
    const staffCounts = countByClinic(allStaff);
    const patientCounts = countByClinic(allPatients);
    const appointmentCounts = countByClinic(allAppointments);

    const clinicsWithStats = clinics.map(c => ({
      id: c.id,
      name: c.name,
      name_ar: c.name_ar,
      phone: c.phone,
      address: c.address,
      currency: c.currency,
      language: c.language,
      logo_url: c.logo_url,
      created_date: c.created_date,
      is_deleted: c.is_deleted || false,
      deletion_status: c.deletion_status || 'active',
      deleted_at: c.deleted_at,
      deleted_by_name: c.deleted_by_name,
      stats: {
        doctors: doctorCounts[c.id] || 0,
        staff: staffCounts[c.id] || 0,
        patients: patientCounts[c.id] || 0,
        appointments: appointmentCounts[c.id] || 0,
      },
    }));

    // Filter pending users in memory (already fetched above — no extra API call)
    const pendingUsers = (allUsers || []).filter(u => u.signup_status === 'pending');
    const pendingRequests = pendingUsers.map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name || '',
      phone: u.phone || '',
      clinic_name: u.clinic_name || '',
      created_date: u.created_date,
    }));

    return Response.json({
      clinics: clinicsWithStats,
      total: clinicsWithStats.length,
      pendingRequests,
    });
  } catch (error) {
    console.error('[getSuperAdminStats] Error:', error?.message || error, error?.stack || '');
    return Response.json({ error: 'Failed to load super admin stats: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}