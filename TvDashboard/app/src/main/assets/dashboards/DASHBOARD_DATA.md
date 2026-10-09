# TV dashboards

## Lightweight illustrated screens (October 2026)

Cloud subscriptions use the same current weather scenery as the warehouse screens.
Customer roof equipment is drawn above the architectural roof surfaces. The building
triangle is removed; project and customer captions retain the full source text and
resize within their available space, with customer names wrapped across two lines.

Warehouse pallets retain their receipt/order reference and show the supplier
(`job.supplier`) for goods in, or the existing source project reference
(`job.project`, normalised from the sales order project/customer reference) for
goods out. Text is rendered as SVG text, with two lines for longer names.
The forklifts are red with rounded rear bodywork and a rotating amber beacon.
Their approach pauses clear of the lorry while raising to deck height; withdrawal
also completes before lowering, keeping forks and cargo clear of the truck.

`_shared/warehouse-weather.js` uses `TVData.weather()` and the same weather cache
as `weather-forecast.html`. Real current WMO conditions drive day/night sky,
clouds, rain, snow, fog and road appearance. No weather values are invented:
failed sources preserve the last-known scene with a stale label; first-load
failures show unavailable weather and a neutral sky. Refreshes run every ten
minutes and on page visibility; motion stops for reduced motion and pauses when
hidden. Geometry and status checks are in `check_warehouse_replays.cjs`.

Goods in, goods out, manufacturing and cloud contracts use local SVG through
`_shared/replay-2d.js`. The shared `_shared/replay-artwork.js` adds vehicle hydraulics,
cab and chassis fittings, wrapped pallets, workshop equipment and architectural
details once, attached to the existing moving parts. No Three.js, WebGL, raster
filters or extra frame loops are required. Existing source scopes and replay
timings are preserved. The older 3D descriptions below are historical.

Weather uses `_shared/tv-signage/scene-2d.js`: gradient-shaded clouds, sun/moon and
an illustrative landscape, with conditions driven by the existing weather feed.
At most three SVG groups animate with CSS; reduced motion stops them and hidden
pages pause them. The landscape is an illustration, not a camera view.

`node tools/dashboard_runner/check_illustrated_screens.cjs` checks all five current
pages at 1920×1080 and 1366×768 with WebGL disabled. It uses isolated browser
fixtures, checks overflow, reduced motion, replay movement and source failures,
and saves labelled screenshots under `logs/illustration-review/`. The office-IP
access controls and live source configuration are unchanged.

These pages are unattended displays. There is no keyboard or mouse. The 13 HTML filenames below are the ones named in `rotation_config.json`; keep them unless the rotation is updated too.

| File | Screen |
| --- | --- |
| `goods-in-24hrs.html` | Goods in: completed receipts, last 24 hours (3D) |
| `goods-out-24hrs.html` | Out the door: completed dispatches, last 24 hours (3D) |
| `manufacturing-24hrs.html` | Made today: finished production orders, last 24 hours (3D) |
| `subscriptions.html` | Cloud contracts (3D) |
| `charging-status.html` | EV chargepoints |
| `shipping_weight-overview.html` | Shipping weight |
| `weather-forecast.html` | Weather (`_shared/tv-signage/`) |
| `website_projects.html` | Architape case studies, full text scrolling at reading pace |
| `company-overview.html` | The week's ins and outs around Architainment: suppliers, manufacturing, dispatches, subscriptions |
| `digital-clock.html`, `lunch-timer.html`, `end-of-day.html` | Clock, lunch break, hometime. The time fills the screen; the studio heading is hidden |
| `after-hours.html` | Evenings and weekends: the time as a strip of 60 LEDs (`_shared/after-hours.js` and `.css`) |

The weekly planner pages (manufacturing, inbound, outbound and subscription schedules) and their overview pages were removed in October 2026. The planner and overview wording below, and the Manufacturing, Inbound, Outbound and Subscriptions rows of the figures table, describe those retired pages and are kept as reference for any reintroduced planner. The current contracts for the 3D pages are in the sections at the end of this file and in `AGENTS.md`.

## Rotation schedule

