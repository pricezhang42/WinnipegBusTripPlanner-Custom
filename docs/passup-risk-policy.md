# Pass-up report ratio policy

`report-scheduled-visit-ratio-v1` is approved for implementation. Use unique
full-bus reports matched to the nearest same-route/destination/date stop within
150 m, divided by recorded visits in the corresponding scheduled-time group.
The denominator is cleaned departure observations, not all GTFS scheduled trips.
Reports use reported local time; reference visits use scheduled local time.
Both use exact stop, route, destination, weekday/weekend and a two-hour Winnipeg
window, pooling all seasons.

| Category | Rule |
|---|---|
| Low | Ratio below 1%; zero reports additionally need 120 visits |
| Medium | Ratio from 1% to below 2.5%, with reports on at least 2 dates |
| High | Ratio at least 2.5%, with reports on at least 3 dates |
| Unknown | Insufficient/invalid evidence or insufficient reporting persistence |

All categories first need at least 60 visits across 10 dates. A High ratio with
only two reporting dates stays Unknown. Ratios above one are flagged Unknown
rather than capped. The old +50 score penalty is absent. The 60 m/100 m profiles
are retained for auditing but do not veto the broad category.

Reports are not verified affected visits: different IDs can describe one bus,
reporting may be incomplete, approximate coordinates affect assignment and the
time bases differ. Categories are descriptive patterns, not boarding probabilities.

The backend serves the new category in independent ride-level `passupRisk` and
counts in `passupReports`. The app prefers this explicit category, including
Unknown, even if departure timing is unavailable. Only older backends without the
field use `reliability.passupRisk`. Legacy visit-based files remain for older
clients during migration; their thresholds do not govern the new report reader.

The UI preserves the departure row and displays “Historical pass-up risk: Low”,
“Medium” or “High” as text. Unknown or missing categories produce no pass-up row.
The accessibility label also names the category. Numeric report ratios, raw
counts and extra audit rows are not displayed.

Current evidence: 93,609 groups, with **70,428 Low, 161 Medium, 35 High and 22,985
Unknown**. These are groups, not routes or riders. The source cutoff is September
24, 2026; freshness/calendar checks still apply. The complete report artifact set
is prepared in the companion backend; hosted deployment and app reload are
separate steps.

See [historical data](historical-data.md) for installation and the
[analysis policy](https://github.com/pricezhang42/Winnipeg-Transit-Data-Analysis/blob/main/REPORT_TIME_PASSUPS.md)
for matching and audits.
