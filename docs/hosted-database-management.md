# Hosted Supabase QA and production

Tracking: [issue #21](https://github.com/pricezhang42/WinnipegBusTripPlanner-Custom/issues/21).

The app repository owns the canonical SQL migration directory. Supabase CLI is
the only migration executor/ledger. Database audit, QA fixtures and Auth settings
are separate tools; none starts a local Supabase instance. Node 22+ is required.

## 1. Audit production first

```sh
npm ci
cp .env.database.example .env.database.local  # only if the local file does not exist
```

The prepared `.env.database.local` file is already ignored by Git. In the
production project's **Connect** dialog select a PostgreSQL **Session pooler**
URI (port 5432), or Direct connection if your network supports its address.
Set `PRODUCTION_DATABASE_URL` in that private file. Use the database password,
not an API key or your Supabase account password. Percent-encode special password
characters. The hostname/role must identify the production reference registered
in `supabase/environments.json`. Transaction-pooler port 6543 is rejected.

`metro.config.js` also excludes database environment files, private reports,
database tools/migrations and downloaded database certificates from the mobile
resolver. Git ignores alone do not exclude files from Metro. Keep app public
settings in `.env.local`, separate from the management credentials.

The tools enforce verified TLS. If the system trust store does not trust the
project certificate, open **Database → Settings → SSL Configuration → Download
Certificate** in the production dashboard. Save the downloaded certificate locally,
then add its absolute path to `.env.database.local`:

```dotenv
PRODUCTION_DATABASE_CA_FILE="/Users/linpu/Downloads/prod-ca-2021.crt"
```

Use the actual downloaded filename. Retry the audit after saving the file. QA has
its own `QA_DATABASE_CA_FILE` setting. Do not disable certificate checks.
See [Supabase's verified TLS instructions](https://supabase.com/docs/guides/database/connecting-to-postgres).

```sh
npm run db:status:production
npm run db:audit:production
```

These commands use a REPEATABLE READ, READ ONLY transaction and query metadata
only. They do not create migration tables, mark versions applied, count/read user
rows, or modify production. The audit saves a mode-0600 report in ignored
`.database/`, including the public schema catalog, function definitions, grants,
RLS, indexes, constraints, sequences (not current values), default privileges,
extensions and recorded migration versions. This is not a full-project backup;
Auth users, storage objects and user data are not copied.

Review [the baseline checklist](../supabase/baseline/README.md) before deploying
anything. The repository's original migrations were applied through the SQL
Editor; a missing CLI history record does not mean it is safe to rerun CREATE
TABLE. The wrapper blocks deployments with untracked existing application tables,
unknown remote versions or migration-history gaps.

For confirmed manually applied migrations, reconcile Supabase history explicitly
using its CLI after reviewing the exact effects. The tools never run migration
repair automatically. For genuine missing changes, apply reviewed SQL and verify
it. A new migration should capture subsequent fixes; do not change applied files.

## 2. Create a separate hosted QA project

Run these yourself after selecting your Supabase organization. The project's
compute/cost follows your organization's plan; choose the intended settings in
the dashboard if you prefer. No project is provisioned automatically by this PR.

```sh
npx supabase login
npx supabase orgs list
```

In zsh, read a new database password without writing it into shell history:

```sh
read -s 'QA_DATABASE_PASSWORD?New QA database password: '
npx supabase projects create WinnipegBusTripPlanner-QA \
  --org-id YOUR_ORGANIZATION_ID \
  --region ca-central-1 \
  --db-password "$QA_DATABASE_PASSWORD"
unset QA_DATABASE_PASSWORD
```

The sample region is Canada Central; choose a supported region matching your
requirements and compare the QA/production PostgreSQL major versions. This
command passes the password to the CLI process; do not put a literal secret in a
committed script or paste its output/configuration into chat. Wait for the
project to become healthy, then get its reference from the dashboard.

```sh
npm run db:register:qa -- --project-ref YOUR_QA_PROJECT_REF
```

This changes only the non-secret local environment registry. Commit that reference
once reviewed. It must differ from production. Populate the QA variables in
`.env.database.local` from the **QA project's** Connect/API settings:

- `QA_DATABASE_URL` (direct/session URI including QA database password)
- `QA_DATABASE_CA_FILE` if needed
- `QA_SUPABASE_PUBLISHABLE_KEY` (public/legacy anon key)
- `QA_SUPABASE_ADMIN_KEY` (QA secret/legacy service-role key, test tooling only)
- `QA_BACKEND_URL` and `QA_BACKEND_DIR`

The API URL is derived from the registered QA reference, not a freely supplied
URL. Legacy JWT keys are checked for the expected role/project when available;
opaque keys are authenticated by the target QA API. Admin and database keys must
never have EXPO_PUBLIC names or be included in the app.

## 3. Recreate the application schema in QA

```sh
npm run db:migrate:qa
npm run db:migrate:qa -- --apply --confirm-ref YOUR_QA_PROJECT_REF
npm run db:audit:qa
npm run db:compare
```

Without `--apply`, migration commands are read-only plans listing pending files
and their hashes. With `--apply`, the wrapper checks the exact environment,
confirms the reference and delegates execution/history to the pinned Supabase
CLI. It does not use whichever project was last linked. It excludes vault,
seed and role synchronization. Raw subprocess errors are redacted.

An empty QA application schema is built from all migrations. Existing untracked
QA application tables require baseline review too. A later full QA rebuild is
explicitly destructive to hosted QA schema/data and invokes Supabase's remote
reset with no seed. It is never offered for production:

```sh
npm run db:rebuild:qa
npm run db:rebuild:qa -- --apply --confirm-ref YOUR_QA_PROJECT_REF
```

Run rebuild only when no other tester or test job is using QA. The tools operate
on a dedicated project, not a QA schema inside production. Keep applied migration
files immutable; the lock manifest enforces file integrity. For a new change:

```sh
npx supabase migration new describe_change
# Write/review the SQL, including explicit grants/policies and data backfills.
npm run db:manifest
npm run db:check
```

## 4. Match Auth configuration deliberately

If available, set a scoped `SUPABASE_ACCESS_TOKEN` in the private environment file.
It is a management token, not the database/API key. Read-only production config
inspection exports only approved non-secret fields:

```sh
npm run db:auth:audit:production
npm run db:auth:qa
npm run db:auth:qa -- --apply --confirm-ref YOUR_QA_PROJECT_REF
```

`supabase/qa-auth.json` describes email/password signup, confirmation, minimum
password length and allowed callback URLs. Review it against production before
applying it to QA, especially if the QA web origin differs. The PATCH command is
QA-only and changes only that allowlist of fields; it does not copy SMTP or OAuth
secrets. Without management access, configure the same fields in the dashboard.
Other provider/SMTP/Storage/network settings remain a manual inventory item;
these tools do not claim to clone the complete Supabase project configuration.

## 5. QA backend, app, fixtures and live verification

Install backend dependencies in `QA_BACKEND_DIR`, then start the separate QA
backend terminal:

```sh
npm run db:backend:qa
```

The runner overrides the backend's Supabase URL/public key with QA values and
excludes database/admin/management credentials from its environment. Transit and
Mapbox settings can continue coming from the backend's existing ignored `.env`.
Use a separate port in `PORT` if a production-connected local backend is running.

Configure the QA app build/Metro process with:

- `EXPO_PUBLIC_SUPABASE_URL=https://YOUR_QA_PROJECT_REF.supabase.co`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set to QA's public key
- `EXPO_PUBLIC_BACKEND_URL` set to the QA backend (Android emulator can use
  `http://10.0.2.2:8787` when that backend runs on your Mac).

Restart Metro after changing environment variables and sign in with QA accounts;
production sessions/accounts do not transfer into QA. The management scripts do
not alter the app's normal environment automatically.

For persistent manual sample accounts/data:

```sh
npm run db:seed:qa -- --apply --confirm-ref YOUR_QA_PROJECT_REF
```

Two generated preconfirmed accounts get synthetic favorite locations/trips and
history. Their credentials are saved only in a private `.database/qa-accounts-*.json`
file. No signup email is sent and no production accounts/data are copied.

For isolated automated checks:

```sh
npm run db:test:qa
```

This audits QA, creates two unique **empty** preconfirmed accounts, signs them in,
and runs the existing backend `scripts/check-saved-items.mjs` with their access
tokens. It verifies real API behavior/RLS, cross-account ownership, duplicate
favorites, deletion and history limits/replanning/concurrency. It then deletes
only this run's tagged accounts (and their cascading saved rows). Shared manual
QA accounts are not reset. Tests/rebuilds/migrations must be serialized on QA.

A passing report is written only after cleanup and a stable-schema check. If
cleanup fails, a private manifest is retained for a scoped retry:

```sh
npm run db:cleanup:qa -- --apply --confirm-ref YOUR_QA_PROJECT_REF \
  --accounts .database/qa-accounts-RUN_ID.json
```

The runner checks the project reference, exact run and admin-only app_metadata
marker before deleting any account. Use the actual manifest path printed by the
command, including a `qa-cleanup-*` path after interrupted cleanup.

## 6. Promote the same migrations to production

```sh
npm run db:migrate:production
npm run db:migrate:production -- --apply --confirm-ref rshgohxdntjglnqilyls
```

Production application requires reconciled history and passing QA evidence from
the last 24 hours for the exact current migration hashes/project. It rereads QA
metadata before applying and checks that the schema is unchanged, migration
history is current, and PostgreSQL major versions match. Evidence is a local
operator workflow check, not a cryptographic approval or replacement for review.
The same migration files are applied, not a dump of QA user data. Test upgrades
against seeded representative data as well as initial creation. Backward-compatible
schema changes are important because older mobile releases may still be active.

There is no production reset, seeding, fixture cleanup, or automatic ledger
repair command. Production Auth settings are read-only in these tools. A rollback
or forward repair is a separately reviewed migration; restoring deleted data
requires backups, not merely reversing DDL.

## CI and current limits

```sh
npm run db:check
npm run db:tools:test
```

The GitHub workflow runs these without any hosted credentials or local database.
It does not deploy migrations automatically. Hosted migration/test runs require
the registered target and private credentials; never expose them to fork PR jobs
or publish raw audit/fixture artifacts. A future protected environment workflow
can run the same commands once the baseline and QA setup are verified.

Current status/evidence: [production baseline review](../supabase/baseline/README.md).
Raw audits and QA fixtures are intentionally ignored by Git. A baseline is not
complete merely because tools exist or a migration appears in the ledger.

An exact refresh preserving original production accounts and password hashes is
tracked separately in [issue #23 and its implementation plan](exact-production-to-qa-copy.md).
It is not supported by the synthetic seed command; no real data refresh has run.

Primary references:
- https://supabase.com/docs/guides/deployment/database-migrations
- https://supabase.com/docs/guides/deployment/managing-environments
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/reference/api/v1-get-auth-service-config