Each screen in `rotation_config.json` has time groups. The first group whose days and time window match is used.

| Group | Days | Window (London) | Shows |
| --- | --- | --- | --- |
| Weekend | Sat, Sun | 00:00 to 23:59 | `after-hours.html` |
| Lunchtime Break | Mon to Fri | 13:00 to 14:00 | `lunch-timer.html` |
| Hometime Departure | Mon to Fri | 17:15 to 17:30 | `end-of-day.html` |
| Business Hours | Mon to Fri | 06:00 to 17:30 | the ten working dashboards, including `company-overview.html` after the projects page |
| Evening and night | every day | 17:30 to 06:00 | `after-hours.html` |

Days are numbers from 0 (Sunday) to 6 (Saturday), as the kiosk manager writes them; a group with no days applies every day. The runner now honours them; before October 2026 it ignored the field. The fallback list (used only if no group matches) is also `after-hours.html`, so a screen never goes blank. `after-hours.html` has a 3,600-second slot because it keeps its own time and does not need reloading. `tools/dashboard_runner/check_rotation_schedule.cjs` checks the boundaries, including the October clock change.

## After-hours screen

Device time shown in Europe/London, with no data source, so nothing can be stale or missing. The LED strip lights one LED per minute of the hour (brightest is the current minute, earlier minutes fade behind it); every fifteenth LED is taller. Light eases from warm white by day to amber and then ember at night, and is dimmer overnight. The picture drifts a few pixels every ten seconds to avoid screen burn-in; with reduced motion it stays still. Greetings come from the day and hour only.

## Display behaviour

- Weekly planners use horizontal day rows and wide cards: three cards across at 1920px, two at 1366px. Additional cards cycle every 15 seconds. Weekend records, open undated records and undated records with unknown status have their own automatic slides.
- Subscription planners group by **next invoice date**, in five calendar months. This is not labelled a renewal date.
- Overview focus lists cycle every 15 seconds. EV pages cycle through all reported chargepoints, three per status screen or two per charge-progress screen. Case studies scroll continuously at about 26 lines a minute and only give way to the next project 10 seconds after the last line is on screen.
- No hover, click, modal, manual scrolling or button is needed on a TV. Mobile layouts may scroll.
- Source failures preserve successfully received data in memory, mark it stale, and retry automatically. A first-load failure shows unavailable. There are no production test fixtures or simulated fallback values.
- Clocks use the device time in Europe/London. Lunch **ends at 14:00** and hometime is **17:30**, preserving the previous targets. Working days are Monday–Friday; bank holidays and individual schedules are not configured.

## What the figures mean

| Screen | Source | Scope and limits |
| --- | --- | --- |
| Manufacturing | `/manufacturing` | Returned production orders for the selected week, grouped by scheduled start. Gateway limit: 250 records. Completed means `done`; `to_close` stays separate. Overdue uses the deadline. No fabricated quantity totals. |
| Inbound | `/purchases` | Returned purchase orders, not items or parcels. The gateway reads up to 150 records before filtering dates; the result may omit relevant orders. Partial view is explicitly labelled. |
| Outbound | `/sales?type=dispatches` | Returned sales orders, not items or parcels. Gateway limit: 150 before date filtering. Scheduled commitment dates are not actual dispatch timestamps. |
| Subscriptions | `/subscriptions` | Returned contracts across five months plus undated contracts. Gateway limit: 200 before date filtering. No monetary total without currency information. |
| EV | Office EVCC `http://192.168.0.194:7070/api/state` | Power: W ÷ 1,000 → kW. Session energy: Wh ÷ 1,000 → kWh. Missing readings stay unavailable. Negative/over-100 battery percentages are rejected. A disconnected bay does not show stale vehicle SOC. Progress is battery percentage, not a race, efficiency measure or inferred target. |
| Shipping weight | `/sales?type=shipping_review` | **Estimated** weight from stock moves and product weights. Missing weights are replaced by an average in the gateway, or 3.5 kg if none exist. Source query cap: 15,000 stock moves/year. Some gateway failures become zero; frontend cannot identify those. Prior-year total is a full-year reference, not a goal or like-for-like growth claim. |
| Weather | Local `/api/weather`, then gateway `/weather` | Open-Meteo forecast for High Wycombe, not a site sensor. Forecast lows/highs share a temperature scale. Current forecast time is displayed. |
| Projects | `_shared/project-stories.js`, generated from the Architape website project pages | Every case study page in the website repo's `xml_pages/site-pages/projects`, with its full story text, specifications, products and its own photographs (cross-faded every 14 seconds). The sales call to action and button labels are left out. The file is a snapshot: rebuild it with `build_project_stories.mjs` when the website pages change. Reading position is saved in `localStorage` because the rotation reloads the page every slot. |
| Company overview | `/odoo/execute` (read-only) through `tv-signage/data.js` | See *Company overview screen* below. |

