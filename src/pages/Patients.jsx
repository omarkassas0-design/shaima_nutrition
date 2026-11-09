import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ServerPagination from '@/components/shared/ServerPagination';
import { Users, Phone, Search, Loader2, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import PatientExportBar from '@/components/patients/PatientExportBar';
import { downloadPatientsPDF, exportPatientsExcel } from '@/lib/patientExport';
import { useAuth } from '@/lib/AuthContext';
import { canRole, roleIsClinicAdmin } from '@/lib/permissions';

export default function Patients() {
  const { t, isRTL, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const canAddPatient = canRole(effectiveRole, 'patients:write');
  const canExportPatients = roleIsClinicAdmin(effectiveRole);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return formatDisplayDate(dateStr, lang);
  };
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Server-side paginated search using the searchPatients backend function
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['searchPatients', clinic?.id, page, pageSize, debouncedSearch, dateFrom, dateTo],
    queryFn: async () => {
      if (!clinic) return { patients: [], has_more: false };
      const res = await appClient.functions.invoke('searchPatients', {
        search: debouncedSearch || undefined,
        page,
        page_size: pageSize,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        clinic_id: clinic?.id,
      });
      return res.data;
    },
    enabled: !!clinic,
    keepPreviousData: true,
    // Shared clinic data: auto-refresh so new patients added by other clinic
    // users appear without manual refresh.
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const patients = data?.patients || [];
  const hasMore = data?.has_more || false;
  const Arrow = isRTL ? '←' : '→';

  const togglePatient = (id) => setSelectedIds(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const handleExport = async (format) => {
    if (!selectAll && selectedIds.size === 0) {
      toast.error(t('select_patient_first'));
      return;
    }
    setIsExporting(true);
    try {
      const res = await appClient.functions.invoke('getPatientsForExport', {
        patient_ids: selectAll ? null : Array.from(selectedIds),
        all: selectAll,
        clinic_id: clinic?.id,
      });
      const exportData = res.data || res;
      if (!exportData.patients || exportData.patients.length === 0) {
        toast.error(t('no_patients_to_export'));
        return;
      }
      if (format === 'pdf') {
        downloadPatientsPDF(exportData, clinic, lang);
      } else {
        await exportPatientsExcel(exportData, clinic, lang);
      }
      toast.success(t('exported_n_patients').replace('{n}', exportData.patients.length).replace('{format}', format.toUpperCase()));
    } catch (e) {
      toast.error(t('export_failed') + ': ' + (e?.message || ''));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('patients')}
        subtitle={isFetching && !isLoading ? t('loading') : undefined}
        actionLabel={canAddPatient ? t('add_patient') : undefined}
        onAction={canAddPatient ? () => navigate('/patients/add') : undefined}
      />

      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search') + ' — ' + t('search_name_phone')}
            className="pl-10 rtl:pl-4 rtl:pr-10"
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground rtl:right-auto rtl:left-3" />
          )}
        </div>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="max-w-xs" />
        <span className="text-muted-foreground text-sm">{t('to')}</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="max-w-xs" />
      </div>

      {canExportPatients && (
        <PatientExportBar
          selectAll={selectAll}
          onSelectAllChange={setSelectAll}
          selectedCount={selectedIds.size}
          onExport={handleExport}
          isExporting={isExporting}
        />
      )}

      {patients.length === 0 && !isLoading ? (
        <EmptyState
          icon={Users}
          title={search ? t('no_patients_found') : t('no_patients')}
          actionLabel={!search && canAddPatient ? t('add_patient') : undefined}
          onAction={!search && canAddPatient ? () => navigate('/patients/add') : undefined}
        />
      ) : (
        <>
          <div className="space-y-1.5">
            {/* Desktop column header — keeps every field aligned down the list */}
            <div className="hidden sm:grid sm:grid-cols-[auto_2.5rem_minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_6.5rem_1rem] items-center gap-3 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="w-4" />
              <span />
              <span>{t('name')}</span>
              <span>{t('phone')}</span>
              <span>{t('gender')}</span>
              <span>{t('date')}</span>
              <span />
            </div>
            {patients.map((patient, i) => (
              <motion.div
                key={patient.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => navigate(`/patients/${patient.id}`)}
                className="glass rounded-xl px-2.5 py-2 sm:px-4 cursor-pointer hover:shadow-md hover:bg-secondary/20 transition-all group"
              >
                <div className="flex items-center gap-3 sm:grid sm:grid-cols-[auto_2.5rem_minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_6.5rem_1rem] sm:items-center sm:gap-3">
                  {canExportPatients ? (
                    <Checkbox
                      checked={selectedIds.has(patient.id)}
                      onCheckedChange={() => togglePatient(patient.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0"
                    />
                  ) : <span className="hidden sm:block w-4" />}
                  <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {patient.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate leading-tight">{patient.full_name}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate sm:hidden" dir="ltr">
                      {patient.phone ? (<><Phone className="w-3 h-3 shrink-0" />{patient.phone}</>) : '—'}
                      {patient.gender && <Badge variant="outline" className="text-[10px] py-0 px-1.5 ms-1">{t(patient.gender)}</Badge>}
                      <span className="ms-auto flex items-center gap-1 shrink-0"><Calendar className="w-3 h-3" />{formatDate(patient.created_date)}</span>
                    </p>
                  </div>
                  <span className="hidden sm:flex text-xs text-muted-foreground items-center gap-1 truncate" dir="ltr">
                    {patient.phone ? (<><Phone className="w-3 h-3 shrink-0" />{patient.phone}</>) : '—'}
                  </span>
                  <span className="hidden sm:block">
                    {patient.gender && <Badge variant="outline" className="text-[10px] py-0 px-1.5">{t(patient.gender)}</Badge>}
                  </span>
                  <span className="hidden sm:flex text-xs text-muted-foreground items-center gap-1 whitespace-nowrap">
                    <Calendar className="w-3 h-3" />{formatDate(patient.created_date)}
                  </span>
                  <span className="text-muted-foreground group-hover:text-primary transition-colors shrink-0">{Arrow}</span>
                </div>
              </motion.div>
            ))}
          </div>

          <ServerPagination
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={(s) => { setPageSize(s); setPage(0); }}
            nextPage={() => hasMore && setPage(p => p + 1)}
            prevPage={() => setPage(p => Math.max(0, p - 1))}
            hasMore={hasMore}
            hasPrev={page > 0}
            isLoading={isFetching}
          />
        </>
      )}
    </div>
  );
}