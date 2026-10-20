# Saved items through the backend

Issue: https://github.com/pricezhang42/WinnipegBusTripPlanner-Custom/issues/17

The app signs in and refreshes sessions with Supabase Auth. Favorites and history
use the backend `/api/me/*` endpoints. The backend verifies each bearer access
token with `auth.getUser(token)` and creates a separate Supabase client for that
request, using the publishable key plus the same user token. Queries explicitly
filter by the verified user ID; PostgreSQL RLS remains enabled. No service-role
key, refresh token, database password, or client-supplied user ID is used.

## Setup and rollout

1. Apply all three existing SQL migrations in `supabase/migrations/` in filename
   order, including the history deletion migration. No new schema migration is
   needed for this API migration.
2. In WinnipegBusTripPlanner-Backend, set `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY` to the same project as the app. A legacy anon key
   works too; secret/service-role keys are rejected. Use Node 22 or newer.
3. Run backend checks and start it with `npm run dev` (port 8787 by default).
4. Configure the app's existing `EXPO_PUBLIC_BACKEND_URL` if necessary. Without
   an override Android uses `http://10.0.2.2:8787`; iOS/web use localhost.
   A physical phone needs the host's reachable LAN address. Keep the app's
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Auth.
5. For web, configure `CORS_ORIGINS` to include the actual web origin. Preflight
   supports Authorization, Content-Type, and DELETE.
6. Deploy and verify the backend before releasing the app update. Configure the
   two backend Supabase settings in the hosting environment as well. This code
   change does not deploy them automatically.

Old app builds remain compatible with the existing Supabase tables and function.
The new app has no fallback to direct table access if the backend is unavailable.
Unauthenticated trip planning and geocoding remain public.

## API contract

All paths below start with `/api/me`; all require `Authorization: Bearer <access-token>`.

| Method | Path | Input / result |
| --- | --- | --- |
| GET | `/saved-items` | `{locations: Location[], favorites: SavedTrip[], history: SavedTrip[]}` |
| POST | `/favorite-locations` | `{location: Location}` |
| DELETE | `/favorite-locations/:key` | URL-encoded exact coordinate key |
| POST | `/favorite-trips` | `{origin: Location, destination: Location}` |
| DELETE | `/favorite-trips/:key` | URL-encoded exact origin/destination key |
| POST | `/trip-history` | `{origin: Location, destination: Location}` |
| DELETE | `/trip-history/:id` | Positive database history ID |

`Location` is `{id, place_name, geometry: {coordinates: [longitude, latitude]}}`.
`SavedTrip` contains origin, destination, created_at, trip_key, and (for history)
id. User IDs are excluded from list responses. Writes return 204, including
repeated deletion of absent items. Favorite saves upsert existing keys. Names are
limited to 2048 characters, IDs to 512, and request bodies to 16 KiB. Coordinates
must be finite and within longitude/latitude bounds. Unexpected top-level fields,
including user_id, are rejected. Additional geocoder properties are stripped.

Favorites retain exact coordinate identities (`lon,lat` and
`originLon,originLat>destinationLon,destinationLat`). History still uses the
SQL function's four-decimal coordinate keys. It locks per user, upserts a
replanned trip to the top, and trims to 10 distinct trips atomically.
`record_planned_trip` is SECURITY DEFINER: its explicit auth.uid() check, per-user
queries, empty search_path and restricted execute grants remain essential.

Failures return `{error: {code, message}}` for saved-data validation, auth, and
service errors: 400 invalid input, 401 invalid/missing credentials, 413 oversized
body, 503 authentication/database unavailable. The existing IP limiter allows
120 requests/minute/instance and returns its standard 429 `{error, retryAfter}`
response with Retry-After. Saved-data responses use Cache-Control: no-store.
Saved-item request URLs (which contain coordinate keys), tokens and payloads are
not logged by the application.

## Session and failure behavior

The API client gets the current session before each request and checks it against
the initiating account. A 401 can refresh the session once and retry with the
new access token. Concurrent rejected requests share the refresh. No network,
service-error, or timeout retry is performed automatically for writes because the
original write may have succeeded. A request times out after 25 seconds; backend
Supabase calls have 8-second timeouts and automatic database retries are disabled.

The hook hides personal lists immediately on account changes, cancels reads, and
uses account epochs plus request generations to reject stale results, including
sign-out and sign-in to the same account. Pending writes cannot refresh another
account's lists or clear that account's busy state. A history-save failure reports
that the trip was found but history could not be saved; it does not discard plans.

## Verification

App:

```sh
npx jest --runInBand --watchAll=false
npx tsc --noEmit
```

The existing Map/nap-alarm TypeScript errors are unrelated to this migration.
The existing StyledText test has no committed snapshot, so a full CI-mode Jest
run fails that snapshot check. The other 15 suites (51 tests) pass in CI mode;
the four focused saved-data suites contain 18 passing tests. No unrelated
snapshot is added by this migration.
Backend:

```sh
npm run typecheck
npm run build
node --import tsx --test src/*.test.ts src/gtfs/*.test.ts
```

The backend unit tests exercise the actual Supabase client against a simulated
Auth/Data API. They verify token forwarding, ownership filters, validation,
concurrency and response behavior; they do not establish live database RLS.

For live API/RLS verification, the backend includes `npm run check:saved-items`.
Supply `SAVED_ITEMS_TEST_BACKEND_URL`, two valid access tokens as
`SAVED_ITEMS_TEST_TOKEN_A` and `SAVED_ITEMS_TEST_TOKEN_B`, the backend Supabase
settings, and explicitly set `SAVED_ITEMS_TEST_DISPOSABLE=1`. Use two empty,
disposable accounts on a test project with the three migrations applied.
The script refuses nonempty accounts before writing. It checks cross-account
access through the backend and direct Data API, ownership forgery, duplicate
favorites, the 10-trip limit and replanning order, then removes its fixtures.
Do not commit tokens or put them in shell command history.

This architecture routes the app through the backend but does not disable the
Supabase Data API. Authenticated users can still call exposed tables/functions,
subject to database policies, grants and constraints. It does not make backend
validation a database-wide invariant or change the RLS boundary.
