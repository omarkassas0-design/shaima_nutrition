# Database migration and reconciliation

## Schema

`supabase/migrations/202611080001_initial_schema.sql` is generated from the preserved JSONC definitions in `migration/source-entities/` by `npm run migration:schema`. The generator keeps source record IDs as text, preserves source columns and platform audit fields, adds the Auth profile mirror, owner table, role/MFA helpers, indexes, RLS policies, notification guard, transactional RPCs for plan discounts, payments, and lab-case expense/finalization changes, and three Storage buckets.

Clinic-scoped tables intentionally do not have a physical `clinic_id` foreign key. The existing permanent deletion workflow deletes the clinic while retaining the current `PendingPermanentDeletion` row and then writes a final audit record with the deleted clinic ID. Cascading FKs would erase the pending record; restrictive FKs would prevent the supported deletion flow. `clinic_id` is enforced by the Worker and RLS instead. Record-to-record foreign keys are not inferred from names alone; their fields are retained and checked by the reconciliation importer. Add explicit constraints only after confirming the source lifecycle and import data.

The `app_mfa_access_allowed()` helper follows Supabase's opt-in MFA policy: accounts with a verified factor need an `aal2` JWT; other accounts can use `aal1` or `aal2`. Supabase Auth's `auth` schema is used inside PostgreSQL, not exposed through the public REST schema. The Worker queries verified factors through the Auth admin MFA endpoint.

## Import

The importer is deliberately non-destructive. It uses `upsert` by source ID, does not delete destination rows, preserves source timestamps/fields, and emits per-row preparation or database errors. It imports user profile rows only after the operator maps each legacy user ID to an existing Supabase Auth user ID. Auth accounts/passwords, MFA factors, and provider identities must be created or migrated through supported Supabase Auth operations; they are not copied as ordinary records.

```powershell
$env:SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY'
node scripts/import-base44-export.mjs --input .\migration\source-export.json --user-map .\migration\user-id-map.json
```

The user map format is a JSON object from old user IDs to Supabase Auth UUIDs, optionally wrapped in a `users` object:

```json
{
  "legacy-user-id": "00000000-0000-4000-8000-000000000000"
}
```

Use a private working location for export and map files. They can contain patient health, contact, billing, and account data. Do not commit them or place credentials in Vite variables. The generated `migration/reports/import-reconciliation-*.json` includes source and imported counts, destination totals, unresolved user references, missing relationships, and row errors. Destination totals include rows that existed before this import; compare the `imported` counts and source IDs as well as totals.

## Reconciliation and release sequence

1. Create a fresh Supabase project and configure Auth providers, email verification, redirect URLs, MFA, and storage limits.
2. Apply the generated SQL migration to an empty project. Review it against the exact Supabase project version before applying.
3. Set the same owner email as `OWNER_EMAIL` in the Worker secret and the operator environment, then run `scripts/bootstrap-owner.mjs`. The script requires an existing Auth user and inserts only that user's UUID into `platform_owners`; the Worker role resolver separately compares that Auth user's validated email to the secret.
4. Create/import clinics and users, providing an explicit legacy-to-Auth user map. Import the rest of the JSON export with the script above.
5. Review every importer error and every missing relationship. Correct source IDs or the explicit user map and rerun the idempotent import. Do not treat a row-level error as a successful migration.
6. Reconcile source and target counts, payment totals, treatment totals, patient files, audit snapshots, and deletion state. Keep a signed, access-controlled copy of the reconciliation output.
7. Migrate private file contents separately. The entity importer preserves file references but does not download old private files or claim that a new Storage object exists.
8. Test both clinic isolation and each module against a non-production Supabase project before switching traffic.

No production export, target project, user-ID map, or service-role credentials were present in this checkout, so no live data import or destination reconciliation has been performed.
