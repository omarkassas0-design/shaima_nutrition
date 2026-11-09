import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserRound, Stethoscope, CalendarDays, Search, Loader2 } from 'lucide-react';

/**
 * Global search page — uses server-side search via backend functions.
 * Never downloads full collections to the browser.
 * Each entity type is searched server-side with a small page size.
 */
export default function SearchPage() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q') || '';

  // Debounce not needed here — query comes from URL
  const search = query.trim();

  // Server-side patient search
  const { data: patientData, isLoading: loadingPatients } = useQuery({
    queryKey: ['searchPatients', clinic?.id, search, 0],
    queryFn: async () => {
      if (!clinic || !search) return { patients: [] };
      const res = await appClient.functions.invoke('searchPatients', { search, page: 0, page_size: 10 });
      return res.data;
    },
    enabled: !!clinic && !!search,
  });

  // Server-side doctor search
  const { data: doctorData, isLoading: loadingDoctors } = useQuery({
    queryKey: ['searchDoctors', clinic?.id, search, 0],
    queryFn: async () => {
      if (!clinic || !search) return { records: [] };
      const res = await appClient.functions.invoke('getPaginatedRecords', {
        entity: 'doctors', search, page: 0, page_size: 10,
      });
      return res.data;
    },
    enabled: !!clinic && !!search,
  });

  // Server-side treatment search
  const { data: treatmentData, isLoading: loadingTreatments } = useQuery({
    queryKey: ['searchTreatments', clinic?.id, search, 0],
    queryFn: async () => {
      if (!clinic || !search) return { records: [] };
      const res = await appClient.functions.invoke('getPaginatedRecords', {
        entity: 'patient_treatments', search, page: 0, page_size: 10,
      });
      return res.data;
    },
    enabled: !!clinic && !!search,
  });

  // Server-side appointment search
  const { data: apptData, isLoading: loadingAppts } = useQuery({
    queryKey: ['searchAppointments', clinic?.id, search, 0],
    queryFn: async () => {
      if (!clinic || !search) return { records: [] };
      const res = await appClient.functions.invoke('getPaginatedRecords', {
        entity: 'appointments', search, page: 0, page_size: 10,
      });
      return res.data;
    },
    enabled: !!clinic && !!search,
  });

  const patients = patientData?.patients || [];
  const doctors = doctorData?.records || [];
  const treatments = treatmentData?.records || [];
  const appointments = apptData?.records || [];

  const totalResults = patients.length + doctors.length + treatments.length + appointments.length;
  const isLoading = loadingPatients || loadingDoctors || loadingTreatments || loadingAppts;

  return (
    <div>
      <PageHeader title={`${t('search')}: "${query}"`} subtitle={isLoading ? t('searching') : t('results_count').replace('{n}', totalResults)} showBack />

      <div className="space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && patients.length > 0 && (
          <Section icon={Users} title={t('patients')} items={patients.map(p => ({
            id: p.id, title: p.full_name, subtitle: p.phone, onClick: () => navigate(`/patients/${p.id}`)
          }))} />
        )}
        {!isLoading && doctors.length > 0 && (
          <Section icon={UserRound} title={t('doctors')} items={doctors.map(d => ({
            id: d.id, title: d.name, subtitle: d.specialty, onClick: () => navigate('/doctors')
          }))} />
        )}
        {!isLoading && treatments.length > 0 && (
          <Section icon={Stethoscope} title={t('treatments')} items={treatments.map(tr => ({
            id: tr.id, title: tr.treatment_name, subtitle: `${tr.price || 0} ${tr.currency || ''}`, onClick: () => navigate('/treatments')
          }))} />
        )}
        {!isLoading && appointments.length > 0 && (
          <Section icon={CalendarDays} title={t('appointments')} items={appointments.map(a => ({
            id: a.id, title: `${a.patient_name} - ${a.doctor_name}`, subtitle: `${formatDisplayDate(a.date, lang)} · ${a.start_time}`, onClick: () => navigate('/appointments')
          }))} />
        )}
        {!isLoading && totalResults === 0 && (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('no_data')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, items }) {
  return (
    <div>
      <h3 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4" />{title} ({items.length})
      </h3>
      <div className="space-y-1">
        {items.map(item => (
          <Card key={item.id} className="glass border-0 cursor-pointer hover:shadow-md transition-all" onClick={item.onClick}>
            <CardContent className="p-3">
              <p className="font-medium text-sm">{item.title}</p>
              {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}