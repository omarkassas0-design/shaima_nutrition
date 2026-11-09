import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react';

/**
 * Export toolbar for the Patients page.
 * - "Select All Patients" checkbox → exports ALL clinic patients
 * - Individual patient checkboxes (managed by parent) → exports only those
 * - Buttons are disabled when nothing is selected and Select All is off.
 */
export default function PatientExportBar({
  selectAll,
  onSelectAllChange,
  selectedCount,
  onExport,
  isExporting,
}) {
  const disabled = !selectAll && selectedCount === 0;

  return (
    <div className="glass rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={selectAll}
          onCheckedChange={onSelectAllChange}
        />
        <span className="text-sm font-medium">Select All Patients</span>
      </div>
      <span className="text-xs text-muted-foreground">
        Selected: {selectAll ? 'All clinic patients' : `${selectedCount} patient${selectedCount !== 1 ? 's' : ''}`}
      </span>
      <div className="flex items-center gap-2 ml-auto">
        <Button
          size="sm"
          variant="outline"
          disabled={isExporting || disabled}
          onClick={() => onExport('pdf')}
        >
          {isExporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />}
          Download PDF
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isExporting || disabled}
          onClick={() => onExport('excel')}
        >
          {isExporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1.5" />}
          Export Excel
        </Button>
      </div>
    </div>
  );
}