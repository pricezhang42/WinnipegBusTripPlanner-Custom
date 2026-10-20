# Production baseline review

Tracking: https://github.com/pricezhang42/WinnipegBusTripPlanner-Custom/issues/21

Status: **live audit pending**. No migration history has been marked applied and
no production schema/data changes have been performed by the management tools.

The first connection attempt on October 20, 2026 failed TLS certificate
verification before any audit queries ran. The production root certificate must
be configured through `PRODUCTION_DATABASE_CA_FILE` before retrying the audit.

## Repository inventory

Four migrations define the application's three public tables, ownership policies,
grants, two SQL/PLpgSQL functions and distinct-trip history behavior. Their byte
hashes are in `../migrations.lock.json`. Existing SQL files were historically
applied manually in the Dashboard, so file presence is not proof of remote state.

The user supplied this production metadata on October 20, 2026:

- `has_table_privilege('authenticated','public.trip_history','DELETE') = false`
- Only the own-history SELECT policy was present on `trip_history`.

The repeatable permission repair is in migration
`202610200001_restore_history_delete_policy.sql` (app PR #20). The user was given
repair SQL, but its live application has not been confirmed. Do not mark that
migration, or the original deletion migration, applied without checking the live
policy and grant.

## Audit and review procedure

1. Set `PRODUCTION_DATABASE_URL` in ignored `.env.database.local`.
2. Run `npm run db:audit:production`. Review the private JSON catalog under
   `.database/`. It contains metadata/function definitions but no table rows.
3. Compare tables/columns/defaults/constraints/indexes, ownership policies and
   grants, function bodies/security/search_path, triggers, default privileges,
   extensions and migration versions against Git. The automatic findings are a
   focused application check, not a complete PostgreSQL diff or baseline approval.
4. Inventory Auth settings with `npm run db:auth:audit:production` if a scoped
   `SUPABASE_ACCESS_TOKEN` is available; otherwise record them manually in the
   Dashboard. SMTP/provider secrets are not copied or exported by these tools.
5. Document each migration's actual effects and whether they exist. For missing
   changes, apply a reviewed migration; for existing manually applied changes,
   record only individually verified versions in Supabase's migration history.
6. Commit a **redacted review summary**, not the raw catalog or credentials, here
   once the audit is complete. Include PostgreSQL major version, approved
   migration versions, unresolved differences, and the SHA-256 of the reviewed
   private report. A file/hash alone does not establish baseline correctness.

Supabase CLI's `migration repair --status applied <version>` updates the ledger
without running SQL. It must not be used to hide missing schema/policy changes.
The wrapper deliberately never invokes repair or auto-approves a baseline.

Production is not ready for migration deployment until this review is complete.
