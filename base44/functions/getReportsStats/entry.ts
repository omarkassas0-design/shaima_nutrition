import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { sumByCurrency, addCurrencyTotals, round2 } from '../../shared/currencyUtils.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { fetchAllRecords } from '../../shared/paginatedFetch.ts';

/**
 * Returns comprehensive, currency-separated report statistics for a clinic.
 *
 * Body:
 *   clinic_id?: string (super_admin only)
 *   date_from?: "YYYY-MM-DD"  (default: 12 months ago)
 *   date_to?:   "YYYY-MM-DD"  (default: today)
 *
 * Currency rules: every monetary total is a per-currency map { USD, SYP, TRY }.
 * Currencies are NEVER mixed or converted.
 */
export default async function(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req, body.clinic_id);
    if (error) return error;

    // Rate limit: prevent expensive report query spam
    const rateLimitResponse = enforceRateLimit(user.id, 'getReportsStats');
    if (rateLimitResponse) return rateLimitResponse;

    const role = authoritativeRole;
    // Reports are admin-only — doctors and receptionists cannot access clinic
    // financial/operational reports. Enforced server-side.
    if (!['super_admin', 'admin', 'clinic_admin'].includes(role)) {
      return Response.json({ error: 'Forbidden — only clinic administrators can view reports' }, { status: 403 });
    }
    const isFinancialAdmin = true;
    const svc = base44.asServiceRole;

    // Date range
    const now = new Date();
    const dateTo = body.date_to || now.toISOString().split('T')[0];
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0];
    const dateFrom = body.date_from || defaultFrom;

    const fetchAll = async (entityName, sortField, dateField) => {
      const filter = { clinic_id: clinicId };
      if (dateField) filter[dateField] = { $gte: dateFrom };
      return fetchAllRecords(svc, entityName, filter, sortField);
    };

    const [payments, expenses, purchases, labCases, appointments, patients, doctors, patientTreatments, doctorPayouts] = await Promise.all([
      isFinancialAdmin ? fetchAll('Payment', '-payment_date', 'payment_date') : Promise.resolve([]),
      isFinancialAdmin ? fetchAll('Expense', '-expense_date', 'expense_date') : Promise.resolve([]),
      isFinancialAdmin ? fetchAll('Purchase', '-purchase_date', 'purchase_date') : Promise.resolve([]),
      isFinancialAdmin ? fetchAll('LabCase', '-sent_date', 'sent_date') : Promise.resolve([]),
      fetchAll('Appointment', '-date', 'date'),
      fetchAll('Patient', '-created_date', null),
      fetchAllRecords(svc, 'Doctor', { clinic_id: clinicId }, 'name'),
      fetchAll('PatientTreatment', '-created_date', null),
      isFinancialAdmin ? fetchAll('DoctorPayout', '-payment_date', 'payment_date') : Promise.resolve([]),
    ]);

    // Filter to date range (inclusive) on the relevant date field
    const inRange = (rec, field) => {
      const d = rec[field];
      if (!d) return true;
      return d >= dateFrom && d <= dateTo;
    };
    const paymentsR = payments.filter(p => inRange(p, 'payment_date'));
    const expensesR = expenses.filter(e => inRange(e, 'expense_date'));
    const purchasesR = purchases.filter(p => inRange(p, 'purchase_date'));
    const labCasesR = labCases.filter(l => inRange(l, 'sent_date'));
    const apptsR = appointments.filter(a => inRange(a, 'date'));
    const payoutsR = doctorPayouts.filter(p => inRange(p, 'payment_date'));

    // ---- Financial totals (per currency) ----
    const totalRevenue = sumByCurrency(paymentsR, 'amount', 'currency');
    const totalExpenses = sumByCurrency(expensesR, 'amount', 'currency');
    const totalPurchases = sumByCurrency(purchasesR, 'amount', 'currency');
    const totalLabCosts = sumByCurrency(labCasesR, 'cost', 'currency');
    const totalCommissions = sumByCurrency(paymentsR, 'doctor_commission_amount', 'currency');
    const totalPayouts = sumByCurrency(payoutsR, 'amount', 'currency');

    // Outstanding balances: per patient, price - paid_amount, same currency only.
    // PatientTreatment.paid_amount is only reduced by payments in the SAME currency.
    // Outstanding balance = aggregate(completed due) - aggregate(completed paid) per patient, per currency.
    // Overpayments on one treatment offset other treatments' unpaid balances in the same currency.
    // Only completed treatments are payable — planned/in_progress/cancelled are excluded.
    const outstandingDueByPatient = {};
    const outstandingPaidByPatient = {};
    patientTreatments.forEach(pt => {
      if (pt.status !== 'completed') return;
      const cur = pt.currency || 'USD';
      const _price = Number(pt.price) || 0;
      const _disc = pt.discount_type === 'percentage'
        ? _price * (Number(pt.discount_value) || 0) / 100
        : pt.discount_type === 'fixed'
          ? (Number(pt.discount_value) || 0)
          : 0;
      const pid = pt.patient_id;
      if (!outstandingDueByPatient[pid]) outstandingDueByPatient[pid] = {};
      if (!outstandingPaidByPatient[pid]) outstandingPaidByPatient[pid] = {};
      outstandingDueByPatient[pid][cur] = round2((outstandingDueByPatient[pid][cur] || 0) + (_price - _disc));
      outstandingPaidByPatient[pid][cur] = round2((outstandingPaidByPatient[pid][cur] || 0) + (Number(pt.paid_amount) || 0));
    });
    const outstandingByPatient = {};
    for (const pid of Object.keys(outstandingDueByPatient)) {
      const totals = {};
      for (const cur of Object.keys(outstandingDueByPatient[pid])) {
        const rem = round2((outstandingDueByPatient[pid][cur] || 0) - (outstandingPaidByPatient[pid][cur] || 0));
        if (rem > 0) totals[cur] = rem;
      }
      if (Object.keys(totals).length > 0) {
        outstandingByPatient[pid] = { patient_id: pid, totals };
      }
    }
    // Attach patient names
    const patientNameMap = {};
    patients.forEach(p => { patientNameMap[p.id] = p.full_name; });
    const outstandingBalances = Object.values(outstandingByPatient).map(o => ({
      patient_id: o.patient_id,
      patient_name: patientNameMap[o.patient_id] || 'Unknown',
      totals: o.totals,
    })).filter(o => Object.keys(o.totals).length > 0);
    const totalOutstanding = outstandingBalances.reduce((acc, o) => addCurrencyTotals(acc, o.totals), {});

    // Net profit = revenue - expenses - purchases - lab costs - payouts (commissions already in expenses conceptually, but we show separately)
    const totalCosts = addCurrencyTotals(addCurrencyTotals(addCurrencyTotals(totalExpenses, totalPurchases), totalLabCosts), totalPayouts);
    const netProfit = {};
    for (const cur of Object.keys({ ...totalRevenue, ...totalCosts })) {
      netProfit[cur] = round2((totalRevenue[cur] || 0) - (totalCosts[cur] || 0));
    }

    // ---- Revenue trend (monthly, per currency) ----
    const revenueData = [];
    const monthBuckets = [];
    const fromD = new Date(dateFrom);
    const toD = new Date(dateTo);
    let cursor = new Date(fromD.getFullYear(), fromD.getMonth(), 1);
    while (cursor <= toD) {
      monthBuckets.push(new Date(cursor));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      if (monthBuckets.length > 36) break;
    }
    for (const m of monthBuckets) {
      const start = new Date(m.getFullYear(), m.getMonth(), 1);
      const end = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59);
      const monthPayments = payments.filter(p => {
        const d = p.payment_date ? new Date(p.payment_date) : new Date(p.created_date);
        return d >= start && d <= end;
      });
      const byCur = sumByCurrency(monthPayments, 'amount', 'currency');
      revenueData.push({ month: m.toLocaleString('en', { month: 'short', year: '2-digit' }), ...byCur });
    }

    // ---- Doctor performance ----
    const doctorPerformance = doctors.map(d => {
      const dAppts = apptsR.filter(a => a.doctor_id === d.id);
      const dTreatments = patientTreatments.filter(pt => pt.doctor_id === d.id);
      const dCommissions = paymentsR.filter(p => p.doctor_id === d.id);
      const dPayouts = payoutsR.filter(p => p.doctor_id === d.id);
      return {
        name: d.name,
        appointments: dAppts.length,
        treatments: dTreatments.length,
        commission: sumByCurrency(dCommissions, 'doctor_commission_amount', 'currency'),
        paid_out: sumByCurrency(dPayouts, 'amount', 'currency'),
      };
    });

    // ---- Doctor detailed breakdown: patients + treatments per doctor ----
    const doctorDetails = doctors.map(d => {
      const dTreatments = patientTreatments.filter(pt => pt.doctor_id === d.id);
      const byPatient = {};
      dTreatments.forEach(pt => {
        const pid = pt.patient_id;
        if (!byPatient[pid]) byPatient[pid] = { patient_id: pid, patient_name: patientNameMap[pid] || 'Unknown', treatments: [] };
        byPatient[pid].treatments.push({
          treatment_name: pt.treatment_name || '—',
          treatment_date: pt.treatment_date || (pt.created_date ? pt.created_date.split('T')[0] : ''),
          status: pt.status,
          price: Number(pt.price) || 0,
          currency: pt.currency || 'USD',
        });
      });
      const patientsList = Object.values(byPatient).sort((a, b) => a.patient_name.localeCompare(b.patient_name));
      return {
        doctor_id: d.id,
        doctor_name: d.name,
        patient_count: patientsList.length,
        treatment_count: dTreatments.length,
        patients: patientsList,
      };
    });

    // ---- Treatment stats ----
    const treatmentCounts = {};
    patientTreatments.forEach(pt => {
      const name = pt.treatment_name || 'Unknown';
      treatmentCounts[name] = (treatmentCounts[name] || 0) + 1;
    });
    const treatmentStats = Object.entries(treatmentCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ---- Patient growth (cumulative within range by created_date) ----
    const patientGrowth = [];
    let cumulative = 0;
    // Count patients created before range start for accurate cumulative
    patients.forEach(p => {
      if (p.created_date && p.created_date < dateFrom) cumulative++;
    });
    for (const m of monthBuckets) {
      const start = new Date(m.getFullYear(), m.getMonth(), 1);
      const end = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59);
      const newPatients = patients.filter(p => {
        const d = new Date(p.created_date);
        return d >= start && d <= end;
      }).length;
      cumulative += newPatients;
      patientGrowth.push({
        month: m.toLocaleString('en', { month: 'short', year: '2-digit' }),
        total: cumulative,
        new: newPatients,
      });
    }

    // ---- Appointment status distribution ----
    const apptCounts = { scheduled: 0, confirmed: 0, waiting: 0, completed: 0, no_show: 0, cancelled: 0 };
    apptsR.forEach(a => { apptCounts[a.status] = (apptCounts[a.status] || 0) + 1; });
    const appointmentStats = Object.entries(apptCounts).map(([name, value]) => ({ name, value }));

    // ---- Expense breakdown by category ----
    const expenseByCategory = {};
    expensesR.forEach(e => {
      const cat = e.category || 'other';
      const cur = e.currency || 'USD';
      if (!expenseByCategory[cat]) expenseByCategory[cat] = {};
      expenseByCategory[cat][cur] = round2((expenseByCategory[cat][cur] || 0) + (Number(e.amount) || 0));
    });

    // ---- Purchase breakdown by category ----
    const purchaseByCategory = {};
    purchasesR.forEach(p => {
      const cat = p.category || 'other';
      const cur = p.currency || 'USD';
      if (!purchaseByCategory[cat]) purchaseByCategory[cat] = {};
      purchaseByCategory[cat][cur] = round2((purchaseByCategory[cat][cur] || 0) + (Number(p.amount) || 0));
    });

    // ---- Patient source distribution (Doctor vs Clinic) ----
    const patientSourceCounts = { doctor: 0, clinic: 0 };
    patients.forEach(p => {
      const src = p.patient_source || 'clinic';
      patientSourceCounts[src] = (patientSourceCounts[src] || 0) + 1;
    });
    const patientSourceStats = Object.entries(patientSourceCounts).map(([name, value]) => ({ name, value }));

    // ---- Payment method breakdown ----
    const paymentMethodCounts = { cash: 0, card: 0, transfer: 0, other: 0 };
    paymentsR.forEach(p => { paymentMethodCounts[p.method] = (paymentMethodCounts[p.method] || 0) + 1; });
    const paymentMethodStats = Object.entries(paymentMethodCounts).map(([name, value]) => ({ name, value }));

    return Response.json({
      canViewFinancials: isFinancialAdmin,
      dateFrom,
      dateTo,
      totals: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        purchases: totalPurchases,
        labCosts: totalLabCosts,
        commissions: totalCommissions,
        payouts: totalPayouts,
        outstanding: totalOutstanding,
        netProfit,
      },
      revenueData,
      doctorPerformance,
      doctorDetails,
      treatmentStats,
      patientGrowth,
      appointmentStats,
      patientSourceStats,
      paymentMethodStats,
      expenseByCategory,
      purchaseByCategory,
      outstandingBalances,
      // Raw lists for export
      payments: paymentsR,
      expenses: expensesR,
      purchases: purchasesR,
      labCases: labCasesR,
      doctorPayouts: payoutsR,
      appointments: apptsR,
      patientCount: patients.length,
      doctorCount: doctors.length,
    });
  } catch (error) {
    return Response.json({ error: 'Failed to load reports data: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}