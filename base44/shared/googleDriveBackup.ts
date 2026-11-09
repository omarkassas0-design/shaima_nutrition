/**
 * Google Drive backup utilities for off-platform backup storage.
 * Uses the SHARED googledrive connector (AuraDental system owner's account).
 *
 * Folder structure:
 *   AuraDental Backups/
 *     Clinic_<clinic_id>/
 *       AuraDental_Clinic_<id>_<date>.backup.json
 *       patient_files/
 *         <file_name>
 *
 * SCOPE: drive.file — the app can only access files/folders it creates.
 * Folder IDs are tracked by searching among app-created files.
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const ROOT_FOLDER_NAME = 'AuraDental Backups';
const PATIENT_FILES_FOLDER = 'patient_files';
const MAX_PATIENT_FILE_SIZE = 25 * 1024 * 1024; // 25MB — Google Drive simple upload limit

/**
 * True when a hostname is loopback / private / link-local / reserved, or a
 * cloud-metadata endpoint. Handles IPv4 literals and IPv4-mapped IPv6 forms.
 */
function isBlockedHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  // Strip IPv6 literal brackets
  const bare = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h;

  // Local / internal / cloud-metadata hostnames
  if (
    bare === 'localhost' || bare.endsWith('.localhost') ||
    bare.endsWith('.local') || bare.endsWith('.internal') ||
    bare === 'metadata.google.internal' || bare === 'metadata.azure.com'
  ) return true;

  // IPv6 (and IPv4-mapped IPv6, e.g. ::ffff:169.254.169.254 / ::ffff:a9fe:a9fe)
  if (bare.includes(':')) {
    if (bare === '::' || bare === '::1') return true;
    if (bare.startsWith('::ffff:') || bare.startsWith('::')) {
      const tail = bare.split(':').pop();
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(tail)) return isBlockedHostname(tail);
      return true; // any other IPv4-mapped/compatible form is not a trusted public host
    }
    if (/^(fe80|fc|fd|ff)/.test(bare)) return true; // link-local, ULA, multicast
    return false;
  }

  // IPv4 literal
  const m = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }

  return false;
}

/**
 * Validates that a URL is safe to fetch from the server (prevents SSRF).
 * Only allows HTTPS and rejects private/internal/loopback/link-local hosts,
 * including IPv4-mapped IPv6 literals.
 */
function isSafeFetchUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;
    if (isBlockedHostname(parsed.hostname)) return false;
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Legacy patient-file URLs must belong to the platform's own storage — the
 * only place this app's upload flow ever produces file_url values. This is
 * the primary SSRF boundary for caller-influenced URLs.
 */
const ALLOWED_FILE_HOSTS = ['media.base44.com', 'base44.com', 'base44.app'];
function isAllowedFileHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return ALLOWED_FILE_HOSTS.some((allowed) => h === allowed || h.endsWith('.' + allowed));
}

/**
 * Gets the Google Drive access token from the SHARED connector.
 * Returns null if the connector is not available.
 */
export async function getDriveToken(svc) {
  try {
    const { accessToken } = await svc.connectors.getConnection('googledrive');
    return accessToken;
  } catch (e) {
    return null;
  }
}

async function findFolder(accessToken, name, parentId) {
  let q = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;

  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.files && data.files[0] ? data.files[0].id : null;
}

async function createFolder(accessToken, name, parentId) {
  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) metadata.parents = [parentId];

  const response = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create folder '${name}': ${response.status} ${err}`);
  }
  const data = await response.json();
  return data.id;
}

export async function ensureFolder(accessToken, name, parentId) {
  const existing = await findFolder(accessToken, name, parentId);
  if (existing) return existing;
  return await createFolder(accessToken, name, parentId);
}

/**
 * Ensures the clinic folder exists in Google Drive.
 * Returns the clinic folder ID.
 */
export async function ensureClinicFolder(accessToken, clinicId) {
  const rootId = await ensureFolder(accessToken, ROOT_FOLDER_NAME, null);
  if (!rootId) throw new Error('Failed to ensure root backup folder');
  const clinicFolderName = `Clinic_${clinicId.slice(-12)}`;
  return await ensureFolder(accessToken, clinicFolderName, rootId);
}

/**
 * Uploads a file to Google Drive.
 * content can be a string or ArrayBuffer.
 * Returns the Drive file ID.
 */
export async function uploadFile(accessToken, name, content, parentId, mimeType) {
  const metadata = { name };
  if (parentId) metadata.parents = [parentId];

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', new Blob([content], { type: mimeType || 'application/octet-stream' }));

  const response = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Drive upload failed for '${name}': ${response.status} ${err}`);
  }
  const data = await response.json();
  return data.id;
}

