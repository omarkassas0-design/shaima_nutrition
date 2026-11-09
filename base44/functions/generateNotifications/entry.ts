/**
 * Generates operational in-app notifications for clinic users.
 *
 * Scans each clinic for:
 *  - Upcoming appointments (next 24h) → doctor + receptionists
 *  - Lab cases due soon / overdue → clinic_admin + assigned doctor
 *  - Outstanding patient balances → clinic_admin + receptionists
 *
 * Avoids duplicate notifications by checking if one of the same type+link
 * already exists for the same user in the last 24h.
 *
 * Callable by: the "Generate Notifications" workflow (no session) or an admin.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { verifySystemCall } from '../../shared/systemAuth.ts';
import { resolveRole } from '../../shared/clinicRoleAssignment.ts';
import { getNotificationStrings, normalizeLang } from '../../shared/messageI18n.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    // Secure invocation: authorized workflow (no session + valid system_secret)
    // or an authenticated admin. The old `system: true` bypass is removed —
    // a public caller can no longer trigger notifications by posting it.
    const { authorized, user, error } = await verifySystemCall(req, base44);
    if (!authorized) return error;

    if (user) {
      const role = await resolveRole(base44.asServiceRole, user);
      if (role !== 'super_admin' && role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const rl = enforceRateLimit(user.id, 'reconcileAllUsers');
      if (rl) return rl;
    }

    const svc = base44.asServiceRole;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().slice(0, 10);

    // Get all clinics
    const clinics = await svc.entities.Clinic.list('-created_date', 500);

    // Get all users once (User entity may not support filter by clinic_id)
    let allUsers = [];
    try {
      allUsers = await svc.entities.User.list(undefined, 1000);
    } catch (_) { allUsers = []; }

    let totalCreated = 0;

    for (const clinic of clinics) {
      const clinicId = clinic.id;
      const i18n = getNotificationStrings(normalizeLang(clinic.language));

      // Filter users for this clinic in memory
      const clinicUsers = allUsers.filter((u) =>
        u.clinic_id === clinicId || u.data?.clinic_id === clinicId
      );

      if (clinicUsers.length === 0) continue;

      const admins = clinicUsers.filter((u) => ['super_admin', 'admin', 'clinic_admin'].includes(u.role || u.data?.role));
      const receptionists = clinicUsers.filter((u) => (u.role || u.data?.role) === 'receptionist');
      const doctors = clinicUsers.filter((u) => (u.role || u.data?.role) === 'doctor');

      // Helper: check if a notification already exists today
      const notifExists = async (userId, type, link) => {
        try {
          const existing = await svc.entities.Notification.filter({
            user_id: userId,
            type,
            link,
          }, '-created_date', 1);
          if (existing && existing.length > 0) {
            const created = new Date(existing[0].created_date);
            return (now.getTime() - created.getTime()) < 24 * 60 * 60 * 1000;
          }
          return false;
        } catch (_) { return false; }
      };

      const createNotif = async (userId, type, title, message, link) => {
        if (!userId) return;
        if (await notifExists(userId, type, link)) return;
        try {
          await svc.entities.Notification.create({
            clinic_id: clinicId,
            user_id: userId,
            type,
            title,
            message,
            link,
            read: false,
          });
          totalCreated++;
        } catch (_) {}
      };

      // 1. Upcoming appointments (next 24h)
      try {
        const allAppts = await svc.entities.Appointment.filter(
          { clinic_id: clinicId },
          'date',
          500
        );
        const appts = allAppts.filter((a) => ['scheduled', 'confirmed'].includes(a.status));
        for (const appt of appts) {
          if (!appt.date) continue;
          const apptDate = new Date(appt.date + 'T' + (appt.start_time || '00:00'));
          if (apptDate >= now && apptDate <= tomorrow) {
            const timeStr = appt.start_time || '';
            const msg = i18n.apptMsg(appt.patient_name, appt.date, timeStr, appt.treatment_name);
            const link = `/appointments`;
            // Notify assigned doctor (find the user linked to this doctor)
            if (appt.doctor_id) {
              const doctor = await svc.entities.Doctor.get(appt.doctor_id).catch(() => null);
              if (doctor?.user_id) {
                await createNotif(doctor.user_id, 'appointment_reminder', i18n.upcomingAppointment, msg, link);
              }
            }
            // Notify receptionists
            for (const r of receptionists) {
              await createNotif(r.id, 'appointment_reminder', i18n.upcomingAppointment, msg, link);
            }
          }
        }
      } catch (_) {}

      // 2. Lab cases due soon / overdue
      try {
        const allLabCases = await svc.entities.LabCase.filter(
          { clinic_id: clinicId },
          'due_date',
          200
        );
        const labCases = allLabCases.filter((lc) => ['sent', 'in_progress'].includes(lc.status));
        for (const lc of labCases) {
          if (!lc.due_date) continue;
          const due = new Date(lc.due_date);
          const isOverdue = due < now;
          const isDueSoon = due <= tomorrow && due >= now;
          if (isOverdue || isDueSoon) {
            const title = isOverdue ? i18n.labCaseOverdue : i18n.labCaseDueSoon;
            const msg = i18n.labMsg(lc.case_type, lc.patient_name, lc.lab_name, lc.due_date);
            const link = '/lab-cases';
            for (const a of admins) {
              await createNotif(a.id, 'lab_ready', title, msg, link);
            }
            if (lc.doctor_id) {
              const doctor = await svc.entities.Doctor.get(lc.doctor_id).catch(() => null);
              if (doctor?.user_id) {
                await createNotif(doctor.user_id, 'lab_ready', title, msg, link);
              }
            }
          }
        }
      } catch (_) {}

      // 3. Outstanding patient balances (admin + receptionist only)
      try {
        const allTreatments = await svc.entities.PatientTreatment.filter(
          { clinic_id: clinicId },
          undefined,
          1000
        );
        // ONLY completed treatments are payable — planned/in_progress/cancelled
        // treatments are not yet owed and must not appear as outstanding balances.
        const treatments = allTreatments.filter((t) => t.status === 'completed');
        // Group by patient, sum outstanding per currency
        // Aggregate due and paid per patient, then subtract — overpayments on one
        // treatment offset other treatments' unpaid balances in the same currency.
        const dueByPatient = {};
        const paidByPatient = {};
        for (const t of treatments) {
          const _price = Number(t.price) || 0;
          const _disc = t.discount_type === 'percentage'
            ? _price * (Number(t.discount_value) || 0) / 100
            : t.discount_type === 'fixed'
              ? (Number(t.discount_value) || 0)
              : 0;
          const cur = t.currency || 'USD';
          const pid = t.patient_id;
          if (!dueByPatient[pid]) dueByPatient[pid] = {};
          if (!paidByPatient[pid]) paidByPatient[pid] = {};
          dueByPatient[pid][cur] = (dueByPatient[pid][cur] || 0) + (_price - _disc);
          paidByPatient[pid][cur] = (paidByPatient[pid][cur] || 0) + (Number(t.paid_amount) || 0);
        }
        const outstanding = {};
        for (const pid of Object.keys(dueByPatient)) {
          for (const cur of Object.keys(dueByPatient[pid])) {
            const owed = (dueByPatient[pid][cur] || 0) - (paidByPatient[pid][cur] || 0);
            if (owed > 0.01) {
              if (!outstanding[pid]) outstanding[pid] = {};
              outstanding[pid][cur] = owed;
            }
          }
        }
        const outstandingCount = Object.keys(outstanding).length;
        if (outstandingCount > 0) {
          const msg = i18n.outstandingMsg(outstandingCount);
          const link = '/payments';
          for (const a of admins) {
            await createNotif(a.id, 'payment_received', i18n.outstandingBalances, msg, link);
          }
          for (const r of receptionists) {
            await createNotif(r.id, 'payment_received', i18n.outstandingBalances, msg, link);
          }
        }
      } catch (_) {}
    }

    return Response.json({ success: true, created: totalCreated, run_at: now.toISOString() });
  } catch (error) {
    console.error('generateNotifications failed', error?.message);
    return Response.json({ error: error?.message || 'Failed to generate notifications' }, { status: 500 });
  }
}