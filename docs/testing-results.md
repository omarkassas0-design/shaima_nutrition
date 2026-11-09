# Testing and verification results

Commands were run in the supplied checkout through 2026-11-09. A passing local build does not establish live database, provider, cross-clinic, or production behavior.

| Check | Result | Scope and notes |
|---|---|---|
| `npm install` and compatible audit fixes | Passed | Removed unused `zod` and `react-quill` dependencies, then applied `npm audit fix` without `--force`; npm changed 40 locked packages. Final audit reports four moderate advisories and no high, critical, or low advisories. |
| `npm run build` | Passed | Vite production bundle completed after the compatible dependency updates. |
| `npm run lint` | Passed | ESLint completed with no reported errors. |
| `npm run typecheck` | Failed | TypeScript reported 1,807 diagnostics across the existing JavaScript/JSX application, mainly component prop/ref declarations and related page typing. The `checkJs` configuration was retained; typing errors were not suppressed to claim a clean check. Full output is in `work/typecheck.log` in the working checkout and is excluded from the handoff ZIP. |
| `npm audit --json` | Findings remain | Four moderate advisories remain: React Router's current v6 dependency line and ExcelJS's nested `uuid` path. npm reports only breaking major-version remedies for those paths; no forced upgrade was applied. |
| `npm run migration:inventory` | Passed | Generated the inventory for 31 entities, 53 functions, and six workflows. |
| `npm run migration:schema` | Passed | Generated the Supabase migration for 31 entity tables and its RLS, storage, and transaction RPC definitions. This is generation only; SQL was not applied to PostgreSQL. |
| `npm run migration:prepare-worker` | Passed | Prepared 53 Worker handler imports. |
| Static Worker bundle (esbuild) | Passed | Bundled `worker/src/index.js` and imports to `work/worker-bundle.js` (1.1 MB). This checks Worker syntax and dependency bundling, but does not validate Wrangler bindings or the Cloudflare runtime. |
| `npx wrangler deploy --dry-run` | Blocked by local tooling/network | Wrangler could not start because optional `@cloudflare/workerd-windows-64@1.20261104.1` was absent. Fetching the matching package returned `ECONNRESET` in both sandboxed and elevated attempts, so Wrangler-specific bindings/config validation was not completed. No deployment was attempted. |
| Base44 package check | Passed | `npm ls @base44/sdk @base44/vite-plugin --depth=0` returned an empty tree. Matches for Base44 remain in source archives, migration tooling, documentation, and compatibility naming; those are not active SDK dependencies. |
| Two-clinic RLS/API tests | Not run | Requires a disposable Supabase project, two clinics, and role test accounts. |
| Auth/MFA/provider/file tests | Not run | Requires live Supabase Auth and configured providers/storage. |
| Production import/reconciliation | Not run | Requires a Base44 export, target project, private file bytes, and explicit legacy-to-Supabase user mapping. |

No automated application test suite was present in the supplied package manifest. The install-time advisory count is not a replacement for reviewing individual advisories and their reachable paths.
