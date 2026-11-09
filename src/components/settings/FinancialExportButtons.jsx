import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useLanguage } from '@/lib/useLanguage';
import { useClinic } from '@/lib/useClinic';
import { useSuperAdmin } from '@/lib/SuperAdminContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileSpreadsheet, FileText, Loader2, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { exportFinancialExcel, exportFinancialPDF } from '@/lib/financialExport';

export default function FinancialExportButtons() {
  const { t, lang } = useLanguage();
  const { clinic } = useClinic();
  const { managedClinicId } = useSuperAdmin();
  const [loading, setLoading] = useState(null); // 'excel' | 'pdf' | null

  // Separate date range — independent from Clinic Data Export
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const [finDateFrom, setFinDateFrom] = useState(defaultFrom);
  const [finDateTo, setFinDateTo] = useState(now.toISOString().split('T')[0]);

  const validate = () => {
    if (!finDateFrom || !finDateTo) {
      toast.error(t('date_range_required'));
      return false;
    }
    if (finDateFrom > finDateTo) {
      toast.error(t('from_date_after_to_date'));
      return false;
    }
    return true;
  };

  const handleExport = async (format) => {
    if (!validate()) return;
    setLoading(format);
    try {
      const res = await appClient.functions.invoke('getReportsStats', {
        clinic_id: managedClinicId || clinic?.id || null,
        date_from: finDateFrom,
        date_to: finDateTo,
      });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);

      const clinicInfo = clinic || {};
      if (format === 'excel') {
        await exportFinancialExcel(data, clinicInfo, finDateFrom, finDateTo, lang);
      } else {
        exportFinancialPDF(data, clinicInfo, finDateFrom, finDateTo, lang);
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
              <DollarSign className="w-4 h-4 text-primary" /> {t('financial_export_title')}
            </p>
            <p className="text-xs text-muted-foreground">{t('financial_export_desc')}</p>
          </div>
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('from')}</Label>
            <Input
              type="date"
              value={finDateFrom}
              onChange={e => setFinDateFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('to')}</Label>
            <Input
              type="date"
              value={finDateTo}
              onChange={e => setFinDateTo(e.target.value)}
              className="w-44"
            />
          </div>
          {finDateFrom && finDateTo && finDateFrom > finDateTo && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {t('from_date_after_to_date')}
            </p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => handleExport('excel')}
            disabled={!!loading || (finDateFrom > finDateTo)}
            variant="outline"
          >
            {loading === 'excel' ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('preparing_export')}</>
            ) : (
              <><FileSpreadsheet className="w-4 h-4 mr-2" />{t('download_excel')}</>
            )}
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            disabled={!!loading || (finDateFrom > finDateTo)}
            className="gradient-primary text-white"
          >
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