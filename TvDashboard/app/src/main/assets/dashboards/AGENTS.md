# Dashboard requirements

- These are unattended office TV displays. There is no keyboard or mouse. All records and pages must cycle automatically; do not require buttons, hover, scrolling or clicks to reveal operational information.
- Prioritise readability from across the room. Weekly planners use wide cards in horizontal day rows, with large order references and customer/product text. Do not compress the planner into seven narrow columns.
- Verify both 1920×1080 and 1366×768. Check content within panels as well as page overflow. Mobile layouts may scroll.
- Never substitute invented operational records, quantities, weather, vehicle readings or website statistics on an API failure. Preserve real last-known values with a visible stale message, or display unavailable.
- Preserve the distinction between missing values and genuine zero. State date ranges, partial source coverage and estimates accurately.
- Maintain the existing filenames used by display rotation (`rotation_config.json`). Shared implementation lives in `_shared/`: `dashboard-data.js`, `dashboard-studio.js` and `dashboard-studio.css` for the studio pages, `dispatch-loading.css` and the `*-history.js` / `subscription-contracts.js` modules for the 3D pages, and `tv-signage/` for the weather page.

User clarification, 25 September 2026: planner cards must be larger and easier to read; screens are purely visual and have no input devices.

## Current pages (renamed October 2026)

| File | Kind |
|---|---|
| `goods-in-24hrs.html`, `goods-out-24hrs.html`, `manufacturing-24hrs.html`, `subscriptions.html` | 3D scenes, see below |
| `charging-status.html`, `digital-clock.html`, `end-of-day.html`, `lunch-timer.html`, `shipping_weight-overview.html`, `website_projects.html` | Studio pages (`dashboard-studio.js`) |
| `after-hours.html` | Evenings and weekends: LED-strip clock (`_shared/after-hours.js`, `.css`). Quiet by design: keep it minimal, dim overnight and drifting to avoid burn-in |
| `weather-forecast.html` | `_shared/tv-signage/` |
| `company-overview.html` | Weekly ins and outs around the ARCHITAINMENT hub (`_shared/company-overview.js`, `.css`). In the Business Hours rotation on every screen, 60 s, after the projects page |

Studio page requests (October 2026): the clock, lunch and hometime pages give the whole screen to the time. `website_projects.html` shows the Architape website case studies from `_shared/project-stories.js` (built by `tools/dashboard_runner/build_project_stories.mjs`), with all the text, and must not move to the next project until the whole text has been shown. The weather forecast uses layered gradient SVG icons and a soft-sprite 3D sky (sun with corona, shaded moon, puff clouds).

The weekly planner/board pages, the older SVG warehouse screens and the `tv-screens/` set were removed. Rules below that mention them (weekly planners, SVG scenes) apply only if such a screen is reintroduced.

## Animated warehouse screens

- Cloud subscriptions: keep roof equipment above roof surfaces, remove the building's
  green triangle, auto-size customer captions without clipping, and use real weather.
- Current user requirements (6 October 2026): red forklifts with rounded rear bodywork,
  a rotating amber beacon (static for reduced motion), supplier names on goods-in
  pallets and source project references on goods-out pallets. Stop clear of the truck
  before raising the forks; keep the forks and pallet clear of the truck until they
  reach deck height, and reverse fully clear before lowering. Warehouse scenery uses
  the weather screen's real High Wycombe weather feed, with visible stale/unavailable
  status. These current requirements supersede the older orange forklift guidance.

- `goods-out-24hrs.html` replays fully delivered sales orders with outgoing deliveries completed in the last 24 hours. `goods-in-24hrs.html` replays completed incoming receipts in the same rolling window. Keep both screens and their data scopes distinct.
- Goods in counts distinct completed receipt IDs, including receipts against partly received purchase orders. Goods out counts distinct qualifying sales orders. Use actual `stock.picking.date_done` timestamps; never infer completion from planned dates, `write_date`, or first observation. See `DASHBOARD_DATA.md` for the full contracts.
- Keep artwork and motion in local SVG/CSS/JavaScript, shared implementations in `_shared/`, and warehouse queries read-only through the existing Odoo bridge. Do not insert demo deliveries on source failure.
- Preserve the requested scene: plain wall without a sign or shutter rectangle; forklift, vehicle and pallet in the centre of the road; no text branding on the forklift or decorative green line on the vehicle; flashing amber roof beacon, disabled for reduced motion.
- Goods out loads a van. Goods in unloads a lorry and sets its pallet down in the marked receiving area. Keep pallet/fork alignment and ground/vehicle-bed heights consistent throughout the animation.
- Label animations as replays, automatically scroll the history list, and prioritise newly observed completions at a cycle boundary. No manual interaction is required. Do not change display rotation unless requested.
- Verification scripts are `tools/dashboard_runner/check_dispatch_loading.cjs` and `tools/dashboard_runner/check_goods_in.cjs`; the latter supports `--live` for read-only local-file browser verification.

## 3D screens (October 2026)

User-approved 3D versions built with three.js 0.170 (loaded from jsDelivr). They share one layout (`_shared/dispatch-loading.css`) and pattern: scene left, caption and three-step journey below, auto-scrolling list right. In these files the requests below override the older SVG-scene rules above (shutter, branding, etc.).

| File | Data module (`_shared/`) | Scene |
|---|---|---|
| `goods-in-24hrs.html` | `receipt-history.js` | Lorry parks; forklift stops short of the tail and only the forks reach the bed; pallet set down at GOODS IN, shutter rolls up, rollers carry it inside. |
| `goods-out-24hrs.html` | `dispatch-history.js` | Reverse of goods in: shutter opens, rollers bring the job out to DISPATCH, forklift loads the lorry, lorry drives off. |
| `manufacturing-24hrs.html` | `manufacturing-history.js` (`mrp.production` done, `date_finished`, last 24 h) | Production line: saw cuts aluminium LED profile, LED tape applied, power-on light test (PASS lamp), gantry boxes it, carton sealed. |
| `subscriptions.html` | `subscription-contracts.js` (active/paused `sale.order` subscriptions) | Night street: HQ rack sends a pulse via a cloud to the customer's building, which lights up; dial counts down days to expiry. Expired contracts: access refused, lights fail. |

- Every 3D scene has a wall screen on the back wall, left side, showing the current record's details (no floating HTML tag). The box/carton label stays as well.
- Keep the gentle camera push-in at key moments (pick-up/set-down, saw/test/sealed box, the lit building). Disabled for reduced motion.
- Look: orange forklift; round rims on all wheels (no square/cross spokes); detailed lorry (grille, lamps, mirrors, steps, tank, guards); workers in hi-vis, hard hat, arms and legs, heads turning to the work.
- Subscriptions: expiry is `end_date`, else `next_invoice_date` (labelled "Renews"). Sort soonest first. Amber within 60 days, red when expired. Strip a leading "SO12345 - " from project names. Refresh every 15 minutes.
- Manufacturing: omit quantities (the gateway can substitute defaults).
- `?demo` (manufacturing and subscriptions only) adds clearly labelled DEMO records on top of live data for previewing. It never writes to Odoo and is not used on the displays; without it, only real records are shown.
- Browser checks: tabs in the background throttle `requestAnimationFrame`. When testing, set `document.hidden` to false and wait in page JavaScript between screenshots.
