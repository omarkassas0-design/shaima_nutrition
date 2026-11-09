/**
 * Aggregates Doctor commission totals from Payment records — currency-aware.
 *
 * Returns, per doctor:
 *   { doctor_id, doctor_name, commission_percentage, payments_count,
 *     total_revenue: { USD, SYP, TRY, EUR }, total_commission: { ... },
 *     paid_amount: { ... }, remaining: { ... },
 *     payments: [ { payment_id, patient_id, patient_name, treatment_name,
 *                  amount, currency, commission_percentage, commission_amount,
 *                  payment_date, method } ] }
 *
 * Security:
 *   - clinic_admin / super_admin / admin: see ALL doctors in their clinic.
 *   - doctor: see ONLY their own commission data (matched via Doctor.user_id).
 *
 * All amounts are grouped by currency. Different currencies are NEVER mixed.
 * Commission is summed from each payment's stored doctor_commission_amount
 * (captured at payment time), preserving historical accuracy.
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { sumByCurrency, round2 } from '../../shared/currencyUtils.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

export default async function(req) {
  try {
    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'getDoctorCommissionSummary');
    if (rateLimitResponse) return rateLimitResponse;

    const userRole = authoritativeRole || user.role || user.data?.role;

    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const dateFrom = body?.date_from || null;
    const dateTo = body?.date_to || null;

    const [doctors, payments, payouts, patients] = await Promise.all([
      svc.entities.Doctor.filter({ clinic_id: clinicId }, 'name', 1000),
      svc.entities.Payment.filter({ clinic_id: clinicId }, '-payment_date', 10000),
      svc.entities.DoctorPayout.filter({ clinic_id: clinicId }, '-payment_date', 10000),
      svc.entities.Patient.filter({ clinic_id: clinicId }, 'full_name', 10000),
    ]);

    // Doctor role: restrict to their own doctor profile (matched via user_id).
    let visibleDoctors = doctors;
    if (userRole === 'doctor') {
      visibleDoctors = doctors.filter(d => d.user_id === user.id);
      if (visibleDoctors.length === 0) {
        return Response.json({ success: true, summary: [] });
      }
    } else if (!['super_admin', 'admin', 'clinic_admin'].includes(userRole)) {
      return Response.json({ error: 'Forbidden — only clinic administrators can view commission data' }, { status: 403 });
    }

    const patientMap = {};
    for (const p of patients) patientMap[p.id] = p;

    const inRange = (d) => (!dateFrom || !d || d >= dateFrom) && (!dateTo || !d || d <= dateTo);
    const rangedPayments = payments.filter(p => inRange(p.payment_date));

    const summary = visibleDoctors.map(doc => {
      const docPayments = rangedPayments.filter(p => p.doctor_id === doc.id);
      const totalRevenue = sumByCurrency(docPayments, 'amount', 'currency');
      const totalCommission = sumByCurrency(docPayments, 'doctor_commission_amount', 'currency');
      const docPayouts = payouts.filter(p => p.doctor_id === doc.id);
      const paidAmount = sumByCurrency(docPayouts, 'amount', 'currency');
      // Remaining commission = MAX(0, total earned commission − recorded payouts).
      // A recorded payout can never drive the outstanding commission negative,
      // so the value is clamped per currency; only the unpaid remainder is
      // exposed. Any overpayment is reported separately (never as a negative
      // "remaining") so the totals stay mathematically consistent.
      const remaining = {};
      const overpaid = {};
      const allCurrencies = new Set([...Object.keys(totalCommission), ...Object.keys(paidAmount)]);
      for (const cur of allCurrencies) {
        const raw = round2((totalCommission[cur] || 0) - (paidAmount[cur] || 0));
        remaining[cur] = raw > 0 ? raw : 0;
        if (raw < 0) overpaid[cur] = round2(Math.abs(raw));
      }

      // Per-payment commission details — patient, treatment, amount, %, commission, currency, date
      const paymentDetails = docPayments.map(p => {
        const pt = patientMap[p.patient_id];
        let treatmentName = '';
        if (p.patient_treatment_id) {
          // Best-effort treatment name lookup from cached payments_snapshot is not available here;
          // the payment doesn't store treatment_name directly, so we leave it empty if not resolvable.
          treatmentName = '';
        }
        return {
          payment_id: p.id,
          patient_id: p.patient_id,
          patient_name: pt?.full_name || '',
          treatment_name: treatmentName,
          amount: p.amount,
          currency: p.currency || 'USD',
          commission_percentage: p.doctor_commission_percentage || 0,
          commission_amount: p.doctor_commission_amount || 0,
          payment_date: p.payment_date,
          method: p.method || 'cash',
        };
      });

      return {
        doctor_id: doc.id,
        doctor_name: doc.name,
        commission_percentage: Number(doc.commission_percentage) || 0,
        commission_percentage_doctor: Number(doc.commission_percentage_doctor) || 0,
        commission_percentage_clinic: Number(doc.commission_percentage_clinic) || 0,
        payments_count: docPayments.length,
        total_revenue: totalRevenue,
        total_commission: totalCommission,
        paid_amount: paidAmount,
        remaining,
        overpaid,
        payments: paymentDetails,
      };
    });

    return Response.json({ success: true, summary });
  } catch (error) {
    return Response.json({ error: 'Failed to load commission summary: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}