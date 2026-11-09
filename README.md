# AuraDental Cloud

AuraDental Cloud is a React/Vite dental clinic application with a Cloudflare Worker API and Supabase Auth, PostgreSQL, RLS, and Storage.

## Local development

1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set the Supabase project URL and publishable key.
4. Run `npm run dev:vite` for the Vite-only frontend, or `npm run dev` to run the Worker and static asset binding together with Wrangler.

Worker secrets are configured separately with `wrangler secret put NAME`. Never put the service-role key or provider credentials in a `VITE_` variable. Required bindings and optional integrations are listed in `.env.example` and `docs/deployment.md`.

## Supabase setup

Apply SQL migrations in `supabase/migrations/` to a new Supabase project. Configure Auth email templates, allowed redirect URLs, Google OAuth, and SMS MFA providers in the Supabase dashboard. Then provision the platform owner using the trusted operator script described in `docs/database-migration.md`.

The migration prepares the target schema and import tooling. This checkout does not include production data, a Supabase project, or the external provider credentials needed to execute a live migration.

## Cloudflare deployment

Review `wrangler.jsonc`, create the Cloudflare Worker, set Worker secrets and environment bindings, and deploy with `npm run deploy`. See `docs/deployment.md` for the full checklist, scheduled triggers, redirect setup, and external provider configuration.

## Migration and audit artifacts

- `docs/migration-inventory.md` maps the 31 source entities, 53 backend functions, frontend call sites, and six scheduled workflows.
- `docs/database-migration.md` documents schema generation, import, reconciliation, and owner bootstrap.
- `docs/security-audit.md` lists enforced boundaries and external checks that remain pending.
- `docs/testing-results.md` records commands actually run and the scope limits of local verification.
- `docs/file-change-report.md` summarizes added, changed, and retained migration files.
- `docs/base44-dependency-report.md` identifies historical references and unavailable external integration inputs.

## Verification commands

`npm run build`, `npm run typecheck`, `npm run lint`, `npm run migration:inventory`, `npm run migration:schema`, and `npm run migration:prepare-worker` are available. Passing a local build does not verify live authentication, RLS against production roles, external delivery, scheduled jobs, or record/file reconciliation.
