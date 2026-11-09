import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, UserCog, ShieldCheck, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';

// ONLY clinic roles — super_admin is NEVER offered here.
const ROLE_OPTIONS = [
  { value: 'clinic_admin', label: 'Clinic Admin' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'receptionist', label: 'Receptionist' },
];

// Account status options — controls whether the user can access the app.
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'not_subscribed', label: 'Not Subscribed' },
];

export default function ManageUsersDialog({ open, onOpenChange, clinics, onSuccess }) {
  const queryClient = useQueryClient();
  // Track pending clinic selections for users without a clinic
  const [pendingClinics, setPendingClinics] = useState({});
  // Track which user is pending delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['superAdminUsers'],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getSuperAdminUsers', {});
      return res.data;
    },
    enabled: open,
    staleTime: 0,
  });

  // Filter out the owner (super_admin) and soft-deleted users (in Recycle Bin)
  const allUsers = (data?.users || []).filter((u) => u.role !== 'super_admin');
  const users = allUsers.filter((u) => !u.is_deleted);
  const filteredUsers = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.email || '').toLowerCase().includes(q) ||
        (u.clinic_id || '').toLowerCase().includes(q)
    );
  })();

  const assignMutation = useMutation({
    mutationFn: async ({ userId, clinicId, role, status }) => {
      const res = await appClient.functions.invoke('assignUserToClinic', {
        user_id: userId, clinic_id: clinicId, role, status,
      });
      return res.data;
    },
    onSuccess: (data, variables) => {
      // Clear pending clinic so the text field shows the fresh clinic_id from the refetch.
      setPendingClinics((prev) => {
        const next = { ...prev };
        delete next[variables.userId];
        return next;
      });
      if (data?.clinic_created) {
        toast.success('New clinic created and role saved successfully.');
      } else if (variables.changeType === 'status') {
        toast.success('Account status updated successfully.');
      } else {
        toast.success(variables.changeType === 'clinic' ? 'Clinic updated successfully.' : 'Role saved successfully.');
      }
      queryClient.invalidateQueries({ queryKey: ['superAdminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
      onSuccess?.();
    },
    onError: (e) => {
      toast.error(e?.message || 'Failed to assign role');
    },
  });

  const getUserClinicId = (u) => {
    return u.clinic_id || pendingClinics[u.id] || null;
  };

  const handleRoleChange = (user, newRole) => {
    const clinicId = getUserClinicId(user);
    // If no clinic_id (new user), pass null — the backend creates a new unique clinic.
    assignMutation.mutate({ userId: user.id, clinicId, role: newRole, changeType: 'role' });
  };

  const handleStatusChange = (user, newStatus) => {
    const clinicId = getUserClinicId(user);
    // Status can only be set for users who already have a CRA (role + clinic).
    const role = user.role && ROLE_OPTIONS.some((r) => r.value === user.role) ? user.role : null;
    if (!clinicId || !role) return;
    assignMutation.mutate({ userId: user.id, clinicId, role, status: newStatus, changeType: 'status' });
  };

  const handleClinicSave = (user) => {
    const newValue = (pendingClinics[user.id] || '').trim();
    const currentValue = user.clinic_id || '';
    if (newValue === currentValue) return;
    if (!newValue) {
      // Don't allow empty — reset to current value
      setPendingClinics((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      return;
    }
    // Always persist to the backend. If the user has a role, reassign to the
    // new clinic with the same role (full CRA upsert). If the user has no
    // role yet, save the clinic_id only (no CRA) — the role can be assigned
    // separately later.
    const hasRole = user.role && ROLE_OPTIONS.some((r) => r.value === user.role);
    assignMutation.mutate({
      userId: user.id,
      clinicId: newValue,
      role: hasRole ? user.role : null,
      changeType: 'clinic',
    });
  };

  // Soft-delete mutation — moves user to Recycle Bin, suspends access
  const deleteMutation = useMutation({
    mutationFn: async ({ userId }) => {
      const res = await appClient.functions.invoke('softDeleteUser', { user_id: userId });
      return res.data;
    },
    onSuccess: () => {
      toast.success('User moved to Recycle Bin. Access disabled.');
      queryClient.invalidateQueries({ queryKey: ['superAdminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
      onSuccess?.();
    },
    onError: (e) => {
      toast.error(e?.message || 'Failed to delete user');
    },
  });

  const handleDelete = (user) => {
    setDeleteTarget(user);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ userId: deleteTarget.id });
    setDeleteTarget(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary" />
            User Management
          </DialogTitle>
          <DialogDescription>
            Assign clinic roles and account status to users. Status controls access: Active (normal), Pending (suspended — user is logged out), Not Subscribed (trial ended — user is logged out).
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by email or clinic ID..."
            className="pl-9 h-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">
              {searchQuery.trim() ? 'No users match your search.' : 'No users found. New users will appear here after registration.'}
            </p>
          ) : (
            filteredUsers.map((u) => {
              const hasRole = u.role && ROLE_OPTIONS.some((r) => r.value === u.role);
              const isMutating =
                assignMutation.isPending && assignMutation.variables?.userId === u.id;

              return (
                <div
                  key={u.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-border bg-card"
                >
                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{u.email}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Clinic ID — editable text field */}
                    <Input
                      className="w-40 h-8 text-xs font-mono"
                      value={pendingClinics[u.id] !== undefined ? pendingClinics[u.id] : (u.clinic_id || '')}
                      onChange={(e) => setPendingClinics((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      onBlur={() => handleClinicSave(u)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                      placeholder="Clinic ID"
                    />

                    {/* Role dropdown — shows "No Role Assigned" when no CRA */}
                    <Select
                      value={hasRole ? u.role : ''}
                      onValueChange={(v) => handleRoleChange(u, v)}
                    >
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <SelectValue placeholder="No Role Assigned" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Status dropdown — only shown for users with a CRA (role assigned) */}
                    {hasRole && (
                      <Select
                        value={u.status || 'active'}
                        onValueChange={(v) => handleStatusChange(u, v)}
                      >
                        <SelectTrigger className={`w-36 h-8 text-xs ${u.status === 'pending' ? 'border-orange-400 text-orange-600' : u.status === 'not_subscribed' ? 'border-amber-400 text-amber-600' : ''}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {isMutating && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                    )}

                    {/* Delete button — soft-deletes user to Recycle Bin */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                      onClick={() => handleDelete(u)}
                      disabled={isMutating || deleteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{deleteTarget?.email}</strong>? The user will be
                moved to the Recycle Bin and their access will be disabled immediately. You can restore
                them from the Recycle Bin at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 pt-2 border-t border-border">
          <ShieldCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span>
            Changing clinic or role saves immediately. Users without a role are fail-closed (no access).
            Super Admin is owner-only and cannot be assigned here.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}