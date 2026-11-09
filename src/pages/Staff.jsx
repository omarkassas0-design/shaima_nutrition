import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ServerPagination from '@/components/shared/ServerPagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Users, Pencil, Trash2, Loader2, Phone, Mail, Search, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { deleteWithUndo } from '@/lib/undoDelete';
import { useLanguage } from '@/lib/useLanguage';
import { getStatusLabel } from '@/lib/statusLabels';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  on_leave: 'bg-yellow-100 text-yellow-700',
  suspended: 'bg-red-100 text-red-700',
  resigned: 'bg-gray-100 text-gray-700',
};

export default function Staff() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterPosition, setFilterPosition] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); setDebouncedSearch(search); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = filterPosition !== 'all' ? { position: filterPosition } : {};

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['paginatedStaff', clinic?.id, page, pageSize, debouncedSearch, filterPosition],
    queryFn: async () => {
      if (!clinic) return { records: [], has_more: false };
      const res = await appClient.functions.invoke('getPaginatedRecords', {
        entity: 'staff',
        page, page_size: pageSize,
        search: debouncedSearch || undefined,
        filters,
        clinic_id: clinic?.id,
      });
      return res.data;
    },
    enabled: !!clinic,
    keepPreviousData: true,
  });

  const staff = data?.records || [];

  const handleDelete = (s) => deleteWithUndo('Staff', s, 'Staff member', () =>
    queryClient.invalidateQueries({ queryKey: ['paginatedStaff'] })
  );

  return (
    <div>
      <PageHeader
        title={t('staff_management')}
        actionLabel={t('add_staff')}
        onAction={() => { setEditing(null); setShowForm(true); }}
      />

      <div className="mb-4 flex gap-2 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} className="pl-10 rtl:pl-4 rtl:pr-10" />
        </div>
        <Select value={filterPosition} onValueChange={(v) => { setFilterPosition(v); setPage(0); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            {['nurse','receptionist','accountant','cleaner','assistant','technician','call_center','other'].map(p => <SelectItem key={p} value={p}>{getStatusLabel(p, lang)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {staff.length === 0 && !isLoading ? (
        <EmptyState icon={Users} title={t('no_staff_found')} actionLabel={t('add_staff')} onAction={() => setShowForm(true)} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                <Card className="glass border-0 shadow-lg hover:shadow-xl transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{s.full_name}</p>
                          <Badge className={STATUS_COLORS[s.status]}>{getStatusLabel(s.status, lang)}</Badge>
                        </div>
                        <Badge variant="outline" className="text-xs">{getStatusLabel(s.position, lang)}</Badge>
                        {s.employee_id && <p className="text-xs text-muted-foreground">ID: {s.employee_id}</p>}
                        {s.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</p>}
                        {s.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => { setEditing(s); setShowForm(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => handleDelete(s)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
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

      <StaffFormDialog open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} editing={editing} clinic={clinic} />
    </div>
  );
}

function StaffFormDialog({ open, onClose, editing, clinic }) {
  const { t, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    full_name: '', employee_id: '', phone: '', email: '', address: '', national_id: '',
    position: 'receptionist', department: '', hire_date: new Date().toISOString().split('T')[0],
    status: 'active', notes: '', salary: '', salary_currency: 'USD',
  });
  const [linkMode, setLinkMode] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    setForm(editing ? { ...editing, salary: editing.salary?.toString() || '' } : {
      full_name: '', employee_id: '', phone: '', email: '', address: '', national_id: '',
      position: 'receptionist', department: '', hire_date: new Date().toISOString().split('T')[0],
      status: 'active', notes: '', salary: '', salary_currency: 'USD',
    });
    setLinkMode(null);
    setSelectedUser(null);
    setUserSearch('');
  }, [editing, open]);

  const { data: eligibleUsers = [], isLoading: loadingEligible } = useQuery({
    queryKey: ['eligibleReceptionists', clinic?.id],
    queryFn: async () => {
      const res = await appClient.functions.invoke('linkExistingReceptionist', { action: 'list' });
      return res.data?.eligible || [];
    },
    enabled: linkMode === 'existing' && !!clinic?.id && open,
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error('Select a user');
      const res = await appClient.functions.invoke('linkExistingReceptionist', {
        action: 'link',
        user_id: selectedUser.user_id,
        staff_data: { full_name: form.full_name, phone: form.phone, email: form.email, department: form.department, notes: form.notes },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paginatedStaff'] });
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      toast.success(t('created_success'));
      onClose();
    },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + (e?.message || '')),
  });

  const filteredEligible = (eligibleUsers || []).filter(u =>
    !userSearch || u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const showLinkMode = !editing && form.position === 'receptionist';
  const isLinkExisting = linkMode === 'existing' && showLinkMode;

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (!data.full_name?.trim()) throw new Error('Name is required');
      const clinicId = clinic?.id;
      if (!clinicId) throw new Error('No clinic');
      const payload = { ...data, salary: data.salary ? Number(data.salary) : undefined };
      if (editing) return clinicApi.update('Staff', editing.id, payload);
      return clinicApi.create('Staff', { ...payload, clinic_id: clinicId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paginatedStaff'] });
      toast.success(editing ? t('updated_success') : t('created_success'));
      onClose();
    },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? t('edit_staff') : t('add_staff')}</DialogTitle></DialogHeader>
        {showLinkMode && (
          <div className="flex gap-2 mb-4 p-1 rounded-lg bg-muted/50">
            <button type="button" onClick={() => setLinkMode(null)} className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${linkMode === null ? 'gradient-primary text-white' : 'hover:bg-accent'}`}>{t('new_receptionist')}</button>
            <button type="button" onClick={() => setLinkMode('existing')} className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${linkMode === 'existing' ? 'gradient-primary text-white' : 'hover:bg-accent'}`}>{t('select_existing_receptionist')}</button>
          </div>
        )}

        {isLinkExisting && (
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
              <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder={t('search')} className="pl-10 rtl:pl-4 rtl:pr-10" />
            </div>
            {loadingEligible ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
            ) : filteredEligible.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">{t('no_eligible_receptionists')}</div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredEligible.map(u => (
                  <button key={u.user_id} type="button" onClick={() => { setSelectedUser(u); setForm(f => ({ ...f, full_name: u.full_name, email: u.email })); }} className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${selectedUser?.user_id === u.user_id ? 'border-primary bg-primary/5' : 'border-input hover:bg-accent'}`}>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{u.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    {selectedUser?.user_id === u.user_id && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
              <Button onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending || !selectedUser} className="gradient-primary text-white">
                {linkMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('link_receptionist')}
              </Button>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-2 gap-4 ${isLinkExisting ? 'hidden' : ''}`}>
          <div className="space-y-2 col-span-2">
            <Label>{t('full_name')} *</Label>
            <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t('employee_id')}</Label>
            <Input value={form.employee_id || ''} onChange={e => setForm({ ...form, employee_id: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t('national_id')}</Label>
            <Input value={form.national_id || ''} onChange={e => setForm({ ...form, national_id: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t('phone')}</Label>
            <Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t('email_address')}</Label>
            <Input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>{t('address')}</Label>
            <Input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t('position')} *</Label>
            <Select value={form.position} onValueChange={v => setForm({ ...form, position: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['nurse','receptionist','accountant','cleaner','assistant','technician','call_center','other'].map(p => <SelectItem key={p} value={p}>{getStatusLabel(p, lang)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('department')}</Label>
            <Input value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t('hire_date')}</Label>
            <Input type="date" value={form.hire_date || ''} onChange={e => setForm({ ...form, hire_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>{t('status')}</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['active','on_leave','suspended','resigned'].map(s => <SelectItem key={s} value={s}>{getStatusLabel(s, lang)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>{t('notes')}</Label>
            <Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>{t('salary')}</Label>
            <Input type="number" min={0} value={form.salary || ''} onChange={e => setForm({ ...form, salary: e.target.value })} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label>{t('salary_currency')}</Label>
            <Select value={form.salary_currency} onValueChange={v => setForm({ ...form, salary_currency: v })}>
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
        <div className={`flex gap-3 justify-end pt-2 ${isLinkExisting ? 'hidden' : ''}`}>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.full_name?.trim()} className="gradient-primary text-white">
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}