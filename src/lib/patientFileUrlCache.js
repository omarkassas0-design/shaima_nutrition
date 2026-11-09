import { appClient } from '@/api/appClient';

/**
 * Shared, short-lived cache for patient file signed URLs.
 *
 * The backend signs URLs with a 5-minute expiry. Reusing them for 4 minutes
 * means one signature per file per viewing window instead of one per render,
 * per preview and per download. URLs are still minted by the server after it
 * verifies the file belongs to the caller's clinic — the cache only reuses a
 * URL that was already authorized for this session.
 */
const URL_TTL_MS = 4 * 60 * 1000;
const MAX_ENTRIES = 300;

const cache = new Map(); // file.id -> { url, expiresAt }
const inFlight = new Map(); // file.id -> Promise<string|null>

const pruneIfNeeded = () => {
  if (cache.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
};

/**
 * Returns a usable URL for a PatientFile record.
 * Legacy records (no file_uri) keep their existing public URL.
 */
export async function getPatientFileUrl(file) {
  if (!file) return null;
  if (!file.file_uri) return file.file_url || null;

  const key = file.id;

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = appClient.functions
    .invoke('getPatientFileSignedUrl', { file_id: file.id })
    .then((res) => {
      const url = res?.data?.signed_url || null;
      if (url) {
        pruneIfNeeded();
        cache.set(key, { url, expiresAt: Date.now() + URL_TTL_MS });
      }
      return url;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, request);
  return request;
}