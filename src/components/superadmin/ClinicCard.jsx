import React from 'react';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, UserRound, CalendarDays, UserPlus, ArrowRight, Phone, MapPin, Trash2, RotateCcw } from 'lucide-react';
import DeleteClinicDialog from './DeleteClinicDialog';
import RestoreClinicDialog from './RestoreClinicDialog';
import PermanentDeleteDialog from './PermanentDeleteDialog';

export default function ClinicCard({ clinic, onManage }) {
  const { lang } = useLanguage();
  const s = clinic.stats || { doctors: 0, staff: 0, patients: 0, appointments: 0 };
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [restoreOpen, setRestoreOpen] = React.useState(false);
  const [permDeleteOpen, setPermDeleteOpen] = React.useState(false);
  const isDeleted = clinic.is_deleted || clinic.deletion_status === 'soft_deleted';

  return (
    <>
    <Card className={`border border-border/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden relative ${isDeleted ? 'opacity-75' : ''}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500 to-cyan-400 opacity-[0.02] pointer-events-none" />
      <CardContent className="p-5 space-y-4 relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-sm flex-shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{clinic.name}</p>
              {clinic.name_ar && <p className="text-xs text-muted-foreground truncate" dir="rtl">{clinic.name_ar}</p>}
            </div>
          </div>
          {isDeleted ? (
            <Badge variant="destructive" className="text-xs flex-shrink-0">
              Deleted
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              {formatDisplayDate(clinic.created_date, lang, { monthOnly: true })}
            </Badge>
          )}
        </div>

        {/* Contact info (active clinics only) */}
        {(clinic.phone || clinic.address) && !isDeleted && (
          <div className="space-y-1.5">
            {clinic.phone && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                <Phone className="w-3 h-3 flex-shrink-0" /> {clinic.phone}
              </p>
            )}
            {clinic.address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" /> {clinic.address}
              </p>
            )}
          </div>
        )}

        {/* Deletion info for soft-deleted clinics */}
        {isDeleted && clinic.deleted_at && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Deleted: {formatDisplayDate(clinic.deleted_at, lang)}
            </p>
            {clinic.deleted_by_name && (
              <p className="text-xs text-muted-foreground">
                By: {clinic.deleted_by_name}
              </p>
            )}
          </div>
        )}

        {/* Stats grid (active clinics only) */}
        {!isDeleted && (
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40">
            <Stat icon={UserRound} label="Doctors" value={s.doctors} color="text-indigo-500" />
            <Stat icon={UserPlus} label="Staff" value={s.staff} color="text-rose-500" />
            <Stat icon={Users} label="Patients" value={s.patients} color="text-sky-500" />
            <Stat icon={CalendarDays} label="Appointments" value={s.appointments} color="text-teal-500" />
          </div>
        )}

        {/* Action buttons */}
        {isDeleted ? (
          <div className="space-y-2 pt-1">
            <Button
              onClick={() => setRestoreOpen(true)}
              className="w-full gradient-primary text-white shadow-sm"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Restore Clinic
            </Button>
            <Button
              onClick={() => setPermDeleteOpen(true)}
              variant="outline"
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Permanent Delete
            </Button>
          </div>
        ) : (
          <>
            <Button
              onClick={() => onManage(clinic.id)}
              className="w-full gradient-primary text-white shadow-sm"
            >
              Manage Clinic
              <ArrowRight className="w-4 h-4 ml-1.5 rtl:rotate-180" />
            </Button>
            <Button
              onClick={() => setDeleteOpen(true)}
              variant="outline"
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete Clinic
            </Button>
          </>
        )}
      </CardContent>
    </Card>
    {!isDeleted && (
      <DeleteClinicDialog
        clinic={clinic}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    )}
    {isDeleted && (
      <>
        <RestoreClinicDialog
          clinic={clinic}
          open={restoreOpen}
          onOpenChange={setRestoreOpen}
        />
        <PermanentDeleteDialog
          clinic={clinic}
          open={permDeleteOpen}
          onOpenChange={setPermDeleteOpen}
        />
      </>
    )}
    </>
  );
}

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40">
      <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}