/**
 * Sends scheduled reports to configured email recipients.
 *
 * Finds all enabled ScheduledReport configs that are due (next_send_at <= now),
 * generates the report data server-side (respecting clinic isolation + currency
 * separation), and emails a summary to each recipient.
 *
 * Callable by: the "Send Scheduled Reports" workflow (no session).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { verifySystemCall } from '../../shared/systemAuth.ts';
import { resolveRole } from '../../shared/clinicRoleAssignment.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { getReportStrings, normalizeLang } from '../../shared/messageI18n.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    // Secure invocation: authorized internal call (workflow engine / test tool)
    // or an authenticated admin. Unauthenticated public HTTP calls are rejected.
    const { authorized, user, error } = await verifySystemCall(req, base44);
    if (!authorized) return error;

    if (user) {
      const role = await resolveRole(base44.asServiceRole, user);
      if (role !== 'admin' && role !== 'super_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const rl = enforceRateLimit(user.id, 'runAutomaticBackups');
      if (rl) return rl;
    }

    const svc = base44.asServiceRole;

    const now = new Date();
    let sentCount = 0;
    let failCount = 0;

    // Get all enabled scheduled reports
    let reports = [];
    try {
      reports = await svc.entities.ScheduledReport.filter({ enabled: true }, undefined, 500);
    } catch (e) {
      return Response.json({ error: 'Failed to fetch scheduled reports' }, { status: 500 });
    }

    for (const config of reports) {
      // Check if due
      if (config.next_send_at) {
        const next = new Date(config.next_send_at);
        if (next > now) continue; // not yet due
      }

      try {
        const clinic = await svc.entities.Clinic.get(config.clinic_id);
        if (!clinic) { failCount++; continue; }

        const i18n = getReportStrings(normalizeLang(clinic.language));

        // Determine date range based on frequency
        let dateFrom, dateTo, periodLabel;
        if (config.frequency === 'daily') {
          dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          dateTo = now.toISOString().slice(0, 10);
          periodLabel = i18n.daily;
        } else if (config.frequency === 'weekly') {
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          dateTo = now.toISOString().slice(0, 10);
          periodLabel = i18n.weekly;
        } else {
          dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
          dateTo = now.toISOString().slice(0, 10);
          periodLabel = i18n.monthly;
        }

        // Generate report data based on report_type
        const reportData = await generateReportData(svc, config, clinic, dateFrom, dateTo, i18n);

        // Build email body
        const subject = `${periodLabel} ${i18n.reportSuffix} — ${clinic.name} — ${reportData.title}`;
        const body = buildEmailBody(clinic, reportData, dateFrom, dateTo, periodLabel, i18n);

        // Send to each recipient
        for (const email of config.email_recipients || []) {
          try {
            await base44.integrations.Core.SendEmail({
              to: email,
              subject,
              body,
            });
            sentCount++;
          } catch (e) {
            console.error('Failed to send to', email, e?.message);
            failCount++;
          }
        }

        // Update last_sent_at and compute next_send_at
        let nextSend = new Date(now);
        if (config.frequency === 'daily') nextSend.setDate(nextSend.getDate() + 1);
        else if (config.frequency === 'weekly') nextSend.setDate(nextSend.getDate() + 7);
        else nextSend.setMonth(nextSend.getMonth() + 1);
        nextSend.setHours(8, 0, 0, 0); // 8 AM local

        await svc.entities.ScheduledReport.update(config.id, {
          last_sent_at: now.toISOString(),
          next_send_at: nextSend.toISOString(),
        });
      } catch (e) {
        console.error('Failed to process report config', config.id, e?.message);
        failCount++;
      }
    }

    return Response.json({ success: true, sent: sentCount, failed: failCount, run_at: now.toISOString() });
  } catch (error) {
    console.error('sendScheduledReports failed', error?.message);
    return Response.json({ error: error?.message || 'Failed to send reports' }, { status: 500 });
  }
}

async function generateReportData(svc, config, clinic, dateFrom, dateTo, i18n) {
  const clinicId = config.clinic_id;
  const type = config.report_type;
  const L = i18n.reportTitles;
  const S = i18n.sectionLabels;

  // Fetch relevant data
  const [payments, expenses, purchases, appts, labCases, treatments] = await Promise.all([
    svc.entities.Payment.filter({ clinic_id: clinicId }, undefined, 5000).catch(() => []),
    svc.entities.Expense.filter({ clinic_id: clinicId }, undefined, 5000).catch(() => []),
    svc.entities.Purchase.filter({ clinic_id: clinicId }, undefined, 5000).catch(() => []),
    svc.entities.Appointment.filter({ clinic_id: clinicId }, undefined, 5000).catch(() => []),
    svc.entities.LabCase.filter({ clinic_id: clinicId }, undefined, 5000).catch(() => []),
    svc.entities.PatientTreatment.filter({ clinic_id: clinicId }, undefined, 5000).catch(() => []),
  ]);

  // Filter by date range
  const inRange = (date) => date && date >= dateFrom && date <= dateTo;
  const rangePayments = payments.filter((p) => inRange(p.payment_date));
  const rangeExpenses = expenses.filter((e) => inRange(e.expense_date));
  const rangePurchases = purchases.filter((p) => inRange(p.purchase_date));
  const rangeAppts = appts.filter((a) => inRange(a.date));

  // Currency-separated totals
  const sumByCurrency = (items, field) => {
    const totals = {};
    for (const item of items) {
      const cur = item.currency || 'USD';
      totals[cur] = (totals[cur] || 0) + (item[field] || 0);
    }
    return totals;
  };

  const revenue = sumByCurrency(rangePayments, 'amount');
  const expensesTotal = sumByCurrency(rangeExpenses, 'amount');
  const purchasesTotal = sumByCurrency(rangePurchases, 'amount');

  // Outstanding balances
  const outstanding = {};
  for (const t of treatments) {
    const owed = (t.price || 0) - (t.paid_amount || 0);
    if (owed > 0.01) {
      const cur = t.currency || 'USD';
      outstanding[cur] = (outstanding[cur] || 0) + owed;
    }
  }

  // Appointment stats
  const apptStats = {};
  for (const a of rangeAppts) {
    apptStats[a.status] = (apptStats[a.status] || 0) + 1;
  }

  const fmtTotals = (totals) => Object.entries(totals).map(([cur, val]) => `${val.toFixed(2)} ${cur}`).join(', ') || '0';

  switch (type) {
    case 'daily_summary':
    case 'weekly_summary':
    case 'monthly_summary':
      return {
        title: type === 'daily_summary' ? L.daily_summary : type === 'weekly_summary' ? L.weekly_summary : L.monthly_summary,
        sections: [
          { label: S.revenue, value: fmtTotals(revenue) },
          { label: S.expenses, value: fmtTotals(expensesTotal) },
          { label: S.purchases, value: fmtTotals(purchasesTotal) },
          { label: S.appointments, value: String(rangeAppts.length) },
          { label: S.outstandingBalances, value: fmtTotals(outstanding) },
        ],
      };
    case 'revenue_summary':
      return {
        title: L.revenue_summary,
        sections: [{ label: S.totalRevenue, value: fmtTotals(revenue) }],
      };
    case 'expense_summary':
      return {
        title: L.expense_summary,
        sections: [
          { label: S.expenses, value: fmtTotals(expensesTotal) },
          { label: S.purchases, value: fmtTotals(purchasesTotal) },
        ],
      };
    case 'payment_summary':
      return {
        title: L.payment_summary,
        sections: [{ label: S.paymentsReceived, value: fmtTotals(revenue) }, { label: S.paymentCount, value: String(rangePayments.length) }],
      };
    case 'outstanding_balances':
      return {
        title: L.outstanding_balances,
        sections: [{ label: S.totalOutstanding, value: fmtTotals(outstanding) }],
      };
    case 'appointment_statistics':
      return {
        title: L.appointment_statistics,
        sections: Object.entries(apptStats).map(([status, count]) => ({ label: status, value: String(count) })),
      };
    case 'clinic_performance':
      return {
        title: L.clinic_performance,
        sections: [
          { label: S.totalAppointments, value: String(rangeAppts.length) },
          { label: S.revenue, value: fmtTotals(revenue) },
          { label: S.outstanding, value: fmtTotals(outstanding) },
        ],
      };
    default:
      return { title: L.default, sections: [] };
  }
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailBody(clinic, reportData, dateFrom, dateTo, periodLabel, i18n) {
  const clinicName = escapeHtml(clinic.name);
  const clinicLogo = escapeHtml(clinic.logo_url);
  const clinicAddress = escapeHtml(clinic.address);
  const clinicPhone = escapeHtml(clinic.phone);
  const isRtl = i18n === getReportStrings('ar');

  let body = `<html><body style="font-family: ${isRtl ? "'Noto Sans Arabic', " : ''}Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;${isRtl ? ' direction: rtl;' : ''}">`;
  body += `<div style="border-bottom: 2px solid #0ea5e9; padding-bottom: 12px; margin-bottom: 16px;">`;
  if (clinicLogo) body += `<img src="${clinicLogo}" alt="Logo" style="max-height: 50px; margin-bottom: 8px;" />`;
  body += `<h1 style="color: #0c4a6e; margin: 0; font-size: 20px;">${clinicName}</h1>`;
  body += `<p style="color: #64748b; margin: 4px 0 0; font-size: 13px;">${escapeHtml(periodLabel)} ${escapeHtml(i18n.reportSuffix)} — ${escapeHtml(reportData.title)}</p>`;
  body += `<p style="color: #64748b; margin: 2px 0 0; font-size: 12px;">${escapeHtml(i18n.period)}: ${escapeHtml(dateFrom)} ${escapeHtml(i18n.to)} ${escapeHtml(dateTo)}</p>`;
  body += `</div>`;

  body += `<table style="width: 100%; border-collapse: collapse;">`;
  for (const section of reportData.sections) {
    body += `<tr style="border-bottom: 1px solid #e2e8f0;">`;
    body += `<td style="padding: 10px 0; color: #475569; font-size: 14px;">${escapeHtml(section.label)}</td>`;
    body += `<td style="padding: 10px 0; text-align: ${isRtl ? 'left' : 'right'}; font-weight: 600; color: #0c4a6e; font-size: 14px;">${escapeHtml(section.value)}</td>`;
    body += `</tr>`;
  }
  body += `</table>`;

  body += `<div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 11px;">`;
  if (clinicAddress) body += `<p style="margin: 2px 0;">${clinicAddress}</p>`;
  if (clinicPhone) body += `<p style="margin: 2px 0;">${escapeHtml(i18n.phone)}: ${clinicPhone}</p>`;
  body += `<p style="margin: 8px 0 0;">${escapeHtml(i18n.generatedBy)}</p>`;
  body += `</div>`;

  body += `</body></html>`;
  return body;
}