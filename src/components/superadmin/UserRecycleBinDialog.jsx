import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserX, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDisplayDate } from '@/lib/dateFormat';

export default function UserRecycleBinDialog({ open, onOpenChange, deletedUsers }) {
  const queryClient = useQueryClient();

  const restoreMutation = useMutation({
    mutationFn: async ({ deletedUserId }) => {
      const res = await appClient.functions.invoke('restoreUser', { deleted_user_id: deletedUserId });
      return res.data;
    },
    onSuccess: () => {
      toast.success('User restored successfully. Access re-enabled.');
      queryClient.invalidateQueries({ queryKey: ['superAdminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
    },
    onError: (e) => {
      toast.error(e?.message || 'Failed to restore user');
    },
  });

  const handleRestore = (deletedUser) => {
    restoreMutation.mutate({ deletedUserId: deletedUser.id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-primary" />
            User Recycle Bin
          </DialogTitle>
          <DialogDescription>
            Soft-deleted users — restore to re-enable access. Deleted users cannot log in until restored.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {!deletedUsers || deletedUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <UserX className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No deleted users in the Recycle Bin.</p>
            </div>
          ) : (
            deletedUsers.map((du) => (
              <div
                key={du.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
              >
                <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <UserX className="w-4 h-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{du.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {du.role || 'No role'} · Deleted {du.deleted_at ? formatDisplayDate(du.deleted_at) : '—'}
                    {du.deleted_by_name ? ` by ${du.deleted_by_name}` : ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-shrink-0"
                  onClick={() => handleRestore(du)}
                  disabled={restoreMutation.isPending && restoreMutation.variables?.deletedUserId === du.id}
                >
                  {restoreMutation.isPending && restoreMutation.variables?.deletedUserId === du.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  Restore
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}