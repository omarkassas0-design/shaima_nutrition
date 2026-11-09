import { clinicApi } from '@/lib/clinicApi';
import { toast } from 'sonner';
import { queryClientInstance } from '@/lib/query-client';

const BUILT_IN_FIELDS = ['id', 'created_date', 'updated_date', 'created_by_id'];

/**
 * Deletes a record and shows an Undo toast.
 * Uses the clinicScopedCrud backend function (authoritative clinic_id) so a
 * tampered client-side data.clinic_id cannot delete another clinic's record.
 * If the user clicks Undo within the window, the record is re-created
 * through the same secure path (clinic_id forced server-side).
 */
export async function deleteWithUndo(entityName, record, label = 'Record', onRestored, overrideClinicId) {
  const result = await clinicApi.delete(entityName, record.id, overrideClinicId);
  queryClientInstance.invalidateQueries({ queryKey: ['auditLog'] });
  const auditId = result?.audit_id;

  toast.success(`${label} deleted`, {
    action: {
      label: 'Undo',
      onClick: async () => {
        try {
          if (auditId) {
            await clinicApi.restore(entityName, auditId, overrideClinicId);
          } else {
            const restoreData = { ...record };
            BUILT_IN_FIELDS.forEach(f => delete restoreData[f]);
            await clinicApi.create(entityName, restoreData, overrideClinicId);
          }
          toast.success(`${label} restored`);
          if (onRestored) onRestored();
        } catch (e) {
          toast.error(`Failed to restore: ${e.message}`);
        }
      },
    },
    duration: 8000,
  });
}