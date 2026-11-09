import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useLanguage } from '@/lib/useLanguage';
import { useClinic } from '@/lib/useClinic';
import { useSuperAdmin } from '@/lib/SuperAdminContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileSpreadsheet, FileText, Loader2, Download, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { exportClinicExcel, exportClinicPDF } from '@/lib/clinicExport';

export default function ClinicExportButtons() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { managedClinicId } = useSuperAdmin();
  const [loading, setLoading] = useState(null); // 'excel' | 'pdf' | null

  // Independent date range — separate from Financial Export
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(now.toISOString().split('T')[0]);

  const validate = () => {
    if (!dateFrom || !dateTo) {
      toast.error(t('date_range_required'));
      return false;
    }
    if (dateFrom > dateTo) {
      toast.error(t('from_date_after_to_date'));
      return false;
    }
    return true;
  };

  const handleExport = async (format) => {
    if (!validate()) return;
    setLoading(format);
    try {
      const res = await appClient.functions.invoke('getClinicExportData', {
        clinic_id: managedClinicId || clinic?.id || null,
        date_from: dateFrom,
        date_to: dateTo,
      });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);

      const clinicInfo = data.clinic || clinic || {};
      if (format === 'excel') {
        await exportClinicExcel(data, clinicInfo, lang, dateFrom, dateTo);
      } else {
        exportClinicPDF(data, clinicInfo, lang, dateFrom, dateTo);
      }
      toast.success(t('saved_success'));
    } catch (e) {
      toast.error(t('failed_to_save') + ': ' + (e?.message || ''));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="glass border-0 shadow-lg">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-sm flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" /> {t('clinic_export_title')}
            </p>
            <p className="text-xs text-muted-foreground">{t('export_clinic_data_desc')}</p>
          </div>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('from')}</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('to')}</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-44"
            />
          </div>
          {dateFrom && dateTo && dateFrom > dateTo && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {t('from_date_after_to_date')}
            </p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => handleExport('excel')} disabled={!!loading || (dateFrom > dateTo)} variant="outline">
            {loading === 'excel' ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('preparing_export')}</>
            ) : (
              <><FileSpreadsheet className="w-4 h-4 mr-2" />{t('download_excel')}</>
            )}
          </Button>
          <Button onClick={() => handleExport('pdf')} disabled={!!loading || (dateFrom > dateTo)} className="gradient-primary text-white">
            {loading === 'pdf' ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('preparing_export')}</>
            ) : (
              <><FileText className="w-4 h-4 mr-2" />{t('download_pdf')}</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}