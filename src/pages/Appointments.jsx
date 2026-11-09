import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/useLanguage';
import { roleIsDoctor, roleIsSuperAdmin } from '@/lib/permissions';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Calendar } from 'lucide-react';
import { deleteWithUndo } from '@/lib/undoDelete';
import { format, addDays, startOfWeek } from 'date-fns';

import CalendarToolbar from '@/components/appointments/CalendarToolbar';
import DoctorFilter from '@/components/appointments/DoctorFilter';
import DayWeekView from '@/components/appointments/DayWeekView';
import AgendaView from '@/components/appointments/AgendaView';
import MonthView from '@/components/appointments/MonthView';
import AppointmentDetailsModal from '@/components/appointments/AppointmentDetailsModal';
import TreatmentRoomSelector from '@/components/appointments/TreatmentRoomSelector';
import AppointmentFormDialog from '@/components/appointments/AppointmentFormDialog';
import AppointmentSearch from '@/components/appointments/AppointmentSearch';

const EMPTY_FORM = {
  clinic_id: '',
  treatment_room: 1,
  patient_id: '', patient_name: '',
  doctor_id: '', doctor_name: '', doctor_color: '',
  treatment_id: '', treatment_name: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  start_time: '09:00', end_time: '09:30',
  status: 'scheduled', notes: '',
};

