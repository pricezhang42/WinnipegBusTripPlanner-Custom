# Independent app connections

Node 22+ is required for the launchers. Run `npm ci`, then copy
`.env.example` to `.env.local` if the local file does not
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
public API/Auth values. Explicit CLI selectors override the defaults in `.env.local`;
process environment overrides file values. Unselected blocks are never passed to Expo. Stop any running Metro server before switching connections;
restart with `npm run start -- --api ... --auth ... --clear`, then rebuild/reload
the client. App connection values are embedded when bundling; an installed release
needs a new build/update to change connections.

Use one local file, `.env.local`, and one committed template, `.env.example`.
Set `DEFAULT_API=local` and `DEFAULT_AUTH=qa1` in that file, then `npm run android`
uses those independent defaults. Override either selector without changing the other:
`npm run android -- --auth qa2`. Direct `npx expo` bypasses the profile launcher;
use the npm commands for named connections.

The retired `.env.connections.local`, frontend `.env.database.local` and backend
`.env` were consolidated. Original local bytes are archived with restrictive
permissions in the backend's ignored `.database/env-backups/` directory; they are
recovery copies, not active configuration. No private database values were moved
into the frontend file. The local config and Node launchers are excluded from Metro.
Never put database passwords, service-role keys or secret keys in the app config.

The saved-data API currently verifies users against its selected database project's
Auth service and uses their JWT under RLS. For example, a production API deployed
against qa1 data works with qa1 Auth. qa2 Auth against a qa1 database is allowed
as a configuration choice but returns an authentication error for favorites and
history; it does not map users between projects. Public trip searches still work.

Database operations and backend server/database selection are documented in the
[backend repository](https://github.com/pricezhang42/WinnipegBusTripPlanner-Backend/blob/main/docs/connections.md).
