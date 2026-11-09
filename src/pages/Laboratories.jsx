import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { useLanguage } from '@/lib/useLanguage';
import { getClinicId } from '@/lib/useClinicId';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ServerPagination from '@/components/shared/ServerPagination';
import { FlaskConical, Phone, Mail, Trash2, Pencil, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { getStatusLabel } from '@/lib/statusLabels';
import { useAuth } from '@/lib/AuthContext';
import { roleIsClinicAdmin, canRole } from '@/lib/permissions';

const EMPTY_FORM = { name: '', contact_person: '', phone: '', whatsapp: '', email: '', address: '', notes: '', status: 'active' };

export default function Laboratories() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const canManage = canRole(effectiveRole, 'laboratories:write');
  const canDelete = roleIsClinicAdmin(effectiveRole);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); setDebouncedSearch(search); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['paginatedLabs', clinic?.id, page, pageSize, debouncedSearch],
    queryFn: async () => {
      if (!clinic) return { records: [], has_more: false };
      const res = await appClient.functions.invoke('getPaginatedRecords', {
        entity: 'laboratories',
        page, page_size: pageSize,
        search: debouncedSearch || undefined,
        clinic_id: clinic?.id,
      });
      return res.data;
    },
    enabled: !!clinic,
    keepPreviousData: true,
  });

  const labs = data?.records || [];

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const clinic_id = await getClinicId(clinic);
      if (editing) return clinicApi.update('Laboratory', editing.id, data);
      return clinicApi.create('Laboratory', { ...data, clinic_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paginatedLabs'] });
      toast.success(editing ? t('updated_success') : t('created_success'));
      setOpen(false);
    },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + (e?.message || '')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => clinicApi.delete('Laboratory', id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['paginatedLabs'] }); toast.success(t('deleted_success')); },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + (e?.message || '')),
  });

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setOpen(true); };
  const openEdit = (lab) => { setEditing(lab); setForm({ name: lab.name || '', contact_person: lab.contact_person || '', phone: lab.phone || '', whatsapp: lab.whatsapp || '', email: lab.email || '', address: lab.address || '', notes: lab.notes || '', status: lab.status || 'active' }); setOpen(true); };
  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error(t('name_required'));
    saveMutation.mutate(form);
  };

  return (
    <div>
      <PageHeader title={t('laboratories')} actionLabel={canManage ? t('add_laboratory') : undefined} onAction={canManage ? openCreate : undefined} />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} className="pl-10 rtl:pl-4 rtl:pr-10" />
        </div>
      </div>

      {!isLoading && labs.length === 0 ? (
        <EmptyState icon={FlaskConical} title={t('no_labs_found')} actionLabel={canManage ? t('add_laboratory') : undefined} onAction={canManage ? openCreate : undefined} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {labs.map((lab, i) => (
              <motion.div key={lab.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }} className="glass rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">{lab.name}</p>
                    {lab.contact_person && <p className="text-xs text-muted-foreground">{lab.contact_person}</p>}
                  </div>
                  <Badge variant={lab.status === 'active' ? 'default' : 'secondary'}>{getStatusLabel(lab.status, lang)}</Badge>
                </div>
                {lab.phone && <p className="text-xs flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" />{lab.phone}</p>}
                {lab.email && <p className="text-xs flex items-center gap-1 text-muted-foreground mt-0.5"><Mail className="w-3 h-3" />{lab.email}</p>}
                <div className="flex gap-1 mt-3 flex-wrap">
                  {lab.whatsapp && (
                    <a
                      href={`https://wa.me/${lab.whatsapp.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800/30 transition-colors"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.89-11.893A11.821 11.821 0 0020.485 3.488"/></svg>
                      {t('whatsapp')}
                      </a>
                      )}
                      {canManage && <Button size="sm" variant="outline" onClick={() => openEdit(lab)}><Pencil className="w-3.5 h-3.5 mr-1" />{t('edit')}</Button>}
                  {canDelete && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(lab.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                </div>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? t('edit') + ' ' + t('laboratory') : t('add_laboratory')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>{t('name')} *</Label><Input value={form.name} onChange={set('name')} placeholder={t('lab_name')} /></div>
            <div className="space-y-1.5"><Label>{t('contact_person')}</Label><Input value={form.contact_person} onChange={set('contact_person')} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>{t('phone')}</Label><Input value={form.phone} onChange={set('phone')} /></div>
              <div className="space-y-1.5"><Label>{t('whatsapp')}</Label><Input value={form.whatsapp} onChange={set('whatsapp')} /></div>
            </div>
            <div className="space-y-1.5"><Label>{t('email_address')}</Label><Input type="email" value={form.email} onChange={set('email')} /></div>
            <div className="space-y-1.5"><Label>{t('address')}</Label><Input value={form.address} onChange={set('address')} /></div>
            <div className="space-y-1.5"><Label>{t('status')}</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['active','inactive'].map(s => <SelectItem key={s} value={s}>{getStatusLabel(s, lang)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('notes')}</Label><Textarea value={form.notes} onChange={set('notes')} rows={2} /></div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSubmit} disabled={saveMutation.isPending} className="gradient-primary text-white">{saveMutation.isPending ? '...' : t('save')}</Button>
              <Button variant="outline" onClick={() => setOpen(false)}>{t('cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}