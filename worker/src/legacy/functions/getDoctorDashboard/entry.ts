/**
 * Read-only dashboard data for a DOCTOR user.
 *
 * Scoped twice over:
 *   1. clinic_id is derived server-side from the authenticated user.
 *   2. Results are further narrowed to the Doctor record linked to this user
 *      (Doctor.user_id === user.id), so a doctor sees only THEIR own work.
 *
 * Currency rule: every financial total is a per-currency map — never mixed.
 */
import { createClientFromRequest } from '../../../compat/platform-sdk.js';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { sumByCurrency, round2 } from '../../shared/currencyUtils.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';
import { fetchAllRecords } from '../../shared/paginatedFetch.ts';

export default async function(req) {
  try {
    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req);
    if (error) return error;

    // Only doctor-role users should use this dashboard.
    if (authoritativeRole !== 'doctor') {
      return Response.json({ error: 'Forbidden — doctor access required' }, { status: 403 });
    }

    const rateLimitResponse = enforceRateLimit(user.id, 'getDoctorDashboard');
    if (rateLimitResponse) return rateLimitResponse;

    const svc = base44.asServiceRole;

    // Resolve the Doctor profile linked to this user account.
    const linked = await svc.entities.Doctor.filter({ clinic_id: clinicId, user_id: user.id }, null, 1);
    let doctor = linked[0];

    // Auto-create a Doctor profile if none exists yet, so the doctor can
    // access their dashboard without a clinic admin manually creating the
    // profile. The profile is scoped to the user's clinic and linked to
    // their user account. Commission/salary default to zero — the clinic
    // admin can configure those later via saveDoctorCompensation.
    if (!doctor) {
      doctor = await svc.entities.Doctor.create({
        clinic_id: clinicId,
        user_id: user.id,
        name: user.full_name || user.email || 'Doctor',
        commission_percentage: 0,
        commission_percentage_doctor: 0,
        commission_percentage_clinic: 0,
        monthly_salary: 0,
        salary_currency: 'USD',
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Fetch ALL records via paginated accumulation — no hard caps that could
    // silently truncate and produce inaccurate metrics.
    const [appointments, patientTreatments, payments, payouts, labCases] = await Promise.all([
      fetchAllRecords(svc, 'Appointment', { clinic_id: clinicId, doctor_id: doctor.id }, '-date'),
      fetchAllRecords(svc, 'PatientTreatment', { clinic_id: clinicId, doctor_id: doctor.id }, '-created_date'),
      fetchAllRecords(svc, 'Payment', { clinic_id: clinicId, doctor_id: doctor.id }, '-payment_date'),
      fetchAllRecords(svc, 'DoctorPayout', { clinic_id: clinicId, doctor_id: doctor.id }, '-payment_date'),
      fetchAllRecords(svc, 'LabCase', { clinic_id: clinicId, doctor_id: doctor.id }, '-due_date'),
    ]);

    // Resolve the doctor's own patients — those assigned to this doctor
    // (assigned_doctor_id for clinic-sourced patients, or referring_doctor_id
    // for doctor-sourced patients). This is INDEPENDENT of appointments:
    // a patient counts the moment they are assigned, with or without an
    // appointment.
    const ownPatients = await fetchAllRecords(
      svc,
      'Patient',
      { clinic_id: clinicId, $or: [
        { assigned_doctor_id: doctor.id },
        { referring_doctor_id: doctor.id },
      ]},
      '-created_date'
    );

    // Also resolve patient names referenced by appointments/treatments/lab
    // cases that may not be assigned to this doctor — for name lookup only.
    const ownPatientIds = new Set(ownPatients.map(p => p.id));
    const extraIds = [...new Set([
      ...appointments.map(a => a.patient_id),
      ...patientTreatments.map(t => t.patient_id),
      ...labCases.map(c => c.patient_id),
    ].filter(Boolean))].filter(id => !ownPatientIds.has(id));

    const extraPatients = extraIds.length
      ? await svc.entities.Patient.filter({ clinic_id: clinicId, id: { $in: extraIds } }, null, extraIds.length)
      : [];

    const patients = ownPatients;
    const patientNameById = Object.fromEntries([
      ...patients.map(p => [p.id, p.full_name]),
      ...extraPatients.map(p => [p.id, p.full_name]),
    ]);

    const todaysAppointments = appointments
      .filter(a => a.date === today)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
      .map(a => ({
        id: a.id, patient_name: a.patient_name || patientNameById[a.patient_id] || 'Patient',
        start_time: a.start_time, end_time: a.end_time, status: a.status,
        treatment_name: a.treatment_name || '', treatment_room: a.treatment_room,
      }));

    const upcomingAppointments = appointments
      .filter(a => a.date > today && a.status !== 'cancelled')
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
      .slice(0, 10)
      .map(a => ({
        id: a.id, date: a.date, start_time: a.start_time, status: a.status,
        patient_name: a.patient_name || patientNameById[a.patient_id] || 'Patient',
        treatment_name: a.treatment_name || '',
      }));

    // Own commission financials — per currency, never mixed.
    // Doctors must NOT see revenue/income — only their own commission data.
    const commissionByCurrency = sumByCurrency(payments, 'doctor_commission_amount', 'currency');
    const paidByCurrency = sumByCurrency(payouts, 'amount', 'currency');
    const remainingByCurrency = {};
    for (const cur of new Set([...Object.keys(commissionByCurrency), ...Object.keys(paidByCurrency)])) {
      remainingByCurrency[cur] = round2((commissionByCurrency[cur] || 0) - (paidByCurrency[cur] || 0));
    }

    const activeLabCases = labCases
      .filter(c => ['sent', 'in_progress', 'ready'].includes(c.status))
      .slice(0, 10)
      .map(c => ({
        id: c.id, case_type: c.case_type, status: c.status, due_date: c.due_date,
        lab_name: c.lab_name || '', cost: c.cost || 0, currency: c.currency || 'USD',
        patient_name: c.patient_name || patientNameById[c.patient_id] || 'Patient',
      }));

    const treatmentPlans = patientTreatments.slice(0, 15).map(t => ({
      id: t.id, treatment_name: t.treatment_name, status: t.status,
      patient_name: patientNameById[t.patient_id] || 'Patient',
      price: t.price || 0, currency: t.currency || 'USD',
      treatment_date: t.treatment_date,
    }));

    return Response.json({
      linked: true,
      doctor: {
        id: doctor.id, name: doctor.name, specialty: doctor.specialty || '',
        commission_percentage: doctor.commission_percentage || 0,
      },
      metrics: {
        totalPatients: patients.length,
        todaysAppointmentCount: todaysAppointments.length,
        todaysCompleted: todaysAppointments.filter(a => a.status === 'completed').length,
        upcomingCount: appointments.filter(a => a.date > today && a.status !== 'cancelled').length,
        totalAppointments: appointments.length,
        activeTreatments: patientTreatments.filter(t => t.status === 'in_progress').length,
        activeLabCaseCount: activeLabCases.length,
      },
      financials: {
        commission: commissionByCurrency,
        paid: paidByCurrency,
        remaining: remainingByCurrency,
      },
      todaysAppointments,
      upcomingAppointments,
      activeLabCases,
      treatmentPlans,
      // Doctors must never see patient phone numbers — stripped server-side.
      recentPatients: patients.slice(0, 8).map(p => ({
        id: p.id, full_name: p.full_name,
      })),
      payouts: payouts.slice(0, 10).map(p => ({
        id: p.id, amount: p.amount, currency: p.currency || 'USD',
        payment_date: p.payment_date, notes: p.notes || '',
      })),
    });
  } catch (error) {
    return Response.json({ error: 'Failed to load doctor dashboard: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}