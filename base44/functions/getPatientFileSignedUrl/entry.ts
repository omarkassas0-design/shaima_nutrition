import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

/**
 * Returns a time-limited signed URL for a private patient file.
 * Verifies the file belongs to the calling user's clinic before signing.
 * Signed URLs expire after 5 minutes.
 */
export default async function(req) {
  try {
    const body = await req.json();
    const { file_id } = body;
    if (!file_id) return Response.json({ error: 'File ID is required' }, { status: 400 });

    const { error, user, base44, clinicId } = await getAuthenticatedClinicUser(req, body.clinic_id);
    if (error) return error;

    const rateLimitResponse = enforceRateLimit(user.id, 'getPatientFileSignedUrl');
    if (rateLimitResponse) return rateLimitResponse;

    const svc = base44.asServiceRole;

    // Fetch the file record by ID
    let file;
    try {
      file = await svc.entities.PatientFile.get(file_id);
    } catch (e) {
      return Response.json({ error: 'File not found' }, { status: 404 });
    }

    if (!file) {
      return Response.json({ error: 'File not found' }, { status: 404 });
    }

    // Verify the file belongs to the caller's clinic
    if (file.clinic_id !== clinicId) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    // Use file_uri (private storage) for signed URL access.
    // If no file_uri exists, the record is a legacy file that has not been
    // migrated to private storage. The permanent public file_url is a
    // security risk (no expiry) and must NOT be returned. The file must
    // be migrated via migrateLegacyFiles before it can be accessed.
    const fileUri = file.file_uri;
    if (!fileUri) {
      return Response.json({
        error: 'This file has not been migrated to private storage. An administrator must run file migration before it can be accessed.',
        file_id: file_id,
        needs_migration: true,
      }, { status: 404 });
    }

    // Create signed URL with 5-minute expiry
    const result = await svc.integrations.Core.CreateFileSignedUrl({
      file_uri: fileUri,
      expires_in: 300,
    });

    return Response.json({ signed_url: result.signed_url, is_legacy: false });
  } catch (error) {
    return Response.json({ error: 'Failed to generate file access URL' }, { status: 500 });
  }
}