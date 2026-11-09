import { requireSupabase } from '@/api/supabaseClient';
const challengeKey = 'auradental_mfa_challenge';
const providerName = (provider) => provider === 'microsoft' ? 'azure' : provider;

function safePath(value) {
  const target = new URL(value || '/dashboard', window.location.origin);
  if (target.origin !== window.location.origin || !target.pathname.startsWith('/') || target.pathname.startsWith('//') || target.pathname.includes('\\')) return '/dashboard';
  return `${target.pathname}${target.search}`;
}

export class MfaError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
  get mustSignInAgain() { return this.status === 401; }
}

function factorsFrom(data) {
  return [...(data?.totp || []), ...(data?.phone || [])].filter((factor) => factor.status === 'verified');
}

function methodFor(factor) {
  return factor.factor_type === 'phone' ? 'sms' : 'totp';
}

function phoneHint(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 3 ? `••• ${digits.slice(-4)}` : 'your phone';
}

async function listFactors() {
  const { data, error } = await requireSupabase().auth.mfa.listFactors();
  if (error) throw error;
  return data;
}

export async function createMfaChallenge(intent = 'signin') {
  const client = requireSupabase();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new MfaError('Your sign-in session expired. Sign in again.', 401);
  const factorData = await listFactors();
  const factors = factorsFrom(factorData);
  const factorIds = {};
  for (const factor of factors) factorIds[methodFor(factor)] ||= factor.id;
  const challenge = {
    next_step: factors.length ? 'verify' : 'enroll',
    mfa_methods: [...new Set(factors.map(methodFor))],
    factor_ids: factorIds,
    phone_hint: phoneHint(factors.find((factor) => factor.factor_type === 'phone')?.phone),
    intent,
  };
  return challenge;
}

export async function loginWithMfa(email, password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) throw assuranceError;
  if (assurance.currentLevel === 'aal1' && assurance.nextLevel === 'aal2') {
    const challenge = await createMfaChallenge('signin');
    sessionStorage.setItem(challengeKey, JSON.stringify(challenge));
    return { mfa_required: true };
  }
  sessionStorage.removeItem(challengeKey);
  return { ...data, access_token: data.session?.access_token };
}

export async function continueMfa(_result, returnTo) {
  const challenge = await createMfaChallenge('signin');
  sessionStorage.setItem(challengeKey, JSON.stringify(challenge));
  window.location.assign(new URL(`/mfa?flow=signin&returnTo=${encodeURIComponent(safePath(returnTo))}`, window.location.origin).href);
}

export async function loginWithSocial(provider, returnTo) {
  const client = requireSupabase();
  const redirectTo = new URL(safePath(returnTo), window.location.origin).href;
  const { data, error } = await client.auth.signInWithOAuth({ provider: providerName(provider), options: { redirectTo } });
  if (error) throw error;
  return data;
}

export function loginWithGoogle(returnTo) {
  return loginWithSocial('google', returnTo);
}

export async function signInToManageMfa(email, password) {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return createMfaChallenge('manage');
}

