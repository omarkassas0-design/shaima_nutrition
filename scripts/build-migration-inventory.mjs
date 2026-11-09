import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const entityRoot = path.join(root, 'migration', 'source-entities');
const functionRoot = path.join(root, 'worker', 'src', 'legacy', 'functions');
const workflowRoot = path.join(root, 'migration', 'source-workflows');
const srcRoot = path.join(root, 'src');
const outputPath = path.join(root, 'docs', 'migration-inventory.md');

const filesUnder = (directory, extension) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(absolute, extension) : (entry.name.endsWith(extension) ? [absolute] : []);
  });

const entities = filesUnder(entityRoot, '.jsonc').map((file) => {
  const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
  const fields = Object.entries(schema.properties || {}).map(([key, value]) => `${key}:${value.type}`).join(', ');
  return { name: schema.name, file: path.relative(root, file).replaceAll('\\', '/'), fields };
});

const frontend = filesUnder(srcRoot, '.js').concat(filesUnder(srcRoot, '.jsx'));
const frontendText = frontend.map((file) => [file, fs.readFileSync(file, 'utf8')]);
const handlers = fs.readdirSync(functionRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const file = path.join(functionRoot, entry.name, 'entry.ts');
    const source = fs.readFileSync(file, 'utf8');
    const entitiesUsed = [...source.matchAll(/\.entities\.([A-Za-z0-9_]+)|\.entities\[([^\]]+)\]/g)]
      .map((match) => match[1] || `[${match[2]}]`);
    const guards = [
      ['requireSuperAdmin', 'platform owner only'],
      ['requireRole', 'explicit role allowlist'],
      ['getAuthenticatedClinicUser', 'active ClinicRoleAssignment and clinic membership'],
      ['verifySystemCall', 'scheduled/system credential and, where present, owner role'],
      ['base44.auth.me', 'authenticated user session'],
    ].filter(([symbol]) => source.includes(symbol)).map(([, label]) => label);
    const callers = frontendText.flatMap(([sourceFile, text]) =>
      [...text.matchAll(new RegExp(`(?:functions\\.invoke\\(['\"\\x60])${entry.name}(?:['\"\\x60])`, 'g'))]
        .map(() => path.relative(root, sourceFile).replaceAll('\\', '/')));
    const external = [
      source.includes('integrations.Core.SendEmail') && 'email provider',
      source.includes('integrations.Core.ExtractDataFromUploadedFile') && 'document extraction provider',
      source.includes('integrations.Core.UploadPrivateFile') && 'private file storage',
      source.includes('CreateFileSignedUrl') && 'signed file URLs',
      source.includes('verifySystemCall') && 'scheduled trigger authentication',
    ].filter(Boolean);
    return {
      name: entry.name,
      file: path.relative(root, file).replaceAll('\\', '/'),
      entities: [...new Set(entitiesUsed)].sort().join(', ') || 'indirect/shared access',
      auth: guards.join('; ') || 'inspect handler; no shared guard detected',
      callers: [...new Set(callers)].join(', ') || 'scheduled/system or internal call',
      external: external.join(', ') || 'none detected',
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

const workflows = fs.readdirSync(workflowRoot).filter((file) => file.endsWith('.jsonc')).sort();
const allSource = frontendText.map(([, text]) => text).join('\n');
const directCalls = [...new Set([
  ...[...allSource.matchAll(/appClient\.(?:entities|integrations|auth|functions)(?:\.[A-Za-z0-9_$]+)*/g)].map((m) => m[0]),
  ...[...allSource.matchAll(/supabase\.auth\.[A-Za-z0-9_.$]+/g)].map((m) => m[0]),
])].sort();

const lines = [
  '# AuraDental Cloud migration inventory',
  '',
  `Generated from the checked-out source on ${new Date().toISOString().slice(0, 10)} by \`scripts/build-migration-inventory.mjs\`.`,
  '',
  '> This inventory describes source dependencies and replacement boundaries. It is not evidence that a provider, production database, migrated data set, or live workflow has been verified.',
  '',
  '## Source scope',
  '',
  `- Frontend source files scanned: ${frontend.length}.`,
  `- Entity definitions scanned: ${entities.length}.`,
  `- Backend functions scanned: ${handlers.length}.`,
  `- Scheduled workflow definitions scanned: ${workflows.length}.`,
  '- Build configuration and package manifests: `vite.config.js`, `package.json`, `package-lock.json`, `README.md`, `.gitignore`.',
  '- No `.git` metadata was present in the supplied checkout, so a trustworthy original file-change diff cannot be produced.',
  '',
  '## Frontend dependency map',
  '',
  '| Current dependency | Responsibilities and data | Current access checks | Replacement boundary |',
  '|---|---|---|---|',
  '| Legacy SDK client / `@base44/sdk` | Previously initialized auth, entity, function, and integration APIs to the UI. | Session checks plus per-handler checks. | Removed from the browser. `src/api/appClient.js` uses Supabase Auth and sends entity/function operations to authenticated Worker routes; only Clinic and own Notification queries use RLS directly. |',
  '| `src/lib/AuthContext.jsx`, `authMfa.js`, `authMfaFlow.js`, auth pages | Session restore, sign-in/out, registration, OTP, Google OAuth, password reset, current role refresh, account status gating. | `getCurrentUserRole` is authoritative; role assignment and status are not trusted from profile data. | Supabase Auth plus Worker role resolution against `ClinicRoleAssignment` and server-owned platform owner records. |',
  '| `src/lib/clinicApi.js`, `src/hooks/usePaginatedQuery.js`, pages and components invoking functions | Clinic CRUD, server pagination, search, reports, dashboards, payment workflows, export, backup, deletion, role management. | Per-function role checks; clinic ID is resolved server-side from the active assignment (owner may select a managed clinic). | Preserve function names and JSON contracts behind Cloudflare Worker routes; map database operations to Supabase PostgreSQL/RLS. |',
  '| Direct entity API calls in pages and components | Clinic and appointment lookup; CRUD, filtering, user notifications and read status. | Clinic entity authorization in Worker; Notification direct access is restricted to the signed-in user by RLS. | `appClient.entities.*` routes clinic-scoped CRUD to Worker authorization, with direct RLS access limited to Clinic lookup and own Notification rows. |',
  '| File integrations and signed URLs | Clinic assets, patient attachments, imports, and private-file access. | Worker verifies clinic membership, role, size, and MIME type; patient files use a private bucket. | Worker upload API plus Supabase Storage and short-lived signed URLs. Legacy-file migration is a separate authenticated operation and needs source URLs to remain reachable. |',
  '| Base44-hosted static media | Product metadata, tooth imagery, welcome banner, promotion email assets. | Public assets; no patient data authorization. | Rehosted under `public/assets` and `public/icons`; the Worker PWA manifest references local icons. |',
  '| Runtime parameters, PWA, offline queue, auth diagnostics | Previous platform URLs, SDK session cleanup, offline entity retries, and platform assumptions. | Supabase Auth and Worker API checks. | Replaced runtime configuration with Vite Supabase settings and Worker PWA routes; queued CRUD operations use the new client. |',
  '',
  '### Frontend client entry points found after migration',
  '',
  ...directCalls.map((call) => `- \`${call}\``),
  '',
  '## Entity data model',
  '',
  '| Entity | Source definition | Defined fields |',
  '|---|---|---|',
  ...entities.sort((a, b) => a.name.localeCompare(b.name)).map((entity) => `| \`${entity.name}\` | \`${entity.file}\` | ${entity.fields} |`),
  '',
  'All source entities rely on platform-provided `id`, `created_date`, `updated_date`, and (where applicable) `created_by_id` values that are not fully described in each JSONC schema. The SQL migration must preserve those values on import.',
  '',
  '## Backend function migration map',
  '',
  '| Function | Source | Data entities accessed | Authentication / authorization detected | Frontend callers | External dependency | Replacement |',
  '|---|---|---|---|---|---|---|',
  ...handlers.map((handler) => `| \`${handler.name}\` | \`${handler.file}\` | ${handler.entities} | ${handler.auth} | ${handler.callers} | ${handler.external} | Worker route retaining this function name and response contract; Supabase adapter under RLS and server role checks. |`),
  '',
  '## Scheduled workflows',
  '',
  ...workflows.map((file) => `- \`${path.posix.join('migration/source-workflows', file)}\` — replace its schedule with a Cloudflare Cron Trigger and invoke the corresponding authenticated Worker operation after reviewing the source trigger and retry behavior.`),
  '',
  '## Shared backend and integration dependencies',
  '',
  '- `worker/src/legacy/shared/clinicAuth.ts`, `clinicRoleAssignment.ts`, `userSecurity.ts`: active clinic role, account status, and owner-protection resolution. These define the authorization boundary and must be ported without client role fallback.',
  '- `worker/src/legacy/shared/commission.ts`, `currencyUtils.ts`, `planDiscount.ts`: financial formulas and discount distribution; preserve exact behavior and historical values.',
  '- `worker/src/legacy/shared/auditLog.ts`, `clinicDeletion.ts`, `restoreLogic.ts`: audit snapshots, deletion/restore ordering, and restore locks.',
  '- `worker/src/legacy/shared/backupLogic.ts`, `googleDriveBackup.ts`, `patientFileBatch.ts`: database backups, private files, signed links, Google Drive transfer, and patient-file reconciliation.',
  '- `worker/src/legacy/shared/paginatedFetch.ts`, `rateLimiter.ts`, `messageI18n.ts`: pagination, abuse controls, and localized outbound content.',
  '- Base44 Core integrations found: email (`SendEmail`), upload/public upload (`UploadFile`, `UploadPrivateFile`), signed URLs (`CreateFileSignedUrl`), and extraction (`ExtractDataFromUploadedFile`). Each provider requires explicit credentials or a configured replacement; missing credentials must not return success.',
  '- Google Drive connector source is preserved under `migration/source-config/`; configure its OAuth client, refresh token, and folder settings in Worker secrets before use.',
  '- Auth source configuration is preserved under `migration/source-config/`; email verification, redirects, OAuth providers, SMS/TOTP MFA, and templates must be configured in Supabase Auth before production use.',
  '',
  '## Environment and configuration dependencies',
  '',
  '- Frontend: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` configure the browser client.',
  '- Worker-only: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and provider/schedule secrets from `.env.example`.',
  '- Build: Vite uses the standard React plugin; `@base44/sdk` and `@base44/vite-plugin` are absent from the active package manifest.',
  '- Static images were copied into the local asset tree; one-time legacy file transfer and archived source code remain documented migration inputs.',
  '',
  '## Security requirements carried into the replacement',
  '',
  '1. Derive clinic membership from the active `ClinicRoleAssignment` row, never a submitted `clinic_id` or mutable profile field.',
  '2. Resolve platform owner eligibility from a server-owned record provisioned only by a trusted operator; a client role or generic admin value must never grant owner access.',
  '3. Keep the service-role key and provider secrets in Worker secrets only. Browser code may contain only the Supabase URL and publishable key.',
  '4. Enforce clinic access in both Worker guards and PostgreSQL RLS, including files and audit records.',
  '5. Preserve entity permissions, doctor/receptionist field restrictions, audit snapshots, deletion recovery, and payment/commission calculations.',
  '',
  '## Known migration inputs not present in this checkout',
  '',
  '- Supabase project URL, publishable key, service-role key, and production database access.',
  '- Base44 production record export and private-file contents/transfer credentials.',
  '- Verified owner account ID, external provider credentials, and live Google Drive OAuth configuration.',
  '- Production test accounts for at least two clinics and expected historical reconciliation counts.',
  '- The source application defines `super_admin`, `clinic_admin`, `doctor`, and `receptionist` as authorization roles; `assistant` and `accountant` appear only as staff position labels. No role permissions were invented for those requested labels.',
  '',
  'Without these inputs, code and SQL can be prepared, but live authentication, provider delivery, file transfer, production data reconciliation, and cross-clinic penetration checks cannot be truthfully marked verified.',
  '',
];

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${path.relative(root, outputPath)} (${entities.length} entities, ${handlers.length} functions).`);
