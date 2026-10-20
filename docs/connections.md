# Independent app connections

Node 22+ is required for the launchers. Run `npm ci`, then copy
`.env.connections.example` to `.env.connections.local` if the local file does not
already exist. The prepared local file contains only public app settings.

Choose the API server and Supabase Auth project separately:

```sh
npm run android -- --api local --auth qa1
npm run ios -- --api simulator --auth qa1
npm run start -- --api production --auth qa1 --clear
npm run web -- --api simulator --auth qa2 --clear
npm run export -- --api production --auth production --platform android
```

Every command accepts `--print` to validate and display the selected URLs without
starting Expo. The API and Auth names do not have to match. `--auth none` disables
accounts for guest testing. Missing/unknown/incomplete profiles fail rather than
falling back to production. Define additional blocks using uppercase prefixes.
`local` uses Android's host address `10.0.2.2:18787`; `simulator` uses localhost.
For a physical device, define an API profile using your computer's LAN address.
qa2 is a placeholder until you create/configure that hosted project.

Profile mode disables Expo's automatic dotenv loading and injects only the chosen
public API/Auth values. `.env.local` and inherited public URLs cannot override
these selections. Stop any running Metro server before switching connections;
restart with `npm run start -- --api ... --auth ... --clear`, then rebuild/reload
the client. App connection values are embedded when bundling; an installed release
needs a new build/update to change connections.

Commands with neither selector retain the existing Expo `.env.local` workflow.
The connection profile file and Node launchers are excluded from Metro. Never put
database passwords, service-role keys or secret keys in either app env file.

The saved-data API currently verifies users against its selected database project's
Auth service and uses their JWT under RLS. For example, a production API deployed
against qa1 data works with qa1 Auth. qa2 Auth against a qa1 database is allowed
as a configuration choice but returns an authentication error for favorites and
history; it does not map users between projects. Public trip searches still work.

Database operations and backend server/database selection are documented in the
[backend repository](https://github.com/pricezhang42/WinnipegBusTripPlanner-Backend/blob/codex/database-connection-profiles/docs/connections.md).
