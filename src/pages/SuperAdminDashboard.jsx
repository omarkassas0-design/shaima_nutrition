import React from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';
import { useSuperAdmin } from '@/lib/SuperAdminContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Plus, Users, UserRound, CalendarDays, LogOut, Stethoscope, UserCog, AlertCircle, RefreshCw, Archive, Recycle, UserX, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/useLanguage';
import CreateClinicDialog from '@/components/superadmin/CreateClinicDialog';
import ManageUsersDialog from '@/components/superadmin/ManageUsersDialog';
import ClinicCard from '@/components/superadmin/ClinicCard';
import RecycleBinDialog from '@/components/superadmin/RecycleBinDialog';
import UserRecycleBinDialog from '@/components/superadmin/UserRecycleBinDialog';
import PendingRequests from '@/components/superadmin/PendingRequests';
import SuperAdminStatCard from '@/components/superadmin/SuperAdminStatCard';

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' } }) };

export default function SuperAdminDashboard() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const { manageClinic } = useSuperAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [manageUsersOpen, setManageUsersOpen] = React.useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = React.useState(false);
  const [userRecycleBinOpen, setUserRecycleBinOpen] = React.useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['superAdminStats'],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getSuperAdminStats', {});
      return res.data;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnMount: true,
    retry: 1,
    retryDelay: 2000,
  });

  const allClinics = data?.clinics || [];
  const pendingRequests = data?.pendingRequests || [];

  // Separate active and soft-deleted clinics
  const clinics = allClinics.filter(c => !c.is_deleted);
  const deletedClinics = allClinics.filter(c => c.is_deleted);

  // Deleted users for the User Recycle Bin — fetched via manageUsers query
  const [deletedUsers, setDeletedUsers] = React.useState([]);
  React.useEffect(() => {
    if (manageUsersOpen || userRecycleBinOpen) {
      appClient.functions.invoke('getSuperAdminUsers', {}).then((res) => {
        setDeletedUsers(res.data?.deletedUsers || []);
      }).catch(() => {});
    }
  }, [manageUsersOpen, userRecycleBinOpen, data]);

  // Aggregate totals across active clinics only
  const totals = clinics.reduce((acc, c) => ({
    doctors: acc.doctors + (c.stats?.doctors || 0),
    staff: acc.staff + (c.stats?.staff || 0),
    patients: acc.patients + (c.stats?.patients || 0),
    appointments: acc.appointments + (c.stats?.appointments || 0),
  }), { doctors: 0, staff: 0, patients: 0, appointments: 0 });

  const handleManage = (clinicId) => {
    manageClinic(clinicId);
    navigate('/');
  };

  const handleLogout = () => {
    logout();
  };

  const showSkeletons = isLoading && !data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-foreground truncate">AuraDental Cloud</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{t('super_admin_dashboard')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/8 text-primary text-sm font-medium">
              <Users className="w-4 h-4" />
              <span className="truncate max-w-[180px]">{user?.email}</span>
            </div>
            {isFetching && !isLoading && (
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" title="Updating" />
            )}
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-red-500 hover:bg-red-500/10 flex-shrink-0">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Error state — controlled failure with Retry, never an infinite spinner */}
        {isError && (
          <Card className="glass border-0 shadow-lg">
            <CardContent className="p-8 flex flex-col items-center text-center gap-3">
              <AlertCircle className="w-10 h-10 text-destructive" />
              <p className="text-sm font-medium text-foreground">{t('failed_to_load_dashboard') || 'Failed to load dashboard data'}</p>
              <Button onClick={() => refetch()} variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                {t('retry') || 'Retry'}
              </Button>
            </CardContent>
          </Card>
        )}

        {!isError && (
          <>
        {/* Hero title + actions */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Control Center</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{t('clinic_management')}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t('manage_all_clinics')}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setManageUsersOpen(true)}
                className="shadow-sm"
              >
                <UserCog className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Manage</span> Users
              </Button>
              <Button
                onClick={() => setCreateOpen(true)}
                className="gradient-primary text-white shadow-lg shadow-primary/20"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {t('create_clinic')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setRecycleBinOpen(true)}
                className="shadow-sm relative"
              >
                <Recycle className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Recycle</span> Bin
                {deletedClinics.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
                    {deletedClinics.length}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setUserRecycleBinOpen(true)}
                className="shadow-sm relative"
              >
                <UserX className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Deleted</span> Users
                {deletedUsers.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
                    {deletedUsers.length}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Global stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <SuperAdminStatCard index={0} icon={Building2} label={t('total_clinics')} value={clinics.length} color="sky" loading={showSkeletons} />
          <SuperAdminStatCard index={1} icon={UserRound} label={t('total_doctors')} value={totals.doctors} color="indigo" loading={showSkeletons} />
          <SuperAdminStatCard index={2} icon={Users} label={t('total_patients')} value={totals.patients} color="teal" loading={showSkeletons} />
          <SuperAdminStatCard index={3} icon={CalendarDays} label={t('total_appointments')} value={totals.appointments} color="violet" loading={showSkeletons} />
        </div>

        {/* Pending registration requests */}
        <PendingRequests pendingRequests={pendingRequests} isLoading={showSkeletons} />

        {/* Clinics list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">{t('all_clinics')}</h3>
            {!showSkeletons && clinics.length > 0 && (
              <span className="text-sm text-muted-foreground">{clinics.length} {clinics.length === 1 ? 'clinic' : 'clinics'}</span>
            )}
          </div>
          {showSkeletons ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
            </div>
          ) : clinics.length === 0 ? (
            <Card className="glass border-0 shadow-lg">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <p className="text-foreground font-medium mb-1">{t('no_clinics_yet')}</p>
                <p className="text-muted-foreground text-sm mb-4">Create your first clinic to get started.</p>
                <Button onClick={() => setCreateOpen(true)} className="gradient-primary text-white">
                  <Plus className="w-4 h-4 mr-1.5" /> {t('create_first_clinic')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clinics.map((clinic, i) => (
                <motion.div key={clinic.id} custom={i} variants={fadeUp} initial="hidden" animate="visible">
                  <ClinicCard clinic={clinic} onManage={handleManage} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Deleted clinics section */}
        {deletedClinics.length > 0 && !showSkeletons && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Archive className="w-5 h-5 text-muted-foreground" />
                Deleted Clinics
              </h3>
              <span className="text-sm text-muted-foreground">{deletedClinics.length} archived</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deletedClinics.map((clinic, i) => (
                <motion.div key={clinic.id} custom={i} variants={fadeUp} initial="hidden" animate="visible">
                  <ClinicCard clinic={clinic} onManage={handleManage} />
                </motion.div>
              ))}
            </div>
          </div>
        )}
          </>
        )}
      </main>

      <CreateClinicDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        clinics={clinics}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['superAdminStats'] })}
      />
      <ManageUsersDialog
        open={manageUsersOpen}
        onOpenChange={setManageUsersOpen}
        clinics={clinics}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['superAdminStats'] })}
      />
      <RecycleBinDialog
        open={recycleBinOpen}
        onOpenChange={setRecycleBinOpen}
        deletedClinics={deletedClinics}
        onManage={handleManage}
        isLoading={showSkeletons}
      />
      <UserRecycleBinDialog
        open={userRecycleBinOpen}
        onOpenChange={setUserRecycleBinOpen}
        deletedUsers={deletedUsers}
      />
    </div>
  );
}