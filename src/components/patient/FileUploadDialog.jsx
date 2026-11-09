import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { clinicApi } from '@/lib/clinicApi';
import { useLanguage } from '@/lib/useLanguage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const FILE_TYPES = [
  { value: 'image', label: 'Image' },
  { value: 'xray', label: 'X-Ray' },
  { value: 'panorama', label: 'Panorama' },
  { value: 'cbct', label: 'CBCT' },
  { value: 'periapical', label: 'Periapical' },
  { value: 'bitewing', label: 'Bitewing' },
  { value: 'pdf', label: 'PDF Report' },
  { value: 'document', label: 'Document' },
];

export default function FileUploadDialog({ open, onClose, patient, clinic, presetTag, presetTreatmentId, imageOnly = false }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [fileType, setFileType] = useState('image');
  const [beforeAfterTag, setBeforeAfterTag] = useState('');
  const [associatedTreatmentId, setAssociatedTreatmentId] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (open) {
      setFileType(imageOnly ? 'image' : 'xray');
      setBeforeAfterTag(presetTag || '');
      setAssociatedTreatmentId(presetTreatmentId || '');
      setNotes('');
      setSelectedFile(null);
    }
  }, [open, presetTag, presetTreatmentId, imageOnly]);

  const { data: treatments = [] } = useQuery({
    queryKey: ['patientTreatments', patient?.id],
    queryFn: () => clinicApi.filter('PatientTreatment', { patient_id: patient.id, clinic_id: clinic?.id }),
    enabled: !!clinic && !!patient,
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');
      setUploading(true);
      const { file_uri } = await appClient.integrations.Core.UploadPrivateFile({ file: selectedFile, clinic_id: clinic.id, patient_id: patient.id });
      return clinicApi.create('PatientFile', {
        clinic_id: clinic.id,
        patient_id: patient.id,
        file_url: '',
        file_uri,
        file_name: selectedFile.name,
        file_type: fileType,
        before_after_tag: beforeAfterTag || undefined,
        associated_treatment_id: associatedTreatmentId || undefined,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientFiles'] });
      toast.success(t('file_uploaded'));
      setUploading(false);
      setSelectedFile(null);
      setNotes('');
      setBeforeAfterTag('');
      setAssociatedTreatmentId('');
      onClose();
    },
    onError: (e) => { setUploading(false); toast.error(t('upload_failed') + ': ' + e.message); },
  });

  const typeOptions = imageOnly ? FILE_TYPES.filter(ft => ft.value === 'image') : FILE_TYPES;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('upload_xray_file')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!imageOnly && (
            <div className="space-y-2">
              <Label>{t('file_type')}</Label>
              <Select value={fileType} onValueChange={setFileType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map(ft => <SelectItem key={ft.value} value={ft.value}>{t(ft.value)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('date')}</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('before_after_tag')}</Label>
            <Select value={beforeAfterTag || 'none'} onValueChange={(v) => setBeforeAfterTag(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder={t('none')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('none')}</SelectItem>
                <SelectItem value="before">{t('before')}</SelectItem>
                <SelectItem value="after">{t('after')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {beforeAfterTag && (
            <div className="space-y-2">
              <Label>{t('associate_treatment')}</Label>
              <Select value={associatedTreatmentId || 'none'} onValueChange={(v) => setAssociatedTreatmentId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={t('optional')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('none')}</SelectItem>
                  {treatments.map(tr => <SelectItem key={tr.id} value={tr.id}>{tr.treatment_name} {tr.tooth_numbers?.length > 0 ? `#${tr.tooth_numbers[0]}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('notes')}</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t('optional_notes')} />
          </div>
          <div className="space-y-2">
            <Label>{t('select_file')}</Label>
            <Input type="file" onChange={handleFileChange} accept={imageOnly ? "image/*" : "image/*,.pdf,.doc,.docx"} />
            {selectedFile && <p className="text-xs text-muted-foreground truncate">{selectedFile.name}</p>}
            <p className="text-xs text-muted-foreground">{t('files_stored_securely')}</p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!selectedFile || saveMutation.isPending || uploading} className="gradient-primary text-white">
              {(saveMutation.isPending || uploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('upload_btn')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
