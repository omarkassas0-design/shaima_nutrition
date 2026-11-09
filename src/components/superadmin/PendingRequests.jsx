import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Check, X, Loader2, Mail, Phone, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PendingRequests({ pendingRequests, isLoading }) {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async (user_id) => {
      const res = await appClient.functions.invoke('approveRegistration', { user_id });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Approved! Clinic "${data.clinic.name}" created and user linked.`);
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
    },
    onError: (e) => {
      toast.error(e?.message || 'Failed to approve registration');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (user_id) => {
      const res = await appClient.functions.invoke('rejectRegistration', { user_id });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Registration request rejected.');
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
    },
    onError: (e) => {
      toast.error(e?.message || 'Failed to reject registration');
    },
  });

  const requests = pendingRequests || [];

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm">
        <CardContent className="p-5 sm:p-6 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <Card className="border border-amber-200/60 dark:border-amber-800/40 shadow-sm border-l-4 border-l-amber-400">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <UserPlus className="w-4 h-4 text-amber-600" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-foreground">
            Pending Registration Requests
          </h3>
          <span className="ml-auto text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 rounded-full">
            {requests.length} pending
          </span>
        </div>

        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-secondary/40 border border-border/40"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground truncate">{req.full_name || 'Unknown'}</p>
                  {req.clinic_name && (
                    <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      <Building2 className="w-3 h-3" />
                      {req.clinic_name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {req.email}
                  </span>
                  {req.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {req.phone}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate(req.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {approveMutation.isPending && approveMutation.variables === req.id ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-1" />
                  )}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rejectMutation.mutate(req.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {rejectMutation.isPending && rejectMutation.variables === req.id ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <X className="w-4 h-4 mr-1" />
                  )}
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}