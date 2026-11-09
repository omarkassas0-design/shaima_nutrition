import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RotateCcw, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RestoreClinicDialog({ clinic, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [restored, setRestored] = React.useState(false);

  const clinicName = clinic?.name || 'this clinic';

  const restoreMutation = useMutation({
    mutationFn: async () => {
      const res = await appClient.functions.invoke('restoreClinic', { clinic_id: clinic.id });
      return res.data;
    },
    onSuccess: () => {
      setRestored(true);
      toast.success('Clinic restored successfully');
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
    },
    onError: (e) => {
      const msg = e?.response?.data?.error || 'Failed to restore clinic';
      toast.error(msg);
    },
  });

  const handleClose = () => {
    setRestored(false);
    onOpenChange(false);
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
        {restored ? (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <div>
              <DialogTitle className="text-lg mb-1">Clinic Restored</DialogTitle>
              <DialogDescription>
                <strong>{clinicName}</strong> has been restored. All data is intact
                and the clinic is accessible again.
              </DialogDescription>
            </div>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Restore Clinic</DialogTitle>
                  <DialogDescription className="text-xs">
                    Reactivate a soft-deleted clinic
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-foreground">
                You are about to restore{' '}
                <strong className="text-primary">{clinicName}</strong>.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside pl-1 mt-3">
                <li>The clinic will become accessible to all its users again</li>
                <li>All preserved data (patients, appointments, payments) will be available</li>
                <li>All IDs and relationships remain intact</li>
              </ul>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={() => restoreMutation.mutate()}
                disabled={restoreMutation.isPending}
                className="flex-1 gradient-primary text-white"
              >
                {restoreMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-1" /> Restore Clinic
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}