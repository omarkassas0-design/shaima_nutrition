import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { clinicApi } from '@/lib/clinicApi';

const ACTION_BADGE = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-rose-100 text-rose-700',
  restore: 'bg-amber-100 text-amber-700',
};

// Built-in / internal fields that add no clinical value to the details view.
const SKIP_FIELDS = ['clinic_id', 'created_by_id'];

function formatValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length > 0 ? JSON.stringify(value) : '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * Shows details for an audit entry.
 *
 * - Delete actions: shows the stored record_snapshot immediately (no fetch).
 * - Create/Update/Restore actions: fetches the LIVE record by record_id via
 *   clinicScopedCrud so the user sees the exact record the action was
 *   performed on — not just a generic list page.
 * - If the record no longer exists (deleted after the audit entry), shows a
 *   "record no longer exists" notice with the audit summary.
 */
export default function AuditEntrySnapshotDialog({ entry, open, onOpenChange }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const hasSnapshot = !!(entry?.record_snapshot && Object.keys(entry.record_snapshot).length > 0);
  const isDelete = entry?.action === 'delete';

  useEffect(() => {
    if (!open || !entry) return;

    // For delete actions with a stored snapshot, show it immediately — no fetch.
    if (isDelete && hasSnapshot) {
      setRecord(entry.record_snapshot);
      setNotFound(false);
      setLoading(false);
      return;
    }

    // For create/update actions, fetch the live record by record_id.
    if (entry.record_id && entry.entity_name) {
      setLoading(true);
      setNotFound(false);
      setRecord(null);
      clinicApi.get(entry.entity_name, entry.record_id)
        .then(r => { setRecord(r); setLoading(false); })
        .catch(() => { setNotFound(true); setLoading(false); });
    } else {
      setNotFound(true);
      setLoading(false);
      setRecord(null);
    }
  }, [open, entry?.id]);

  if (!entry) return null;

  const displayRecord = record || (hasSnapshot ? entry.record_snapshot : null);
  const fields = displayRecord
    ? Object.entries(displayRecord).filter(([k]) => !SKIP_FIELDS.includes(k))
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge className={`text-xs ${ACTION_BADGE[entry.action] || 'bg-secondary'}`}>
              {entry.action}
            </Badge>
            <span>{entry.entity_name}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{entry.summary}</p>
          <p className="text-xs text-muted-foreground">{entry.user_name || '—'}</p>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {notFound && !loading && (
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                This record could not be loaded. It may have been permanently
                deleted, or you may not have permission to view it.
              </p>
            </div>
          )}

          {!loading && !notFound && fields.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 max-h-[50vh] overflow-y-auto">
              {fields.map(([key, value]) => (
                <div key={key} className="flex gap-2 text-sm">
                  <span className="font-medium min-w-[120px] text-muted-foreground shrink-0">{key}:</span>
                  <span className="break-all whitespace-pre-wrap">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}