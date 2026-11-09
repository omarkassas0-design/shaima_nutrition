import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { sumByCurrency } from '../../shared/currencyUtils.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { fetchAllRecords } from '../../shared/paginatedFetch.ts';

/**
 * Returns aggregated dashboard statistics for the calling user's clinic.
 * Computes server-side so the frontend doesn't download entire collections.
 */
export default async function(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req, body.clinic_id);
    if (error) return error;

    // Rate limit: prevent dashboard query spam
    const rateLimitResponse = enforceRateLimit(user.id, 'getDashboardStats');
    if (rateLimitResponse) return rateLimitResponse;

    if (!authoritativeRole) return Response.json({ error: 'Forbidden — no role assigned' }, { status: 403 });
    const isFinancialAdmin = ['super_admin', 'admin', 'clinic_admin'].includes(authoritativeRole);

    const today = new Date().toISOString().split('T')[0];
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    // Fetch ALL records via paginated accumulation — no hard caps that could
    // silently truncate and produce inaccurate metrics. Bounded queries
    // (e.g. today's appointments) fetch one batch and stop naturally.
    const svc = base44.asServiceRole;

    const [patients, todayAppts, upcomingAppts, recentPayments, doctors, labCases, staff] = await Promise.all([
      fetchAllRecords(svc, 'Patient', { clinic_id: clinicId }, '-created_date'),
      fetchAllRecords(svc, 'Appointment', { clinic_id: clinicId, date: today }, 'start_time'),
      fetchAllRecords(svc, 'Appointment', { clinic_id: clinicId, date: { $gte: today } }, 'date'),
      isFinancialAdmin
        ? fetchAllRecords(svc, 'Payment', { clinic_id: clinicId, payment_date: { $gte: sixMonthsAgoStr } }, '-payment_date')
        : Promise.resolve([]),
      fetchAllRecords(svc, 'Doctor', { clinic_id: clinicId }, 'name'),
      fetchAllRecords(svc, 'LabCase', { clinic_id: clinicId }, '-created_date'),
      isFinancialAdmin
        ? fetchAllRecords(svc, 'Staff', { clinic_id: clinicId }, 'full_name')
        : Promise.resolve([]),
    ]);

    // Revenue: sum of all payments in the last 6 months, grouped by currency
    const revenueByCurrency = sumByCurrency(recentPayments, 'amount', 'currency');

    // Monthly income: current calendar month's payments grouped by currency
    const _now = new Date();
    const currentMonthStart = new Date(_now.getFullYear(), _now.getMonth(), 1).toISOString().split('T')[0];
    const currentMonthEnd = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).toISOString().split('T')[0];
    const monthlyIncomeByCurrency = isFinancialAdmin
      ? sumByCurrency(recentPayments.filter(p => p.payment_date >= currentMonthStart && p.payment_date <= currentMonthEnd), 'amount', 'currency')
      : {};
    const upcomingCount = upcomingAppts.filter(a => a.status !== 'cancelled').length;
    const activeLabCases = labCases.filter(c => c.status === 'sent' || c.status === 'in_progress').length;
    const newPatientsThisMonth = patients.filter(p => {
      const d = new Date(p.created_date);
      const m = new Date();
      return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
    }).length;

    // Revenue chart: last 6 months, per currency
    const now = new Date();
    const revenueData = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(m.getFullYear(), m.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(m.getFullYear(), m.getMonth() + 1, 0).toISOString().split('T')[0];
      const monthPayments = recentPayments.filter(p => p.payment_date >= start && p.payment_date <= end);
      const byCur = sumByCurrency(monthPayments, 'amount', 'currency');
      revenueData.push({ month: m.toLocaleString('en', { month: 'short' }), ...byCur });
    }

    // Patient growth: last 6 months (cumulative from fetched sample)
    const patientGrowth = [];
    let cumulative = 0;
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      const count = patients.filter(p => new Date(p.created_date) <= end).length;
      cumulative = count;
      patientGrowth.push({ month: m.toLocaleString('en', { month: 'short' }), patients: count });
    }

    // Appointment status distribution (from upcoming appointments)
    const statusCounts = {};
    upcomingAppts.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });

    // Recent patients and payments (already sorted, limited)
    const _role = authoritativeRole;
    const _isDoctor = _role === 'doctor';
    const recentPatientsList = patients.slice(0, 5).map(p => ({
      id: p.id, full_name: p.full_name, phone: _isDoctor ? '' : p.phone, created_date: p.created_date
    }));
    const recentPaymentsList = recentPayments.slice(0, 5).map(p => ({
      id: p.id, amount: p.amount, currency: p.currency || 'USD', method: p.method, payment_date: p.payment_date, created_date: p.created_date
    }));

    return Response.json({
      canViewFinancials: isFinancialAdmin,
      metrics: {
        totalPatients: patients.length,
        newPatientsThisMonth,
        todaysAppointments: todayAppts.length,
        todaysCompleted: todayAppts.filter(a => a.status === 'completed').length,
        upcomingAppointments: upcomingCount,
        revenueByCurrency: isFinancialAdmin ? revenueByCurrency : {},
        monthlyIncomeByCurrency: isFinancialAdmin ? monthlyIncomeByCurrency : {},
        paymentCount: isFinancialAdmin ? recentPayments.length : 0,
        activeDoctors: doctors.length,
        totalStaff: isFinancialAdmin ? staff.length : 0,
        activeLabCases,
      },
      revenueData: isFinancialAdmin ? revenueData : [],
      patientGrowth,
      statusDistribution: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
      recentPatients: recentPatientsList,
      recentPayments: isFinancialAdmin ? recentPaymentsList : [],
      todayAppointments: todayAppts.map(a => ({
        id: a.id, patient_name: a.patient_name, doctor_name: a.doctor_name,
        start_time: a.start_time, status: a.status, doctor_color: a.doctor_color
      })).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
    });
  } catch (error) {
    console.error('[getDashboardStats] Error:', error?.message || error, error?.stack || '');
    return Response.json({ error: 'Failed to load dashboard data: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}