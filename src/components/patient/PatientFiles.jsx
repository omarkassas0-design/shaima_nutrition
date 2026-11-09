import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicApi } from '@/lib/clinicApi';
import { getPatientFileUrl } from '@/lib/patientFileUrlCache';
import useInView from '@/hooks/useInView';
import { useLanguage } from '@/lib/useLanguage';
import { formatDisplayDate } from '@/lib/dateFormat';
import { useClinic } from '@/lib/useClinic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Download, FileText, Loader2, Maximize2, X, Images } from 'lucide-react';
import BeforeAfterGallery from '@/components/patient/BeforeAfterGallery';
import FileUploadDialog from '@/components/patient/FileUploadDialog';
import EmptyState from '@/components/shared/EmptyState';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { canRole } from '@/lib/permissions';

const FILE_TYPES = [
  { value: 'image', label: 'Image', color: 'bg-blue-100 text-blue-700' },
  { value: 'xray', label: 'X-Ray', color: 'bg-purple-100 text-purple-700' },
  { value: 'panorama', label: 'Panorama', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'cbct', label: 'CBCT', color: 'bg-violet-100 text-violet-700' },
  { value: 'periapical', label: 'Periapical', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'bitewing', label: 'Bitewing', color: 'bg-teal-100 text-teal-700' },
  { value: 'pdf', label: 'PDF Report', color: 'bg-red-100 text-red-700' },
  { value: 'document', label: 'Document', color: 'bg-gray-100 text-gray-700' },
];

const typeColor = (type) => FILE_TYPES.find(f => f.value === type)?.color || 'bg-secondary text-foreground';
const typeLabel = (type) => FILE_TYPES.find(f => f.value === type)?.label || type;
const isImage = (type) => ['image', 'xray', 'panorama', 'cbct', 'periapical', 'bitewing'].includes(type);

// Only allow https: or same-origin relative URLs. Rejects javascript:, data:, etc.
const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  // Relative same-origin path (starts with single /)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') return trimmed;
  } catch {}
  return null;
};