Gateway base: `https://office-intranet.architainment-lighting-dns-website-account.workers.dev`.

The source limitations above were identified in the local `cloudflare_workers/workers/office-intranet.js`. The frontend cannot reconstruct records omitted by the gateway or audit its underlying Odoo data. Fixing pagination, weight provenance and swallowed upstream errors requires a separate gateway change and deployment. These dashboards therefore identify partial views and estimates instead of presenting them as complete measured totals.

## Calculation rules

- Counts deduplicate by record ID, falling back to order name. Cancelled records are excluded.
- Unknown statuses remain unknown; they are not assumed active, completed or overdue.
- Missing numbers differ from zero. A sum with a missing constituent remains unavailable.
- Odoo datetime strings are interpreted as UTC and displayed in Europe/London. Date-only due dates become overdue on the following London calendar day.
- Weekly charts include Monday–Sunday. Averages use **plotted records / seven calendar days**; monthly invoice averages use **plotted records / five months**.
- Graphs show the current status against scheduled dates. They do not invent historical completion trends.
- Shipping bars preserve genuine zeros and omit future current-year months. The current month is labelled partial.
- Source values inserted into markup are escaped; story HTML becomes plain text. Unsafe article/image URL schemes are rejected.

## Implementation and checks

- `_shared/dashboard-data.js`: pure data rules, usable in Node tests.
- `_shared/dashboard-studio.js`: display renderers and source handling.
- `_shared/dashboard-studio.css`: responsive TV layouts.
- `../tools/dashboard_runner/build_dashboard_pages.mjs`: generates the small HTML wrappers for the studio pages only (charging, shipping, projects, clock, lunch, home).
- `../tools/dashboard_runner/build_project_stories.mjs [projects folder]`: rebuilds `_shared/project-stories.js` from the website project pages and fails if a page's structure is no longer recognised.
- `../tools/dashboard_runner/check_company_overview.cjs`: company overview data rules (deduplication, open states, lateness, project names, subscription windows).
- `../tools/dashboard_runner/check_dashboard_data.cjs`: calculation regression checks.
- `../tools/dashboard_runner/check_dashboard_browser.cjs`: Chrome fixture checks at 1920×1080, 1366×768 and 390px. Verifies overflow, clipped content, script errors, lack of interactive controls and failure/recovery behaviour. Fixture screenshots are watermarked.
- The browser checker’s `--live` flag uses configured sources without substituting test data. `--only=name1,name2` narrows a review.
- `../tools/dashboard_runner/check_dashboard_sources.mjs`: read-only endpoint compatibility checks; records field names, response status and counts, not individual records.

Browser checks use Playwright installed in the temporary directory `intranet-dashboard-review` and the existing Chrome executable. Results and screenshots are saved under `../logs/dashboard-review/`; live captures are in its `live/` subfolder. No new runtime package, chart CDN or build step is required by the dashboards themselves. Google Fonts is optional; local sans-serif fallbacks remain usable without it.
# Goods-in unloading screen

`goods-in-24hrs.html` shows completed incoming `stock.picking` receipts whose
actual `date_done` is within the rolling last 24 hours. One delivery means one
distinct receipt ID, not a purchase order; multiple completed receipts against a
partly received purchase order each remain visible. Only `state = done` and
`picking_type_code = incoming` qualify. Internal/outgoing transfers, cancelled or
unfinished receipts, and invalid/future timestamps are excluded. Receipts without
a linked purchase order remain visible, using their source-document reference.

