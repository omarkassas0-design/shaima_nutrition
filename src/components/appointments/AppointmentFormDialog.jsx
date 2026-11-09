import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { useLanguage } from '@/lib/useLanguage';
import { getClinicId } from '@/lib/useClinicId';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getStatusLabel } from '@/lib/statusLabels';
import PatientSearchSelect from '@/components/appointments/PatientSearchSelect';
import EntitySearchSelect from '@/components/shared/EntitySearchSelect';
import TreatmentCategorySelector from '@/components/appointments/TreatmentCategorySelector';

const EMPTY = {
  clinic_id: '', treatment_room: 1,
  patient_id: '', patient_name: '',
  doctor_id: '', doctor_name: '', doctor_color: '',
  treatment_id: '', treatment_name: '',
  date: format(new Date(), 'yyyy-MM-dd'), start_time: '09:00', end_time: '09:30',
  status: 'scheduled', notes: '',
};

/**
 * Shared Appointment form dialog — the FULL form with Patient, Doctor,
 * Treatment, date/time, room, conflict detection, and all logic.
 * Used by both the Appointments page and the Quick Add menu.
 *
 * Props:
 *   open, onClose
 *   editing          — appointment object for edit mode (null for create)
 *   presetDate       — optional initial date (from calendar slot click)
 *   presetTime       — optional initial start_time
 *   overrideClinicId — super-admin clinic override (null for normal clinic)
 */
