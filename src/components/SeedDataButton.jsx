import React, { useState } from 'react';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { Button } from '@/components/ui/button';
import { Loader2, Database } from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

export default function SeedDataButton() {
  const { clinic } = useClinic();
  const [loading, setLoading] = useState(false);

  const seed = async () => {
    if (!clinic) {
      toast.error('Save clinic settings first, then create test data.');
      return;
    }
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const inOneWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd');

      // 1. Doctor
      const doctor = await clinicApi.create('Doctor', {
        name: 'Dr. Sarah Al-Hassan',
        specialty: 'General Dentistry',
        phone: '+963-991-234567',
        calendar_color: '#0ea5e9',
        schedule: {
          working_days: ['mon','tue','wed','thu','fri'],
          start_hour: '09:00', end_hour: '17:00',
          break_start: '13:00', break_end: '14:00',
          appointment_duration: 30,
        },
      });

      // 2. Patient
      const patient = await clinicApi.create('Patient', {
        full_name: 'Ahmad Khalil',
        phone: '+963-932-112233',
        gender: 'male',
        birth_date: '1985-06-15',
        address: 'Damascus, Al-Maliki District',
        notes: 'Regular checkup patient. Prefers morning appointments.',
        medical_info: {
          blood_type: 'A+',
          allergies: 'Penicillin',
          chronic_diseases: 'None',
          medications: 'None',
        },
      });

      // 3. Treatment catalog entry
      const treatment = await clinicApi.create('Treatment', {
        name: 'Porcelain Crown',
        category: 'Restorative',
        description: 'Full porcelain crown for damaged or heavily filled tooth',
        default_price: 250,
        currency: 'USD',
        duration_minutes: 60,
        status: 'active',
      });

      // 4. Laboratory
      const lab = await clinicApi.create('Laboratory', {
        name: 'Damascus Dental Lab',
        contact_person: 'Mahmoud Saleh',
        phone: '+963-11-9876543',
        whatsapp: '+963991876543',
        email: 'info@damascuslab.sy',
        address: 'Damascus, Baramkeh St.',
        status: 'active',
      });

      // 5. Appointment
      await clinicApi.create('Appointment', {
        patient_id: patient.id,
        doctor_id: doctor.id,
        patient_name: patient.full_name,
        doctor_name: doctor.name,
        doctor_color: doctor.calendar_color,
        date: today,
        start_time: '10:00',
        end_time: '10:30',
        status: 'scheduled',
        notes: 'Crown preparation — first visit',
      });

      // 6. Patient treatment (with tooth number)
      const pt = await clinicApi.create('PatientTreatment', {
        patient_id: patient.id,
        treatment_id: treatment.id,
        treatment_name: treatment.name,
        description: treatment.description,
        price: treatment.default_price,
        currency: treatment.currency,
        paid_amount: 100,
        discount_type: 'none',
        discount_value: 0,
        status: 'in_progress',
        tooth_numbers: [16],
        doctor_id: doctor.id,
        doctor_name: doctor.name,
        treatment_date: today,
        notes: 'Upper right first molar. Shade A2 porcelain.',
      });

      // 7. Payment
      await clinicApi.create('Payment', {
        patient_id: patient.id,
        patient_treatment_id: pt.id,
        amount: 100,
        currency: 'USD',
        method: 'cash',
        payment_date: today,
        notes: 'Initial deposit for crown procedure',
      });

      // 8. Lab case
      await clinicApi.create('LabCase', {
        patient_id: patient.id,
        patient_name: patient.full_name,
        doctor_id: doctor.id,
        doctor_name: doctor.name,
        lab_id: lab.id,
        lab_name: lab.name,
        case_type: 'Porcelain Crown',
        description: 'Upper right first molar #16 — full porcelain crown',
        sent_date: today,
        due_date: inOneWeek,
        cost: 80,
        currency: 'USD',
        status: 'sent',
        notes: 'Shade A2, standard occlusal anatomy',
      });

      toast.success('✅ Test data created! Navigate to Patients, Doctors, Appointments, etc. to see the data.');
    } catch (e) {
      toast.error('Failed to create test data: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={seed} disabled={loading} className="border-dashed border-2">
      {loading ? <Loader2 className="w-4 h-4 mr-2" /> : <Database className="w-4 h-4 mr-2" />}
      {loading ? 'Creating...' : 'Create Sample Test Data'}
    </Button>
  );
}