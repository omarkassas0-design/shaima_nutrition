import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { getPatientFileUrl } from '@/lib/patientFileUrlCache';
import useInView from '@/hooks/useInView';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { useAuth } from '@/lib/AuthContext';
import { roleIsDoctor } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ImageOff, Plus } from 'lucide-react';
import FileUploadDialog from '@/components/patient/FileUploadDialog';

export default function BeforeAfterGallery({ patient }) {
  const { t } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const readOnly = roleIsDoctor(effectiveRole);
  const [selectedTreatment, setSelectedTreatment] = useState('all');
  const [uploadPreset, setUploadPreset] = useState(null);

  const { data: files = [] } = useQuery({
    queryKey: ['patientFiles', patient.id],
    queryFn: () => clinicApi.filter('PatientFile', { patient_id: patient.id, clinic_id: clinic?.id }, '-created_date', 200),
    enabled: !!clinic,
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ['patientTreatments', patient.id],
    queryFn: () => clinicApi.filter('PatientTreatment', { patient_id: patient.id, clinic_id: clinic?.id }),
    enabled: !!clinic,
  });

  const baFiles = files.filter(f => f.before_after_tag === 'before' || f.before_after_tag === 'after');

  const byTreatment = {};
  baFiles.forEach(f => {
    const key = f.associated_treatment_id || 'none';
    if (!byTreatment[key]) byTreatment[key] = { before: [], after: [] };
    if (f.before_after_tag === 'before') byTreatment[key].before.push(f);
    else byTreatment[key].after.push(f);
  });

  const treatmentKeys = selectedTreatment === 'all'
    ? Object.keys(byTreatment)
    : [selectedTreatment];

  const treatmentNameMap = {};
  treatments.forEach(tr => { treatmentNameMap[tr.id] = tr.treatment_name; });

  const openUpload = (tag, treatmentId = '') => setUploadPreset({ tag, treatmentId });

  const activeTid = selectedTreatment !== 'all' && selectedTreatment !== 'none' ? selectedTreatment : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={selectedTreatment} onValueChange={setSelectedTreatment}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all_treatments')}</SelectItem>
            {Object.keys(byTreatment).filter(k => k !== 'none').map(k => (
              <SelectItem key={k} value={k}>{treatmentNameMap[k] || t('treatment')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!readOnly && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openUpload('before', activeTid)}>
              <Plus className="w-4 h-4 mr-1" />{t('add_before_image')}
            </Button>
            <Button size="sm" className="gradient-primary text-white" onClick={() => openUpload('after', activeTid)}>
              <Plus className="w-4 h-4 mr-1" />{t('add_after_image')}
            </Button>
          </div>
        )}
      </div>

      {baFiles.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <ImageOff className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('no_before_after_images')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {treatmentKeys.map(key => {
            const group = byTreatment[key];
            if (!group) return null;
            const tName = key === 'none' ? t('unassigned') : (treatmentNameMap[key] || t('treatment'));
            const tid = key !== 'none' ? key : '';
            return (
              <Card key={key} className="glass border-0">
                <CardContent className="p-4">
                  <p className="font-semibold text-sm mb-3">{tName}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <BeforeAfterColumn
                      label={t('before')}
                      badgeClass="bg-amber-100 text-amber-700"
                      items={group.before}
                      emptyText={t('no_before_images')}
                      onAdd={!readOnly ? () => openUpload('before', tid) : null}
                      addLabel={t('add_before_image')}
                    />
                    <BeforeAfterColumn
                      label={t('after')}
                      badgeClass="bg-emerald-100 text-emerald-700"
                      items={group.after}
                      emptyText={t('no_after_images')}
                      onAdd={!readOnly ? () => openUpload('after', tid) : null}
                      addLabel={t('add_after_image')}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <FileUploadDialog
        open={!!uploadPreset}
        onClose={() => setUploadPreset(null)}
        patient={patient}
        clinic={clinic}
        presetTag={uploadPreset?.tag}
        presetTreatmentId={uploadPreset?.treatmentId}
        imageOnly
      />
    </div>
  );
}

function BeforeAfterColumn({ label, badgeClass, items, emptyText, onAdd, addLabel }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Badge className={`${badgeClass} border-0`}>{label}</Badge>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.length === 0 && !onAdd && (
          <p className="text-xs text-muted-foreground italic">{emptyText}</p>
        )}
        {items.map(f => <BeforeAfterImage key={f.id} file={f} />)}
        {onAdd && (
          <button type="button" onClick={onAdd}
            className="w-full aspect-square rounded-lg border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-accent transition-colors">
            <Plus className="w-6 h-6" />
            <span className="text-[10px] font-medium text-center px-1">{addLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function BeforeAfterImage({ file }) {
  const { lang } = useLanguage();
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ref, inView] = useInView();

  // Only sign the URL once the image actually scrolls into view.
  useEffect(() => {
    if (!inView) return;
    let active = true;
    getPatientFileUrl(file).then(u => { if (active) { setUrl(u); setLoading(false); } }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [inView, file.id]);

  return (
    <div ref={ref} className="rounded-lg overflow-hidden bg-secondary">
      {loading ? (
        <div className="aspect-square flex items-center justify-center"><Loader2 className="w-6 h-6 text-muted-foreground animate-spin" /></div>
      ) : url ? (
        <img src={url} alt={file.file_name} className="w-full aspect-square object-cover" />
      ) : (
        <div className="aspect-square flex items-center justify-center"><ImageOff className="w-6 h-6 text-muted-foreground" /></div>
      )}
      <p className="text-[10px] text-muted-foreground p-1.5 truncate">{file.file_name}</p>
      {file.created_date && <p className="text-[10px] text-muted-foreground px-1.5 pb-1.5">{formatDisplayDate(file.created_date, lang)}</p>}
    </div>
  );
}