The existing Odoo `/odoo/execute` bridge supplies read-only `search_read` calls and
`purchase.order.read` for verified `purchase_id` links. Labels use receipt reference,
supplier, purchase-order reference and `x_project_reference` or `project_id` when
available. No quantities are inferred. UTC datetimes display in Europe/London.
Expected dates and record modification dates are never used as receipt times.

Keyset pagination reads 200 receipts per page, up to a clearly labelled partial
coverage limit of 2,000. The minute refresh preserves last-known data on failure,
marks it stale, and continues aging receipts out of the 24-hour window. No sample
data is substituted. Empty successful responses display zero; unavailable history
displays a dash. A labelled 30-second receipt replay unloads a lorry and prioritises
new receipts at the next cycle boundary. The supplier list scrolls automatically.
Reduced-motion mode uses a static illustration, no flashing beacon, and list paging.

# Dispatch loading screen

`goods-out-24hrs.html` replays fully delivered sales orders whose outgoing delivery
transfer completed within the rolling last 24 hours. It uses the existing read-only
calls through `/odoo/execute`: `stock.picking.search_read` and `sale.order.read`.
The sales completion statuses match the former outbound schedule page: `full`, `shipped`, and
`fully delivered`. Transfers must be `done`, `outgoing`, and linked to a sales order.
The timestamp is the latest returned `stock.picking.date_done` for that order, not
its scheduled date, `write_date`, or an inferred status-change time. The display
therefore describes completed deliveries for currently fully delivered orders;
it does not claim to be a status audit log. Partial deliveries, internal picks,
cancelled orders, and transfers without a linked sales order are excluded.

Odoo datetime strings are UTC; display times use Europe/London. Jobs are deduplicated
by sales-order ID. Keyset pagination reads up to 2,000 recent transfers in pages of
200 and explicitly labels that safety limit as partial coverage. Failed requests
retain last-known records marked stale; records still age out after 24 hours.
The screen refreshes every minute and prioritises newly observed orders at the next
24-second animation boundary. Animations are labelled replays, not live tracking.
The sidebar scrolls automatically; reduced-motion mode uses static illustrations
and advances the sidebar without smooth movement. No demo records are used on failure.

# Company overview screen

`company-overview.html` (`_shared/company-overview.js` and `.css`) shows the current London week, Monday to Sunday, as flows around an ARCHITAINMENT hub. One 1920×1080 stage is scaled to the display.

| Lane | Direction | Source (via `TVData`) | One card is |
| --- | --- | --- | --- |
| In · Suppliers | supplier → hub | `stock.picking` incoming: `done` with `date_done` this week, or open (`draft`, `waiting`, `confirmed`, `assigned`) with `scheduled_date` this week | one receipt; title is the supplier, then PO and project reference |
| Out · Customers & projects | hub → customer | `stock.picking` outgoing, same rules, grouped per sale order; project names read from `sale.order.project_id` / `client_order_ref` | one sale order; title is the project if known, else the customer |
| Make · Manufacturing | done: card → hub; scheduled: hub → card | `mrp.production` done with `date_finished` this week, or open with `date_start` this week | one production order; product name without internal code. No quantities |
| Service · Cloud subscriptions | hub → customer | active and paused `sale.order` subscriptions | contracts whose contract end (else next invoice date) falls this week, then the next six, labelled "Next" |

- Solid flowing arrows are completed this week; dashed arrows are scheduled or due. Lateness uses the scheduled date for receipts and dispatches, and the deadline for production orders.
- Lane headers and the KPI strip count records, not items or parcels. A `+` means the 4,000-record paging limit was reached and counts are lower bounds; the footer names the affected lanes.
- The hub ring splits this week's records by lane. It is a share of activity, not a target.
- Each lane shows six (side lanes) or three (top and bottom) cards and pages every 12 seconds. Data refreshes every 3 minutes.
- Each source fails independently. Last-known records for the current week are kept in memory and `localStorage` and the lane is marked stale; with no record the lane says the data is unavailable. Nothing is substituted.
