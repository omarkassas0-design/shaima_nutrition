import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { useClinic } from '@/lib/useClinic';
import { getClinicId } from '@/lib/useClinicId';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ServerPagination from '@/components/shared/ServerPagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import NumberInput from '@/components/shared/NumberInput';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { roleIsClinicAdmin } from '@/lib/permissions';
import { UserRound, Phone, Pencil, Trash2, Loader2, Search, UserCheck, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { deleteWithUndo } from '@/lib/undoDelete';

const COLORS = ['#0ea5e9','#10b981','#8b5cf6','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16'];

export default function Doctors() {
  const { t } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = roleIsClinicAdmin(effectiveRole);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); setDebouncedSearch(search); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['paginatedDoctors', clinic?.id, page, pageSize, debouncedSearch],
    queryFn: async () => {
      if (!clinic) return { records: [], has_more: false };
      const res = await appClient.functions.invoke('getPaginatedRecords', {
        entity: 'doctors',
        page, page_size: pageSize,
        search: debouncedSearch || undefined,
        clinic_id: clinic?.id,
      });
      return res.data;
    },
    enabled: !!clinic?.id,
    keepPreviousData: true,
  });

  const doctors = data?.records || [];

  const handleDelete = (doc) => deleteWithUndo('Doctor', doc, 'Doctor', () =>
    queryClient.invalidateQueries({ queryKey: ['paginatedDoctors'] })
  );

  const openCreate = () => { setEditing(null); setShowForm(true); };

  return (
    <div>
      <PageHeader
        title={t('doctors')}
        actionLabel={canManage ? t('add_doctor') : undefined}
        onAction={canManage ? openCreate : undefined}
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} className="pl-10 rtl:pl-4 rtl:pr-10" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-secondary/40 animate-pulse" />)}
        </div>
      ) : doctors.length === 0 ? (
        <EmptyState icon={UserRound} title={t('no_data')} actionLabel={canManage ? t('add_doctor') : undefined} onAction={canManage ? () => setShowForm(true) : undefined} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {doctors.map((doc, i) => (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.05, 0.3) }}>
                <Card className="glass border-0 shadow-sm hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ backgroundColor: doc.calendar_color || COLORS[i % COLORS.length] }}>
                          {doc.name?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-tight truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground leading-tight truncate">{doc.specialty || '—'}</p>
                        </div>
                      </div>
                      {canManage && (
                      <div className="flex gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setEditing(doc); setShowForm(true); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive"
                          onClick={() => handleDelete(doc)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/50 space-y-1 text-[11px] text-muted-foreground">
                      {doc.phone && (
                        <p className="flex items-center gap-1" dir="ltr"><Phone className="w-3 h-3 shrink-0" />{doc.phone}</p>
                      )}
                      {doc.schedule && (
                        <p className="truncate">
                          {doc.schedule.start_hour} – {doc.schedule.end_hour}
                          {(doc.schedule.working_days || []).length > 0 && ` · ${doc.schedule.working_days.join(', ')}`}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <ServerPagination
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            setPageSize={(s) => { setPageSize(s); setPage(0); }}
            nextPage={() => data?.has_more && setPage(p => p + 1)}
            prevPage={() => setPage(p => Math.max(0, p - 1))}
            hasMore={data?.has_more || false}
            hasPrev={page > 0}
            isLoading={isFetching}
          />
        </>
      )}

      <DoctorFormDialog open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} editing={editing} clinic={clinic} />
    </div>
  );
}

function DoctorFormDialog({ open, onClose, editing, clinic }) {
  const { t } = useLanguage();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const canManageCompensation = ['super_admin', 'clinic_admin'].includes(effectiveRole);

  const defaultForm = {
    name: '', specialty: '', phone: '', calendar_color: COLORS[0],
    commission_percentage: 10, commission_percentage_doctor: 10, commission_percentage_clinic: 5,
    monthly_salary: '', salary_currency: 'USD',
    schedule: { working_days: ['mon','tue','wed','thu','fri'], start_hour: '09:00', end_hour: '17:00', break_start: '13:00', break_end: '14:00' },
  };

  const [form, setForm] = useState(defaultForm);
  const [mode, setMode] = useState('new'); // 'new' | 'existing'
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Fetch eligible doctor accounts (doctor CRA in this clinic, no Doctor profile yet).
  // Only fetched when creating (not editing) and the dialog is open.
  const { data: eligibleData, isLoading: eligibleLoading } = useQuery({
    queryKey: ['eligibleDoctors', clinic?.id],
    queryFn: async () => {
      const res = await appClient.functions.invoke('linkExistingDoctor', { action: 'list' });
      return res.data;
    },
    enabled: !!open && !editing && !!clinic?.id,
  });

  const eligible = eligibleData?.eligible || [];

  // Default to 'existing' mode (preferred) when eligible doctors exist.
  useEffect(() => {
    if (!open) {
      setSelectedUserId(null);
      setMode('new');
      return;
    }
    if (!editing && eligible.length > 0) {
      setMode('existing');
    } else {
      setMode('new');
    }
  }, [open, editing, eligible.length]);

  useEffect(() => {
    setForm(editing ? { ...defaultForm, ...editing } : defaultForm);
  }, [editing, open]);

  // When a user is selected, prefill the name from their account info.
  const handleSelectUser = (u) => {
    setSelectedUserId(u.user_id);
    setForm(f => ({ ...f, name: u.full_name || f.name }));
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Compensation fields are saved exclusively via the saveDoctorCompensation
      // backend function (clinic_admin only). Strip them from the main save so
      // non-clinic_admin users can never write commission or salary.
      const { commission_percentage, commission_percentage_doctor, commission_percentage_clinic, monthly_salary, salary_currency, ...doctorData } = data;

      // --- Edit existing doctor (unchanged flow) ---
      if (editing) {
        if (!data.name?.trim()) throw new Error('Name is required');
        const savedDoctor = await clinicApi.update('Doctor', editing.id, doctorData);
        if (canManageCompensation) {
          await appClient.functions.invoke('saveDoctorCompensation', {
            doctor_id: savedDoctor.id,
            commission_percentage: Number(commission_percentage) || 0,
            commission_percentage_doctor: Number(commission_percentage_doctor) || 0,
            commission_percentage_clinic: Number(commission_percentage_clinic) || 0,
            monthly_salary: Number(monthly_salary) || 0,
            salary_currency: salary_currency || 'USD',
          });
        }
        return savedDoctor;
      }

      // --- Link existing doctor account ---
      if (mode === 'existing') {
        if (!selectedUserId) throw new Error(t('select_doctor_account'));
        const res = await appClient.functions.invoke('linkExistingDoctor', {
          action: 'link',
          user_id: selectedUserId,
          doctor_data: {
            name: doctorData.name,
            specialty: doctorData.specialty,
            phone: doctorData.phone,
            calendar_color: doctorData.calendar_color,
            schedule: doctorData.schedule,
            commission_percentage_doctor: Number(commission_percentage_doctor) || 0,
            commission_percentage_clinic: Number(commission_percentage_clinic) || 0,
          },
        });
        return res.data.doctor;
      }

      // --- New doctor (unchanged flow) ---
      if (!data.name?.trim()) throw new Error('Name is required');
      const clinicId = await getClinicId(clinic);
      const savedDoctor = await clinicApi.create('Doctor', { ...doctorData, clinic_id: clinicId });
      if (canManageCompensation) {
        await appClient.functions.invoke('saveDoctorCompensation', {
          doctor_id: savedDoctor.id,
          commission_percentage: Number(commission_percentage) || 0,
          commission_percentage_doctor: Number(commission_percentage_doctor) || 0,
          commission_percentage_clinic: Number(commission_percentage_clinic) || 0,
          monthly_salary: Number(monthly_salary) || 0,
          salary_currency: salary_currency || 'USD',
        });
      }
      return savedDoctor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paginatedDoctors'] });
      queryClient.invalidateQueries({ queryKey: ['eligibleDoctors'] });
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      toast.success(editing ? t('updated_success') : t('created_success'));
      onClose();
    },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + (e.message || '')),
  });

  const days = ['sun','mon','tue','wed','thu','fri','sat'];
  const schedule = form.schedule || {};
  const toggleDay = (day) => {
    const wd = schedule.working_days || [];
    setForm({ ...form, schedule: { ...schedule, working_days: wd.includes(day) ? wd.filter(d => d !== day) : [...wd, day] } });
  };
  const setSchedule = (key, val) => setForm({ ...form, schedule: { ...schedule, [key]: val } });

  const isLinkMode = mode === 'existing' && !editing;
  const canSave = isLinkMode ? !!selectedUserId : !!form.name?.trim();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? t('edit') : t('add_doctor')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Mode toggle — only when creating */}
          {!editing && (
            <div className="flex gap-2 p-1 bg-secondary/60 rounded-lg">
              <button
                type="button"
                onClick={() => setMode('existing')}
                disabled={eligible.length === 0}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${isLinkMode ? 'gradient-primary text-white shadow' : 'text-muted-foreground'} disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <UserCheck className="w-4 h-4" />
                {t('select_existing_doctor')}
              </button>
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${!isLinkMode ? 'gradient-primary text-white shadow' : 'text-muted-foreground'}`}
              >
                <UserRound className="w-4 h-4" />
                {t('new_doctor')}
              </button>
            </div>
          )}

          {/* Eligible doctor accounts selector */}
          {isLinkMode && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">{t('select_doctor_account')}</Label>
              <p className="text-xs text-muted-foreground -mt-1">{t('eligible_doctors_hint')}</p>
              {eligibleLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : eligible.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  {t('no_eligible_doctors')}
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {eligible.map(u => (
                    <button
                      type="button"
                      key={u.user_id}
                      onClick={() => handleSelectUser(u)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${selectedUserId === u.user_id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-secondary/50'}`}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm gradient-primary">
                        {u.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{u.full_name || t('name')}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3" />{u.email}
                        </p>
                      </div>
                      {selectedUserId === u.user_id && <UserCheck className="w-5 h-5 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Doctor profile fields — shown in edit mode, new mode, or after selecting a user */}
          {(!isLinkMode || selectedUserId) && (
            <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>{t('name')} *</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder={t('doctor_name_placeholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('specialty')}</Label>
              <Input value={form.specialty || ''} onChange={e => setForm({...form, specialty: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>{t('phone')}</Label>
              <Input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} dir="ltr" />
            </div>
          </div>

          {canManageCompensation && (
            <div className="space-y-3 pt-3 border-t">
              <Label className="text-base font-semibold">{t('compensation')}</Label>
              <p className="text-xs text-muted-foreground -mt-2">{t('admin_only_compensation')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('commission_doctor_brings')} (%)</Label>
                  <NumberInput
                    min={0} max={100}
                    value={form.commission_percentage_doctor}
                    onChange={v => setForm({...form, commission_percentage_doctor: v})}
                    placeholder="0-100" dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">{t('commission_doctor_brings_hint')}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('commission_clinic_brings')} (%)</Label>
                  <NumberInput
                    min={0} max={100}
                    value={form.commission_percentage_clinic}
                    onChange={v => setForm({...form, commission_percentage_clinic: v})}
                    placeholder="0-100" dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">{t('commission_clinic_brings_hint')}</p>
                </div>
              </div>
              {!isLinkMode && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('monthly_salary')}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.monthly_salary}
                    onChange={e => setForm({...form, monthly_salary: e.target.value})}
                    placeholder="0"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('salary_currency')}</Label>
                  <Select value={form.salary_currency} onValueChange={v => setForm({...form, salary_currency: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="SYP">SYP</SelectItem>
                      <SelectItem value="TRY">TRY (₺)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('calendar_color')}</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button type="button" key={c} onClick={() => setForm({...form, calendar_color: c})}
                  className={`w-8 h-8 rounded-lg transition-all ${form.calendar_color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <Label className="text-base font-semibold">{t('schedule')}</Label>
            <div className="flex gap-1.5 flex-wrap">
              {days.map(day => (
                <button type="button" key={day} onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${(schedule.working_days || []).includes(day) ? 'gradient-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
                  {t(day)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">{t('start_hour')}</Label><Input type="time" value={schedule.start_hour || '09:00'} onChange={e => setSchedule('start_hour', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">{t('end_hour')}</Label><Input type="time" value={schedule.end_hour || '17:00'} onChange={e => setSchedule('end_hour', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">{t('break_start')}</Label><Input type="time" value={schedule.break_start || '13:00'} onChange={e => setSchedule('break_start', e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">{t('break_end')}</Label><Input type="time" value={schedule.break_end || '14:00'} onChange={e => setSchedule('break_end', e.target.value)} /></div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !canSave} className="gradient-primary text-white">
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{isLinkMode ? t('link_doctor') : t('save')}
            </Button>
          </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}