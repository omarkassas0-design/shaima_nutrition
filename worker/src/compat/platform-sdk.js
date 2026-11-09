import { createClient } from '@supabase/supabase-js';
import { environmentFor } from './environment.js';

const snake = (value) => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const tableFor = (entity) => {
  const value = snake(entity);
  if (entity === 'User') return 'users';
  if (value.endsWith('y') && !/[aeiou]y$/.test(value)) return `${value.slice(0, -1)}ies`;
  return `${value}s`;
};

function throwIfError(error) {
  if (!error) return;
  const result = new Error(error.message || 'Database operation failed.');
  result.code = error.code;
  result.details = error.details;
  throw result;
}

function postgrestFilterValue(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function applyFilters(query, filters = {}) {
  let next = query;
  for (const [column, value] of Object.entries(filters || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [operator, operand] of Object.entries(value)) {
        if (operator === '$options') continue;
        if (operator === '$in') {
          const values = (Array.isArray(operand) ? operand : []).filter((item) => item !== undefined);
          const hasNull = values.includes(null);
          const nonNull = values.filter((item) => item !== null);
          if (hasNull && nonNull.length) next = next.or(`${column}.is.null,${column}.in.(${nonNull.map(postgrestFilterValue).join(',')})`);
          else if (hasNull) next = next.is(column, null);
          else next = next.in(column, nonNull);
        }
        else if (operator === '$ne') next = operand === null ? next.not(column, 'is', null) : next.neq(column, operand);
        else if (operator === '$gte') next = next.gte(column, operand);
        else if (operator === '$gt') next = next.gt(column, operand);
        else if (operator === '$lte') next = next.lte(column, operand);
        else if (operator === '$lt') next = next.lt(column, operand);
        else if (operator === '$regex') {
          const literal = String(operand).replaceAll('\\', '').replace(/[.*+?^${}()|[\]{}]/g, '').replace(/%/g, '\\%').replace(/_/g, '\\_');
          next = next.ilike(column, `%${literal}%`);
        } else if (operator === '$contains') next = next.contains(column, operand);
        else throw new Error(`Unsupported filter operator: ${operator}`);
      }
    } else if (value === null) {
      next = next.is(column, null);
    } else if (Array.isArray(value)) {
      next = next.in(column, value);
    } else {
      next = next.eq(column, value);
    }
  }
  return next;
}

function applySort(query, sort) {
  if (!sort) return query;
  const sorts = Array.isArray(sort) ? sort : [sort];
  let next = query;
  for (const item of sorts) {
    if (typeof item !== 'string' || !item.trim()) continue;
    const descending = item.startsWith('-');
    const column = item.replace(/^-/, '').trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) throw new Error('Invalid sort field.');
    next = next.order(column, { ascending: !descending, nullsFirst: false });
  }
  return next;
}

async function selectMany(client, table, filters, sort, limit, skip = 0) {
  const maxRows = Math.max(0, Math.min(Number(limit) || 500, 10000));
  if (!maxRows) return [];
  const chunkSize = 1000;
  const records = [];
  let offset = Math.max(0, Number(skip) || 0);
  while (records.length < maxRows) {
    const pageSize = Math.min(chunkSize, maxRows - records.length);
    let query = client.from(table).select('*');
    query = applyFilters(query, filters);
    query = applySort(query, sort);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    throwIfError(error);
    records.push(...(data || []));
    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }
  return records;
}

function entityApi(client, entity) {
  const table = tableFor(entity);
  return {
    filter: (filters = {}, sort, limit, skip) => selectMany(client, table, filters, sort, limit, skip),
    list: (sort, limit) => selectMany(client, table, {}, sort, limit),
    async get(id) {
      const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
      throwIfError(error);
      if (!data) throw new Error(`${entity} record not found.`);
      return data;
    },
    async create(record) {
      const { data, error } = await client.from(table).insert(record || {}).select('*').single();
      throwIfError(error);
      return data;
    },
    async bulkCreate(records) {
      if (!Array.isArray(records) || records.length === 0) return [];
      const { data, error } = await client.from(table).insert(records).select('*');
      throwIfError(error);
      return data || [];
    },
    async update(id, patch) {
      const { data, error } = await client.from(table)
        .update({ ...(patch || {}), updated_date: new Date().toISOString() })
        .eq('id', id).select('*').maybeSingle();
      throwIfError(error);
      return data;
    },
    async bulkUpdate(records) {
      if (!Array.isArray(records) || records.length === 0) return [];
      const results = [];
      for (let offset = 0; offset < records.length; offset += 20) {
        const batch = records.slice(offset, offset + 20);
        results.push(...await Promise.all(batch.map(({ id, ...patch }) => this.update(id, patch))));
      }
      return results.filter(Boolean);
    },
    async delete(id) {
      const { error } = await client.from(table).delete().eq('id', id);
      throwIfError(error);
      return { success: true };
    },
    async deleteMany(filters = {}) {
      let query = client.from(table).delete();
      query = applyFilters(query, filters);
      const { error } = await query;
      throwIfError(error);
      return { success: true };
    },
  };
}

