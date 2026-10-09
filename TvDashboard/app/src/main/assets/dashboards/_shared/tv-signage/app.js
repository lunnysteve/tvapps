(function () {
  'use strict';
  const D = window.DashboardData, T = window.TVData, E = D.esc, kind = document.body.dataset.screen;
  const names = { weather: ['High Wycombe / Weather', 'Outside. Right now.'], time: ['Time / Europe · London', 'Make every second count.'], goods_in: ['Warehouse / Goods in', 'Arrived. Unloaded. Received.'], warehouse: ['Warehouse / Dispatch', 'Ready. Set. Dispatch.'], subscriptions: ['Technical services / Subscriptions', 'Every connection counts.'] };
  const state = { payload: null, failed: false, busy: false, page: 0, received: 0 };
  names.manufacturing = ['Manufacturing / Production', 'From parts to progress.'];
  const root = document.getElementById('screen'), clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const dateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, weekday: 'short', day: 'numeric', month: 'short' });
  const fmt = (v, unit = '') => { const n = D.numeric(v); return n === null ? '—' : n.toLocaleString('en-GB', { maximumFractionDigits: 0 }) + unit; };
  const label = (v, opts = {}) => { const d = D.date(v); return d ? new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, day: 'numeric', month: 'short', ...opts }).format(d) : 'Date unavailable'; };
  const empty = (title, detail) => `<div class="empty"><strong>${E(title)}</strong><p>${E(detail)}</p></div>`;
  root.innerHTML = `<header><div class="brand"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M3 35 20 5l17 30H3Z M13 35l7-13 7 13" stroke="currentColor" stroke-width="3"/></svg>ARCHITAINMENT<span class="channel">${E(names[kind][0])}</span></div><div class="header-time"><span id="header-date"></span><time id="header-clock"></time></div></header><section class="heading"><div><p class="eyebrow">The bigger picture</p><h1>${E(names[kind][1])}</h1></div><div class="period" id="period"></div></section><main id="content"></main><footer><span id="source"></span><span class="status" id="status">Connecting to source…</span></footer>`;
  const content = document.getElementById('content');
  const scene = (caption, classes = '') => `<div class="scene ${classes}" id="scene"><div class="scene-error" id="scene-error">Preparing visualisation<small>Operational data is independent of the animation</small></div><span class="scene-caption">${E(caption)}</span></div>`;
  if (kind === 'goods_in' || kind === 'warehouse') {
    const incoming = kind === 'goods_in'; content.className = 'logistics';
    content.innerHTML = `<section class="panel process-strip"><div class="process-stat"><h2>${incoming ? 'Received this week' : 'Shipped this week'}</h2><div class="number" id="done-count">—</div><p>${incoming ? 'Completed receipt transfers' : 'Jobs with a completed dispatch'}</p></div>${scene(incoming ? 'Goods in · process illustration' : 'Dispatch · process illustration')}<div class="process-stat"><h2>${incoming ? 'Due in this week' : 'Due to ship this week'}</h2><div class="number" id="due-count">—</div><p>${incoming ? 'Open scheduled receipts' : 'Jobs with open scheduled transfers'}</p></div></section><div class="split"><section class="panel list-panel"><div class="panel-head"><h2>${incoming ? 'Received / This week' : 'Shipped / This week'}</h2><span class="page" id="done-page"></span></div><div class="records" id="done-list"></div></section><section class="panel list-panel"><div class="panel-head"><h2>${incoming ? 'Expected / This week' : 'Scheduled / This week'}</h2><span class="page" id="due-page"></span></div><div class="records" id="due-list"></div></section></div>`;
  } else if (kind === 'manufacturing') {
    content.className = 'logistics';
    content.innerHTML = `<section class="panel process-strip"><div class="process-stat"><h2>Completed this week</h2><div class="number" id="done-count">—</div><p>Production orders · actual completion</p></div>${scene('Manufacturing · process illustration')}<div class="process-stat"><h2>Scheduled this week</h2><div class="number" id="due-count">—</div><p id="production-progress">Open orders · scheduled starts</p></div></section><div class="split"><section class="panel list-panel"><div class="panel-head"><h2>Completed / This week</h2><span class="page" id="done-page"></span></div><div class="records" id="done-list"></div></section><section class="panel list-panel"><div class="panel-head"><h2>Production / This week</h2><span class="page" id="due-page"></span></div><div class="records" id="due-list"></div></section></div>`;
  } else if (kind === 'weather') {
    content.className = 'weather-main';
    content.innerHTML = `<section class="panel weather-current"><p class="location">HIGH WYCOMBE, BUCKINGHAMSHIRE</p><div><div class="number temperature"><span id="temp">—</span><small>°C</small></div><h2 class="condition" id="condition">Connecting to weather</h2><p class="feels" id="feels">Current modelled conditions</p></div><div class="weather-facts"><div><b id="humidity">—</b><span>Humidity</span></div><div><b id="wind">—</b><span id="wind-unit">Wind · km/h</span></div><div><b id="rain">—</b><span id="rain-label">Rain chance · today’s peak</span></div></div></section><section class="panel weather-scene">${scene('') }<div class="scene-top"><span>ATMOSPHERE / HIGH WYCOMBE</span><span id="weather-day">—</span></div><div class="sun-data"><span>Sunrise <b id="sunrise">—</b></span><span>Sunset <b id="sunset">—</b></span></div></section><div class="forecast" id="forecast"></div>`;
    document.getElementById('scene').style.height = '100%';
  } else if (kind === 'time') {
    content.className = 'clock-main';
    content.innerHTML = `<section class="panel clock-panel"><p class="clock-label">Local time / High Wycombe</p><div class="clock-digits"><span id="hours">00</span>:<span id="minutes">00</span><span class="seconds">:<span id="seconds">00</span></span></div><h2 class="clock-day" id="clock-day"></h2><p class="clock-date" id="clock-date"></p></section><section class="panel">${scene('Precision in motion · procedural chronometer')}</section><section class="panel clock-bottom"><div><small>Calendar week</small><strong id="week-number">—</strong></div><div><small>Sunrise · High Wycombe</small><strong id="sunrise">—</strong></div><div><small>Sunset · High Wycombe</small><strong id="sunset">—</strong></div><div><small>Today in Europe / London</small><strong id="day-progress">—</strong><div class="day-track"><i id="day-fill"></i></div></div></section>`;
    document.getElementById('scene').style.height = '100%';
  } else {
    content.className = 'subscriptions-main';
    content.innerHTML = `<section class="panel subscription-hero"><div class="subscription-total"><h2>Total active subscriptions</h2><div class="number" id="active-count">—</div><p id="active-scope">Customer service contracts · Odoo</p></div>${scene('Connected services · process illustration')}<div class="subscription-breakdown"><div><strong id="paused-count">—</strong><span>Paused</span></div><div><strong id="undated-count">—</strong><span>No renewal date</span></div><div><strong id="overdue-count">—</strong><span>Past dates</span></div></div></section><section class="panel renewals-panel"><div class="renewals-top"><div><h2>Renewal watch / Next 3 months</h2><p id="renewal-range">Contract ends & next invoice dates</p></div><div class="number" id="renewal-count">—</div></div><div class="renewal-rows" id="renewals"></div><div class="renewals-foot"><span>Next invoice dates are a renewal proxy.</span><span id="renewal-page"></span></div></section>`;
  }
  function set(id, text) { const el = document.getElementById(id); if (el && el.textContent !== String(text)) el.textContent = text; }
  function fit() { root.style.setProperty('--scale', Math.min(innerWidth / 1920, innerHeight / 1080)); }
  addEventListener('resize', fit); fit();
  function tick() {
    const now = new Date(), clock = clockFormat.format(now); set('header-clock', clock); set('header-date', dateFormat.format(now));
    if (kind === 'time') {
      const [h, m, s] = clock.split(':'); set('hours', h); set('minutes', m); set('seconds', s);
      set('clock-day', new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, weekday: 'long' }).format(now));
      set('clock-date', label(D.dayKey(now), { year: 'numeric' })); set('week-number', 'CW ' + String(T.isoWeek(now)).padStart(2, '0'));
      const percent = (Number(h) * 3600 + Number(m) * 60 + Number(s)) / 86400 * 100;
      set('day-progress', `${Math.floor(percent)}% of the day`); document.getElementById('day-fill').style.width = percent + '%';
      document.getElementById('period').innerHTML = '<b>Europe / London</b>Automatic GMT / BST';
    }
    status();
  }
  function status() {
    const el = document.getElementById('status');
    const stale = state.failed || state.payload?.stale || (state.received && Date.now() - state.received > (['time','weather'].includes(kind) ? 45 * 60000 : 3 * 60000));
    root.classList.toggle('is-stale', !!stale); el.classList.toggle('stale', !!stale);
    if (!state.received) { el.textContent = state.failed ? (kind === 'time' ? 'Clock running · sun times unavailable' : 'Data unavailable · retrying automatically') : 'Connecting to source…'; return; }
    const at = new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, hour: '2-digit', minute: '2-digit' }).format(new Date(state.received));
    const age = Math.max(0, Math.floor((Date.now() - state.received) / 60000));
    el.textContent = `${stale ? 'STALE · ' : ''}${kind === 'time' ? 'Sun times' : 'Updated'} ${at} · ${age < 1 ? 'just now' : age + ' min ago'}`;
  }
  function pageList(rows, id, pageId, completed) {
    const el = document.getElementById(id), count = 3, pages = Math.max(1, Math.ceil(rows.length / count)), page = state.page % pages;
    set(pageId, rows.length ? `${page + 1} / ${pages}${pages > 1 ? ' · Auto 15s' : ''}` : '');
    if (!rows.length) { el.style.display = 'block'; el.innerHTML = empty(state.payload ? 'No records this week' : state.failed ? 'Source unavailable' : 'Connecting to Odoo', state.payload ? 'No matching records returned for this period.' : 'The screen retries automatically.'); return; }
    el.style.display = '';
    el.innerHTML = rows.slice(page * count, (page + 1) * count).map(r => {
      const late = !completed && D.overdue(kind === 'manufacturing' ? r.deadline : r.date);
      const detail = kind === 'manufacturing' ? `${r.description} · ${completed ? 'Finished' : 'Starts'} ${label(r.date)}${!completed ? ' · Deadline: ' + (r.deadline ? label(r.deadline) : 'not supplied') : ''}${r.components && !completed ? ' · ' + r.components : ''}` : kind === 'goods_in' ? `${r.description} · ${r.packages === null ? 'Package count not supplied' : fmt(r.packages) + ' packages'}` : `${r.count} ${r.count === 1 ? 'transfer' : 'transfers'} · Carrier: ${r.carrier || 'not supplied'}`;
      return `<article class="record"><h3>${E(r.reference)}</h3><span class="tag ${completed ? '' : late ? 'amber' : 'cyan'}">${E(late ? r.status + ' · Late' : r.status)}</span><p class="partner">${E(r.partner)}</p><time>${E(label(r.date, { weekday: 'short' }))}</time><p class="detail">${E(detail)}</p></article>`;
    }).join('');
  }
  function renderLogistics() {
    const w = T.week(), p = state.payload;
    document.getElementById('period').innerHTML = `<b>THIS WEEK · CW ${T.isoWeek()}</b>${E(label(w.start))} – ${E(label(w.end))}`;
    const done = p ? T.logisticsRows(p, true) : [], due = p ? T.logisticsRows(p, false) : [];
    const currentPeriod = p && p.period === w.start;
    set('done-count', currentPeriod ? fmt(done.length) + (p.partial ? '+' : '') : '—'); set('due-count', currentPeriod ? fmt(due.length) + (p.partial ? '+' : '') : '—');
    pageList(done, 'done-list', 'done-page', true); pageList(due, 'due-list', 'due-page', false);
    set('source', p?.partial ? 'PARTIAL COVERAGE · 4,000-transfer safety limit reached · counts are lower bounds' : kind === 'goods_in' ? 'Odoo · Actual receipts & scheduled arrivals · One receipt = one transfer · London time' : 'Odoo · Dispatch completion dates · Part-shipped jobs can appear on both sides · London time');
  }
  function renderManufacturing() {
    const w = T.week(), p = state.payload, currentPeriod = p && p.period === w.start;
    document.getElementById('period').innerHTML = `<b>THIS WEEK · CW ${T.isoWeek()}</b>${E(label(w.start))} – ${E(label(w.end))}`;
    const done = p ? T.manufacturingRows(p, true) : [], due = p ? T.manufacturingRows(p, false) : [];
    set('done-count', currentPeriod ? fmt(done.length) + (p.partial ? '+' : '') : '—');
    set('due-count', currentPeriod ? fmt(due.length) + (p.partial ? '+' : '') : '—');
    set('production-progress', currentPeriod ? `${due.filter(r => r.state === 'progress').length} in progress · ${due.filter(r => r.state === 'to_close').length} to close · Scheduled starts` : 'Open orders · scheduled starts');
    pageList(done, 'done-list', 'done-page', true); pageList(due, 'due-list', 'due-page', false);
    set('source', p?.partial ? 'PARTIAL COVERAGE · 4,000-order safety limit reached · Counts are lower bounds' : 'Odoo · Production orders, not unit quantities · Actual completions & scheduled starts · Late = past deadline');
  }
  function sunTimes(p) {
    const i = p?.daily?.time.indexOf(D.dayKey()) ?? -1;
    const time = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(v) ? v.slice(11, 16) : '—';
    set('sunrise', time(p?.daily?.sunrise?.[i])); set('sunset', time(p?.daily?.sunset?.[i]));
  }
  // Layered weather icons: gradient sun, moon and clouds with gentle motion. Variants follow the WMO code.
  let iconId = 0;
  function weatherIcon(type, code, night = false) {
    const n = D.numeric(code), id = 'wx' + (++iconId);
    const defs = `<defs><radialGradient id="${id}s" cx="40%" cy="38%" r="70%"><stop offset="0" stop-color="#fff6cf"/><stop offset=".45" stop-color="#ffd75e"/><stop offset="1" stop-color="#f4a62a"/></radialGradient>
      <radialGradient id="${id}m" cx="38%" cy="35%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#dfe8ef"/><stop offset="1" stop-color="#a9bccb"/></radialGradient>
      <linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfdfe"/><stop offset="1" stop-color="#c2d1da"/></linearGradient>
      <linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8bac6"/><stop offset="1" stop-color="#6a7f8d"/></linearGradient>
      <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9be2ff"/><stop offset="1" stop-color="#3fa7e6"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset="1" stop-color="#ffb02e"/></linearGradient>
      <radialGradient id="${id}g"><stop offset=".45" stop-color="#ffd75e" stop-opacity=".28"/><stop offset="1" stop-color="#ffd75e" stop-opacity="0"/></radialGradient><radialGradient id="${id}h"><stop offset=".5" stop-color="#d8ebf7" stop-opacity=".18"/><stop offset="1" stop-color="#d8ebf7" stop-opacity="0"/></radialGradient>
      <filter id="${id}f" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.4" flood-color="#000" flood-opacity=".35"/></filter></defs>`;
    const rays = (cx, cy, r1, r2, w) => `<g class="wx-rays" style="transform-origin:${cx}px ${cy}px">${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a); return `<line x1="${(cx + c * r1).toFixed(1)}" y1="${(cy + s * r1).toFixed(1)}" x2="${(cx + c * r2).toFixed(1)}" y2="${(cy + s * r2).toFixed(1)}"/>`; }).join('')}</g>`;
    const sun = (cx, cy, r) => `<g class="wx-sun"><circle cx="${cx}" cy="${cy}" r="${r * 2.1}" fill="url(#${id}g)"/><g stroke="#ffc53d" stroke-width="${(r * .28).toFixed(1)}" stroke-linecap="round">${rays(cx, cy, r * 1.4, r * 1.85)}</g><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}s)"/></g>`;
    const moon = (cx, cy, r) => `<g class="wx-moon"><mask id="${id}k"><rect width="64" height="64" fill="#fff"/><circle cx="${cx + r * .62}" cy="${cy - r * .38}" r="${r * .86}" fill="#000"/></mask><circle cx="${cx}" cy="${cy}" r="${r * 2}" fill="url(#${id}h)"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}m)" mask="url(#${id}k)"/></g>`;
    const cloud = (dx, dy, k, fill) => `<path transform="translate(${dx} ${dy}) scale(${k})" filter="url(#${id}f)" fill="url(#${id}${fill})" d="M17.5 46h28a9.5 9.5 0 0 0 1.6-18.9A13.5 13.5 0 0 0 21.3 24 11 11 0 0 0 17.5 46Z"/>`;
    const sky = (cx, cy, r) => night ? moon(cx, cy, r) : sun(cx, cy, r);
    const heavy = [65, 67, 82].includes(n), drizzle = [51, 53, 55, 56, 57].includes(n), showers = [80, 81, 82].includes(n);
    let g;
    if (type === 'sun') g = n === 1 ? sky(28, 27, 12) + cloud(22, 22, .6, 'c') : sky(32, 32, 13);
    else if (type === 'cloud') g = n === 2 ? sky(23, 22, 9.5) + cloud(5, 6, .95, 'c') : cloud(-2, -6, .78, 'd') + cloud(4, 4, .95, 'c');
    else if (type === 'rain' || type === 'snow' || type === 'storm') {
      g = (showers ? sky(23, 18, 8) : '') + (type === 'storm' || heavy ? cloud(-3, -9, .72, 'd') : '') + cloud(2, -4, 1, type === 'storm' || heavy ? 'd' : 'c');
      if (type === 'rain') {
        const drops = drizzle ? [[22, 47], [32, 50], [42, 47]] : heavy ? [[19, 47], [28, 51], [37, 47], [46, 51]] : [[22, 47], [32, 51], [42, 47]];
        g += `<g class="wx-fall" fill="url(#${id}r)">${drops.map(([x, y], i) => drizzle ? `<circle cx="${x}" cy="${y + 2}" r="1.8" style="animation-delay:${i * .35}s"/>` : `<path d="M${x} ${y}c-1.8 2.6-2.8 4.3-2.8 5.6a2.8 2.8 0 0 0 5.6 0c0-1.3-1-3-2.8-5.6Z" style="animation-delay:${i * .3}s"/>`).join('')}</g>`;
      } else if (type === 'snow') {
        g += `<g class="wx-fall" stroke="#eef7fc" stroke-width="1.6" stroke-linecap="round">${[[22, 52], [32, 56], [42, 52]].map(([x, y], i) => `<g style="animation-delay:${i * .5}s"><path d="M${x} ${y - 3.5}v7M${x - 3} ${y - 1.75}l6 3.5M${x - 3} ${y + 1.75}l6-3.5"/></g>`).join('')}</g>`;
      } else g += `<path class="wx-bolt" d="M33 40 25.5 52h6l-3 10 11-14h-6.5l4-8Z" fill="url(#${id}b)" stroke="#fff3c4" stroke-width=".6" stroke-linejoin="round"/>`;
    } else if (type === 'fog') g = cloud(2, -8, .95, 'c') + `<g class="wx-fog" stroke="#b9c9d2" stroke-width="3.2" stroke-linecap="round"><path d="M12 44h40"/><path d="M17 51h34" opacity=".75"/><path d="M14 58h26" opacity=".5"/></g>`;
    else g = '<circle cx="32" cy="32" r="18" fill="none" stroke="#7d93a0" stroke-width="2.5" stroke-dasharray="4 5"/><path d="M25 32h14" stroke="#9badb7" stroke-width="3" stroke-linecap="round"/>';
    return `<svg class="wx-icon" viewBox="0 0 64 64" aria-hidden="true">${defs}${g}</svg>`;
  }
  function renderWeather() {
    const p = state.payload; sunTimes(p);
    if (kind === 'time') { set('source', 'Clock · Device time in Europe/London · Sunrise / sunset: Open-Meteo, High Wycombe'); return; }
    document.getElementById('period').innerHTML = '<b>HIGH WYCOMBE, UK</b>7-day outlook · °C';
    if (!p) { set('condition', state.failed ? 'Weather unavailable' : 'Connecting to weather'); set('source', 'Open-Meteo · High Wycombe · No estimated or demonstration readings'); return; }
    const current = p.current, daily = p.daily, [desc, type] = T.weatherInfo(current.weather_code), today = D.dayKey(), todayIndex = daily.time.indexOf(today);
    set('temp', fmt(current.temperature_2m)); set('condition', desc); set('feels', `Feels like ${fmt(current.apparent_temperature)}°C`);
    set('humidity', fmt(current.relative_humidity_2m, '%')); set('wind', fmt(current.wind_speed_10m));
    set('wind-unit', 'Wind · ' + (p.current_units?.wind_speed_10m || 'km/h'));
    set('rain', fmt(daily.precipitation_probability_max?.[todayIndex], '%')); set('weather-day', current.is_day === 0 ? 'NIGHT' : current.is_day === 1 ? 'DAYLIGHT' : '');
    const indexes = daily.time.map((d,i) => d >= today ? i : -1).filter(i => i >= 0).slice(0,7);
    document.getElementById('forecast').innerHTML = indexes.map(i => {
      const [condition, icon] = T.weatherInfo(daily.weather_code?.[i]);
      return `<article class="panel forecast-day"><h3>${daily.time[i] === today ? 'Today' : E(label(daily.time[i], { weekday: 'short', day: undefined, month: undefined }))}<span>${E(label(daily.time[i]))}</span></h3><div class="forecast-center">${weatherIcon(icon, daily.weather_code?.[i])}<div class="forecast-temp">${fmt(daily.temperature_2m_max?.[i])}°<small>${fmt(daily.temperature_2m_min?.[i])}° low</small></div></div><p>${E(condition)}</p><small>${fmt(daily.precipitation_probability_max?.[i], '%')} rain chance</small></article>`;
    }).join('');
    set('source', `${p.provider || 'Open-Meteo'} · Modelled conditions at ${String(current.time || 'time unavailable').replace('T',' ')} · ${indexes.length} forecast days available`);
    window.TVAtmosphere = { type, overcast: current.weather_code === 3, night: current.is_day === 0, wind: D.nonnegative(current.wind_speed_10m) ?? 0 };
    dispatchEvent(new Event('tv-atmosphere'));
  }
  function renderSubscriptions() {
    const p = state.payload;
    document.getElementById('period').innerHTML = `<b>NEXT THREE MONTHS</b>${E(label(D.dayKey()))} – ${E(label(T.addMonths(D.dayKey(), 3)))}`;
    if (!p) { document.getElementById('renewals').innerHTML = empty(state.failed ? 'Contracts unavailable' : 'Connecting to Odoo', 'Renewal dates and counts will appear when the source responds.'); set('source', 'Odoo · Customer service subscriptions · No invented costs or owners'); return; }
    const data = T.subscriptionRows(p), pages = Math.max(1, Math.ceil(data.upcoming.length / 4)), page = state.page % pages;
    set('active-count', fmt(data.active) + (p.partial ? '+' : '')); set('paused-count', fmt(data.paused)); set('undated-count', fmt(data.undated)); set('overdue-count', fmt(data.overdue)); set('renewal-count', fmt(data.upcoming.length));
    set('active-scope', p.partial ? 'Partial coverage · minimum confirmed active' : 'Customer service contracts · Odoo');
    set('renewal-range', `${label(data.today)} – ${label(data.end)} · Active & paused contracts`);
    set('renewal-page', `${page + 1} / ${pages}${pages > 1 ? ' · Auto 15s' : ''}`);
    document.getElementById('renewals').innerHTML = data.upcoming.length ? data.upcoming.slice(page*4, (page+1)*4).map(r => {
      const amount = D.nonnegative(r.recurring_total ?? r.amount_recurring), currency = D.name(r.currency_id);
      const cost = amount !== null && currency ? `${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency} / billing cycle` : 'Cost not supplied';
      const service = D.name(r.project_id) || D.name(r.plan_id) || D.name(r.name);
      return `<article class="renewal"><h3>${E(service)}</h3><time>${E(label(r.due))}</time><p>${E(D.name(r.partner_id) || 'Customer not supplied')} · ${E(D.name(r.name))}</p><span class="basis">${E(r.basis)}${r.paused ? ' · Paused' : ''}</span><div class="meta"><span>Owner: ${E(D.name(r.user_id) || 'not supplied')}</span><span>${E(cost)}</span></div></article>`;
    }).join('') : empty('No renewals in this window', 'No returned contract ends or invoice dates fall within the next three months.');
    set('source', p.partial ? 'PARTIAL COVERAGE · 4,000-contract safety limit reached · Counts describe returned contracts' : 'Odoo · Active and paused customer contracts · Contract end takes priority over next invoice');
  }
  function render() { if (kind === 'goods_in' || kind === 'warehouse') renderLogistics(); else if (kind === 'manufacturing') renderManufacturing(); else if (kind === 'subscriptions') renderSubscriptions(); else renderWeather(); status(); }
  const key = 'architainment-tv-v1-' + kind;
  try { const cached = JSON.parse(localStorage.getItem(key)); if (cached && Number.isFinite(cached.asOf) && cached.asOf <= Date.now() && (['weather','time'].includes(kind) ? T.validWeather(cached) : kind === 'subscriptions' ? Array.isArray(cached.rows) : Array.isArray(cached.done) && Array.isArray(cached.due))) { state.payload = cached; state.received = cached.asOf; state.failed = true; } } catch (_) { /* Storage can be disabled in signage browsers. */ }
  async function refresh() {
    if (state.busy) return; state.busy = true;
    try {
      const payload = kind === 'manufacturing' ? await T.manufacturing() : kind === 'subscriptions' ? await T.subscriptions() : ['weather','time'].includes(kind) ? await T.weather() : await T.logistics(kind);
      state.payload = payload; state.received = payload.asOf; state.failed = !!payload.stale; window.Signage?.report({ asOf: payload.observed || payload.asOf, stale: state.failed });
      try { localStorage.setItem(key, JSON.stringify(payload)); } catch (_) { /* Keep the in-memory last-known result. */ }
    } catch (error) { state.failed = true; console.warn('Dashboard source unavailable:', error.message); }
    finally { state.busy = false; render(); }
  }
  tick(); render(); refresh();
  setInterval(tick, 1000); setInterval(refresh, ['weather','time'].includes(kind) ? 10 * 60000 : 60000);
  setInterval(() => { state.page++; render(); }, 15000);
  addEventListener('online', refresh); document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); refresh(); } });
  // Classic local bundle also works when a page is opened directly from disk.
  try {
    if (!window.TVScenes) throw new Error('The 2D weather picture did not load');
    window.TVScenes.mount(document.getElementById('scene'), kind);
  } catch (error) {
    document.getElementById('scene-error').innerHTML = 'Visualisation unavailable<small>Live information remains on screen</small>';
    console.warn('Scene unavailable:', error.message);
  }
})();
