# Route colours

Every route badge (trip summary and expanded ride details) and every ride's map line and pins
come from one resolver, `routeStyle()` in `lib/routeStyle.ts`. A route's style depends only on
the route, never on where it appears in a trip.

## Where the colours come from

1. **Winnipeg Transit `badge-style` (preferred).** Every route object in the Transit API carries
   `badge-label` and `badge-style` (`class-names`, `background-color`, `border-color`, `color`).
   The v3 trip planner includes them on each ride's `route`, and the backend's `/api/plans`
   passes the route object through unchanged, so the app needs no extra requests.
2. **Reviewed palette (fallback).** If `badge-style` is missing or malformed, the resolver uses
   the palette below. It was copied from the v4 Routes API on **2026-10-22** and matches GTFS
   `routes.txt` `route_color` / `route_text_color` (feed valid 2026-09-06 to 2026-12-12).
   winnipegtransit.com/routes reads the same API values at runtime; it has no stylesheet of its own.

Precedence: exact named routes (BLUE, FX2, FX3, FX4), then the listed numbered routes, then the
`F<n>` and `D<n>` families. FX is not a family: each FX route has its own colour, so an unknown
FX route gets the neutral badge instead of the F colour. Keys are trimmed and upper-cased first.

| Class | Routes | Background | Border | Text |
| --- | --- | --- | --- | --- |
| blue (rapid transit) | BLUE | `#0064b1` | `#0064b1` | `#ffffff` |
| FX2 | FX2 | `#f37043` | `#f37043` | `#ffffff` |
| FX3 | FX3 | `#f27ea6` | `#f27ea6` | `#ffffff` |
| FX4 | FX4 | `#6450a1` | `#6450a1` | `#ffffff` |
| frequent | F5–F9 | `#00b262` | `#00b262` | `#ffffff` |
| direct | D10–D19 | `#026c7e` | `#026c7e` | `#ffffff` |
| connector | 22, 28, 31, 37, 38, 39, 43, 48, 70, 74 | `#052465` | `#052465` | `#ffffff` |
| community | 91, 220–680 (30 routes) | `#ffffff` | `#052465` | `#052465` |
| limited | 690, 691, 694, 833, 881–889, 895 | `#fff0d8` | `#052465` | `#052465` |
| unknown / new route | anything else | `#ffffff` | `#d9d9d9` | `#000000` |

The unknown style is the one winnipegtransit.com uses for a route without a style.

## Map lines

A ride's line and pins use the badge background. Pale backgrounds (community, limited) would
disappear on the map, so their line is darkened by 40%, as winnipegtransit.com does on its own
map. Unknown routes are drawn in dark grey `#4b5563`. Walking and transfer legs stay dashed
grey and are not route colours.

## Readability

Badges keep their official colours in light and dark mode; the badge's own background carries
the label. If an API style ever pairs text with an unreadable background (contrast below 3:1),
the resolver switches the label to black or white. Pass-up High/Medium/Low colours, shelter
labels and the timeline rails are separate from route branding and are unchanged.

## Updating the palette

When Winnipeg Transit adds or restyles routes, compare `GET /v4/routes.json` (`badge-style`)
with the tables in `lib/routeStyle.ts`, update both this page and the code, and change the
review date. Tests are in `lib/__tests__/routeStyle.test.ts`.
