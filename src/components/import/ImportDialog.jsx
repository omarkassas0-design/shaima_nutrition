import React, { useState, useRef } from 'react';
import { appClient } from '@/api/appClient';
import { clinicApi } from '@/lib/clinicApi';
import { useClinic } from '@/lib/useClinic';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { ENTITY_IMPORT_CONFIGS as ENTITY_CONFIGS, normalizeRecord, buildSchemaWithHints, stripSystemFields, normalizeValue } from '@/lib/importColumnMapping';

export default function ImportDialog({ open, onOpenChange }) {
  const { clinic } = useClinic();
  const fileRef = useRef(null);
  const [entityType, setEntityType] = useState('patients');
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [validRows, setValidRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const reset = () => {
    setFile(null); setFileUrl(null); setValidRows([]); setErrors([]); setImportResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFileSelect = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setValidRows([]); setErrors([]); setImportResult(null);

    // Validate file type
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const ext = selected.name.substring(selected.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(ext)) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }

    // Upload file
    setUploading(true);
    try {
      const { file_url } = await appClient.integrations.Core.UploadImportFile({ file: selected, clinic_id: clinic?.id });
      setFileUrl(file_url);
      await extractAndValidate(file_url);
    } catch (e) {
      toast.error('Upload failed: ' + (e?.message || 'Unknown'));
    } finally {
      setUploading(false);
    }
  };

  const extractAndValidate = async (url) => {
    setExtracting(true);
    setErrors([]); setValidRows([]);
    try {
      const config = ENTITY_CONFIGS[entityType];
      const schema = buildSchemaWithHints(entityType);

      const extractRes = await appClient.functions.invoke('secureExtractData', {
        file_url: url,
        json_schema: {
          type: 'object',
          properties: {
            records: {
              type: 'array',
              items: { type: 'object', properties: schema },
            },
          },
        },
      });
      const result = extractRes.data || extractRes;

      const records = result?.output?.records || result?.output || [];
      if (!Array.isArray(records) || records.length === 0) {
        setErrors([{ row: 0, error: 'No records found in file' }]);
        return;
      }

      // Normalize column names: map exported headers (Full Name, الاسم الكامل, etc.)
      // to the correct database field names (full_name, etc.)
      const normalizedRecords = records.map((r) => normalizeRecord(entityType, r));

      // Validate
      const valid = [];
      const errs = [];
      const seenKeys = new Set();

      normalizedRecords.forEach((row, idx) => {
        const rowErrors = [];

        // Check required fields
        for (const field of config.requiredFields) {
          if (!row[field] || String(row[field]).trim() === '') {
            rowErrors.push(`Missing required field: ${field}`);
          }
        }

        // Check data types
        for (const [field, type] of Object.entries(config.fieldTypes)) {
          if (row[field] === undefined || row[field] === null || row[field] === '') continue;
          if (Array.isArray(type)) {
            // Normalize translated values (Arabic/Turkish) to canonical enum values
            row[field] = normalizeValue(field, row[field]);
            const valueStr = String(row[field]);
            const matchedValue = type.find((v) => v.toLowerCase() === valueStr.toLowerCase());
            if (!matchedValue) {
              rowErrors.push(`Invalid value for ${field}: "${row[field]}" (must be one of: ${type.join(', ')})`);
            } else {
              row[field] = matchedValue; // normalize to correct case
            }
          } else if (type === 'number') {
            if (isNaN(Number(row[field]))) {
              rowErrors.push(`Invalid number for ${field}: "${row[field]}"`);
            }
          } else if (type === 'date') {
            const d = new Date(row[field]);
            if (isNaN(d.getTime())) {
              rowErrors.push(`Invalid date for ${field}: "${row[field]}"`);
            } else {
              row[field] = d.toISOString().slice(0, 10);
            }
          }
        }

        // Check duplicates within file
        if (config.dedupeKeys.length > 0) {
          const key = config.dedupeKeys.map((k) => String(row[k] || '')).join('|');
          if (seenKeys.has(key)) {
            rowErrors.push('Duplicate record in file');
          } else {
            seenKeys.add(key);
          }
        }

        if (rowErrors.length > 0) {
          errs.push({ row: idx + 2, error: rowErrors.join('; '), data: row });
        } else {
          valid.push(row);
        }
      });

      setValidRows(valid);
      setErrors(errs);
    } catch (e) {
      setErrors([{ row: 0, error: 'Failed to extract data: ' + (e?.message || 'Unknown') }]);
    } finally {
      setExtracting(false);
    }
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setImportResult(null);
    try {
      const config = ENTITY_CONFIGS[entityType];

      // clinic_id is derived server-side by clinicScopedCrud — never trust client.
      // Strip system fields (id, created_date, etc.) that may have been exported.
      const records = validRows.map((r) => stripSystemFields({ ...r }));

      // Bulk create through the secure backend function
      let success = 0, failed = 0;
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        try {
          await clinicApi.bulkCreate(config.entityName, batch);
          success += batch.length;
        } catch (e) {
          failed += batch.length;
          console.error('Batch failed:', e?.message);
        }
      }

      setImportResult({ success, failed, total: records.length });
      if (failed === 0) {
        toast.success(`Successfully imported ${success} record(s)`);
      } else {
        toast.warning(`Imported ${success}, failed ${failed}`);
      }
    } catch (e) {
      toast.error('Import failed: ' + (e?.message || 'Unknown'));
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleEntityChange = (v) => {
    setEntityType(v);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Data from Excel/CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Entity type selector */}
          <div className="space-y-1.5">
            <Label>Import Type</Label>
            <Select value={entityType} onValueChange={handleEntityChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ENTITY_CONFIGS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File upload */}
          <div className="space-y-1.5">
            <Label>File (CSV or Excel)</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                disabled={uploading || extracting}
              />
              {file && (
                <Button size="icon" variant="ghost" onClick={reset}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {(uploading || extracting) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                {uploading ? 'Uploading file…' : 'Extracting and validating data…'}
              </div>
            )}
          </div>

          {/* Validation results */}
          {fileUrl && !uploading && !extracting && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="font-medium">{validRows.length}</span> valid
                </div>
                {errors.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="font-medium">{errors.length}</span> errors
                  </div>
                )}
                <div className="text-xs text-muted-foreground ml-auto">
                  {validRows.length > 0 && `${validRows.length} record(s) will be imported`}
                </div>
              </div>

              {/* Error details */}
              {errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 p-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
                    Validation Errors ({errors.length}):
                  </p>
                  <div className="space-y-1">
                    {errors.slice(0, 20).map((err, i) => (
                      <div key={i} className="text-xs text-amber-700 dark:text-amber-400">
                        <span className="font-medium">Row {err.row}:</span> {err.error}
                      </div>
                    ))}
                    {errors.length > 20 && (
                      <div className="text-xs text-muted-foreground">…and {errors.length - 20} more</div>
                    )}
                  </div>
                </div>
              )}

              {/* Import result */}
              {importResult && (
                <div className={`p-3 rounded-lg border ${importResult.failed === 0 ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/50' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50'}`}>
                  <p className="text-sm font-medium">
                    Import complete: {importResult.success} succeeded, {importResult.failed} failed (of {importResult.total})
                  </p>
                </div>
              )}

              {/* Actions */}
              {!importResult && validRows.length > 0 && (
                <div className="flex gap-2">
                  <Button onClick={handleImport} disabled={importing} className="gradient-primary text-white">
                    {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Import {validRows.length} Record(s)
                  </Button>
                  <Button variant="outline" onClick={handleClose}>Cancel</Button>
                </div>
              )}

              {importResult && (
                <Button onClick={handleClose} className="w-full">Done</Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