function signedStorageReference(value) {
  if (!value || typeof value !== 'string') throw new Error('A private storage reference is required.');
  if (/^https?:\/\//i.test(value)) throw new Error('External file URLs cannot be signed by this storage service.');
  const normalized = value.replace(/^supabase:\/\//i, '').replace(/^\//, '');
  const slash = normalized.indexOf('/');
  if (slash <= 0 || slash === normalized.length - 1) throw new Error('Invalid private storage reference.');
  return { bucket: normalized.slice(0, slash), objectPath: normalized.slice(slash + 1) };
}

function safeFileName(name) {
  return String(name || 'file').normalize('NFKC').replace(/[\\/\0-\x1f\x7f]/g, '_').replace(/\.\.+/g, '_').slice(0, 160) || 'file';
}

async function uploadPrivateFile(service, { file, clinic_id, patient_id, bucket = 'patient-files' } = {}) {
  const clinicId = clinic_id || service.__clinicScope;
  if (!clinicId) throw new Error('A server-resolved clinic scope is required for private file uploads.');
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('A file payload is required.');
  const bytes = await file.arrayBuffer();
  const mimeType = file.type || 'application/octet-stream';
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error('File exceeds the 20 MB upload limit.');
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/dicom', 'application/dicom', 'text/csv', 'application/json', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']);
  if (!allowed.has(mimeType)) throw new Error('This file type is not allowed.');
  const folder = safeFileName(patient_id || 'general');
  const objectPath = `${clinicId}/${folder}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await service.storage.from(bucket).upload(objectPath, bytes, { contentType: mimeType, upsert: false });
  throwIfError(error);
  return { file_uri: `${bucket}/${objectPath}`, file_name: safeFileName(file.name), file_size: bytes.byteLength, content_type: mimeType };
}

async function googleDriveConnection(env) {
  if (env.GOOGLE_DRIVE_ACCESS_TOKEN) return { accessToken: env.GOOGLE_DRIVE_ACCESS_TOKEN };
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('Google Drive backup is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN as Worker secrets.');
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw new Error(`Google Drive token refresh failed (${response.status}).`);
  return { accessToken: result.access_token };
}

function emailProvider(env) {
  return async (args) => {
    if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) throw new Error('Email delivery is not configured. Set EMAIL_API_KEY and EMAIL_FROM as Worker secrets/variables.');
    const recipients = Array.isArray(args.to) ? args.to : [args.to];
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.EMAIL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: args.from || env.EMAIL_FROM, to: recipients, subject: args.subject || '', html: args.body || args.html || '' }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Email provider rejected delivery (${response.status}): ${result.message || result.error || 'unknown provider error'}`);
    return { id: result.id, status: 'sent' };
  };
}

function jwtClaims(token) {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
}

