import { requireSupabase, supabase } from './supabaseClient';

const snake = (value) => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const tableFor = (entity) => {
  const value = snake(entity);
  if (entity === 'User') return 'users';
  if (value.endsWith('y') && !/[aeiou]y$/.test(value)) return `${value.slice(0, -1)}ies`;
  return `${value}s`;
};

const postgrestFilterValue = (value) => `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

function applyFilters(query, filters = {}) {
  let next = query;
  for (const [column, value] of Object.entries(filters || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [operator, operand] of Object.entries(value)) {
        if (operator === '$options') continue;
        if (operator === '$ne') next = operand === null ? next.not(column, 'is', null) : next.neq(column, operand);
        else if (operator === '$in') {
          const values = (Array.isArray(operand) ? operand : []).filter((item) => item !== undefined);
          const hasNull = values.includes(null);
          const nonNull = values.filter((item) => item !== null);
          if (hasNull && nonNull.length) next = next.or(`${column}.is.null,${column}.in.(${nonNull.map(postgrestFilterValue).join(',')})`);
          else if (hasNull) next = next.is(column, null);
          else next = next.in(column, nonNull);
        }
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
    } else if (value === null) next = next.is(column, null);
    else if (Array.isArray(value)) next = next.in(column, value);
    else next = next.eq(column, value);
  }
  return next;
}

function applySort(query, sort) {
  if (!sort) return query;
  const items = Array.isArray(sort) ? sort : [sort];
  let next = query;
  for (const item of items) {
    if (typeof item !== 'string' || !item.trim()) continue;
    const descending = item.startsWith('-');
    const column = item.replace(/^-/, '').trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) throw new Error('Invalid sort field.');
    next = next.order(column, { ascending: !descending, nullsFirst: false });
  }
  return next;
}

async function invokeFunction(name, payload = {}) {
  const client = requireSupabase();
  const { data: { session } } = await client.auth.getSession();
  const response = await fetch(`/api/functions/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Object.assign(new Error(data.error || data.detail || `Request failed (${response.status}).`), {
      response: { data, status: response.status },
      code: data.code,
    });
    throw error;
  }
  return { data };
}