/**
 * Downloads a file from Google Drive.
 * Returns the content as ArrayBuffer.
 */
export async function downloadFile(accessToken, fileId) {
  const response = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Drive download failed for ${fileId}: ${response.status}`);
  }
  return await response.arrayBuffer();
}

function getMimeType(fileType, fileName) {
  const typeMap = {
    image: 'image/jpeg',
    pdf: 'application/pdf',
    xray: 'image/png',
    document: 'application/octet-stream',
  };
  if (typeMap[fileType]) return typeMap[fileType];

  const ext = fileName?.split('.').pop()?.toLowerCase();
  const extMap = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return extMap[ext] || 'application/octet-stream';
}

/**
 * Uploads a patient file's content to Google Drive.
 * Downloads from Base44 private storage via signed URL (file_uri) or
 * directly (legacy file_url), then uploads to Drive.
 * Returns { driveFileId, size } or { skipped, reason }.
 */
export async function uploadPatientFileContent(accessToken, patientFilesFolderId, svc, fileUri, fileUrl, fileName, fileType) {
  let content;

  if (fileUri) {
    const signedUrlResult = await svc.integrations.Core.CreateFileSignedUrl({
      file_uri: fileUri,
      expires_in: 120,
    });
    const signedUrl = signedUrlResult.signed_url;
    if (!isSafeFetchUrl(signedUrl)) {
      return { skipped: true, reason: 'Blocked: signed URL failed SSRF validation' };
    }
    let response;
    try {
      // redirect: 'error' — never follow a redirect to an unvalidated host.
      response = await fetch(signedUrl, { redirect: 'error' });
    } catch (_) {
      return { skipped: true, reason: 'Blocked: signed URL could not be fetched safely' };
    }
    if (!response.ok) return { skipped: true, reason: `Download failed: ${response.status}` };
    content = await response.arrayBuffer();
  } else if (fileUrl) {
    // Validate the stored file URL before fetching to prevent SSRF —
    // an attacker who can set file_url must not be able to make the
    // server fetch internal/metadata endpoints.
    // Legacy file_url values are caller-influenceable — restrict them to the
    // platform's own storage hosts, and never follow redirects (which could
    // otherwise bounce the server to an internal/metadata address).
    if (!isSafeFetchUrl(fileUrl) || !isAllowedFileHost(new URL(fileUrl).hostname)) {
      return { skipped: true, reason: 'Blocked: file URL failed SSRF validation' };
    }
    let response;
    try {
      response = await fetch(fileUrl, { redirect: 'error' });
    } catch (_) {
      return { skipped: true, reason: 'Blocked: file URL could not be fetched safely' };
    }
    if (!response.ok) return { skipped: true, reason: `Download failed: ${response.status}` };
    content = await response.arrayBuffer();
  } else {
    return { skipped: true, reason: 'No file reference' };
  }

  if (content.byteLength === 0) {
    return { skipped: true, reason: 'Empty file' };
  }
  if (content.byteLength > MAX_PATIENT_FILE_SIZE) {
    return { skipped: true, reason: 'File exceeds 25MB limit' };
  }

  const mimeType = getMimeType(fileType, fileName);
  const safeFileName = (fileName || 'unnamed').replace(/[^a-zA-Z0-9._-]/g, '_');
  const driveFileId = await uploadFile(accessToken, safeFileName, content, patientFilesFolderId, mimeType);

  return { driveFileId, size: content.byteLength };
}

/**
 * Restores a patient file from Google Drive to Base44 private storage.
 * Downloads from Drive, uploads to Base44 private storage.
 * Returns { file_uri } or { skipped, reason }.
 */
export async function restorePatientFileContent(accessToken, driveFileId, fileName, fileType, svc) {
  const content = await downloadFile(accessToken, driveFileId);
  const mimeType = getMimeType(fileType, fileName);
  const safeFileName = (fileName || 'unnamed').replace(/[^a-zA-Z0-9._-]/g, '_');

  const file = new File([content], safeFileName, { type: mimeType });
  const result = await svc.integrations.Core.UploadPrivateFile({ file });

  return { file_uri: result.file_uri };
}

export { PATIENT_FILES_FOLDER };