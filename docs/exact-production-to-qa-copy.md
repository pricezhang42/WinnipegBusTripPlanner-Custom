# Exact production-to-QA data refresh

Tracking: [issue #23](https://github.com/pricezhang42/WinnipegBusTripPlanner-Custom/issues/23).
Depends on [PR #22](https://github.com/pricezhang42/WinnipegBusTripPlanner-Custom/pull/22).

Status: **implementation plan only**. No copy command is implemented by this
document. No production data has been exported and no QA users/data have been
replaced. The current `db:seed:qa` command creates synthetic fixtures; it cannot
perform this refresh.

## Outcome and boundary

The user requested original accounts and passwords, without anonymization. A
successful refresh preserves user UUIDs and existing password hashes, so the
same email/password credentials work against QA. It preserves the associated
favorites and history, including keys, original row IDs, timestamps and JSON
values. Passwords are never recovered as plaintext or reset through the Admin
API. Supabase supports transferring Auth users and their password hashes through
its database migration workflow; see the [Auth migration guide](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects).

This is a copy of **data into the versioned QA application schema**, with an
explicit Auth migration compatibility check. It does not roll QA back to
production's older function permissions. The environments keep separate signing
keys, API keys, service configuration and Auth callback URLs. Production remains
read-only throughout. Existing QA users and their saved data are replaced only
by an explicitly acknowledged refresh.

Source: `rshgohxdntjglnqilyls`; destination: `dvxkygiqnvvghkmqxhvk`.
The runner must derive these from `supabase/environments.json` and the existing
verified-TLS connection helpers, not whichever project a CLI last linked to.

| Data or state | Intended treatment |
| --- | --- |
| `public.favorite_locations`, `favorite_trips`, `trip_history` | Copy every row and original ownership/value. Restore identity/sequence behavior without ID collisions. |
| Auth users, identities and related Auth data | Preserve original records and hashes through a compatible logical restore. Inventory all Auth tables before choosing a complete restore set. Do not copy just `auth.users`. |
| Auth sessions, refresh tokens, MFA, OAuth/SSO and encrypted fields | Explicit preflight/review item. A reduced set is not an exact copy. If compatible restoration cannot be established, stop and report the missing scope. Do not silently discard or transform it. |
| Auth service migration bookkeeping | Compare source/target managed schema versions and restore data using a supported route. Never replace bookkeeping to conceal incompatible tables. |
| `supabase_migrations` | Retain QA's application migration ledger. Production currently has no ledger; copying that absence would lose QA's migration tracking. |
| Public schema definitions, RLS, grants and functions | Keep migration-managed QA definitions and the QA-only permission correction. Data restore must not import production DDL/default privileges. |
| Additional schemas, Vault, Storage, replication and integrations | Inventory and classify before execution. Include dependencies deliberately or declare the run unsupported; app-table parity alone is not a full-project clone. Storage file bytes need their own transfer when present. |
| Project keys, URLs, SMTP/provider secrets and callback settings | Remain QA-specific. Do not copy the production signing secret to preserve existing mobile sessions. |

The operator should sign out and obtain a fresh QA session after copying.
Keeping separate project signing keys means a production access token is not a
QA login. Existing password compatibility and existing-session compatibility
are separate requirements. Copying refresh/session records and encrypted Auth
state requires explicit review; it must not be assumed safe or functional just
because a table restore succeeded.

## Proposed operator interface

These commands describe the intended implementation; **they do not exist yet**:

```sh
# Metadata/preflight plan; no export or destination writes.
npm run db:refresh:qa

# Create protected source and recovery artifacts and replace QA only.
npm run db:refresh:qa -- \
  --apply \
  --confirm-source rshgohxdntjglnqilyls \
  --confirm-ref dvxkygiqnvvghkmqxhvk \
  --replace-qa-data
```

The default preview lists references, schema compatibility, selected tables,
dependencies, required tools and unresolved blockers. It must not print rows,
emails, metadata payloads, hashes, reset/session tokens or connection strings.
Preview must not export real rows. Any row counts needed during execution stay
in private verification artifacts rather than raw SQL logs.

The implementation must reject production as destination, equal references,
missing confirmations and connection URLs that do not identify the registered
project. Existing verified-TLS validation applies to both connections. There is
no generic `--force`, linked-project fallback or production reset path.

## Implementation sequence

1. **Preflight without data export.** Check tools and actual server/managed Auth
   versions. Compare columns/types/defaults/generated fields, constraints,
   triggers, sequences, extensions and grants needed for the restore. Inspect
   metadata for additional dependencies, integrations and encryption requirements.
   Detect unreviewed foreign keys outside the selected tables. Refuse an
   unsupported combination before changing QA. PostgreSQL 17.6/17.11 major
   compatibility alone does not prove Auth service compatibility.
2. **Choose the supported restore mechanism.** Use the
   [Supabase logical backup/restore workflow](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
   as the reference. Native PostgreSQL tools or disposable tool containers are
   acceptable; no local Supabase database instance is required. Verify the pinned
   CLI's actual inclusion/exclusion behavior, especially Auth data, before use.
   Use PostgreSQL tools compatible with both servers. Do not invent a partial
   JavaScript copy of managed Auth tables.
3. **Prepare recovery.** Stop QA app/backend access and concurrent seed/test/
   migration jobs; establish a single refresh lock. Take a protected, validated
   QA backup and record its schema/ledger versions. A backup is not proven
   recoverable merely because its file exists: rehearse restoration on disposable
   hosted infrastructure before relying on this workflow.
4. **Export a consistent production snapshot.** The export connection is
   read-only. Keep all related tables in the same logical snapshot so changing
   favorites/history/users cannot produce mismatched ownership. Do not change
   production Auth settings, triggers, grants, sequences, schema or ledger.
   Sequence allocation state is not MVCC table data: record and handle its
   high-water marks explicitly rather than claiming a perfect snapshot of counters.
5. **Replace destination data.** Validate the recovery artifact before removal.
   Quiesce QA Auth/API access and use a bounded transaction/lock strategy.
   Restore the chosen complete dependency set into QA's compatible schema.
   Do not use unbounded `TRUNCATE ... CASCADE`, broad schema drops or migration
   resets. Identity inserts, trigger handling, encryption and sequence recovery
   must follow the chosen tested restore mechanism. If that mechanism requires
   temporarily suppressing triggers, explicitly validate referential integrity
   afterward and restore the original settings on every exit path.
6. **Verify before releasing QA.** Compare source-snapshot and destination row
   counts and stable content digests, ownership links, nullability, FK integrity,
   original password hashes and restored next-ID behavior. Avoid JavaScript
   number/date conversions that lose bigint precision or timestamp fractions.
   Treat password hashes and low-entropy data digests as sensitive values; print
   only pass/fail summaries. Verify QA schema and migration ledger are unchanged.
7. **Authenticate and test.** An account owner enters their existing password
   locally against the QA endpoint; never request it in chat or save it in an
   artifact. Verify confirmed/unconfirmed and email/password behavior explicitly.
   OAuth/SSO/MFA need compatible QA provider settings/encryption and dedicated
   checks before claiming those flows work. Run `db:test:qa` using its own new
   temporary accounts; it must not write to or clean up cloned accounts.
8. **Finalize or recover.** Invalidate pre-refresh QA promotion evidence before
   any data replacement. Write new evidence only after verified restoration,
   live tests and owned-fixture cleanup. On failure, keep QA unavailable until
   the transaction is rolled back or its validated backup is restored. Report
   whether rollback succeeded; never claim atomic recovery for nontransactional
   sequence/tool side effects. Release the lock and reopen QA only after checks.

## Artifact handling

Artifacts can contain the original emails, location history, password hashes,
MFA material and tokens. Store them only in an ignored `.database/` run directory
with mode 0700 and files mode 0600, outside the Metro graph. Record source/target
references, snapshot time, selected schemas, tool versions and protected backup
checksums. Never commit/upload those artifacts, attach them to the PR, expose
them through the mobile build or publish them through CI.

Define an operator-chosen retention period and a cleanup command. Delete source
exports after successful verification according to that policy; keep the QA
recovery artifact until its rollback window closes. No secrets belong in process
arguments or unredacted error logs. Existing secret redaction must be reviewed
for errors containing SQL/data, not only environment-variable values.

Copying database data does not send signup emails by itself, but restored cron,
webhooks, queues and integrations can have external effects. Keep such services
disabled or pointed at QA before exposing restored data. Do not reset passwords
or trigger real-user emails as an automated validation shortcut.

## Rehearsal and acceptance evidence

Before a real refresh, exercise the runner on disposable hosted source/target
fixtures containing password users, identities, favorites/history, high identity
values and existing target data. Verify:

- Reversed/equal targets, missing acknowledgements, invalid TLS and incompatible
  Auth schema/encryption stop before destination mutation.
- Source stays read-only; copied rows preserve UUIDs, hashes and exact values.
- Mid-restore failure, FK mismatch and verification failure produce a tested
  rollback/recovery path; secrets do not appear in diagnostics.
- Repeated refresh replaces the intended QA set without duplicate identities,
  orphaned ownership or sequence collisions, while retaining QA schema/ledger.
- QA original-password login works; source tokens/keys are not used as QA login.
- Original cloned users survive the existing temporary-account test cleanup.

Offline CI tests validate guards, artifact handling, planning and failure paths.
CI must not receive production rows, password hashes or credentials. Live rehearsal
and the first production-to-QA run remain explicit operator steps after review.

For comparison, Supabase's [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project)
is a separate full database cloning option with its own plan/backup requirements.
It creates a new project, so it is not an automatic refresh of our existing QA
project and does not replace the compatibility/configuration review above.
