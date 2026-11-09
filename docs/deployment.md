# Deployment

## Prerequisites

- Node.js 20 or newer and npm.
- A Supabase project with the SQL migration applied.
- A Cloudflare account with Workers enabled and a configured production domain if using a custom hostname.
- Auth email/redirect/provider configuration and the provider secrets required by enabled workflows.

## Local setup

1. Copy `.env.example` to `.env.local` and set only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for Vite. Do not put service-role or provider secrets in any `VITE_` variable.
2. Install dependencies with `npm install`.
3. Run `npm run dev:vite` for the frontend alone. For Worker routes and asset binding, build and run Wrangler with `npm run build` followed by `npx wrangler dev`.

## Cloudflare Worker

`wrangler.jsonc` configures `worker/src/index.js`, serves the Vite `dist` directory through the `ASSETS` binding, routes `/api/*` through the Worker, enables SPA fallback, and defines scheduled triggers. Set the following secrets with `npx wrangler secret put NAME` for the production Worker: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL`, and `BACKUP_WORKFLOW_SECRET`. The service-role key is server-only. Provider secrets are optional until the related workflow is enabled: `EMAIL_API_KEY`, `EMAIL_FROM`, `DOCUMENT_EXTRACTION_URL`, `DOCUMENT_EXTRACTION_TOKEN`, and Google Drive OAuth credentials.

Deploy with `npm run deploy`. Configure a preview Worker separately; the included `preview` environment intentionally has no cron triggers. Verify project bindings and secrets in both environments before testing. Set the Supabase Auth Site URL and allow-list callback URLs to the final app and `/reset-password` routes. Configure Google OAuth and SMS MFA credentials in Supabase, not in frontend code.

## Scheduled jobs

The Worker cron table runs backups twice per hour from 22:00 through 02:30 UTC, notifications hourly, recycle-bin purge at 00:00 UTC, scheduled reports at 05:00 UTC, and deletion countdown scans every minute. These are UTC schedules. Review them against the source workflow time zones and clinic operational hours before production activation. Cloudflare Cron Triggers are declared in Wrangler configuration; confirm the deployed trigger list in the Cloudflare dashboard after deployment.

## Provider behavior

Email and document extraction return explicit errors when their secrets are missing or the provider rejects a request. Google Drive requires a valid OAuth refresh token. The MCP OAuth consent page remains closed because the supplied source includes a UI but no token grant server or app authorization store. Configure any missing integrations and validate delivery with test accounts before enabling live workflows.

This checkout has not been deployed to Cloudflare or connected to a live Supabase project.
