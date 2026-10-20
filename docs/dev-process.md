Run database commands from `/Users/linpu/workplace/WinnipegBusTripPlanner-Backend`. See the [backend database guide](https://github.com/pricezhang42/WinnipegBusTripPlanner-Backend/blob/codex/database-connection-profiles/docs/hosted-database-management.md) and [independent app connections](connections.md).

Use this flow: **write a SQL migration → apply it to QA → test → review the PR → apply the same migration to production.** Deployment is manual; merging a PR does not update either database.

1. **Create a new migration in the backend repository.**

   ```sh
   npx supabase migration new describe_your_change
   ```

   Edit the generated SQL file under `supabase/migrations/`. Include any required data backfill, grants and policies. Keep previously applied files unchanged.

2. **Register and apply it to QA.**

   ```sh
   npm run db:manifest
   npm run db:check
   npm run db -- migrate --database qa1
   npm run db -- migrate --database qa1 --apply --confirm-ref dvxkygiqnvvghkmqxhvk
   npm run db -- audit --database qa1
   ```

   The first migration command previews pending changes.

3. **Test the change.**

   Test affected app features in the emulator. With the QA backend running on port 18787, also run:

   ```sh
   npm run db -- test --database qa1 --api local
   ```

   This verifies saved-data behavior and creates QA verification evidence. Add checks specific to your schema change—such as verifying a backfill—because the existing tests do not cover every future migration.

4. **Commit and review.**

   Include the new SQL file, updated `migrations.lock.json`, related code and validation results in a PR.

5. **Deploy to production after review and baseline reconciliation.**

   ```sh
   npm run db -- migrate --database production
   npm run db -- migrate --database production --qa-database qa1 --apply --confirm-ref rshgohxdntjglnqilyls
   npm run db -- audit --database production
   ```

   Production requires passing QA evidence from the last **24 hours** for the exact migration files, with QA’s schema unchanged.

If you **already changed QA through the Dashboard**, capture those exact changes in a migration first. Verify every effect, then reconcile that version in QA’s ledger so it is not executed twice. Production will execute the migration normally.

Also, refresh production data into QA **before** introducing schema differences: the copy runner requires matching table structures. For mobile compatibility, prefer adding nullable columns first, then backfilling and removing old fields in later releases.