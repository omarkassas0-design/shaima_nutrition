import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';
import { roleIsClinicAdmin } from '@/lib/permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Database, Download, RotateCcw, Loader2, AlertTriangle, CheckCircle2, XCircle, FileText, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/useLanguage';
import { getStatusLabel } from '@/lib/statusLabels';
import { formatDisplayDateTime } from '@/lib/dateFormat';
import { formatNumber } from '@/lib/currencyUtils';

/**
 * Backup management panel for clinic administrators.
 * Shows backup history, allows manual backup creation, and provides restore functionality.
 * Only visible to clinic_admin, admin, and super_admin roles.
 * Only shows the current clinic's backups — never another clinic's.
 */
export default function BackupManagement() {
  const { t, lang } = useLanguage();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [restoreDialog, setRestoreDialog] = useState(null);
  const [restoreStep, setRestoreStep] = useState('idle'); // idle, preview, confirming, restoring
  const [restorePreview, setRestorePreview] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [batchProgress, setBatchProgress] = useState(null); // { backup_id, total, successful, failed, skipped, remaining }

  const canManage = roleIsClinicAdmin(effectiveRole);

  const { data: backupData, isLoading } = useQuery({
    queryKey: ['backupHistory', page],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getBackupHistory', { page, page_size: 20 });
      return res.data;
    },
    enabled: canManage,
  });

  const processBatchMutation = useMutation({
    mutationFn: (backupId) => appClient.functions.invoke('processPatientFileBatch', { backup_id: backupId }),
  });

  const createBackupMutation = useMutation({
    mutationFn: () => appClient.functions.invoke('createClinicBackup', {}),
    onSuccess: async (res) => {
      const data = res.data;
      queryClient.invalidateQueries({ queryKey: ['backupHistory'] });

      // If patient file batches are needed, poll until all files are processed
      if (data.needs_more_batches) {
        setBatchProgress({
          backup_id: data.backup_id,
          total: data.patient_file_total,
          successful: data.patient_file_successful,
          failed: data.patient_file_failed,
          skipped: data.patient_file_skipped,
          remaining: data.patient_file_remaining,
        });

        // Process remaining batches sequentially
        let current = data;
        let safetyCounter = 0;
        const maxIterations = 200; // Safety valve

        while (current.needs_more_batches && safetyCounter < maxIterations) {
          safetyCounter++;
          try {
            const batchRes = await processBatchMutation.mutateAsync(data.backup_id);
            current = batchRes.data;
            setBatchProgress({
              backup_id: data.backup_id,
              total: current.patient_file_total,
              successful: current.patient_file_successful,
              failed: current.patient_file_failed,
              skipped: current.patient_file_skipped,
              remaining: current.patient_file_remaining,
            });
          } catch (e) {
            toast.error(t('backup_failed') + ': ' + (e?.message || ''));
            break;
          }
        }

        setBatchProgress(null);
        queryClient.invalidateQueries({ queryKey: ['backupHistory'] });

        if (current.status === 'completed') {
          toast.success(t('backup_created_success'));
        } else if (current.status === 'failed') {
          toast.error(t('backup_failed') + ': ' + (current.error || 'Patient file backup failed'));
        }
      } else {
        // All files processed in the first batch (or no files to process)
        if (data.status === 'completed') {
          toast.success(t('backup_created_success'));
        } else {
          toast.error(t('backup_failed') + ': ' + (data.error || ''));
        }
      }
    },
    onError: (e) => toast.error(t('backup_failed') + ': ' + (e?.message || '')),
  });

  const previewRestoreMutation = useMutation({
    mutationFn: (backupId) => appClient.functions.invoke('restoreClinicBackup', {
      backup_id: backupId,
      action: 'preview',
    }),
    onSuccess: (res) => {
      setRestorePreview(res.data);
      setRestoreStep('preview');
    },
    onError: (e) => toast.error(t('preview_failed_msg') + ': ' + (e?.message || '')),
  });

  const executeRestoreMutation = useMutation({
    mutationFn: (data) => appClient.functions.invoke('restoreClinicBackup', data),
    onSuccess: (res) => {
      setRestoreStep('done');
      queryClient.invalidateQueries({ queryKey: ['backupHistory'] });
      queryClient.invalidateQueries();
      toast.success(t('restore_completed_safety'));
    },
    onError: (e) => {
      setRestoreStep('error');
      toast.error(t('restore_failed_error') + ': ' + (e?.message || ''));
    },
  });

  if (!canManage) return null;

  const backups = backupData?.backups || [];

  const handleRestoreClick = (backup) => {
    setRestoreDialog(backup);
    setRestoreStep('idle');
    setRestorePreview(null);
    setConfirmText('');
  };

  const handlePreview = () => {
    if (restoreDialog) {
      previewRestoreMutation.mutate(restoreDialog.id);
    }
  };

  const handleConfirmRestore = () => {
    if (confirmText !== 'RESTORE') {
      toast.error(t('type_restore_caps'));
      return;
    }
    setRestoreStep('restoring');
    executeRestoreMutation.mutate({
      backup_id: restoreDialog.id,
      action: 'restore',
      confirm_token: restorePreview?.confirm_token,
    });
  };

  const closeRestoreDialog = () => {
    setRestoreDialog(null);
    setRestoreStep('idle');
    setRestorePreview(null);
    setConfirmText('');
  };

  return (
    <Card className="glass border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          {t('backup_restore')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t('automatic_backups_desc')}
          </p>
          <Button
            size="sm"
            onClick={() => createBackupMutation.mutate()}
            disabled={createBackupMutation.isPending}
            className="gradient-primary text-white"
          >
            {createBackupMutation.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{t('creating_dots')}</>
            ) : (
              <><Download className="w-3.5 h-3.5 mr-1.5" />{t('backup_now')}</>
            )}
          </Button>
        </div>

        {batchProgress && (
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <UploadCloud className="w-4 h-4 animate-pulse" />
              {t('backing_up_patient_files')}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('patient_files_progress')}</span>
                <span>{batchProgress.successful + batchProgress.skipped} / {batchProgress.total}</span>
              </div>
              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full gradient-primary transition-all duration-300"
                  style={{ width: `${batchProgress.total > 0 ? ((batchProgress.successful + batchProgress.skipped) / batchProgress.total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>{t('successful')}: {batchProgress.successful}</span>
                {batchProgress.skipped > 0 && <span>{t('skipped')}: {batchProgress.skipped}</span>}
                {batchProgress.failed > 0 && <span className="text-red-500">{t('failed')}: {batchProgress.failed}</span>}
                <span>{t('remaining')}: {batchProgress.remaining}</span>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-14 bg-secondary/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
            {t('no_backups_click')}
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {backups.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    b.status === 'completed' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  }`}>
                    {b.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-2">
                      <FileText className="w-3 h-3 flex-shrink-0" />
                      {b.file_name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="bidi-iso">{formatDisplayDateTime(b.created_date, lang)}</span>
                      {b.file_size > 0 && <span className="bidi-iso">· {formatNumber(b.file_size / 1024, lang, { maximumFractionDigits: 1 })} KB</span>}
                      <Badge variant="outline" className="text-xs py-0">
                        {getStatusLabel(b.backup_type, lang)}
                      </Badge>
                    </div>
                  </div>
                </div>
                {b.status === 'completed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestoreClick(b)}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    {t('restore')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {backupData?.has_more && (
          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" onClick={() => setPage(p => p + 1)}>
              {t('load_more')}
            </Button>
          </div>
        )}

        {/* Restore Dialog */}
        <Dialog open={!!restoreDialog} onOpenChange={closeRestoreDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                {t('restore_backup_title')}
              </DialogTitle>
            </DialogHeader>

            {restoreStep === 'idle' && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                    {t('restore_warning_replace')}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    {t('safety_backup_will_create')}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('about_to_restore')} <span className="font-medium text-foreground">{restoreDialog?.file_name}</span>
                </p>
                <DialogFooter>
                  <Button variant="outline" onClick={closeRestoreDialog}>{t('cancel')}</Button>
                  <Button
                    onClick={handlePreview}
                    disabled={previewRestoreMutation.isPending}
                    className="gradient-primary text-white"
                  >
                    {previewRestoreMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('loading_dots')}</>
                    ) : (
                      <>{t('preview_continue')}</>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}

            {restoreStep === 'preview' && restorePreview && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('backup_contents')}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(restorePreview.record_counts || {}).map(([key, count]) => (
                      <div key={key} className="flex justify-between p-2 rounded-lg bg-secondary/40">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                    {t('delete_all_warning')}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t('type_restore_confirm')}
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={e => setConfirmText(e.target.value)}
                    placeholder="RESTORE"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-transparent text-sm"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeRestoreDialog}>{t('cancel')}</Button>
                  <Button
                    variant="destructive"
                    onClick={handleConfirmRestore}
                    disabled={confirmText !== 'RESTORE' || executeRestoreMutation.isPending}
                  >
                    {executeRestoreMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('restoring_dots')}</>
                    ) : (
                      <>{t('restore_now')}</>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}

            {restoreStep === 'restoring' && (
              <div className="py-8 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <p className="text-sm font-medium">{t('restoring_backup')}</p>
                <p className="text-xs text-muted-foreground">{t('creating_safety_backup')}</p>
              </div>
            )}

            {restoreStep === 'done' && (
              <div className="py-6 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
                <p className="text-sm font-medium">{t('restore_completed_success')}</p>
                <p className="text-xs text-muted-foreground">{t('safety_backup_before_restore')}</p>
                <DialogFooter>
                  <Button onClick={closeRestoreDialog} className="gradient-primary text-white">{t('done_btn')}</Button>
                </DialogFooter>
              </div>
            )}

            {restoreStep === 'error' && (
              <div className="py-6 text-center space-y-3">
                <XCircle className="w-12 h-12 mx-auto text-red-500" />
                <p className="text-sm font-medium">{t('restore_failed_error')}</p>
                <p className="text-xs text-muted-foreground">{t('use_safety_backup')}</p>
                <DialogFooter>
                  <Button variant="outline" onClick={closeRestoreDialog}>{t('close')}</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}