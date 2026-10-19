# Reliability flow

The app displays historical **departure** behavior for each expanded ride. It does
not infer arrival timing or predict the next bus. Timing and pass-up report
counts are separate measures.

## From source to summary

1. The analysis repository cleans departure rows and aggregates individual
   observations. Early means more than 60 seconds early; late means more than
   300 seconds late. The boundaries themselves count as on time.
2. The backend resolves the route, boarding stop, exact normalized destination,
   Winnipeg date, weekday/weekend and two-hour window. All seasons are pooled.
   Windows start on even hours: 16 covers 16:00–17:59. There is no fallback to
   another stop, destination or route.
3. Departure statistics require at least 30 observations across 5 dates. The
   backend validates counts, dates, quantiles, shares and intervals before
   returning `reliability.status: available` and the stored statistics. Otherwise
   it returns `status: unavailable` and a reason.
4. `lib/reliability.ts` converts the early and late shares into one presentation
   model. `components/RideReliability.tsx` renders that model without repeating
   the calculations.

The summary rounds `(earlyShare + lateShare) * 100` to a whole percent. The number
is green below 20%, blue from 20% through 45%, and red above 45%. At an early share
of at least 20%, it adds “N% left early.” Accessibility text names the color band
and explains that this is historical evidence, not a live prediction. Invalid
shares display Unavailable.

## Availability

| Backend reason | Meaning |
|---|---|
| `data_unavailable` | Missing or invalid artifact/statistics |
| `route_without_history` | Route absent from the artifact |
| `boarding_context_missing` | Stop, direction or time cannot be resolved |
| `insufficient_comparable_history` | No timing group with enough evidence |
| `data_outdated` | Artifact age or trip horizon exceeds 30 days, or cutoff is in the future |
| `historical_date_unsupported` | Trip date is on/before the data cutoff |
| `holiday_calendar_unsupported` | Listed holiday or unsupported calendar year |

The current backend calendar supports 2026. These restrictions are unchanged;
calendar expansion and artifact freshness work are tracked separately. Missing
reliability never prevents a trip plan from being returned.

## Pass-up data boundary

The independent ride-level `passupRisk` uses approved policy
`report-scheduled-visit-ratio-v1`: 150 m reports divided by recorded visits grouped
by scheduled time. Medium starts at 1% with reports on two dates; High at 2.5%
with reports on three dates, subject to sample minimums. The app displays only
Medium/High warnings, with the category in the accessibility label. It does not
display the numeric report ratio.

Ride-level `passupReports` contains schema-3 report counts and reference departure
counts independently of timing availability. Different report IDs can describe
one bus, so the ratio is not a boarding probability. A report group can exist
without recorded departures and then has an Unknown category.

Older backends without the independent category still use the nested visit-based
`reliability.passupRisk`. An explicit new Unknown never falls back to that old
category. See [pass-up policy](passup-risk-policy.md) for the approved gates.

## Running and checking

Start the companion backend (`npm run dev`) and point
`EXPO_PUBLIC_BACKEND_URL` to it. The Android emulator host address is
`http://10.0.2.2:8787`. A hosted backend must be updated separately; restarting
Expo does not update it.

Backend checks: `npm run build` and `node --import tsx --test src/*.test.ts src/gtfs/*.test.ts`.
App checks: `npx jest components/__tests__/RideReliability.test.tsx lib/__tests__/reliability.test.ts --runInBand --watch=false`.
Tests cover sparse/missing history, timezone and window boundaries, freshness,
malformed evidence, percentage rounding, early notes, colors and warning rows.

For data builds and installation, see [historical data](historical-data.md).
Outside time remains walking plus waiting without a shelter.
