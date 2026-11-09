import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ServerPagination from '@/components/shared/ServerPagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { History, Trash2, RotateCcw, ShieldAlert, XCircle, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { roleIsClinicAdmin } from '@/lib/permissions';
import { useNavigate } from 'react-router-dom';
import AuditEntrySnapshotDialog from '@/components/audit/AuditEntrySnapshotDialog';



const ACTION_BADGE = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-rose-100 text-rose-700',
  restore: 'bg-amber-100 text-amber-700',
};

export default function AuditLog() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const canManageRecycleBin = roleIsClinicAdmin(effectiveRole);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState('audit');
  const [snapshotEntry, setSnapshotEntry] = useState(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); setDebouncedSearch(search); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset search + pagination when switching tabs
  useEffect(() => { setPage(0); setSearch(''); setDebouncedSearch(''); }, [tab]);

  const isRecycleTab = tab === 'recycle';
  const filters = isRecycleTab ? { action: 'delete', restored: false } : {};

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['auditLog', clinic?.id, page, pageSize, debouncedSearch, tab],
    queryFn: async () => {
      if (!clinic) return { records: [], has_more: false };
      const res = await appClient.functions.invoke('getPaginatedRecords', {
        entity: 'audit_logs',
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

  const entries = data?.records || [];

  const [restoringId, setRestoringId] = useState(null);
  const [permanentDeleteEntry, setPermanentDeleteEntry] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleEntryClick = (entry) => {
    // Patient create/update: navigate to the patient profile page — the only
    // entity with a true per-record detail route.
    if (entry.entity_name === 'Patient' && entry.action !== 'delete' && entry.record_id) {
      navigate(`/patients/${entry.record_id}`);
      return;
    }
    // Everything else (including all delete actions): open the details dialog.
    // - Delete actions: shows the stored record_snapshot immediately.
    // - Create/Update actions: fetches the LIVE record by record_id so the
    //   user sees the exact record the action was performed on.
    setSnapshotEntry(entry);
  };

  const handleRestore = async (entry) => {
    setRestoringId(entry.id);
    try {
      await clinicApi.restore(entry.entity_name, entry.id);
      toast.success(t('restore_success'));
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      queryClient.invalidateQueries();
    } catch (e) {
      toast.error(t('restore_failed') + ': ' + (e?.message || ''));
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteEntry) return;
    setDeletingId(permanentDeleteEntry.id);
    try {
      await clinicApi.permanentDelete(permanentDeleteEntry.id);
      toast.success(t('permanent_delete_success'));
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      setPermanentDeleteEntry(null);
    } catch (e) {
      toast.error(e?.message || 'Failed to permanently delete');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDateTime = (d) => {
    if (!d) return '—';
    let dateStr = String(d);
    // Legacy records store created_date as UTC without an explicit timezone
    // indicator (e.g. "2026-09-08T14:19:18.504000"). In non-UTC browsers, JS
    // Date parses such strings as LOCAL time, making timestamps appear hours
    // behind (e.g. 14:19 UTC shown as 14:19 in UTC+3 instead of 17:19).
    // Fix: if the string looks like an ISO datetime with no 'Z' or offset,
    // append 'Z' so JS Date treats it as UTC. toLocaleString then converts
    // to the browser's local timezone correctly.
    if (dateStr.includes('T') && !dateStr.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(dateStr)) {
      // Normalize 6-digit fractional seconds to 3 (milliseconds) for maximum
      // cross-browser compatibility before appending 'Z'.
      dateStr = dateStr.replace(/\.(\d{6})$/, (m, frac) => '.' + frac.slice(0, 3)) + 'Z';
    }
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return String(d);
    return formatDisplayDate(parsed, lang, { time: true });
  };

  return (
    <div>
      <PageHeader title={t('audit_log')} />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="glass border-0 h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="audit" className="text-xs sm:text-sm">
            <History className="w-4 h-4 mr-1.5" />
            {t('audit_log')}
          </TabsTrigger>
          <TabsTrigger value="recycle" className="text-xs sm:text-sm">
            <Trash2 className="w-4 h-4 mr-1.5" />
            {t('recycle_bin')}
          </TabsTrigger>
        </TabsList>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="pl-10 rtl:pl-4 rtl:pr-10"
          />
        </div>

        <TabsContent value="audit">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <EmptyState icon={ShieldAlert} title={t('no_audit_entries')} />
          ) : (
            <>
              <div className="space-y-2">
                {entries.map(entry => (
                  <Card
                    key={entry.id}
                    className="glass border-0 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleEntryClick(entry)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge className={`text-xs ${ACTION_BADGE[entry.action] || 'bg-secondary'}`}>
                            {entry.action}
                          </Badge>
                          <span className="text-sm font-medium">{entry.entity_name}</span>
                          <span className="text-xs text-muted-foreground truncate">{entry.summary}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-muted-foreground">{entry.user_name || '—'}</p>
                          <p className="text-[11px] text-muted-foreground">{formatDateTime(entry.created_date)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
        </TabsContent>

        <TabsContent value="recycle">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <EmptyState icon={Trash2} title={t('no_deleted_items')} />
          ) : (
            <>
              <div className="space-y-2">
                {entries.map(entry => (
                  <Card
                    key={entry.id}
                    className="glass border-0 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleEntryClick(entry)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Badge className="text-xs bg-rose-100 text-rose-700">{entry.entity_name}</Badge>
                            <span className="text-sm font-medium truncate">{entry.summary}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t('deleted_by')}: {entry.user_name || '—'} · {formatDateTime(entry.created_date)}
                          </p>
                        </div>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={restoringId === entry.id}
                            onClick={() => handleRestore(entry)}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            {restoringId === entry.id ? '...' : t('restore')}
                          </Button>
                          {canManageRecycleBin && (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deletingId === entry.id}
                              onClick={() => setPermanentDeleteEntry(entry)}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              {deletingId === entry.id ? '...' : t('permanent_delete')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!permanentDeleteEntry} onOpenChange={(open) => !open && setPermanentDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('permanent_delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirm_permanent_delete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('permanent_delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AuditEntrySnapshotDialog
        entry={snapshotEntry}
        open={!!snapshotEntry}
        onOpenChange={(open) => !open && setSnapshotEntry(null)}
      />
    </div>
  );
}
