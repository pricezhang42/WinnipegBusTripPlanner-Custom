# Historical data

The analysis repository owns ingestion, cleaning and aggregation. Use its current
[build instructions](https://github.com/pricezhang42/Winnipeg-Transit-Data-Analysis/blob/main/HISTORICAL_DATA.md)
and [report-evidence contract](https://github.com/pricezhang42/Winnipeg-Transit-Data-Analysis/blob/main/REPORT_TIME_PASSUPS.md).
Removed pilot exporters and visit-matching audit commands must not be used to
build report-count artifacts.

## Current rebuild

The October 18, 2026 rebuild covers July 1, 2025–September 24, 2026, using the 13
monthly ZIP archives and recent departure CSV. It retains 46,948,677 cleaned
departures across 72 route identifiers. The supplied files start in July; missing
June days are not reconstructed. All seasons are pooled into exact
route/stop/destination/weekday-or-weekend/two-hour groups.

- Timing: 83,568 supported groups; statistics unchanged by the report-matching simplification.
- Pass-ups: 16,049 full-bus reports on covered dates; one invalid coordinate and
  4,561 reports without a stop within 150 m are excluded. 11,487 unique reports
  match within 150 m (7,760 within 60 m; 10,018 within 100 m).
- There are 2,008 report-positive groups, including two without reference departures.

Audit files and source hashes are retained in the analysis repository under
`reports/history-report-time-20261018`. Recorded departures do not establish
complete actual-service coverage or a denominator for pass-up probabilities.

## Backend installation

Install each manifest together with all its referenced route shards, preserving
relative paths. The backend loads manifests at startup and must be restarted.
Never replace a manifest without its matching shards.

| Artifact | Backend path override | Purpose |
|---|---|---|
| `reliability.json` + timing shards | `RELIABILITY_DATA_PATH` | Departure statistics, schema 2 |
| `passup-report-counts.json` + report shards | `PASSUP_REPORT_DATA_PATH` | Evidence only, schema 3; label policy pending |
| Existing `passup-risk.json` + risk shards | `PASSUP_RISK_DATA_PATH` | Legacy visit-based v2 categories only |

Default paths are in the backend's `data/` directory. The new report reader checks
its evidence identity and departure-source hash against timing when present.
Missing/incompatible files produce unavailable evidence without blocking plans.
New report artifacts cannot be substituted for legacy risk artifacts. This code
refactor does not install artifacts or deploy the backend.

The backend's 30-day freshness/horizon and calendar rules still apply. Larger
historical coverage does not make months-ahead estimates available.
