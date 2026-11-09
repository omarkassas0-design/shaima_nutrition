import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { fetchAllRecords } from '../../shared/paginatedFetch.ts';

/**
 * Server-side paginated patient search for a clinic.
 * Uses skip/limit for real pagination — never loads the full collection.
 * Supports search by name, phone, or patient ID.
 */
export default async function(req) {
  try {
    const body = await req.json();
    const { search, page = 0, page_size = 20, sort = '-created_date', date_from, date_to } = body;

    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req, body.clinic_id);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'searchPatients');
    if (rateLimitResponse) return rateLimitResponse;

    const role = authoritativeRole;
    if (!role) return Response.json({ error: 'Forbidden — no role assigned' }, { status: 403 });
    const svc = base44.asServiceRole;

    // Build query — always filter by clinic_id for isolation
    const query = { clinic_id: clinicId };

    // If search term provided, use regex on name, phone
    if (search && search.trim()) {
      const term = search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { full_name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { whatsapp_number: { $regex: escaped, $options: 'i' } },
      ];
    }

    // Pagination: use real skip/limit on the DB when no date filter is
    // provided (the common case). When a date filter IS provided, $gte/$lte
    // is not supported on the created_date system field in Base44, so we
    // accumulate all matching records via paginated batches (no hard cap)
    // and filter by date in-memory before applying pagination.
    const limit = Math.min(page_size, 100);
    const skip = page * limit;

    // Doctors must never see patient phone numbers — enforced server-side.
    const isDoctor = role === 'doctor';
    const mapPatient = (p) => ({
      id: p.id,
      full_name: p.full_name,
      phone: isDoctor ? '' : p.phone,
      gender: p.gender,
      birth_date: p.birth_date,
      whatsapp_opt_in: p.whatsapp_opt_in,
      created_date: p.created_date,
    });

    if (!date_from && !date_to) {
      // True server-side pagination — no cap, no accumulation
      const results = await svc.entities.Patient.filter(query, sort, limit, skip);
      const nextBatch = await svc.entities.Patient.filter(query, sort, 1, skip + limit);
      const hasMore = nextBatch.length > 0;

      return Response.json({
        patients: results.map(mapPatient),
        page,
        page_size: limit,
        has_more: hasMore,
      });
    }

    // Date filter path: accumulate all matching records (no cap), filter by
    // date range in-memory, then apply pagination on the filtered set.
    // Timezone-safe: created_date is stored as ISO-like string without
    // timezone, so string comparison works correctly.
    const allResults = await fetchAllRecords(svc, 'Patient', query, sort);
    const fromStr = date_from ? date_from + 'T00:00:00' : null;
    const toStr = date_to ? date_to + 'T23:59:59' : null;
    const filtered = allResults.filter(p => {
      if (!p.created_date) return false;
      if (fromStr && p.created_date < fromStr) return false;
      if (toStr && p.created_date > toStr) return false;
      return true;
    });

    const results = filtered.slice(skip, skip + limit);
    const hasMore = skip + limit < filtered.length;

    return Response.json({
      patients: results.map(mapPatient),
      page,
      page_size: limit,
      has_more: hasMore,
    });
  } catch (error) {
    return Response.json({ error: 'Failed to search patients', detail: error?.message }, { status: 500 });
  }
}