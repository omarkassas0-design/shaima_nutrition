import React from 'react';
import { formatDisplayDate } from '@/lib/dateFormat';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Stethoscope, Calendar, Clock, FileText, Activity, Pencil, Trash2, DoorClosed } from 'lucide-react';
import { durationMinutes, getStatusStyle } from './calendarUtils';
import { useLanguage } from '@/lib/useLanguage';
import { getStatusLabel } from '@/lib/statusLabels';

export default function AppointmentDetailsModal({
  appointment,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  canEdit = true,
}) {
  const { t, lang } = useLanguage();
  if (!appointment) return null;
  const style = getStatusStyle(appointment.status);
  const duration = durationMinutes(appointment.start_time, appointment.end_time);

  const Row = ({ icon, label, value }) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium text-foreground break-words">{value || '—'}</div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${style.bg}`} />
            {t('appointment_details')}
            </DialogTitle>
            </DialogHeader>

            <div className="space-y-0">
            <Row icon={<User className="w-4 h-4" />} label={t('patient')} value={appointment.patient_name} />
            <Row icon={<Stethoscope className="w-4 h-4" />} label={t('doctor_dentist')} value={appointment.doctor_name} />
            <Row icon={<DoorClosed className="w-4 h-4" />} label={t('treatment_room')} value={appointment.treatment_room ? t('treatment_room_n').replace('{n}', appointment.treatment_room) : '—'} />
            <Row
             icon={<Calendar className="w-4 h-4" />}
             label={t('date')}
             value={appointment.date ? formatDisplayDate(appointment.date, lang) : '—'}
            />
            <Row
             icon={<Clock className="w-4 h-4" />}
             label={t('time')}
             value={`${appointment.start_time || '—'} – ${appointment.end_time || '—'}${duration > 0 ? ` (${duration} min)` : ''}`}
            />
            <Row icon={<FileText className="w-4 h-4" />} label={t('treatment_procedure')} value={appointment.treatment_name} />
            <Row
             icon={<Activity className="w-4 h-4" />}
             label={t('status')}
             value={<Badge className={`${style.soft} border`}>{getStatusLabel(appointment.status, lang)}</Badge>}
            />
            {appointment.notes && (
             <Row icon={<FileText className="w-4 h-4" />} label={t('notes')} value={appointment.notes} />
            )}
            </div>

            {canEdit && (
            <DialogFooter className="flex gap-2 sm:justify-between">
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => onDelete(appointment)}>
              <Trash2 className="w-4 h-4 mr-1" /> {t('delete')}
            </Button>
            <Button size="sm" className="gradient-primary text-white" onClick={() => onEdit(appointment)}>
              <Pencil className="w-4 h-4 mr-1" /> {t('edit')}
            </Button>
            </DialogFooter>
            )}
      </DialogContent>
    </Dialog>
  );
}