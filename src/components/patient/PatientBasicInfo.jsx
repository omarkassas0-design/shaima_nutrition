import React, { useState } from 'react';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pencil, Save, X, Phone, MapPin, Calendar, User, CheckCircle, Stethoscope, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { roleIsDoctor, canRole } from '@/lib/permissions';
import { deleteWithUndo } from '@/lib/undoDelete';

export default function PatientBasicInfo({ patient }) {
  const { t, lang } = useLanguage();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const doctorView = roleIsDoctor(effectiveRole);
  const canDelete = canRole(effectiveRole, 'patients:delete');
  const [form, setForm] = useState({
    full_name: patient.full_name || '',
    phone: patient.phone || '',
    gender: patient.gender || '',
    birth_date: patient.birth_date || '',
    address: patient.address || '',
    notes: patient.notes || '',
  });

  const saveMutation = useMutation({
    mutationFn: (data) => clinicApi.update('Patient', patient.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patient.id] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setEditing(false);
      toast.success(t('saved_success'));
    },
    onError: () => toast.error(t('failed_to_save')),
  });
  const handleSave = () => saveMutation.mutate(form);

  const handleDelete = async () => {
    setDeleting(true);
    await deleteWithUndo('Patient', patient, t('patient'), () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      navigate('/patients');
    });
    setDeleting(false);
  };

  if (!editing) {
    return (
      <Card className="glass border-0 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">{t('basic_info')}</CardTitle>
          {!doctorView && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />{t('edit')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white text-2xl font-bold">
              {patient.full_name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold">{patient.full_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {patient.phone_verified && <Badge className="bg-green-100 text-green-700 text-xs"><CheckCircle className="w-3 h-3 mr-1" />{t('phone_verified')}</Badge>}
                {patient.gender && <Badge variant="outline" className="text-xs">{t(patient.gender)}</Badge>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Doctors must never see patient phone numbers — enforced server-side, hidden in UI too */}
            {!doctorView && <InfoRow icon={Phone} label={t('phone')} value={patient.phone} />}
            <InfoRow icon={Calendar} label={t('birth_date')} value={patient.birth_date ? formatDisplayDate(patient.birth_date, lang) : '-'} />
            <InfoRow icon={MapPin} label={t('address')} value={patient.address || '-'} />
            <InfoRow icon={User} label={t('gender')} value={patient.gender ? t(patient.gender) : '-'} />
            {patient.patient_source === 'doctor' && patient.referring_doctor_name && (
              <InfoRow icon={Stethoscope} label={t('referring_doctor')} value={patient.referring_doctor_name} />
            )}
            {patient.patient_source === 'clinic' && patient.assigned_doctor_name && (
              <InfoRow icon={Stethoscope} label={t('assigned_doctor')} value={patient.assigned_doctor_name} />
            )}
          </div>
          {patient.notes && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-1">{t('notes')}</p>
              <p className="text-sm bg-secondary/50 rounded-lg p-3">{patient.notes}</p>
            </div>
          )}
          {canDelete && (
            <div className="pt-4 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/5"
                disabled={deleting}
                onClick={handleDelete}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />{t('delete_patient')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-0 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg">{t('edit')}</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5 mr-1" />{t('cancel')}</Button>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gradient-primary text-white">
            {saveMutation.isPending ? <span className="w-3.5 h-3.5 mr-1 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            {t('save')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2"><Label>{t('full_name')}</Label><Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} /></div>
          <div className="space-y-2"><Label>{t('phone')}</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} dir="ltr" /></div>
          <div className="space-y-2"><Label>{t('gender')}</Label>
            <Select value={form.gender} onValueChange={v => setForm({...form, gender: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="male">{t('male')}</SelectItem><SelectItem value="female">{t('female')}</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>{t('birth_date')}</Label><Input type="date" value={form.birth_date} onChange={e => setForm({...form, birth_date: e.target.value})} /></div>
          <div className="space-y-2"><Label>{t('address')}</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>{t('notes')}</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="w-4 h-4 text-primary" /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}