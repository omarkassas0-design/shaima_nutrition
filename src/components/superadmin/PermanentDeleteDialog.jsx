import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Clock, Trash2, XCircle, CheckCircle2, Loader2, XOctagon } from 'lucide-react';
import { toast } from 'sonner';

export default function PermanentDeleteDialog({ clinic, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('checking'); // checking | confirm | countdown | success | cancelled | failed
  const [confirmText, setConfirmText] = useState('');
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [failReason, setFailReason] = useState('');
  const pollRef = useRef(null);
  const countdownRef = useRef(null);

  const clinicName = clinic?.name || 'this clinic';

  const stopIntervals = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const startCountdown = useCallback((pd) => {
    stopIntervals();
    setPendingDeletion(pd);
    setStep('countdown');

    // Local countdown timer (updates every second for smooth UI)
    const updateCountdown = () => {
      const expires = new Date(pd.expires_at).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((expires - now) / 1000));
      setRemainingSeconds(remaining);
    };
    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);

    // Poll server for status changes every 2 seconds
    // Detects: executed (deletion happened), cancelled, failed
    pollRef.current = setInterval(async () => {
      try {
        const res = await appClient.functions.invoke('checkPendingPermanentDeletion', { clinic_id: clinic.id });
        const data = res.data;
        if (data?.pending_deletion?.status === 'executed') {
          stopIntervals();
          setStep('success');
          queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
        } else if (data?.pending_deletion?.status === 'cancelled') {
          stopIntervals();
          setStep('cancelled');
        } else if (data?.pending_deletion?.status === 'failed') {
          stopIntervals();
          setFailReason(data.pending_deletion.failure_reason || 'Unknown error');
          setStep('failed');
          queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
        } else if (data?.pending_deletion?.status === 'pending') {
          if (data.remaining_seconds != null) {
            setRemainingSeconds(data.remaining_seconds);
          }
        }
      } catch (_) {}
    }, 2000);
  }, [clinic?.id, queryClient, stopIntervals]);

  // Check for existing pending deletion on open (handles page refresh)
  useEffect(() => {
    if (!open || !clinic?.id) return;
    setConfirmText('');
    setPendingDeletion(null);
    setFailReason('');
    setStep('checking');

    let cancelled = false;
    (async () => {
      try {
        const res = await appClient.functions.invoke('checkPendingPermanentDeletion', { clinic_id: clinic.id });
        if (cancelled) return;
        const data = res.data;
        if (data?.pending_deletion?.status === 'executed') {
          setStep('success');
        } else if (data?.pending_deletion?.status === 'failed') {
          setFailReason(data.pending_deletion.failure_reason || 'Unknown error');
          setStep('failed');
        } else if (data?.pending_deletion?.status === 'pending') {
          startCountdown(data.pending_deletion);
        } else {
          setStep('confirm');
        }
      } catch (e) {
        if (!cancelled) setStep('confirm');
      }
    })();

    return () => { cancelled = true; };
  }, [open, clinic?.id, startCountdown]);

  // Cleanup on close
  useEffect(() => {
    if (!open) stopIntervals();
  }, [open, stopIntervals]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopIntervals();
  }, [stopIntervals]);

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await appClient.functions.invoke('schedulePermanentDeletion', { clinic_id: clinic.id });
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.pending_deletion) {
        toast.success('Permanent deletion scheduled — 60 second countdown started');
        startCountdown(data.pending_deletion);
      }
    },
    onError: (e) => {
      const msg = e?.response?.data?.error || 'Failed to schedule permanent deletion';
      toast.error(msg);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await appClient.functions.invoke('cancelPermanentDeletion', { pending_deletion_id: pendingDeletion.id });
      return res.data;
    },
    onSuccess: () => {
      stopIntervals();
      setStep('cancelled');
      toast.success('Permanent deletion cancelled — no data was deleted');
    },
    onError: (e) => {
      const msg = e?.response?.data?.error || 'Failed to cancel deletion';
      toast.error(msg);
    },
  });

  const handleConfirmDelete = () => {
    if (confirmText !== 'DELETE PERMANENTLY') return;
    scheduleMutation.mutate();
  };

  const handleClose = () => {
    stopIntervals();
    const invalidate = ['success', 'cancelled', 'failed'].includes(step);
    setConfirmText('');
    setPendingDeletion(null);
    setFailReason('');
    setStep('checking');
    onOpenChange(false);
    if (invalidate) {
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
    }
  };

  const handleOpenChange = (v) => {
    if (!v) {
      handleClose();
    } else {
      onOpenChange(v);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        {/* Checking */}
        {step === 'checking' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Checking deletion status...</p>
          </div>
        )}

        {/* Confirm */}
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <XOctagon className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <DialogTitle className="text-destructive text-lg">Permanent Delete</DialogTitle>
                  <DialogDescription className="text-xs">
                    IRREVERSIBLE — all data will be destroyed
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4 space-y-2">
                <p className="text-sm text-foreground">
                  You are about to <strong className="text-destructive">PERMANENTLY DELETE</strong>{' '}
                  <strong className="text-destructive">{clinicName}</strong> and ALL its data.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside pl-1">
                  <li>All patients, appointments, treatments, and payments</li>
                  <li>All doctors, staff, invoices, and lab cases</li>
                  <li>All files, consent forms, and message logs</li>
                  <li>All audit logs and backup records</li>
                  <li>The clinic record itself</li>
                </ul>
                <p className="text-xs font-semibold text-destructive">
                  ⚠ This action is IRREVERSIBLE. After a 60-second countdown, the clinic and all its data will be permanently destroyed. This CANNOT be undone or restored.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Type{' '}
                  <code className="px-1.5 py-0.5 rounded bg-muted font-mono font-bold text-destructive">
                    DELETE PERMANENTLY
                  </code>{' '}
                  to confirm:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE PERMANENTLY"
                  className="font-mono"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={confirmText !== 'DELETE PERMANENTLY' || scheduleMutation.isPending}
                className="flex-1"
              >
                {scheduleMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Scheduling...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-1" /> Permanent Delete
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Countdown */}
        {step === 'countdown' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <DialogTitle className="text-destructive text-lg">
                    Permanent deletion scheduled
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Cancel to stop — this cannot be undone after completion
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="text-center">
                {remainingSeconds > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong className="text-foreground">{clinicName}</strong> will be
                      permanently deleted in:
                    </p>
                    <div className="text-5xl font-bold tabular-nums text-destructive my-3">
                      {remainingSeconds}
                    </div>
                    <p className="text-sm text-muted-foreground">seconds remaining</p>
                  </>
                ) : (
                  <div className="py-4 flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-destructive animate-spin" />
                    <p className="text-sm font-medium text-destructive">
                      Permanently deleting clinic...
                    </p>
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                <p className="text-xs text-muted-foreground">
                  After the countdown finishes,{' '}
                  <strong className="text-destructive">{clinicName}</strong> and ALL its
                  data will be permanently destroyed. This CANNOT be undone.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending || remainingSeconds <= 0}
                className="w-full text-base h-11"
              >
                {cancelMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-1" /> Cancel Deletion
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <XOctagon className="w-7 h-7 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-lg mb-1 text-destructive">Clinic Permanently Deleted</DialogTitle>
              <DialogDescription>
                <strong>{clinicName}</strong> and all its data have been permanently
                destroyed. This cannot be undone.
              </DialogDescription>
            </div>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        )}

        {/* Cancelled */}
        {step === 'cancelled' && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <div>
              <DialogTitle className="text-lg mb-1">Deletion Cancelled</DialogTitle>
              <DialogDescription>
                The permanent deletion was cancelled. <strong>{clinicName}</strong> is
                still soft-deleted and no data was destroyed.
              </DialogDescription>
            </div>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        )}

        {/* Failed */}
        {step === 'failed' && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-lg mb-1 text-destructive">Deletion Failed</DialogTitle>
              <DialogDescription>
                The permanent deletion failed. The clinic data may be partially
                deleted. Please contact support for recovery.
              </DialogDescription>
              {failReason && (
                <div className="mt-3 rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-left">
                  <p className="text-xs font-mono text-destructive break-all">{failReason}</p>
                </div>
              )}
            </div>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}