export default function PatientFiles({ patient }) {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const canUpload = canRole(effectiveRole, 'patientfiles:write');
  const canDelete = canRole(effectiveRole, 'patientfiles:delete');
  const [showAdd, setShowAdd] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showGallery, setShowGallery] = useState(false);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['patientFiles', patient.id],
    queryFn: () => clinicApi.filter('PatientFile', { patient_id: patient.id, clinic_id: clinic?.id }, '-created_date', 200),
    enabled: !!clinic,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => clinicApi.delete('PatientFile', id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['patientFiles'] }); toast.success(t('file_deleted')); },
    onError: (e) => toast.error(t('failed_to_save') + ': ' + e.message),
  });

  // Cached: a valid signed URL is reused for previews and downloads
  // instead of being minted again for every view.
  const fetchSignedUrl = useCallback(async (file) => sanitizeUrl(await getPatientFileUrl(file)), []);

  const openPreview = useCallback(async (file) => {
    setPreview(file);
    setPreviewUrl(null);
    setPreviewLoading(true);
    try {
      const url = await fetchSignedUrl(file);
      setPreviewUrl(url);
    } catch (e) {
      toast.error(t('failed_to_load_file'));
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [fetchSignedUrl]);

  const downloadFile = useCallback(async (file) => {
    try {
      const url = await fetchSignedUrl(file);
      if (!url) { toast.error(t('invalid_file_url')); return; }
      window.open(url, '_blank');
    } catch (e) {
      toast.error(t('failed_to_download_file'));
    }
  }, [fetchSignedUrl]);

  const filtered = typeFilter === 'all' ? files : files.filter(f => f.file_type === typeFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="font-semibold text-lg">{t('files')}</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowGallery(true)} size="sm">
            <Images className="w-4 h-4 mr-1" />{t('before_after_gallery')}
          </Button>
          {canUpload && (
            <Button onClick={() => setShowAdd(true)} className="gradient-primary text-white" size="sm">
              <Plus className="w-4 h-4 mr-1" />{t('upload_file')}
            </Button>
          )}
        </div>
      </div>

      {/* Type filter tabs */}
      <Tabs value={typeFilter} onValueChange={setTypeFilter}>
        <TabsList className="h-auto flex-wrap gap-1 p-1 glass border-0">
          <TabsTrigger value="all" className="text-xs">{t('all')} ({files.length})</TabsTrigger>
          {FILE_TYPES.filter(ft => files.some(f => f.file_type === ft.value)).map(ft => (
            <TabsTrigger key={ft.value} value={ft.value} className="text-xs">
              {t(ft.value)} ({files.filter(f => f.file_type === ft.value).length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array(4).fill(0).map((_, i) => <div key={i} className="aspect-square rounded-xl bg-secondary/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title={files.length === 0 ? t('no_files_uploaded') : t('no_files_category')} actionLabel={canUpload ? t('upload_file') : undefined} onAction={canUpload ? () => setShowAdd(true) : undefined} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <AnimatePresence>
            {filtered.map((f, i) => (
              <motion.div key={f.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.03 }}>
                <Card className="glass border-0 group hover:shadow-lg transition-all">
                  <CardContent className="p-3">
                    {isImage(f.file_type) ? (
                      <div className="aspect-square rounded-lg overflow-hidden bg-secondary mb-2 cursor-pointer relative group/img" onClick={() => openPreview(f)}>
                        {f.file_uri ? (
                          <FileImageThumb file={f} fetchSignedUrl={fetchSignedUrl} />
                        ) : (
                          <img src={sanitizeUrl(f.file_url) || undefined} alt={f.file_name} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                          <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-square rounded-lg bg-secondary flex items-center justify-center mb-2 cursor-pointer" onClick={() => openPreview(f)}>
                        <FileText className="w-10 h-10 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-xs font-medium truncate mb-1">{f.file_name}</p>
                    <div className="flex items-center gap-1 mb-1">
                      <Badge className={`text-[10px] ${typeColor(f.file_type)} border-0`}>{t(f.file_type)}</Badge>
                      {f.before_after_tag === 'before' && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">{t('before')}</Badge>}
                      {f.before_after_tag === 'after' && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">{t('after')}</Badge>}
                    </div>
                    {f.notes && <p className="text-[10px] text-muted-foreground truncate">{f.notes}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">{f.created_date ? formatDisplayDate(f.created_date, lang) : ''}</span>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => downloadFile(f)}>
                          <Download className="w-3 h-3" />
                        </Button>
                        {canDelete && (
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive" onClick={() => deleteMutation.mutate(f.id)} disabled={deleteMutation.isPending}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <FileUploadDialog open={showAdd} onClose={() => setShowAdd(false)} patient={patient} clinic={clinic} />

      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('before_after_gallery')}</DialogTitle></DialogHeader>
          <BeforeAfterGallery patient={patient} />
        </DialogContent>
      </Dialog>

      {/* Full-screen preview */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex flex-col"
            onClick={() => { setPreview(null); setPreviewUrl(null); }}
          >
            <div className="flex items-center justify-between p-4" onClick={e => e.stopPropagation()}>
              <div>
                <p className="text-white font-semibold">{preview.file_name}</p>
                <Badge className={`text-xs ${typeColor(preview.file_type)} border-0`}>{t(preview.file_type)}</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => previewUrl && window.open(previewUrl, '_blank')} disabled={!previewUrl}>
                  <Download className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => { setPreview(null); setPreviewUrl(null); }}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
              {previewLoading ? (
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              ) : previewUrl ? (
                isImage(preview.file_type) ? (
                  <img src={previewUrl} alt={preview.file_name} className="max-w-full max-h-full object-contain rounded-lg" />
                ) : (
                  <iframe src={previewUrl} className="w-full max-w-4xl h-[70vh] rounded-lg bg-white" />
                )
              ) : (
                <p className="text-white/70">{t('failed_to_load_file')}</p>
              )}
            </div>
            {preview.notes && (
              <p className="text-white/70 text-sm text-center pb-4">{preview.notes}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Thumbnail component that fetches a signed URL on mount for image files */
function FileImageThumb({ file, fetchSignedUrl }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ref, inView] = useInView();

  // Only sign the URL once the thumbnail actually scrolls into view.
  React.useEffect(() => {
    if (!inView) return;
    let active = true;
    fetchSignedUrl(file).then(u => { if (active) { setUrl(u); setLoading(false); } }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [inView, file.id]);

  if (loading) return <div ref={ref} className="w-full h-full flex items-center justify-center"><Loader2 className="w-6 h-6 text-muted-foreground animate-spin" /></div>;
  if (!url) return <div className="w-full h-full flex items-center justify-center"><FileText className="w-8 h-8 text-muted-foreground" /></div>;
  return <img src={url} alt={file.file_name} className="w-full h-full object-cover" />;
}