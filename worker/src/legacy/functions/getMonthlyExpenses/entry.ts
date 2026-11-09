/**
 * Monthly Expenses aggregation for a clinic — currency-aware.
 *
 * Security:
 *   - Only clinic_admin (and super_admin) can call this function.
 *   - clinic_id is ALWAYS derived server-side from the authenticated user.
 *
 * Currency rules (CRITICAL — currencies are NEVER mixed):
 *   - Doctor salaries use Doctor.salary_currency.
 *   - Doctor commissions use the Payment.currency of each payment.
 *   - Staff salaries use Staff.salary_currency.
 *   - Other expenses use Expense.currency.
 *   - Every total is a per-currency map ({ USD, SYP, TRY }).
 *   - Grand total is a per-currency map, NOT a single number.
 *
 * Body: { month?: "YYYY-MM", clinic_id?: string (super_admin only) }
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { sumByCurrency, addCurrencyTotals, round2 } from '../../shared/currencyUtils.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

export default async function(req) {
  try {
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req, body.clinic_id);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'getMonthlyExpenses');
    if (rateLimitResponse) return rateLimitResponse;

    const userRole = authoritativeRole;
    if (!['super_admin', 'admin', 'clinic_admin'].includes(userRole)) {
      return Response.json({ error: 'Forbidden — only clinic administrators can view monthly expenses' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    const now = new Date();
    const month = body.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, mon] = month.split('-').map(Number);
    if (!year || !mon || mon < 1 || mon > 12) {
      return Response.json({ error: 'Invalid month format. Expected YYYY-MM' }, { status: 400 });
    }
    const startDate = new Date(year, mon - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, mon, 0).toISOString().split('T')[0];

    const [doctors, staff, paymentsRaw, expensesRaw, purchasesRaw] = await Promise.all([
      svc.entities.Doctor.filter({ clinic_id: clinicId }, 'name', 500),
      svc.entities.Staff.filter({ clinic_id: clinicId }, 'full_name', 500),
      svc.entities.Payment.filter({ clinic_id: clinicId, payment_date: { $gte: startDate } }, '-payment_date', 5000),
      svc.entities.Expense.filter({ clinic_id: clinicId, expense_date: { $gte: startDate } }, '-expense_date', 500),
      svc.entities.Purchase.filter({ clinic_id: clinicId, purchase_date: { $gte: startDate } }, '-purchase_date', 500),
    ]);

    const payments = paymentsRaw.filter(p => p.payment_date <= endDate);
    const expenses = expensesRaw.filter(e => e.expense_date <= endDate);
    const purchases = purchasesRaw.filter(p => p.purchase_date <= endDate);

    // Doctor commissions: grouped by payment currency per doctor.
    const commissionByDoctor = {}; // doctor_id -> { currency -> amount }
    payments.forEach(p => {
      if (p.doctor_id) {
        const cur = p.currency || 'USD';
        if (!commissionByDoctor[p.doctor_id]) commissionByDoctor[p.doctor_id] = {};
        commissionByDoctor[p.doctor_id][cur] = round2((commissionByDoctor[p.doctor_id][cur] || 0) + (p.doctor_commission_amount || 0));
      }
    });

    // Build doctor list — salary in salary_currency, commissions per currency.
    const doctorList = doctors.map(d => {
      const salaryCurrency = d.salary_currency || 'USD';
      const commissionEarned = commissionByDoctor[d.id] || {};
      return {
        id: d.id,
        name: d.name,
        specialty: d.specialty || '',
        salary: d.monthly_salary || 0,
        salary_currency: salaryCurrency,
        commission_percentage: d.commission_percentage || 0,
        commission_earned: commissionEarned, // { USD: 100, SYP: 50000 }
      };
    });

    // Build staff list.
    const staffList = staff
      .filter(s => !s.status || s.status === 'active')
      .map(s => ({
        id: s.id,
        name: s.full_name,
        position: s.position || 'staff',
        salary: s.salary || 0,
        salary_currency: s.salary_currency || 'USD',
      }));

    // Split expenses into Prosthesis/Lab Costs and Other Expenses.
    // Prosthesis/Lab costs are auto-created from finalized lab cases
    // (category 'prosthesis_lab') and shown as their own line item.
    const prosthesisExpenses = expenses.filter(e => (e.category || 'other') === 'prosthesis_lab');
    const otherExpenses = expenses.filter(e => (e.category || 'other') !== 'prosthesis_lab');

    // Build expense list (other expenses only — prosthesis shown separately).
    const expenseList = otherExpenses.map(e => ({
      id: e.id,
      name: e.name,
      amount: e.amount || 0,
      currency: e.currency || 'USD',
      category: e.category || 'other',
      expense_date: e.expense_date,
      notes: e.notes || '',
    }));

    // Build prosthesis/lab cost list.
    const prosthesisList = prosthesisExpenses.map(e => ({
      id: e.id,
      name: e.name,
      amount: e.amount || 0,
      currency: e.currency || 'USD',
      category: 'prosthesis_lab',
      expense_date: e.expense_date,
      notes: e.notes || '',
    }));

    // Build purchase list.
    const purchaseList = purchases.map(p => ({
      id: p.id,
      name: p.name,
      amount: p.amount || 0,
      currency: p.currency || 'USD',
      category: p.category || 'other',
      supplier: p.supplier || '',
      purchase_date: p.purchase_date,
      notes: p.notes || '',
    }));

    // Per-currency totals — each currency stays separate.
    const totalDoctorSalaries = {}; // salary_currency -> total
    doctorList.forEach(d => {
      const cur = d.salary_currency;
      totalDoctorSalaries[cur] = round2((totalDoctorSalaries[cur] || 0) + d.salary);
    });

    const totalDoctorCommissions = {}; // payment currency -> total
    doctorList.forEach(d => {
      for (const [cur, amt] of Object.entries(d.commission_earned)) {
        totalDoctorCommissions[cur] = round2((totalDoctorCommissions[cur] || 0) + amt);
      }
    });

    const totalStaffSalaries = {}; // salary_currency -> total
    staffList.forEach(s => {
      const cur = s.salary_currency;
      totalStaffSalaries[cur] = round2((totalStaffSalaries[cur] || 0) + s.salary);
    });

    const totalOtherExpenses = sumByCurrency(expenseList, 'amount', 'currency');
    const totalProsthesisLab = sumByCurrency(prosthesisList, 'amount', 'currency');
    const totalPurchases = sumByCurrency(purchaseList, 'amount', 'currency');

    // Grand total per currency — currencies never mixed.
    const grandTotal = addCurrencyTotals(
      addCurrencyTotals(
        addCurrencyTotals(
          addCurrencyTotals(
            addCurrencyTotals(totalDoctorSalaries, totalDoctorCommissions),
            totalStaffSalaries
          ),
          totalOtherExpenses
        ),
        totalProsthesisLab
      ),
      totalPurchases
    );

    return Response.json({
      month,
      monthLabel: new Date(year, mon - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' }),
      doctors: doctorList,
      staff: staffList,
      expenses: expenseList,
      prosthesis_lab: prosthesisList,
      purchases: purchaseList,
      totals: {
        staff_salaries: totalStaffSalaries,
        doctor_salaries: totalDoctorSalaries,
        doctor_commissions: totalDoctorCommissions,
        other_expenses: totalOtherExpenses,
        prosthesis_lab_costs: totalProsthesisLab,
        purchases: totalPurchases,
        grand_total: grandTotal,
      },
    });
  } catch (error) {
    return Response.json({ error: 'Failed to calculate monthly expenses: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}