export default function Appointments() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { user, effectiveRole } = useAuth();
  const queryClient = useQueryClient();

  const [view, setView] = useState('week');
  const [cursorDate, setCursorDate] = useState(new Date());
  const [selectedDoctorId, setSelectedDoctorId] = useState('all');
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(1);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [presetDate, setPresetDate] = useState(null);
  const [presetTime, setPresetTime] = useState(null);
  const [dialogClinicId, setDialogClinicId] = useState(null);
  const [detailAppt, setDetailAppt] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const isSuperAdmin = roleIsSuperAdmin(effectiveRole);
  const doctorView = roleIsDoctor(effectiveRole);

  // Date range for fetching based on current view
  const dateRange = useMemo(() => {
    if (view === 'day') {
      return { from: format(cursorDate, 'yyyy-MM-dd'), to: format(cursorDate, 'yyyy-MM-dd') };
    }
    if (view === 'week' || view === 'agenda') {
      const start = startOfWeek(cursorDate, { weekStartsOn: 6 });
      const end = addDays(start, 6);
      return { from: format(start, 'yyyy-MM-dd'), to: format(end, 'yyyy-MM-dd') };
    }
    // month — fetch the full 6-week matrix (Sat start) so edge days always load
    const monthStart = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
    const matrixStart = startOfWeek(monthStart, { weekStartsOn: 6 });
    const matrixEnd = addDays(matrixStart, 41);
    return { from: format(matrixStart, 'yyyy-MM-dd'), to: format(matrixEnd, 'yyyy-MM-dd') };
  }, [view, cursorDate]);

  // Fetch all clinics (super admin only)
  const { data: allClinics = [] } = useQuery({
    queryKey: ['allClinics'],
    queryFn: () => appClient.entities.Clinic.list('name'),
    enabled: isSuperAdmin,
  });

  // Clinics available as tabs: all 5 for super admin, own clinic for regular users
  const clinicsToShow = isSuperAdmin ? allClinics : (clinic ? [clinic] : []);

  // Default the selected clinic to the first available
  useEffect(() => {
    if (!selectedClinicId && clinicsToShow.length > 0) {
      setSelectedClinicId(clinicsToShow[0].id);
    }
  }, [selectedClinicId, clinicsToShow]);

  const activeClinicId = isSuperAdmin ? selectedClinicId : clinic?.id;

  // Reset doctor filter when switching clinics
  useEffect(() => {
    setSelectedDoctorId('all');
  }, [activeClinicId]);

  // Fetch doctors for the active clinic (for filter + colors)
  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors', activeClinicId],
    queryFn: () => activeClinicId ? clinicApi.filter('Doctor', { clinic_id: activeClinicId }, 'name', 200, activeClinicId) : [],
    enabled: !!activeClinicId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', activeClinicId, selectedRoom, selectedDoctorId, dateRange.from, dateRange.to],
    queryFn: () => {
      const filter = { date: { $gte: dateRange.from, $lte: dateRange.to }, treatment_room: selectedRoom };
      if (selectedDoctorId !== 'all') filter.doctor_id = selectedDoctorId;
      return clinicApi.filter('Appointment', filter, 'start_time', 200, activeClinicId);
    },
    enabled: isSuperAdmin || !!clinic,
    // Shared clinic data: auto-refresh so changes by other clinic users appear
    // without manual refresh. True WebSocket subscriptions require RLS read
    // access for clinic roles, which would bypass server-side role enforcement.
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Doctor filter is now applied server-side
  const visibleAppointments = appointments;

  const clinicMap = useMemo(() => {
    const list = isSuperAdmin ? allClinics : clinicsToShow;
    return Object.fromEntries((list || []).map(c => [c.id, c.name]));
  }, [isSuperAdmin, allClinics, clinicsToShow]);

  const handleDelete = (appt) => {
    setDetailOpen(false);
    deleteWithUndo('Appointment', appt, 'Appointment', () =>
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    , activeClinicId);
  };

  const openCreate = (date, time) => {
    setEditing(null);
    setPresetDate(date || format(cursorDate, 'yyyy-MM-dd'));
    setPresetTime(time || null);
    setDialogClinicId(isSuperAdmin ? (selectedClinicId || clinic?.id || '') : null);
    setOpen(true);
  };

  const openEdit = (appt) => {
    setDetailOpen(false);
    setEditing(appt);
    setPresetDate(null);
    setPresetTime(null);
    setDialogClinicId(isSuperAdmin ? (appt.clinic_id || null) : null);
    setOpen(true);
  };

  const handleAppointmentClick = (appt) => {
    setDetailAppt(appt);
    setDetailOpen(true);
  };

  const handleSlotClick = (date, time) => {
    if (doctorView) return;
    openCreate(date, time);
  };

  const handleSearchResultClick = (a) => {
    setDetailAppt(a);
    setDetailOpen(true);
  };

  const handleDayClick = (date) => {
    setView('day');
    setCursorDate(new Date(date));
  };

  return (
    <div>
      <PageHeader
        title={t('appointments')}
        actionLabel={!doctorView ? t('add_appointment') : undefined}
        onAction={!doctorView ? () => openCreate() : undefined}
      />

      <AppointmentSearch
        clinicMap={clinicMap}
        onResultClick={handleSearchResultClick}
      />

      <TreatmentRoomSelector
        selectedRoom={selectedRoom}
        onChange={setSelectedRoom}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DoctorFilter
          doctors={doctors}
          selectedDoctorId={selectedDoctorId}
          onChange={setSelectedDoctorId}
        />
      </div>

      <CalendarToolbar
        view={view}
        setView={setView}
        cursorDate={cursorDate}
        setCursorDate={setCursorDate}
        onAdd={() => openCreate()}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : visibleAppointments.length === 0 && view === 'day' ? (
        <EmptyState
          icon={Calendar}
          title={t('no_appointments_for_day')}
          actionLabel={t('add_appointment')}
          onAction={() => openCreate()}
        />
      ) : (
        <>
          {view === 'agenda' ? (
           <AgendaView
             appointments={visibleAppointments}
             cursorDate={cursorDate}
             onAppointmentClick={handleAppointmentClick}
           />
          ) : view === 'day' || view === 'week' ? (
           <DayWeekView
             view={view}
             cursorDate={cursorDate}
             appointments={visibleAppointments}
             doctors={doctors}
             onAppointmentClick={handleAppointmentClick}
             onSlotClick={handleSlotClick}
           />
          ) : (
           <MonthView
             cursorDate={cursorDate}
             appointments={visibleAppointments}
             doctors={doctors}
             onAppointmentClick={handleAppointmentClick}
             onDayClick={handleDayClick}
           />
          )}
        </>
      )}

      {/* Details modal */}
      <AppointmentDetailsModal
        appointment={detailAppt}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
        onDelete={handleDelete}
        canEdit={!doctorView}
      />

      <AppointmentFormDialog
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        editing={editing}
        presetDate={presetDate}
        presetTime={presetTime}
        overrideClinicId={dialogClinicId}
      />
    </div>
  );
}

// helper to add minutes to "HH:MM"
function addMinutes(time, mins) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}