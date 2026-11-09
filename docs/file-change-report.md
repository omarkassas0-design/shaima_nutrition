# File change report

## Scope note

The supplied checkout has no `.git` directory and no baseline manifest, so there is no trustworthy original diff listing every changed line or a complete changed/unchanged file classification. This report identifies the migration-owned files and functional changes visible in the resulting tree. The original backend source remains under `base44/` for comparison.

## Added or generated

- `src/api/supabaseClient.js`, `src/api/appClient.js` — replace the browser SDK with Supabase Auth, Worker function calls, RLS-limited direct reads, and upload routes.
- `worker/src/index.js`, `worker/src/handler-map.js`, `worker/src/compat/`, `worker/src/legacy/`, `worker/src/templates/` — Cloudflare API, scheduled jobs, local Supabase adapter, 53 mapped source handlers/shared modules, and the rehosted email template.
- `supabase/migrations/202611080001_initial_schema.sql` and `scripts/generate-supabase-migration.mjs` — generated schema, roles, RLS, storage, triggers, and transaction RPCs for linked financial updates.
- `scripts/import-base44-export.mjs`, `scripts/bootstrap-owner.mjs`, `scripts/build-migration-inventory.mjs`, `scripts/prepare-worker-handlers.mjs` — import/reconciliation, owner provisioning, inventory, and local handler preparation tools.
- `migration/source-entities/`, `migration/source-workflows/`, `migration/source-config/` — preserved source schemas, workflow definitions, and platform/auth/Google Drive configuration copies.
- `docs/database-migration.md`, `docs/deployment.md`, `docs/security-audit.md`, `docs/testing-results.md`, `docs/base44-dependency-report.md`, `docs/file-change-report.md`, `docs/migration-inventory.md` — operation, security, testing, dependency, and audit documentation.
- `public/assets/`, `public/icons/` — locally served copies of brand, welcome, promotional, dental diagram, and PWA icon assets.
- `.env.example`, `wrangler.jsonc`, `README.md` — deployment bindings, example variables, cron/environment configuration, and setup instructions.

## Modified

- Auth context, sign-in/registration/recovery/MFA pages, role guards, and route setup — move session, OAuth, email OTP, password recovery, and MFA behavior to Supabase Auth while preserving the existing screens and role checks.
- Pages, hooks, components, and utilities that used the former client — call `appClient` so clinic CRUD and function calls use the Worker boundary; a complete change list could not be reconstructed without the original version-control metadata.
- `vite.config.js`, package manifests, and frontend runtime settings — remove the active Base44 build/client dependencies and configure the standard Vite/Supabase runtime. `package-lock.json` is refreshed by dependency installation.
- `package.json` and `package-lock.json` — removed unused `zod` and `react-quill`, then applied npm's non-forced compatible security updates (40 locked packages changed). The final audit has no high, critical, or low findings; four moderate findings remain on React Router v6 and ExcelJS's nested `uuid` path because npm reports only breaking major remedies.
- `jsconfig.json` — preserves project-wide JavaScript checking and includes the React/Vite ambient types required by the configured checker. The resulting typecheck reports existing application prop/ref typing diagnostics; they are listed in `docs/testing-results.md`.
- Lint cleanup — removed unused imports exposed by the configured lint command and one obsolete suppression comment. These edits do not change runtime behavior.
- PWA and static media consumers — use local icons, images, Worker manifest, and Worker service-worker routes.
- Worker legacy handlers/shared modules — use the local Supabase adapter and Worker environment bindings instead of platform SDK imports; high-impact payment, plan discount, and lab-case finalization writes now use database transactions.

## Removed

- `src/api/base44Client.js` — removed after all active frontend imports were redirected to `appClient`.
- `src/lib/app-params.js` — removed with the Base44 runtime parameter initialization.
- No application pages, clinical modules, financial modules, role screens, localization files, or original backend source directories were deleted.

## Verification performed

The final list of commands and results is in `docs/testing-results.md`. Source/configuration audit work is documented in `docs/migration-inventory.md` and `docs/security-audit.md`. The Vite build and lint pass; typecheck reports 1,807 diagnostics and the final npm audit reports four moderate findings. Wrangler dry-run could not start because its optional Windows runtime package was missing and package downloads returned `ECONNRESET`. No production deployment, live Supabase access, two-clinic security test, private-file transfer, provider delivery, or historical data import was available in this checkout.