export function createClientFromRequest(request) {
  const env = environmentFor(request);
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase Worker bindings are not configured.');
  }
  const bearer = request.headers.get('authorization') || '';
  const accessToken = bearer.match(/^Bearer\s+(.+)$/i)?.[1] || null;
  const publicClient = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const serviceClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const service = {
    env,
    storage: serviceClient.storage,
    rpc: (name, args) => serviceClient.rpc(name, args),
    __clinicScope: null,
    setClinicScope(clinicId) { this.__clinicScope = clinicId || null; },
    entities: new Proxy({}, { get: (_target, entity) => entityApi(serviceClient, String(entity)) }),
    integrations: { Core: {
      UploadPrivateFile: (args) => uploadPrivateFile(service, args),
      async CreateFileSignedUrl({ file_uri, expires_in = 300 } = {}) {
        const { bucket, objectPath } = signedStorageReference(file_uri);
        const { data, error } = await serviceClient.storage.from(bucket).createSignedUrl(objectPath, Math.min(Math.max(Number(expires_in) || 300, 60), 3600));
        throwIfError(error);
        return { signed_url: data.signedUrl, file_url: data.signedUrl, expires_in };
      },
      SendEmail: emailProvider(env),
      async UploadFile({ file } = {}) {
        const upload = await uploadPrivateFile(service, { file, bucket: 'clinic-assets' });
        const { data } = serviceClient.storage.from('clinic-assets').getPublicUrl(upload.file_uri.split('/').slice(1).join('/'));
        return { ...upload, file_url: data.publicUrl };
      },
      async ExtractDataFromUploadedFile({ file_url, file_uri, ...options } = {}) {
        if (!env.DOCUMENT_EXTRACTION_URL) throw new Error('Document extraction is not configured. Set DOCUMENT_EXTRACTION_URL and its token as Worker secrets.');
        const response = await fetch(env.DOCUMENT_EXTRACTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(env.DOCUMENT_EXTRACTION_TOKEN ? { Authorization: `Bearer ${env.DOCUMENT_EXTRACTION_TOKEN}` } : {}) },
          body: JSON.stringify({ file_url, file_uri, ...options }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`Document extraction provider failed (${response.status}).`);
        return body;
      },
    } },
    connectors: {
      async getConnection(name) {
        if (name !== 'googledrive') throw new Error(`Unsupported connector: ${name}`);
        return googleDriveConnection(env);
      },
    },
  };
  const entities = new Proxy({}, { get: (_target, entity) => entityApi(publicClient, String(entity)) });
  return {
    env,
    entities,
    asServiceRole: service,
    users: {
      async inviteUser(email, role = 'user') {
        if (role !== 'user') throw new Error('Only the standard Supabase Auth role is supported for invitations.');
        const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email);
        throwIfError(error);
        return data;
      },
    },
    auth: {
      async me() {
        if (!accessToken) return null;
        const { data: authData, error } = await publicClient.auth.getUser(accessToken);
        if (error || !authData?.user) return null;
        const user = authData.user;
        const claims = jwtClaims(accessToken);
        const { data: factorData, error: factorsError } = await serviceClient.auth.admin.mfa.listFactors(user.id);
        if (factorsError) throwIfError(factorsError);
        const hasVerifiedFactor = (factorData?.factors || []).some((factor) => factor.status === 'verified');
        const { data: profile, error: profileError } = await serviceClient.from('users').select('*').eq('id', user.id).maybeSingle();
        if (profileError && profileError.code !== 'PGRST116') throwIfError(profileError);
        const metadata = user.user_metadata || {};
        return {
          ...(profile || {}),
          id: user.id,
          email: user.email || profile?.email || '',
          full_name: profile?.full_name || metadata.full_name || metadata.name || '',
          data: { ...metadata, ...(profile?.data || {}) },
          role: profile?.role || metadata.role || 'user',
          created_date: user.created_at,
          mfa_required: hasVerifiedFactor && (claims.aal || 'aal1') !== 'aal2',
        };
      },
    },
  };
}

export async function uploadForAuthenticatedUser(request, { kind = 'patient-file', file, clinicId, patientId } = {}) {
  const env = environmentFor(request);
  const sdk = createClientFromRequest(request);
  const { error, user, clinicId: authoritativeClinicId, authoritativeRole } = await (await import('../legacy/shared/clinicAuth.ts')).getAuthenticatedClinicUser(request, clinicId);
  if (error) return error;
  const service = sdk.asServiceRole;
  service.setClinicScope(authoritativeClinicId);
  const role = authoritativeRole;
  const isAsset = kind === 'clinic-asset';
  if (isAsset && !['clinic_admin', 'super_admin'].includes(role)) return Response.json({ error: 'Clinic administrator access is required to upload clinic branding.' }, { status: 403 });
  if (!isAsset && !['clinic_admin', 'doctor', 'receptionist', 'super_admin'].includes(role)) return Response.json({ error: 'File upload is not allowed for this role.' }, { status: 403 });
  const bucket = isAsset ? 'clinic-assets' : kind === 'import' ? 'import-staging' : 'patient-files';
  const allowed = new Set(isAsset ? ['image/jpeg', 'image/png', 'image/webp'] : kind === 'import'
    ? ['text/csv', 'application/json', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
    : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/dicom', 'application/dicom']);
  if (!file || typeof file.arrayBuffer !== 'function') return Response.json({ error: 'A file is required.' }, { status: 400 });
  if (file.size > (isAsset ? 10 : 20) * 1024 * 1024) return Response.json({ error: 'The file exceeds the upload size limit.' }, { status: 413 });
  if (!allowed.has(file.type)) return Response.json({ error: 'This file type is not allowed.' }, { status: 415 });
  try {
    const upload = await uploadPrivateFile(service, { file, clinic_id: authoritativeClinicId, patient_id: patientId, bucket });
    if (isAsset) {
      const objectPath = upload.file_uri.split('/').slice(1).join('/');
      const { data } = service.storage.from(bucket).getPublicUrl(objectPath);
      return Response.json({ ...upload, file_url: data.publicUrl });
    }
    const { data, error: signedError } = await service.storage.from(bucket).createSignedUrl(upload.file_uri.split('/').slice(1).join('/'), 900);
    throwIfError(signedError);
    return Response.json({ ...upload, file_url: data.signedUrl, file_uri: upload.file_uri });
  } catch (error) {
    console.error('Private upload failed:', error?.message || error);
    return Response.json({ error: error?.message || 'Upload failed.' }, { status: 500 });
  }
}
