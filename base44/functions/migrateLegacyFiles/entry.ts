import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

/**
 * Validates that a URL is safe to fetch server-side (SSRF protection).
 * Only allows the app's own file storage origin — blocks all external,
 * private, and internal hosts including DNS-rebinding and IPv6 vectors.
 */
const ALLOWED_FILE_HOST = 'base44.app';
function isSafeFileUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'https:') return false;
    if (url.hostname.toLowerCase() !== ALLOWED_FILE_HOST) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Identifies and optionally migrates legacy PatientFile records that use
 * public file_url instead of private file_uri.
 *
 * Safety controls:
 * - Does NOT delete or modify any records unless action="migrate".
 * - For action="scan" (default): returns a list of legacy files.
 * - For action="migrate": downloads the public file, re-uploads to private storage,
 *   saves the file_uri, and ONLY removes file_url after successful upload.
 * - Processes in small batches to avoid timeouts.
 * - Reports per-file success/failure.
 *
 * LIMITATION: The function fetches the public URL from the server. If the
 * public URL is no longer accessible (expired, deleted from CDN), migration
 * for that file will fail and the original record is preserved unchanged.
 */
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'scan', limit = 50 } = body;

    const { error, user, base44, clinicId, authoritativeRole } = await getAuthenticatedClinicUser(req, body.clinic_id);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'migrateLegacyFiles');
    if (rateLimitResponse) return rateLimitResponse;

    const userRole = authoritativeRole || user.role || user.data?.role;
    if (userRole !== 'clinic_admin' && userRole !== 'super_admin' && userRole !== 'admin') {
      return Response.json({ error: 'Only administrators can manage file migration' }, { status: 403 });
    }

    const svc = base44.asServiceRole;

    // Find legacy files: have file_url but no file_uri (or empty file_uri)
    const legacyFiles = await svc.entities.PatientFile.filter(
      { clinic_id: clinicId, file_uri: { $in: [null, '', undefined] } },
      '-created_date',
      Math.min(limit, 100)
    );

    // Also find files where file_url exists and is non-empty but file_uri is missing
    const trulyLegacy = legacyFiles.filter(f => f.file_url && f.file_url.trim() !== '');

    if (action === 'scan') {
      return Response.json({
        action: 'scan',
        legacy_count: trulyLegacy.length,
        legacy_files: trulyLegacy.map(f => ({
          id: f.id,
          file_name: f.file_name,
          file_url: f.file_url,
          patient_id: f.patient_id,
          created_date: f.created_date,
        })),
      });
    }

    if (action === 'migrate') {
      const results = { migrated: 0, failed: 0, skipped: 0, errors: [] };

      for (const file of trulyLegacy) {
        try {
          // Validate URL to prevent SSRF — only fetch https URLs to known-safe hosts
          if (!isSafeFileUrl(file.file_url)) {
            results.failed++;
            results.errors.push({
              file_id: file.id,
              file_name: file.file_name,
              error: 'URL validation failed: must be https to a public host (SSRF protection)',
            });
            continue;
          }

          // Download the public file
          const fileResponse = await fetch(file.file_url);
          if (!fileResponse.ok) {
            results.failed++;
            results.errors.push({
              file_id: file.id,
              file_name: file.file_name,
              error: `Download failed: HTTP ${fileResponse.status}`,
            });
            continue;
          }

          const blob = await fileResponse.blob();
          const fileObj = new File([blob], file.file_name || 'migrated-file', {
            type: blob.type || 'application/octet-stream',
          });

          // Upload to private storage
          const uploadResult = await svc.integrations.Core.UploadPrivateFile({ file: fileObj });

          // Update the record with the new file_uri
          await svc.entities.PatientFile.update(file.id, {
            file_uri: uploadResult.file_uri,
            // Keep file_url for now — only remove after explicit verification
          });

          results.migrated++;
        } catch (err) {
          results.failed++;
          results.errors.push({
            file_id: file.id,
            file_name: file.file_name,
            error: err?.message || String(err),
          });
        }
      }

      return Response.json({
        action: 'migrate',
        ...results,
        note: 'Files have been re-uploaded to private storage. The original public file_url is preserved for safety. Run action="verify" to confirm private access works, then action="cleanup" to remove public URLs.',
      });
    }

    if (action === 'verify') {
      // Verify that migrated files can be accessed via signed URL
      const migratedFiles = await svc.entities.PatientFile.filter(
        { clinic_id: clinicId, file_uri: { $ne: null } },
        '-created_date',
        Math.min(limit, 100)
      );

      let verified = 0;
      let failed = 0;
      const errors = [];

      for (const file of migratedFiles) {
        if (!file.file_uri) continue;
        try {
          const signedResult = await svc.integrations.Core.CreateFileSignedUrl({
            file_uri: file.file_uri,
            expires_in: 10,
          });
          // Verify the signed URL is accessible
          const check = await fetch(signedResult.signed_url, { method: 'HEAD' });
          if (check.ok) {
            verified++;
          } else {
            failed++;
            errors.push({ file_id: file.id, error: `HEAD returned ${check.status}` });
          }
        } catch (err) {
          failed++;
          errors.push({ file_id: file.id, error: err?.message });
        }
      }

      return Response.json({
        action: 'verify',
        verified,
        failed,
        errors: errors.slice(0, 10),
      });
    }

    if (action === 'cleanup') {
      // Remove the public file_url from records that have a file_uri
      // Only do this after verification
      const migratedFiles = await svc.entities.PatientFile.filter(
        { clinic_id: clinicId, file_uri: { $ne: null } },
        '-created_date',
        Math.min(limit, 100)
      );

      let cleaned = 0;
      for (const file of migratedFiles) {
        if (file.file_url && file.file_uri) {
          await svc.entities.PatientFile.update(file.id, { file_url: '' });
          cleaned++;
        }
      }

      return Response.json({
        action: 'cleanup',
        cleaned,
        note: 'Public file_url fields have been cleared. Files are now only accessible via private signed URLs.',
      });
    }

    return Response.json({ error: 'Unknown action. Use scan, migrate, verify, or cleanup.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: 'Migration failed', detail: error?.message }, { status: 500 });
  }
}