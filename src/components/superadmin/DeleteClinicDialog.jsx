import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Clock, Trash2, XCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DeleteClinicDialog({ clinic, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('checking'); // checking | confirm | countdown | success | cancelled
  const [confirmText, setConfirmText] = useState('');
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
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
    // Detects: executed (deletion happened), cancelled (by another tab/session)
    pollRef.current = setInterval(async () => {
      try {
        const res = await appClient.functions.invoke('checkPendingClinicDeletion', { clinic_id: clinic.id });
        const data = res.data;
        if (data?.pending_deletion?.status === 'executed') {
          stopIntervals();
          setStep('success');
          queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
        } else if (data?.pending_deletion?.status === 'cancelled') {
          stopIntervals();
          setStep('cancelled');
        } else if (data?.pending_deletion?.status === 'pending') {
          if (data.remaining_seconds != null) {
            setRemainingSeconds(data.remaining_seconds);
          }
        } else if (!data?.pending_deletion) {
          // No pending deletion record — deletion likely executed
          stopIntervals();
          setStep('success');
          queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
        }
      } catch (_) {}
    }, 2000);
  }, [clinic?.id, queryClient, stopIntervals]);

  // Check for existing pending deletion on open (handles page refresh)
  useEffect(() => {
    if (!open || !clinic?.id) return;
    setConfirmText('');
    setPendingDeletion(null);
    setStep('checking');

    let cancelled = false;
    (async () => {
      try {
        const res = await appClient.functions.invoke('checkPendingClinicDeletion', { clinic_id: clinic.id });
        if (cancelled) return;
        const data = res.data;
        if (data?.clinic_is_deleted || data?.pending_deletion?.status === 'executed') {
          setStep('success');
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
      const res = await appClient.functions.invoke('scheduleClinicDeletion', { clinic_id: clinic.id });
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.pending_deletion) {
        toast.success('Clinic deletion scheduled — 60 second countdown started');
        startCountdown(data.pending_deletion);
      }
    },
    onError: (e) => {
      const msg = e?.response?.data?.error || 'Failed to schedule deletion';
      toast.error(msg);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await appClient.functions.invoke('cancelClinicDeletion', { pending_deletion_id: pendingDeletion.id });
      return res.data;
    },
    onSuccess: () => {
      stopIntervals();
      setStep('cancelled');
      toast.success('Deletion cancelled — no data was deleted');
    },
    onError: (e) => {
      const msg = e?.response?.data?.error || 'Failed to cancel deletion';
      toast.error(msg);
    },
  });

  const handleConfirmDelete = () => {
    if (confirmText !== 'DELETE') return;
    scheduleMutation.mutate();
  };

  const handleClose = () => {
    stopIntervals();
    const wasSuccess = step === 'success';
    const wasCancelled = step === 'cancelled';
    setConfirmText('');
    setPendingDeletion(null);
    setStep('checking');
    onOpenChange(false);
    if (wasSuccess || wasCancelled) {
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
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <DialogTitle className="text-destructive text-lg">Delete Clinic</DialogTitle>
                  <DialogDescription className="text-xs">
                    Reversible — clinic can be restored later
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4 space-y-2">
                <p className="text-sm text-foreground">
                  You are about to deactivate{' '}
                  <strong className="text-destructive">{clinicName}</strong>.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside pl-1">
                  <li>The clinic becomes inaccessible to all its users</li>
                  <li>All data (patients, appointments, payments, files) is preserved</li>
                  <li>The clinic can be restored from the Super Admin dashboard</li>
                </ul>
                <p className="text-xs font-semibold text-amber-600">
                  After a 60-second countdown, the clinic will be deactivated. This is reversible — the clinic can be restored later.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Type{' '}
                  <code className="px-1.5 py-0.5 rounded bg-muted font-mono font-bold text-destructive">
                    DELETE
                  </code>{' '}
                  to confirm:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE"
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
                disabled={confirmText !== 'DELETE' || scheduleMutation.isPending}
                className="flex-1"
              >
                {scheduleMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Scheduling...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-1" /> Delete Clinic
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
                <div className="w-11 h-11 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <DialogTitle className="text-amber-600 text-lg">
                    Clinic deletion scheduled
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Deletion in progress — cancel to stop
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
                      deactivated in:
                    </p>
                    <div className="text-5xl font-bold tabular-nums text-amber-600 my-3">
                      {remainingSeconds}
                    </div>
                    <p className="text-sm text-muted-foreground">seconds remaining</p>
                  </>
                ) : (
                  <div className="py-4 flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-destructive animate-spin" />
                    <p className="text-sm font-medium text-amber-600">
                      Deactivating clinic...
                    </p>
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                <p className="text-xs text-muted-foreground">
                  After the countdown finishes,{' '}
                  <strong className="text-amber-600">{clinicName}</strong> will be
                  deactivated. All data is preserved and the clinic can be restored.
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
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <div>
              <DialogTitle className="text-lg mb-1">Clinic Deactivated</DialogTitle>
              <DialogDescription>
                <strong>{clinicName}</strong> has been deactivated. All data is
                preserved and the clinic can be restored from the Super Admin dashboard.
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
                The clinic deletion was cancelled. <strong>{clinicName}</strong> is
                intact and no data was deleted.
              </DialogDescription>
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