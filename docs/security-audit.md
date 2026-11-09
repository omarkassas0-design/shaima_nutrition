# Security audit

## Implemented boundaries

- Browser configuration includes only a Supabase URL and publishable key. The Worker requires a server-side service-role secret and provider bindings.
- The Worker validates a Supabase Auth access token and uses `ClinicRoleAssignment` to resolve the active clinic and authoritative clinic role. The source's owner rule compares the validated Auth email with the server-only `OWNER_EMAIL`; direct PostgreSQL RLS checks the operator-provisioned Auth UUID in `platform_owners`. Neither trusts profile metadata or a client role, and both need to be provisioned for the same one owner.
- Clinic-scoped entity CRUD is routed through `clinicScopedCrud`; submitted clinic IDs are ignored for ordinary users and accepted only as a managed-clinic override for an owner. Reads and mutations verify record clinic ownership.
- Supabase RLS policies independently restrict clinic rows, user profile rows, role assignments, notifications, and Storage objects. The Patient table has no direct browser policy because doctors' phone-number fields are stripped in the Worker response.
- Patient files use a private bucket and short-lived signed URLs. Uploads enforce MIME and size limits and use a server-resolved clinic path. Clinic branding is stored separately as public static content.
- The database applies restrictive MFA policies for enrolled factors. The Worker checks the token assurance claim and verified-factor status.
- Notification updates are guarded so an ordinary user may only change the `read` flag on their own notification.
- Treatment plan discounts, payment mutations plus patient-treatment balance refresh, and LabCase expense/finalization changes run through server-only database RPCs so each linked write is transactional. Audit rows remain best-effort after the core transaction, matching the source audit helper behavior.
- Scheduled deletion calls use a Worker secret and source handlers retain idempotency and status checks.
- Sensitive handler rate limits are currently in-memory per Worker isolate. They are useful for repeated submissions in one isolate but do not provide a distributed enforcement boundary; configure a Durable Object or another atomic shared limiter before relying on them in production.

## Release-blocking checks still required

- Dependency review: after removing unused `zod` and `react-quill` packages and applying `npm audit fix` without `--force`, the final audit reports four moderate advisories and no high, critical, or low advisories. The remaining paths are React Router v6 (open redirect through backslash navigation and SSR hydration constructor injection) and ExcelJS's nested `uuid` version (buffer bounds check). npm only offers breaking major-version remedies for these paths; review and test those upgrades before production.
- Apply the migration to a disposable Supabase project and inspect actual policy behavior, grants, Auth trigger behavior, and function permissions. This repository has no linked project for that verification.
- Create two clinics and test browser RLS and direct API requests as each role. A code review is not a substitute for live negative tests.
- Confirm every role in the production policy model. The checked-in source uses `super_admin`, `clinic_admin`, `doctor`, and `receptionist`; `assistant` and `accountant` are staff position labels, not authorization roles. Their intended rights need product-owner confirmation before adding privileges.
- Confirm Storage paths and policies using real uploads, cross-clinic attempts, signed URL expiry, file type spoofing, and oversize files.
- Review cross-entity relationships and records with missing clinic/user references before import. The migration preserves fields and records errors instead of imposing inferred cascading relationships.
- Physical FKs are intentionally not generated for clinic or record links because source deletion/restore logic preserves audit orphans and temporarily unlinks children. The relationship fields are retained and reconciled by import tooling; explicit constraints need lifecycle-safe redesign first.
- Validate owner provisioning, Auth signup, email confirmation, OAuth, password recovery, MFA enrollment/challenge, and account suspension with real test users.
- Configure and test external email, document extraction, Google Drive, SMS, and legacy file migration providers. No delivery is represented as successful if provider configuration is missing.
- Obtain an independent penetration test and privacy review for clinical and financial data before production cutover.

## Known functional boundaries

- The supplied MCP OAuth consent UI has no accompanying grant/token service or authorization store. It fails closed rather than minting fake tokens.
- Trusted-device MFA bypass for 30 days is not implemented; its prior UI claim was removed because no secure device registry/refresh policy was supplied.
- The importer preserves file references but does not transfer private file bytes. Legacy files require a separate authenticated transfer and verification pass.
- No live database, provider, multi-clinic, or end-to-end test was possible in this environment.