export default function AppointmentFormDialog({ open, onClose, editing, presetDate, presetTime, overrideClinicId }) {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [treatmentPickerOpen, setTreatmentPickerOpen] = useState(false);

  const clinicId = overrideClinicId || clinic?.id || form.clinic_id;
  const isEditing = !!editing;

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors', clinicId],
    queryFn: () => clinicId ? clinicApi.filter('Doctor', { clinic_id: clinicId }, 'name', 200, clinicId) : [],
    enabled: !!clinicId && open,
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ['treatments', clinicId],
    queryFn: () => clinicId ? clinicApi.filter('Treatment', { clinic_id: clinicId, status: 'active' }, 'name', 200, clinicId) : [],
    enabled: !!clinicId && open,
  });

  const { data: doctorDayAppointments = [] } = useQuery({
    queryKey: ['doctor-conflicts', form.doctor_id, form.date, clinicId],
    queryFn: () => clinicApi.filter('Appointment',
      { doctor_id: form.doctor_id, date: form.date, status: { $ne: 'cancelled' } },
      'start_time', 200, clinicId
    ),
    enabled: open && !!clinicId && !!form.doctor_id && !!form.date,
  });

  const { data: roomDayAppointments = [] } = useQuery({
    queryKey: ['room-conflicts', clinicId, form.treatment_room, form.date],
    queryFn: () => clinicApi.filter('Appointment',
      { treatment_room: form.treatment_room, date: form.date, status: { $ne: 'cancelled' } },
      'start_time', 200, clinicId
    ),
    enabled: open && !!clinicId && !!form.treatment_room && !!form.date,
  });

  // Initialize form when dialog opens or editing/preset changes
  useEffect(() => {
    if (!open) return;
    if (isEditing && editing) {
      setForm({
        clinic_id: editing.clinic_id || '',
        treatment_room: editing.treatment_room || 1,
        patient_id: editing.patient_id || '',
        patient_name: editing.patient_name || '',
        doctor_id: editing.doctor_id || '',
        doctor_name: editing.doctor_name || '',
        doctor_color: editing.doctor_color || '',
        treatment_id: editing.treatment_id || '',
        treatment_name: editing.treatment_name || '',
        date: editing.date || format(new Date(), 'yyyy-MM-dd'),
        start_time: editing.start_time || '09:00',
        end_time: editing.end_time || '09:30',
        status: editing.status || 'scheduled',
        notes: editing.notes || '',
      });
    } else {
      setForm({
        ...EMPTY,
        clinic_id: overrideClinicId || '',
        date: presetDate || format(new Date(), 'yyyy-MM-dd'),
        start_time: presetTime || '09:00',
        end_time: presetTime ? addMinutes(presetTime, 30) : '09:30',
      });
    }
  }, [open, isEditing, editing, presetDate, presetTime, overrideClinicId]);

  const conflict = useMemo(() => {
    if (!form.start_time || !form.end_time) return null;
    return doctorDayAppointments.find(a => {
      if (isEditing && a.id === editing?.id) return false;
      const aEnd = a.end_time || a.start_time;
      return form.start_time < aEnd && form.end_time > a.start_time;
    });
  }, [doctorDayAppointments, form.start_time, form.end_time, isEditing, editing]);

  const roomConflict = useMemo(() => {
    if (!form.start_time || !form.end_time) return null;
    return roomDayAppointments.find(a => {
      if (isEditing && a.id === editing?.id) return false;
      const aEnd = a.end_time || a.start_time;
      return form.start_time < aEnd && form.end_time > a.start_time;
    });
  }, [roomDayAppointments, form.start_time, form.end_time, isEditing, editing]);

  const { mutate, isPending } = useMutation({
    mutationFn: async (data) => {
      const cid = await getClinicId({ id: clinicId });
      if (isEditing) return clinicApi.update('Appointment', editing.id, data, cid);
      return clinicApi.create('Appointment', data, cid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      toast.success(isEditing ? t('updated_success') : t('created_success'));
      onClose();
    },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + (e?.message || '')),
  });

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!form.patient_id) return toast.error(t('patient_required'));
    if (!form.doctor_id) return toast.error(t('doctor_required'));
    mutate(form);
  };

  const handleDoctorChange = (id, rec) => {
    setForm(f => ({ ...f, doctor_id: id, doctor_name: rec?.name || '', doctor_color: rec?.calendar_color || '' }));
  };

  const handlePatientChange = (id, patient) => {
    setForm(f => ({ ...f, patient_id: id, patient_name: patient?.full_name || '' }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isEditing ? t('edit_appointment') : t('new_appointment')}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('treatment_room')} *</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, treatment_room: n }))}
                    className={cn(
                      'h-9 rounded-md border text-sm font-medium transition-colors',
                      form.treatment_room === n
                        ? 'gradient-primary text-white border-transparent'
                        : 'border-input bg-transparent hover:bg-accent'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('patient')} *</Label>
              <PatientSearchSelect
                clinicId={clinicId}
                value={form.patient_id}
                patientName={form.patient_name}
                onChange={handlePatientChange}
                disabled={!clinicId}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('doctor')} *</Label>
              <EntitySearchSelect
                entity="Doctor"
                clinicId={clinicId}
                value={form.doctor_id}
                selectedLabel={form.doctor_name || doctors.find(d => d.id === form.doctor_id)?.name}
                onChange={handleDoctorChange}
                labelKey="name"
                secondaryKey="specialty"
                placeholder={t('doctor')}
                disabled={!clinicId}
                overrideClinicId={clinicId}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('treatment_type')}</Label>
              <button
                type="button"
                onClick={() => clinicId ? setTreatmentPickerOpen(true) : null}
                disabled={!clinicId}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {form.treatment_name ? (
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{form.treatment_name}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t('select_category_treatment')}</span>
                )}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>{t('date')}</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('start')}</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('end')}</Label>
                <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>

            {conflict && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold">{t('time_conflict')}</p>
                  <p className="text-xs mt-0.5">
                    {t('doctor')} {form.doctor_name || conflict.doctor_name} {t('already_has_appointment')}
                    {' '}{t('in_treatment_room')} {conflict.treatment_room || 1}
                    {' '}{t('from')} {conflict.start_time} {t('to')} {conflict.end_time}.
                  </p>
                </div>
              </div>
            )}

            {roomConflict && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold">{t('room_conflict')}</p>
                  <p className="text-xs mt-0.5">{t('treatment_room')} {form.treatment_room} {t('room_already_has_appointment')}</p>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t('status')}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['scheduled', 'confirmed', 'waiting', 'completed', 'no_show', 'cancelled'].map(s => (
                    <SelectItem key={s} value={s}>{getStatusLabel(s, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t('notes')}</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('optional_notes')} />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={onClose}>{t('cancel')}</Button>
              <Button type="submit" disabled={isPending || !clinicId} className="gradient-primary text-white">
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <TreatmentCategorySelector
        open={treatmentPickerOpen}
        onOpenChange={setTreatmentPickerOpen}
        treatments={treatments}
        selectedTreatmentId={form.treatment_id}
        onSelect={(tr) => setForm(f => ({ ...f, treatment_id: tr.id, treatment_name: tr.name }))}
      />
    </>
  );
}

function addMinutes(time, mins) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}