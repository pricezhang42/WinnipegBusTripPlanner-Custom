# Pass-up evidence and category policy

## Report-based rules remain under review

The October 18, 2026 rebuild matches each full-bus report to the nearest stop on
the same route, destination and covered date, within 150 m. It does not compare
runner-up stops or match a report to a specific bus visit. Groups use the report's
Winnipeg timestamp, weekday/weekend and fixed two-hour window, pooling seasons.
Spatial profiles at 60 m, 100 m and 150 m describe matching sensitivity.

Schema 3 (`stop-report-counts-v1`) counts unique report IDs and reporting dates.
Different IDs can describe the same bus. Reference departure totals use scheduled
local time and are context only; counts can exceed departures, and groups with
zero reference departures are retained. Counts are not boarding-failure rates.

The user chose to **keep label rules under review**. Candidate comparisons in the
analysis repository are not production policy. The backend returns
`passupReports.labelStatus: pending_policy_review` with evidence, independently
of departure timing availability. The app does not display new categories or
percentages from this field.

## Existing app behavior retained

The separate deployed `passup-risk.json` artifact uses legacy
`reported-pattern-v2` visit evidence. Its reader verifies grouping, cutoff,
departure-source hash and agreement across the three stored distance/time
profiles (`60m_120s`, `100m_180s`, `150m_300s`). These are legacy artifact checks,
not instructions for building new report evidence.

Existing category gates are unchanged:

- At least 60 recorded visits across 10 dates; zero-report Low requires 120 visits.
- Score = reported visits / (recorded visits + 50).
- Medium starts at 0.010 with reports on at least 2 dates.
- High starts at 0.025 with reports on at least 3 dates.
- Lower scores are Low; insufficient evidence/persistence, incompatible data or
  disagreement between profiles gives Unknown.

These categories describe reported historical patterns, not calibrated
probabilities. The UI shows a warning only for Medium/High and names the category
in accessibility text. Low/Unknown produces no warning row. Missing risk evidence
does not remove departure statistics. Do not apply these visit-based thresholds
to report counts.

See [historical data](historical-data.md) for current artifacts and the
[reliability flow](trip-reliability-implementation.md) for the departure summary.