function entityClient(entity) {
  const table = tableFor(entity);
  const directRlsEntity = entity === 'Clinic' || entity === 'Notification';
  const invokeCrud = async (action, payload = {}) => {
    const { data } = await invokeFunction('clinicScopedCrud', { action, entity, ...payload });
    if (data?.error) {
      const error = Object.assign(new Error(data.error), { code: data.code });
      throw error;
    }
    return data;
  };
  return {
    async filter(filters = {}, sort, limit = 500, skip = 0) {
      if (!directRlsEntity) {
        const data = await invokeCrud('filter', { filter: filters, sort, limit, skip });
        return data.records || [];
      }
      const client = requireSupabase();
      let query = client.from(table).select('*');
      query = applyFilters(query, filters);
      query = applySort(query, sort);
      const start = Math.max(0, Number(skip) || 0);
      const size = Math.max(0, Math.min(Number(limit) || 500, 1000));
      if (!size) return [];
      const { data, error } = await query.range(start, start + size - 1);
      if (error) throw error;
      return data || [];
    },
    async list(sort, limit = 500) {
      return this.filter({}, sort, limit);
    },
    async get(id) {
      if (!directRlsEntity) {
        const data = await invokeCrud('get', { id });
        return data.record;
      }
      const client = requireSupabase();
      const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async update(id, patch) {
      if (!directRlsEntity) {
        const data = await invokeCrud('update', { id, patch });
        return data.record;
      }
      const client = requireSupabase();
      const { data, error } = await client.from(table).update(patch || {}).eq('id', id).select('*').maybeSingle();
      if (error) throw error;
      return data;
    },
    async create(record) {
      if (!directRlsEntity) {
        const data = await invokeCrud('create', { record });
        return data.record;
      }
      const client = requireSupabase();
      const { data, error } = await client.from(table).insert(record || {}).select('*').single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      if (!directRlsEntity) return invokeCrud('delete', { id });
      const client = requireSupabase();
      const { error } = await client.from(table).delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    },
    async bulkCreate(records) {
      if (!Array.isArray(records) || !records.length) return [];
      if (!directRlsEntity) {
        const data = await invokeCrud('bulkCreate', { record: records });
        return data.records || [];
      }
      const client = requireSupabase();
      const { data, error } = await client.from(table).insert(records).select('*');
      if (error) throw error;
      return data || [];
    },
    async bulkUpdate(records) {
      if (!Array.isArray(records)) return [];
      const results = [];
      for (const { id, ...patch } of records) results.push(await this.update(id, patch));
      return results.filter(Boolean);
    },
    async deleteMany(filters = {}) {
      if (!directRlsEntity) {
        const records = await this.filter(filters, undefined, 1000);
        await Promise.all(records.map((record) => this.delete(record.id)));
        return { success: true };
      }
      const client = requireSupabase();
      let query = client.from(table).delete();
      query = applyFilters(query, filters);
      const { error } = await query;
      if (error) throw error;
      return { success: true };
    },
  };
}

async function uploadFile(file, kind, clinicId, patientId) {
  const client = requireSupabase();
  const { data: { session } } = await client.auth.getSession();
  const form = new FormData();
  form.set('file', file);
  form.set('kind', kind);
  if (clinicId) form.set('clinic_id', clinicId);
  if (patientId) form.set('patient_id', patientId);
  const response = await fetch('/api/storage/upload', {
    method: 'POST',
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    body: form,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Upload failed (${response.status}).`);
  return result;
}

const auth = {
  async me() {
    if (!supabase) return null;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
    const metadata = user.user_metadata || {};
    return {
      ...(profile || {}),
      id: user.id,
      email: user.email || profile?.email || '',
      full_name: profile?.full_name || metadata.full_name || metadata.name || '',
      role: profile?.role || metadata.role || 'user',
      data: { ...metadata, ...(profile?.data || {}) },
    };
  },
  async loginViaEmailPassword(email, password) {
    const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { ...data, access_token: data.session?.access_token, refresh_token: data.session?.refresh_token };
  },
  async loginWithProvider(provider, returnTo = '/') {
    const target = new URL(returnTo || '/', window.location.origin);
    const redirectTo = target.origin === window.location.origin && !target.pathname.startsWith('//') && !target.pathname.includes('\\')
      ? target.href
      : `${window.location.origin}/`;
    const { data, error } = await requireSupabase().auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) throw error;
    return data;
  },
  async register({ email, password }) {
    const { data, error } = await requireSupabase().auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },
  async verifyOtp({ email, otpCode }) {
    const { data, error } = await requireSupabase().auth.verifyOtp({ email, token: otpCode, type: 'signup' });
    if (error) throw error;
    return data;
  },
  async resendOtp(email) {
    const { data, error } = await requireSupabase().auth.resend({ type: 'signup', email });
    if (error) throw error;
    return data;
  },
  async resetPasswordRequest(email) {
    const { data, error } = await requireSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    return data;
  },
  /** @param {{ newPassword?: string, code?: string }} [options] */
  async resetPassword({ newPassword, code } = {}) {
    const client = requireSupabase();
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session && code) {
      const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
    }
    const { data: current } = await client.auth.getSession();
    if (!current?.session) throw new Error('This password reset link is invalid or has expired. Request a new link.');
    const { data, error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  },
  async updateMe(attributes) {
    const { data, error } = await requireSupabase().auth.updateUser({ data: attributes || {} });
    if (error) throw error;
    return data;
  },
  async logout() {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw error;
  },
  setToken() {
    // Supabase Auth stores sessions from sign-in, OAuth, OTP verification, and MFA verification.
  },
};

const integrations = { Core: {
  UploadFile: ({ file, clinic_id }) => uploadFile(file, 'clinic-asset', clinic_id),
  UploadPrivateFile: ({ file, clinic_id, patient_id }) => uploadFile(file, 'patient-file', clinic_id, patient_id),
  UploadImportFile: ({ file, clinic_id }) => uploadFile(file, 'import', clinic_id),
} };

export const appClient = {
  auth,
  functions: { invoke: invokeFunction },
  entities: new Proxy({}, { get: (_target, entity) => entityClient(String(entity)) }),
  integrations,
};
