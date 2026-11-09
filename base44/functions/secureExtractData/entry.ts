import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getAuthenticatedClinicUser } from '../../shared/clinicAuth.ts';
import { enforceRateLimit } from '../../shared/rateLimiter.ts';

/**
 * Secure gateway for the ExtractDataFromUploadedFile credit-consuming
 * integration. Only authenticated clinic users (with a valid clinic
 * assignment) can invoke this — preventing unauthorized credit usage from
 * public/client-side access.
 *
 * The actual integration call runs server-side via the service role, so the
 * client never has direct access to the credit-consuming endpoint.
 *
 * Body: { file_url: string, json_schema: object }
 */
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { file_url, json_schema } = body;

    if (!file_url || !json_schema) {
      return Response.json({ error: 'file_url and json_schema are required' }, { status: 400 });
    }

    // Authoritative auth + clinic isolation check — rejects unauthenticated
    // users and users without a valid clinic assignment.
    const { error, user, base44, clinicId } = await getAuthenticatedClinicUser(req);
    if (error) return error;

    const rl = enforceRateLimit(user.id, 'secureExtractData');
    if (rl) return rl;

    // Call the credit-consuming integration server-side only.
    const result = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: 'Extract failed: ' + (error?.message || 'Unknown') }, { status: 500 });
  }
}