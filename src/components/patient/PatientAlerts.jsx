import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { useLanguage } from '@/lib/useLanguage';
import { AlertTriangle, AlertCircle, CreditCard, Clock } from 'lucide-react';
import { isPast, parseISO } from 'date-fns';
import { formatCurrencyTotals, computeOutstandingBalance } from '@/lib/currencyUtils';

export default function PatientAlerts({ patient }) {
  const { clinic } = useClinic();
  const { t } = useLanguage();

  const { data: payments = [] } = useQuery({
    queryKey: ['patientPayments', patient.id],
    queryFn: () => clinicApi.filter('Payment', { patient_id: patient.id, clinic_id: clinic?.id }),
    enabled: !!clinic,
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ['patientTreatments', patient.id],
    queryFn: () => clinicApi.filter('PatientTreatment', { patient_id: patient.id, clinic_id: clinic?.id }),
    enabled: !!clinic,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['patientAppointments', patient.id],
    queryFn: () => clinicApi.filter('Appointment', { patient_id: patient.id, clinic_id: clinic?.id }, '-date'),
    enabled: !!clinic,
  });

  const alerts = [];

  // Allergy alert
  const allergies = patient.medical_info?.allergies;
  if (allergies && allergies.trim() && allergies !== '-') {
    alerts.push({ type: 'danger', icon: AlertCircle, message: `⚠️ ${t('allergies')}: ${allergies}` });
  }

  // Chronic diseases
  const chronic = patient.medical_info?.chronic_diseases;
  if (chronic && chronic.trim() && chronic !== '-') {
    alerts.push({ type: 'warning', icon: AlertTriangle, message: `${t('chronic_diseases')}: ${chronic}` });
  }

  // Unpaid balance — per currency, never mixed. ONLY completed treatments
  // contribute to the outstanding balance (planned/in_progress/cancelled do not).
  const { remainingByCurrency } = computeOutstandingBalance(treatments);
  const hasRemaining = Object.values(remainingByCurrency).some(v => v > 0);
  if (hasRemaining) {
    alerts.push({ type: 'warning', icon: CreditCard, message: `${t('remaining')}: ${formatCurrencyTotals(remainingByCurrency)}` });
  }

  // Missed appointments
  const missed = appointments.filter(a => a.status === 'cancelled' && a.date && isPast(parseISO(a.date)));
  if (missed.length >= 2) {
    alerts.push({ type: 'info', icon: Clock, message: `${missed.length} ${t('missed_appointments')}` });
  }

  if (alerts.length === 0) return null;

  const colors = {
    danger: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  };

  return (
    <div className="space-y-2 mb-4">
      {alerts.map((alert, i) => (
        <div key={i} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium ${colors[alert.type]}`}>
          <alert.icon className="w-4 h-4 flex-shrink-0" />
          <span>{alert.message}</span>
        </div>
      ))}
    </div>
  );
}