export function mfaSession(challenge) {
  const client = requireSupabase();
  const factorIds = { ...(challenge?.factor_ids || {}) };
  const challengeIds = {};
  const pendingFactorIds = {};

  const factorFor = async (method) => {
    if (pendingFactorIds[method]) return pendingFactorIds[method];
    if (factorIds[method]) return factorIds[method];
    const factors = factorsFrom(await listFactors());
    const factor = factors.find((item) => methodFor(item) === method);
    if (!factor) throw new MfaError(`No ${method === 'sms' ? 'phone' : 'authenticator'} factor is enrolled.`, 400);
    factorIds[method] = factor.id;
    return factor.id;
  };

  const startChallenge = async (method, factorId) => {
    const id = factorId || await factorFor(method);
    const { data, error } = await client.auth.mfa.challenge({ factorId: id });
    if (error) throw error;
    challengeIds[method] = data.id;
    return data.id;
  };

  const verify = async (method, code) => {
    const factorId = await factorFor(method);
    const challengeId = challengeIds[method] || await startChallenge(method, factorId);
    const { data, error } = await client.auth.mfa.verify({ factorId, challengeId, code });
    if (error) throw new MfaError(error.message || 'Invalid verification code.');
    const result = {
      access_token: data?.session?.access_token,
      factor_id: factorId,
      method,
    };
    if (challenge?.intent === 'manage') result.mfa_management_token = 'supabase-authenticated-session';
    return result;
  };

  const removeReplacedFactors = async (method, keepId) => {
    if (challenge?.intent !== 'manage') return;
    const factorType = method === 'sms' ? 'phone' : 'totp';
    const existing = factorsFrom(await listFactors()).filter((factor) => factor.factor_type === factorType && factor.id !== keepId);
    for (const factor of existing) {
      const { error } = await client.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
    }
    factorIds[method] = keepId;
  };

  return {
    verify: (code, method) => verify(method, code),
    sendSignInCode: (method = 'sms') => startChallenge(method),
    async setupAuthenticator() {
      const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `AuraDental ${new Date().toLocaleDateString()}` });
      if (error) throw error;
      pendingFactorIds.totp = data.id;
      const secret = data.totp?.secret || '';
      const secretFormatted = secret.match(/.{1,4}/g)?.join(' ') || secret;
      return { qr_code: data.totp?.qr_code, secret_formatted: secretFormatted };
    },
    async confirmAuthenticator(code) {
      const factorId = pendingFactorIds.totp || await factorFor('totp');
      const result = await verify('totp', code, factorId);
      await removeReplacedFactors('totp', factorId);
      return result;
    },
    async sendPhoneCode(phoneNumber) {
      const { data, error } = await client.auth.mfa.enroll({ factorType: 'phone', friendlyName: `AuraDental ${phoneHint(phoneNumber)}`, phone: phoneNumber });
      if (error) throw error;
      pendingFactorIds.sms = data.id;
      await startChallenge('sms', data.id);
      return { success: true, factor_id: data.id };
    },
    async confirmPhone(code) {
      if (!pendingFactorIds.sms) throw new MfaError('Start phone verification again.', 401);
      const result = await verify('sms', code);
      await removeReplacedFactors('sms', pendingFactorIds.sms);
      return result;
    },
    async status() {
      const all = factorsFrom(await listFactors());
      const methods = [...new Set(all.map(methodFor))];
      const phone = all.find((factor) => factor.factor_type === 'phone');
      for (const factor of all) factorIds[methodFor(factor)] ||= factor.id;
      return { methods, phone_hint: phoneHint(phone?.phone), factors: all.map(({ id, factor_type, friendly_name, phone: number }) => ({ id, factor_type, friendly_name, phone: number })) };
    },
    async sendProofCode(method) {
      if (method === 'totp') return { success: true };
      await startChallenge(method || 'sms');
      return { success: true };
    },
    async removeMethod(method, code) {
      const factorId = await factorFor(method);
      const challengeId = challengeIds[method] || await startChallenge(method, factorId);
      const { error: verifyError } = await client.auth.mfa.verify({ factorId, challengeId, code });
      if (verifyError) throw new MfaError(verifyError.message || 'Invalid verification code.');
      const { error } = await client.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      return { success: true };
    },
    async forgetDevices() {
      throw new Error('Supabase Auth does not expose trusted-device clearing for this project.');
    },
  };
}

let resumed;
export function resumeMfa() {
  resumed ||= (async () => {
    const params = new URLSearchParams(window.location.search);
    const flow = params.get('flow') || (params.get('manage') === '1' ? 'manage' : 'signin');
    const { data: { session } } = await requireSupabase().auth.getSession();
    if (!session) return null;
    const pending = sessionStorage.getItem(challengeKey);
    if (pending && flow !== 'manage') {
      try { return JSON.parse(pending); } catch { sessionStorage.removeItem(challengeKey); }
    }
    const { data, error } = await requireSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    if (data.currentLevel === 'aal1' && data.nextLevel === 'aal2') return createMfaChallenge(flow === 'manage' ? 'manage' : 'signin');
    if (flow === 'manage') return createMfaChallenge('manage');
    sessionStorage.removeItem(challengeKey);
    params.delete('mfa_code');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
    return flow === 'manage' ? null : { access_token: session.access_token };
  })();
  return resumed;
}

export async function loadSignInOptions() {
  return {
    name: 'AuraDental Cloud',
    auth_config: {
      enable_username_password: true,
      enable_google_login: true,
      enable_microsoft_login: false,
      enable_facebook_login: false,
      enable_apple_login: false,
      enable_sso_login: false,
      use_workspace_sso: false,
    },
  };
}

export async function signInWithProvider(provider, returnTo, { manage = false } = {}) {
  if (provider === 'sso') throw new Error('Enterprise SSO is not configured for this Supabase project.');
  const redirect = manage ? `/mfa?manage=1&returnTo=${encodeURIComponent(safePath(returnTo))}` : safePath(returnTo);
  return loginWithSocial(provider, redirect || '/dashboard');
}

export async function finishSignIn(_accessToken, returnTo) {
  sessionStorage.removeItem(challengeKey);
  const target = safePath(returnTo || '/dashboard');
  window.location.assign(new URL(target, window.location.origin).href);
}
