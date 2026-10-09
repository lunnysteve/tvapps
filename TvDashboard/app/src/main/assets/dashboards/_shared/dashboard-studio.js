(function () {
    'use strict';
    const D = window.DashboardData, R = window.Signage;
    const E = D.esc;
    const API = 'https://office-intranet.architainment-lighting-dns-website-account.workers.dev';
    const config = {
        manufacturing: { title: 'Made to move.', section: 'Manufacturing', accent: '#c1f279', rgb: '193,242,121', endpoint: '/manufacturing', key: 'orders', noun: 'production orders', schedule: 'Scheduled starts', due: 'Deadline', done: 'Completed', scope: 'Production orders returned for the selected week, grouped by scheduled start in Europe/London. The source currently limits each response to 250 records. Counts are not company-wide totals. Completed means state done; to-close orders remain separate. Overdue means an unfinished returned order past its deadline. Unit totals are omitted because the gateway substitutes default quantities. Missing dates and unknown states are not treated as completed work.' },
        inbound: { title: 'Incoming. In focus.', section: 'Warehouse / Inbound', accent: '#94d8f2', rgb: '148,216,242', endpoint: '/purchases', key: 'shipments', noun: 'purchase orders', schedule: 'Expected arrivals', due: 'Expected', done: 'Fully received', scope: 'Returned purchase orders grouped by expected arrival in Europe/London, plus returned open orders without dates. One purchase order is one record, not one parcel or item. The gateway reads at most 150 purchase orders before applying its date filter, so this is a partial view, not the full warehouse backlog. Overdue counts apply only to returned records. Full receipt is the only completed status.' },
        outbound: { title: 'Ready. Set. Dispatch.', section: 'Warehouse / Outbound', accent: '#f5be8c', rgb: '245,190,140', endpoint: '/sales?type=dispatches', key: 'shipments', noun: 'sales orders', schedule: 'Committed dispatches', due: 'Committed', done: 'Fully delivered', scope: 'Returned sales orders grouped by commitment date in Europe/London, plus returned open orders without dates. These are sales-order counts, not parcel or item counts. The gateway reads at most 150 sales orders before filtering, so counts describe returned records only. The headline overdue count uses this same scope. No dispatch date or completion history is inferred from commitment dates.' },
        subscriptions: { title: 'Every connection counts.', section: 'Subscriptions', accent: '#c7b7fa', rgb: '199,183,250', endpoint: '/subscriptions', key: 'shipments', noun: 'contracts', schedule: 'Next invoice schedule', due: 'Next invoice', done: 'Active', scope: 'Returned contracts grouped by next invoice date across five calendar months, plus returned contracts without dates. An invoice date is not necessarily a contract renewal. The gateway reads at most 200 contracts before filtering, so these are not company-wide totals. Closed contracts are shown separately. Monetary totals are omitted because the response does not provide currency. Date-only invoices become past due on the following London calendar day.' },
        charging: { title: 'A little more energy.', section: 'EV charging', accent: '#bdf478', rgb: '189,244,120' },
        race: { title: 'The road ahead.', section: 'EV / Charge progress', accent: '#c8b6fc', rgb: '200,182,252' },
        shipping: { title: 'The weight of our work.', section: 'Shipping / Year in view', accent: '#94d8f2', rgb: '148,216,242' },
        weather: { title: 'Outside, right now.', section: 'High Wycombe / Weather', accent: '#f3d490', rgb: '243,212,144' },
        projects: { title: 'Light makes the difference.', section: 'Projects / Case studies', accent: '#c1f279', rgb: '193,242,121' },
        clock: { title: 'A moment in time.', section: 'Office clock', accent: '#c1f279', rgb: '193,242,121' },
        lunch: { title: 'Room to recharge.', section: 'Lunch break', accent: '#f3d490', rgb: '243,212,144' },
        home: { title: 'Good work. Good evening.', section: 'Hometime', accent: '#c7b7fa', rgb: '199,183,250' }
    };
    const kind = document.body.dataset.dashboard;
    let demoCharging = kind === 'charging' && document.body.dataset.demo === 'true' && new URLSearchParams(location.search).get('demo') !== 'false';
    function demoChargepoints() {
        return { siteTitle: 'DEMO · Six office charging bays', loadpoints: [
            { title: 'Bay 1', connected: true, charging: true, mode: 'now', chargePower: 7200, sessionEnergy: 8400, vehicleSoc: 46, vehicleTitle: 'Demo · Tesla Model 3' },
            { title: 'Bay 2', connected: true, charging: true, mode: 'pv', chargePower: 3600, sessionEnergy: 2100, vehicleSoc: 71, vehicleTitle: 'Demo · Kia EV6' },
            { title: 'Bay 3', connected: false, charging: false, mode: 'pv', chargePower: 0, sessionEnergy: 0 },
            { title: 'Bay 4', connected: true, charging: true, mode: 'now', chargePower: 11000, sessionEnergy: 12600, vehicleSoc: 22, vehicleTitle: 'Demo · Polestar 2' },
            { title: 'Bay 5', connected: true, charging: false, mode: 'off', chargePower: 0, sessionEnergy: 15300, vehicleSoc: 100, vehicleTitle: 'Demo · VW ID.4' },
            { title: 'Bay 6', connected: false, charging: false, mode: 'pv', chargePower: 0, sessionEnergy: 0 }
        ] };
    }
    const mode = document.body.dataset.view || 'overview';
    const c = config[kind];
    if (!c) return;
    const root = document.getElementById('dashboard');
    if (mode === 'board') c.title = { manufacturing: 'Production planner.', inbound: 'Arrivals planner.', outbound: 'Dispatch planner.', subscriptions: 'Invoice planner.' }[kind];
    const state = { payload: null, rows: [], offset: 0, page: 0, refreshed: null, failed: false, busy: false, generation: 0, auto: true };
    const colors = { done: '#87dab4', working: '#f5c779', queued: '#82c9ef', ready: '#b6a2ee', blocked: '#ff9394', closing: '#c1f279', unknown: '#9badb7', active: '#87dab4', draft: '#82c9ef', paused: '#f5c779', renewed: '#b6a2ee', closed: '#9badb7' };
    const labels = { done: c.done || 'Completed', working: kind === 'inbound' ? 'Part received' : kind === 'outbound' ? 'Picking / partial' : 'In progress', queued: kind === 'inbound' ? 'Expected' : kind === 'outbound' ? 'Waiting' : 'Queued', ready: 'Ready', blocked: 'Components late', closing: 'To close', unknown: 'Unknown status', active: 'Active', draft: 'Draft / renewal quote', paused: 'Paused / payment issue', renewed: 'Renewed', closed: 'Closed' };
    const paths = {
        arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
        box: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9M7 5.8l10 5.5"/>',
        bolt: '<path d="m14 2-9 12h7l-2 8 9-12h-7l2-8Z"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        flag: '<path d="M5 21V4c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
        link: '<path d="m10 14 4-4m-5 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
        cup: '<path d="M4 8h13v7a6 6 0 0 1-12 0V8Zm13 1h2a3 3 0 0 1 0 6h-2M4 22h14M7 2v2m5-2v2"/>',
        home: '<path d="m2 11 10-9 10 9M5 9v12h14V9M10 21v-8h4v8"/>',
        offline: '<path d="m3 3 18 18M8 8a9 9 0 0 1 12 3M4 11a11 11 0 0 1 1-1m3 5a6 6 0 0 1 7-1m-3 6h.01"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>'
    };
    function icon(key, cls = '') { return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key] || paths.box}</svg>`; }
    function fmt(value, digits = 0) { const n = D.numeric(value); return n === null ? '—' : n.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits }); }
    function dateLabel(value, opts = {}) { const d = D.date(value); return d ? new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, day: 'numeric', month: 'short', ...opts }).format(d) : 'No date'; }
    function timeLabel(value) { const d = value instanceof Date ? value : D.date(value); return d ? new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d) : '—'; }
    function metric(label, value, note, style = '', symbol = 'arrow', unit = '') { return `<section class="metric ${style}"><div class="metric-label">${E(label)}${icon(symbol)}</div><div class="metric-value">${E(value)}${unit ? `<span class="unit">${E(unit)}</span>` : ''}</div><p class="metric-note">${E(note)}</p></section>`; }
    function empty(title, message, symbol = 'box') { return `<div class="empty">${icon(symbol)}<strong>${E(title)}</strong><p>${E(message)}</p></div>`; }
    function panelHead(title, sub, index) { return `<div class="panel-head"><div><h2>${E(title)}</h2><p>${E(sub)}</p></div><span class="panel-index">${index}</span></div>`; }
    const operational = !!c.endpoint;
    const localClock = ['clock', 'lunch', 'home'].includes(kind);
    document.documentElement.style.setProperty('--accent', c.accent);
    document.documentElement.style.setProperty('--accent-rgb', c.rgb);
    root.innerHTML = `<div class="studio"><header class="masthead"><div class="brand"><svg class="brand-mark" viewBox="0 0 30 30" fill="none" aria-hidden="true"><path d="M2 26 15 3l13 23H2Z" stroke="currentColor" stroke-width="2"/><path d="m9 26 6-11 6 11" stroke="currentColor" stroke-width="2"/></svg>Architainment<span class="brand-divider"></span><span class="channel">${E(c.section)}</span></div><div class="clock-block"><span id="header-date"></span><time id="header-time"></time></div></header><section class="heading"><div><p class="eyebrow">${operational ? (mode === 'board' ? 'The working week' : 'The bigger picture') : E(c.section)}</p><h1>${E(c.title)}</h1><p class="subtitle" id="subtitle"></p></div><nav class="heading-tools" aria-label="Dashboard controls" id="controls"></nav></section><div class="data-banner" id="data-banner" role="status" hidden></div><main id="content"><div class="skeleton">${empty('Connecting to the source', 'Your dashboard will appear when the data arrives.', 'link')}</div></main><footer class="foot"><span id="source-line"></span><span class="status loading" id="live-status">${localClock ? 'London time' : 'Connecting'}</span></footer><dialog class="scope-dialog" id="scope-dialog"><h2>About these figures</h2><p id="scope-copy"></p><form method="dialog"><button>Close</button></form></dialog></div>`;
    const content = document.getElementById('content');
    document.getElementById('scope-dialog').remove();
    document.querySelector('.studio').classList.toggle('planner-studio', mode === 'board');
    const subtitle = document.getElementById('subtitle');
    const controls = document.getElementById('controls');
    function scope(text, label) {
        c.dataScope = text;
        document.getElementById('source-line').textContent = label;
        // Source caveats are documented in DASHBOARD_DATA.md. TV screens have no input devices.
    }
    function updateStatus() {
        const el = document.getElementById('live-status');
        if (demoCharging) { el.className = 'status stale'; el.textContent = 'DEMO DATA · Not live'; return; }
        if (localClock) { el.className = 'status ok'; el.textContent = 'Europe / London'; return; }
        if (kind === 'projects') { el.className = 'status ok'; el.textContent = state.payload ? `Case study ${reader.index + 1} of ${state.payload.projects.length}` : 'Case studies unavailable'; return; }
        if (!state.refreshed) { el.className = `status ${state.failed ? 'error' : 'loading'}`; el.textContent = state.failed ? 'Data unavailable' : 'Connecting'; return; }
        const age = Math.max(0, Math.floor((Date.now() - state.refreshed.getTime()) / 1000));
        const ageLabel = age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`;
        el.className = `status ${state.failed ? 'stale' : 'ok'}`;
        el.textContent = `${state.failed ? 'Last received' : 'Received'} ${ageLabel} · ${timeLabel(state.refreshed)}`;
    }
    function showFailure() {
        state.failed = true; R.report({ stale: true, asOf: state.refreshed?.getTime() });
        const banner = document.getElementById('data-banner');
        banner.hidden = false;
        banner.innerHTML = `<span>${state.payload ? `Connection interrupted. Showing data received at ${E(timeLabel(state.refreshed))}; figures may have changed.` : 'The source is unavailable. No figures are being estimated.'}</span><span>Retrying automatically</span>`;
        if (!state.payload) content.innerHTML = `<div class="screen-error">${empty('Waiting for a connection.', 'This screen will recover automatically when its data source is available.', 'offline')}</div>`;
        updateStatus();
    }
    async function request(url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!data || typeof data !== 'object' || data.error || data.is_mock || data.mock || data.demo || data.is_demo) throw new Error('Source did not return live data');
            return data;
        } finally { clearTimeout(timeout); }
    }
    function keys() { return kind === 'subscriptions' ? D.months(state.offset) : D.days(state.offset); }
    function rangeLabel() { const k = keys(); return kind === 'subscriptions' ? `${dateLabel(k[0] + '-01', { day: undefined })} – ${dateLabel(k[4] + '-01', { day: undefined, year: 'numeric' })}` : `${dateLabel(k[0])} – ${dateLabel(k[6], { year: 'numeric' })}`; }
    function operationControls() {
        controls.innerHTML = `<span class="period">${E(rangeLabel())}</span>`;
        subtitle.textContent = `${rangeLabel()} · ${kind === 'subscriptions' ? 'Next invoice dates' : 'Scheduled dates'} · Returned ${c.noun} only`;
    }
    function changePeriod(delta) {
        state.offset += delta; state.page = 0; state.payload = null; state.refreshed = null; state.failed = false;
        state.generation++; state.busy = false;
        content.innerHTML = `<div class="skeleton">${empty('Loading this period', rangeLabel(), 'clock')}</div>`;
        operationControls(); refresh();
    }
    function badge(row) { const label = row.late ? 'Past due' : labels[row.state]; return `<span class="badge" style="--state:${row.late ? 'var(--bad)' : colors[row.state]}">${E(label)}</span>`; }
    function legend(rows) { const present = [...new Set(rows.map(r => r.state))]; return `<div class="legend">${present.map(s => `<span><i class="dot" style="background:${colors[s]}"></i>${E(labels[s])} <b>${rows.filter(r => r.state === s).length}</b></span>`).join('')}</div>`; }
    function renderMetrics(rows, m) {
        const complete = rows.filter(r => r.state === (kind === 'subscriptions' ? 'active' : 'done')).length;
        const active = rows.filter(r => kind === 'subscriptions' ? r.state === 'paused' : !r.terminal && r.state !== 'unknown').length;
        return `<div class="metrics">${metric('In this view', fmt(rows.length), `Returned ${c.noun}`, 'hero', 'box')}${metric(c.done, fmt(complete), kind === 'subscriptions' ? 'Active contracts in this view' : 'Current status of returned orders', '', 'check')}${metric(kind === 'subscriptions' ? 'Paused / payment issue' : 'Open orders', fmt(active), kind === 'subscriptions' ? 'Returned contracts needing review' : 'Known unfinished statuses', 'accent', 'clock')}${metric('Past due in this view', fmt(m.late), kind === 'manufacturing' ? 'Unfinished, past their deadline' : kind === 'subscriptions' ? 'Open, past next invoice date' : 'Open, past their scheduled date', m.late ? 'danger' : '', 'flag')}</div>`;
    }
    function chart(rows, m, k) {
        const max = Math.max(1, ...m.counts);
        const order = Object.keys(colors);
        return `<div class="plot" role="img" aria-label="${E(c.schedule)}: ${E(m.counts.map((n, i) => `${k[i]}: ${n}`).join(', '))}"><div class="plot-scale"><span>${E(c.noun)} · zero baseline</span><span>Scale: 0–${max}</span></div><div class="columns" style="--columns:${k.length}">${m.buckets.map((bucket, i) => `<div class="column"><span class="column-total">${bucket.length}</span><div class="stack" style="height:${bucket.length / max * 77}%" title="${E(k[i])}: ${bucket.length}">${order.filter(s => bucket.some(r => r.state === s)).map(s => { const count = bucket.filter(r => r.state === s).length; return `<div class="segment" style="height:${count / bucket.length * 100}%;background:${colors[s]}" title="${E(labels[s])}: ${count}"></div>`; }).join('')}</div></div>`).join('')}</div><div class="column-labels" style="--columns:${k.length}">${k.map(key => `<span class="${key === D.dayKey() ? 'today' : ''}">${kind === 'subscriptions' ? dateLabel(key + '-01', { day: undefined, month: 'short' }) : dateLabel(key, { day: undefined, month: undefined, weekday: 'short' })}</span>`).join('')}</div></div>${legend(rows)}<div class="chart-summary"><span><b>${fmt(m.average, 1)}</b> per ${kind === 'subscriptions' ? 'month' : 'calendar day'}</span><span><b>${fmt(m.undated)}</b> open without a date</span><span><b>${fmt(m.dated)}</b> plotted</span></div>`;
    }
    function focus(rows) {
        const items = rows.filter(r => r.open).sort((a, b) => Number(b.late) - Number(a.late) || (D.date(a.due)?.getTime() ?? Infinity) - (D.date(b.due)?.getTime() ?? Infinity));
        const perPage = 4;
        const pages = Math.max(1, Math.ceil(items.length / perPage));
        const page = state.page % pages;
        return `${panelHead('Next in focus', kind === 'manufacturing' ? 'Open orders · overdue deadlines first' : 'Open records · past due first', '02')}<div class="focus-list">${items.length ? items.slice(page * perPage, (page + 1) * perPage).map((r, i) => `<div class="focus-row"><span class="row-number">${String(page * perPage + i + 1).padStart(2, '0')}</span><div><div class="row-title" title="${E(r.title)}">${E(r.title)}</div><div class="row-detail" title="${E(r.detail)}">${E(r.detail)}</div></div><div class="row-end">${badge(r)}<small>${E(dateLabel(r.due))}</small></div></div>`).join('') : empty('Nothing open in this view', 'All returned records have a finished status.', 'check')}</div><div class="list-footer"><span>${items.length} open · Page ${page + 1} of ${pages}</span><span>${pages > 1 ? 'Automatically rotating' : 'All open records shown'}</span></div>`;
    }
    function board(rows, m, k) {
        const perPage = innerWidth >= 1600 ? 3 : 2;
        const groups = [{ title: kind === 'subscriptions' ? 'Invoice schedule' : 'Monday – Friday', buckets: m.buckets.slice(0, 5), dates: k.slice(0, 5) }];
        if (kind !== 'subscriptions' && m.buckets.slice(5).some(b => b.length)) groups.push({ title: 'Weekend schedule', buckets: m.buckets.slice(5), dates: k.slice(5) });
        const undated = rows.filter(r => !r.key && r.open);
        if (undated.length) groups.push({ title: 'Open records without a date', buckets: [undated], dates: [null] });
        const unclassified = rows.filter(r => !r.key && r.state === 'unknown');
        if (unclassified.length) groups.push({ title: 'Unknown status / no date', buckets: [unclassified], dates: [null] });
        const slides = groups.flatMap(group => Array.from({ length: Math.max(1, ...group.buckets.map(b => Math.ceil(b.length / perPage))) }, (_, page) => ({ ...group, page })));
        const slideIndex = state.page % slides.length;
        const current = slides[slideIndex];
        const renderJob = r => `<article class="planner-card" style="--state:${r.late ? 'var(--bad)' : colors[r.state]}"><div class="planner-card-top"><strong>${E(r.title)}</strong>${badge(r)}</div><p class="planner-card-detail">${E(r.detail)}</p><div class="planner-card-ref">${E(r.reference || (kind === 'manufacturing' ? 'Deadline: ' + dateLabel(r.due) : c.due + ': ' + dateLabel(r.scheduled)))}</div></article>`;
        return `<div class="planner-summary"><span><b>${rows.length}</b> ${E(c.noun)} in view</span><span class="${m.late ? 'late' : ''}"><b>${m.late}</b> past due</span><span><b>${m.undated}</b> without a date</span><span class="planner-page">${E(current.title)} · ${slideIndex + 1} / ${slides.length}</span></div><div class="planner-rows" style="--planner-rows:${current.buckets.length}">${current.buckets.map((bucket, i) => {
            const ordered = bucket.slice().sort((a, b) => Number(a.terminal) - Number(b.terminal) || Number(b.late) - Number(a.late) || a.title.localeCompare(b.title));
            const pageCount = Math.max(1, Math.ceil(ordered.length / perPage)); const page = current.page % pageCount;
            const key = current.dates[i]; const dateStr = key?.length === 7 ? key + '-01' : key;
            return `<section class="planner-row ${key === D.dayKey() ? 'is-today' : ''}"><header class="planner-day"><h2>${key ? E(dateLabel(dateStr, { day: undefined, month: kind === 'subscriptions' ? 'short' : undefined, weekday: kind === 'subscriptions' ? undefined : 'short' })) : 'No date'}</h2><p>${key ? E(dateLabel(dateStr, kind === 'subscriptions' ? { year: 'numeric', day: undefined } : {})) : 'To schedule'}</p><small>${ordered.length} ${kind === 'subscriptions' ? 'contracts' : 'orders'}${pageCount > 1 ? ` · ${page + 1}/${pageCount}` : ''}</small></header><div class="planner-cards" style="--cards:${perPage}">${ordered.length ? ordered.slice(page * perPage, (page + 1) * perPage).map(renderJob).join('') : '<div class="planner-empty">No records returned for this date</div>'}</div></section>`;
        }).join('')}</div><div class="board-summary">${legend(rows)}<span>${slides.length > 1 ? 'Cards rotate automatically every 15 seconds' : 'All returned records shown'}</span></div>`;
    }
    function renderOperations() {
        operationControls();
        const rows = D.records(state.payload[c.key], kind);
        const k = keys(); const m = D.metrics(rows, k, kind === 'subscriptions'); state.rows = rows;
        content.innerHTML = mode === 'board' ? board(rows, m, k) : renderMetrics(rows, m) + `<div class="overview-grid"><section class="panel workload-panel">${panelHead(c.schedule, kind === 'subscriptions' ? 'Next invoice dates · current contract status' : 'Scheduled date · current order status', '01')}${chart(rows, m, k)}</section><section class="panel focus-panel">${focus(rows)}</section></div>`;
        content.querySelectorAll('[data-action="cycle"]').forEach(b => b.onclick = cycle);
        if (mode === 'board') {
            requestAnimationFrame(() => content.querySelectorAll('.planner-card-detail,.planner-card-ref').forEach(el => {
                const text = el.textContent; el.textContent = '';
                const span = document.createElement('span'); span.className = 'read-line'; span.textContent = text; el.appendChild(span);
                const overflow = span.scrollWidth - el.clientWidth;
                if (overflow > 2) { span.classList.add('scrolling'); span.style.setProperty('--travel', `${-overflow}px`); }
            }));
        }
    }
    function cycle() { if (!state.payload) return; state.page++; R.saveCursor({ page: state.page }, kind); render(); }

    // Domain-specific renderers are defined below. All use the same honest refresh state.
    function render() {
        if (operational) renderOperations();
        else if (kind === 'charging' || kind === 'race') renderEnergy();
        else if (kind === 'shipping') renderShipping();
        else if (kind === 'weather') renderWeather();
        else if (kind === 'projects') renderProjects();
        else renderTime();
    }
    async function refresh() {
        if (localClock) return;
        if (state.busy) return;
        state.busy = true; const generation = state.generation;
        try {
            let payload;
            if (operational) {
                const url = new URL(API + c.endpoint); url.searchParams.set('offset', state.offset);
                payload = await request(url.toString());
                if (!Array.isArray(payload[c.key]) || payload[c.key].some(x => !x || typeof x !== 'object' || Array.isArray(x))) throw new Error('Invalid records');
            } else if (kind === 'charging' || kind === 'race') {
                payload = await request('http://192.168.0.194:7070/api/state');
                payload = payload.result || payload;
                if (payload.error || payload.is_mock || payload.mock || payload.demo || payload.is_demo || !Array.isArray(payload.loadpoints) || payload.loadpoints.some(x => !x || typeof x !== 'object' || Array.isArray(x))) throw new Error('Invalid chargepoints');
            } else if (kind === 'weather') {
                try { payload = await request('/api/weather'); } catch (_) { payload = await request(API + '/weather'); }
                if (!payload.current || !payload.daily || !Array.isArray(payload.daily.time)) throw new Error('Invalid forecast');
            } else if (kind === 'shipping') {
                payload = await request(API + '/sales?type=shipping_review');
                if (D.nonnegative(payload.ytdThisYear) === null || !Array.isArray(payload.monthlyThisYear)) throw new Error('Invalid shipping review');
            }
            if (generation !== state.generation) return;
            if (demoCharging) { demoCharging = false; state.page = 0; configureSpecial(); }
            state.payload = payload; state.refreshed = new Date(payload.asOf || Date.now()); state.failed = !!payload.stale;
            R.write('studio-' + kind, payload, state.refreshed.getTime());
            R.report({ asOf: state.refreshed.getTime(), stale: state.failed, records: payload.loadpoints?.length });
            document.getElementById('data-banner').hidden = !demoCharging;
            render(); updateStatus();
        } catch (error) { if (generation === state.generation) { console.warn('Dashboard source unavailable:', error.message); if (demoCharging) { updateStatus(); } else { showFailure(); } } }
        finally { if (generation === state.generation) state.busy = false; }
    }

    function configureSpecial() {
        if (kind === 'charging' || kind === 'race') {
            subtitle.textContent = kind === 'race' ? 'Reported battery level · each vehicle, at a glance' : 'Live chargepoints · power, connection and session energy';
            controls.innerHTML = '<span class="period">Live office chargepoints</span>';
            scope('Direct readings from the office EVCC server. Charge power is converted from watts to kilowatts; session energy from watt-hours to kilowatt-hours. Missing or invalid readings stay unavailable. Battery state of charge is displayed only when reported between 0 and 100 percent. A full battery is not assumed to be the vehicle’s charging target. The progress screen compares reported battery levels, not charging speed or efficiency. Disconnected bays do not show old vehicle battery data. No sample vehicles or readings are used.', 'Office EVCC · Direct readings');
        } else if (kind === 'shipping') {
            subtitle.textContent = 'Dispatch weight estimates · monthly comparison and weight-data coverage';
            scope('The shipping gateway combines completed stock moves with product weights. It estimates missing product weights using a weighted average, or 3.5 kg if no weights are available, so all weight totals here are labelled estimated. Its source query is capped at 15,000 stock moves per year and some upstream failures become zero: these are reported figures, not an independently audited total. Current-year bars stop at the current month; the current month is partial. Last-year total is explicitly a full-year reference, not a target or a like-for-like growth rate. Coverage counts describe active products in the source catalogue. Monetary values and unsupported growth claims are omitted.', 'Odoo · Reported estimates');
        } else if (kind === 'weather') {
            subtitle.textContent = 'High Wycombe, UK · current conditions and the next five days';
            scope('Forecast for High Wycombe (51.6291, −0.7493), supplied by Open-Meteo through the office weather service. Times are Europe/London. These are modelled weather conditions, not an on-site sensor. Temperature is Celsius, wind speed is kilometres per hour. The temperature ranges show the forecast low and high on a common scale. Missing forecast values remain unavailable. No simulated weather is used.', 'Open-Meteo · High Wycombe');
        } else if (kind === 'projects') {
            subtitle.textContent = 'Architape case studies · full text and photography from the website';
            scope('Case studies copied from the Architape website project pages by build_project_stories.mjs. Text, specifications, products and photographs are as published; each project shows only its own photographs.', `Architape website · ${window.ProjectStories?.projects?.length ?? 0} case studies · built ${window.ProjectStories?.generated ?? 'unknown'}`);
        } else {
            subtitle.textContent = kind === 'clock' ? 'Europe / London' : kind === 'lunch' ? 'Lunch ends at 14:00 · Monday to Friday' : 'Hometime at 17:30 · Monday to Friday';
            scope('Time follows the device clock, displayed in Europe/London with British Summer Time handled automatically. The existing lunch-end time of 14:00 and hometime of 17:30 are retained. Countdowns use Monday–Friday; weekends point to the next Monday. Public holidays and individual working patterns are not configured. After today’s target, the completed state remains visible for the rest of the day.', 'Device clock · London timezone');
        }
    }
    function chargerArt(charging) {
        return `<svg class="charger-art" viewBox="0 0 360 200" fill="none" aria-hidden="true"><ellipse cx="175" cy="180" rx="125" ry="10" fill="currentColor" opacity=".06"/><path d="M28 178h305" stroke="currentColor" opacity=".2"/><rect x="45" y="34" width="78" height="142" rx="16" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-width="1.5"/><rect x="59" y="50" width="50" height="45" rx="6" fill="currentColor" fill-opacity=".12"/><path d="m87 57-15 19h11l-4 13 15-20H83l4-12Z" fill="currentColor"/><circle cx="84" cy="117" r="5" fill="${charging ? 'currentColor' : '#536771'}"/><path d="M124 73h9c14 0 15 10 15 21v46c0 19 12 25 26 16l18-13" stroke="currentColor" stroke-width="3" opacity=".35"/><path class="charge-flow" d="M124 73h9c14 0 15 10 15 21v46c0 19 12 25 26 16l18-13" stroke="currentColor" stroke-width="3"/><path d="m185 133 16-27c4-7 10-10 20-10h57c8 0 15 4 20 11l15 25 17 7v25H182v-23l3-8Z" fill="currentColor" fill-opacity=".04" stroke="currentColor" stroke-width="1.5"/><path d="m204 128 13-21h62l13 21h-88Z" fill="currentColor" fill-opacity=".12"/><path d="M184 144h23m100 0h21" stroke="currentColor" stroke-width="3"/><circle cx="208" cy="165" r="12" fill="var(--panel)" stroke="currentColor" stroke-width="2"/><circle cx="306" cy="165" r="12" fill="var(--panel)" stroke="currentColor" stroke-width="2"/></svg>`;
    }
    function soc(lp) { const n = D.nonnegative(lp.vehicleSoc); return lp.connected === true && n !== null && n > 0 && n <= 100 ? n : null; }  // the chargers report 0 when the car does not share its battery level
    function energyState(lp) { return lp.charging === true ? 'Charging' : lp.connected === true ? 'Connected' : lp.connected === false ? 'Disconnected' : 'Connection unknown'; }
    function energyMetrics(loadpoints) {
        const total = D.sumKnown(loadpoints.map(lp => lp.chargePower));
        const connected = loadpoints.filter(lp => lp.connected === true).length;
        const charging = loadpoints.filter(lp => lp.charging === true).length;
        return `<div class="metrics">${metric('Charging power', fmt(total === null ? null : total / 1000, 1), 'Sum of reported chargepoint power', 'hero', 'bolt', 'kW')}${metric('Charging now', fmt(charging), `Across ${loadpoints.length} reported chargepoints`, '', 'bolt')}${metric('Connected', fmt(connected), 'Includes vehicles currently charging', '', 'link')}${metric('Disconnected', fmt(loadpoints.filter(lp => lp.connected === false).length), 'Reported as not connected', '', 'box')}</div>`;
    }
    function renderEnergy() {
        const all = state.payload.loadpoints;
        if (kind === 'charging' && all.length) {
            const page = state.page % Math.max(1, Math.ceil(all.length / 6));
            const points = all.slice(page * 6, page * 6 + 6);
            content.innerHTML = energyMetrics(all) + `<div class="bay-wall" data-bays="${points.length}">${points.map(lp => {
                const power = D.nonnegative(lp.chargePower), energy = D.nonnegative(lp.sessionEnergy);
                // 11500 W is the fastest the office cars charge; a limit reported by the charger takes precedence.
                const maximum = D.nonnegative(lp.maxChargePower) || D.nonnegative(lp.chargerMaxPower) || 11500;
                const level = soc(lp);
                const powerPercent = power === null || !maximum ? 0 : Math.min(100, power / maximum * 100);
                const name = lp.connected === true ? lp.vehicleTitle || 'Vehicle not identified' : lp.connected === false ? 'No vehicle connected' : 'Status unavailable';
                const status = lp.connected === false ? 'Not connected' : energyState(lp);
                return `<section class="panel bay-card ${lp.charging === true ? 'is-charging' : ''}">
                    <div class="bay-top"><h2>${E(lp.title || 'Chargepoint')}</h2><span class="bay-state"><i></i>${E(status)}</span></div>
                    <h3 class="bay-vehicle">${E(name)}</h3>
                    <div class="bay-reading"><div class="bay-power">${fmt(power === null ? null : power / 1000, 1)}<small>kW</small></div><div class="bay-art ${lp.charging === true ? 'charging' : ''}">${chargerArt(lp.charging === true)}</div></div>
                    <div class="bay-battery-label"><span>${power === null ? 'Power unavailable' : '0 kW'}</span><strong>${fmt(maximum / 1000, 1)} kW max</strong></div>
                    <div class="bay-battery" role="img" aria-label="Charging power ${power === null ? 'unavailable' : fmt(power / 1000, 1) + ' kW'}; maximum ${fmt(maximum / 1000, 1)} kW"><i style="width:${powerPercent}%"></i></div>
                    <div class="bay-details"><span>Session <strong>${fmt(energy === null ? null : energy / 1000, 1)} kWh</strong></span><span>${level === null ? '' : fmt(level) + '% battery · '}${E({ off: 'Off', now: 'Fast', minpv: 'Minimum + solar', pv: 'Solar' }[lp.mode] || 'Mode unknown')}</span></div>
                </section>`;
            }).join('')}</div><div class="board-summary"><span>${all.length} reported chargepoints · Page ${page + 1} of ${Math.ceil(all.length / 6)}</span><span>${all.length > 6 ? 'Bays rotate automatically' : 'All reported bays shown'}</span></div>`;
            return;
        }
        const pageSize = kind === 'race' ? 2 : 3;
        const pages = Math.max(1, Math.ceil(all.length / pageSize));
        const page = state.page % pages;
        const points = all.slice(page * pageSize, (page + 1) * pageSize);
        const pageInfo = all.length ? `<div class="board-summary"><span>${E(state.payload.siteTitle || 'Office chargepoints')} · Page ${page + 1} of ${pages}</span><span>${pages > 1 ? 'Chargepoints rotate automatically' : 'All chargepoints shown'}</span></div>` : '';
        if (!all.length) { content.innerHTML = energyMetrics(all) + empty('No chargepoints reported', 'The source responded with an empty chargepoint list.', 'bolt'); return; }
        if (kind === 'race') {
            content.innerHTML = energyMetrics(all) + `<div class="race-grid"><section class="panel">${panelHead('Charge progress', 'Reported battery level · 0–100%', '01')}${points.map((lp, i) => {
                const level = soc(lp); const p = D.nonnegative(lp.chargePower);
                return `<div class="race-row"><div class="race-label"><div><h3>${E(lp.vehicleTitle || lp.title || 'Chargepoint ' + (page * pageSize + i + 1))}</h3><p class="row-detail">${E(lp.title || 'Chargepoint')} · ${E(energyState(lp))}</p></div><b>${fmt(level)}${level !== null ? '%' : ''}</b></div><div class="race-track" role="img" aria-label="${E(lp.title || 'Battery')}: ${level === null ? 'unavailable' : level + '%'}"><div class="race-fill" style="width:${level ?? 0}%"></div></div><div class="race-small"><span>${level === null ? 'Battery level unavailable' : '0%'} </span><span>${fmt(p === null ? null : p / 1000, 1)} kW${level !== null ? ' · 100%' : ''}</span></div></div>`;
            }).join('')}</section><section class="panel focus-panel">${panelHead('Every charge counts.', 'Energy delivered during reported sessions', '02')}<div class="energy-orbit">${icon('bolt')}</div><div class="power" style="text-align:center">${fmt((() => { const n = D.sumKnown(all.map(lp => lp.sessionEnergy)); return n === null ? null : n / 1000; })(), 2)}<small>kWh</small></div><p class="quality-note">Session energy is cumulative. Battery level reflects each vehicle’s reported state of charge; it does not indicate how quickly the vehicle is charging.</p></section></div>${pageInfo}`;
        } else {
            content.innerHTML = energyMetrics(all) + `<div class="energy-grid" style="--bays:${Math.min(3, points.length)}">${points.map((lp, i) => {
                const power = D.nonnegative(lp.chargePower); const session = D.nonnegative(lp.sessionEnergy); const level = soc(lp);
                const modeNames = { off: 'Off', now: 'Fast', minpv: 'Minimum + solar', pv: 'Solar' };
                return `<section class="panel charger ${lp.charging === true ? 'charging' : ''}"><div class="charger-head"><h2>${E(lp.title || 'Bay ' + (page * pageSize + i + 1))}</h2><span class="badge" style="--state:${lp.charging === true ? 'var(--accent)' : 'var(--muted)'}">${E(energyState(lp))}</span></div>${chargerArt(lp.charging === true)}<div class="power">${fmt(power === null ? null : power / 1000, 1)}<small>kW</small></div><div class="energy-meta"><span>Session energy</span><strong>${fmt(session === null ? null : session / 1000, 2)} kWh</strong></div><div class="energy-meta"><span>Charge mode</span><strong>${E(modeNames[lp.mode] || lp.mode || 'Unknown')}</strong></div><div class="vehicle-name">${E(lp.connected === true ? lp.vehicleTitle || 'Connected vehicle' : 'No connected vehicle reported')}</div><div class="battery" role="img" aria-label="Battery level ${level === null ? 'unavailable' : level + '%'}">${Array.from({ length: 20 }, (_, n) => `<i class="${level !== null && (n + 1) * 5 <= level ? 'filled' : ''}"></i>`).join('')}</div><div class="race-small"><span>Reported battery</span><span>${level === null ? 'Unavailable' : fmt(level) + '%'}</span></div></section>`;
            }).join('')}</div>${pageInfo}`;
        }
        content.querySelectorAll('[data-action="cycle"]').forEach(b => b.onclick = cycle);
    }
    function shippingBars(data) {
        const month = Number(D.dayKey().slice(5, 7)) - 1;
        const a = Array.from({ length: 12 }, (_, i) => i <= month ? D.nonnegative(data.monthlyThisYear?.[i]) : null);
        const b = Array.from({ length: 12 }, (_, i) => D.nonnegative(data.monthlyLastYear?.[i]));
        const max = Math.max(1, ...a.filter(n => n !== null), ...b.filter(n => n !== null));
        const top = Math.ceil(max / 4) * 4;
        const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const chart = `<svg class="shipping-chart" viewBox="0 0 900 340" role="img" aria-label="Monthly estimated dispatch weight in tonnes; current month is partial"><title>Monthly estimated dispatch weight in tonnes</title>${Array.from({ length: 5 }, (_, i) => { const y = 275 - i * 60; return `<path class="axis" d="M48 ${y}h834"/><text x="38" y="${y + 4}" text-anchor="end">${fmt(top * i / 4)}</text>`; }).join('')}${names.map((n, i) => {
            const x = 57 + i * 69;
            const bars = [b[i], a[i]].map((v, j) => v === null ? '' : `<rect class="${j ? 'current' : 'previous'}-bar" x="${x + j * 23}" y="${275 - v / top * 240}" width="19" height="${v / top * 240}" rx="3"><title>${n}: ${fmt(v, 1)} t ${j ? '(current year, estimated)' : '(previous year, estimated)'}</title></rect>`).join('');
            return bars + `<text x="${x + 20}" y="305" text-anchor="middle">${n}${i === month ? '*' : ''}</text>`;
        }).join('')}</svg>`;
        const year = Number(D.dayKey().slice(0, 4));
        return chart + `<div class="legend"><span><i class="dot" style="background:var(--accent)"></i>${year} to date</span><span><i class="dot" style="background:#637e90"></i>${year - 1}</span><span>* Current month is partial</span></div>`;
    }
    function renderShipping() {
        const p = state.payload; const year = Number(D.dayKey().slice(0, 4));
        const weighed = D.nonnegative(p.weighedProducts), missing = D.nonnegative(p.unweighedProducts);
        const coverage = weighed !== null && missing !== null && weighed + missing > 0 ? weighed / (weighed + missing) * 100 : null;
        content.innerHTML = `<div class="metrics">${metric('Estimated weight · YTD', fmt(p.ytdThisYear, 1), `${year} · includes estimated missing weights`, 'hero', 'box', 't')}${metric('Reported dispatches · YTD', fmt(p.ordersThisYear), 'Distinct outgoing pickings in source', '', 'arrow')}${metric('Estimated weight · prior year', fmt(p.totalLastYear, 1), `${year - 1} full year · reference, not a target`, '', 'box', 't')}${metric('Products missing weight', fmt(missing), 'Reported active catalogue products', missing > 0 ? 'danger' : '', 'flag')}</div><div class="shipping-grid"><section class="panel shipping-main">${panelHead('A year in motion', 'Estimated dispatch weight by month · tonnes', '01')}${shippingBars(p)}<div class="chart-summary"><span>Missing months stay unavailable · zero values remain zero</span></div></section><section class="panel">${panelHead('Better weights. Better insight.', 'Reported catalogue weight coverage', '02')}<div class="quality-number">${fmt(coverage, 1)}<span style="font-size:.45em">${coverage === null ? '' : '%'}</span></div><div class="quality-track"><div class="quality-fill" style="width:${coverage ?? 0}%"></div></div><p class="quality-lines"><strong>${fmt(weighed)}</strong> products with a recorded weight<br><strong>${fmt(missing)}</strong> without a recorded weight</p><p class="quality-note">The source estimates missing weights using an average. These totals describe estimated dispatch weight, not a measured weighbridge total.</p><div class="energy-meta"><span>Estimated average / dispatch</span><strong>${fmt(p.avgWeight, 2)} t</strong></div></section></div>`;
    }
    function weatherInfo(code) {
        const n = D.numeric(code);
        if (n === 0) return ['Clear sky', 'sun'];
        if (n === 1) return ['Mainly clear', 'sun'];
        if (n === 2) return ['Partly cloudy', 'cloud'];
        if (n === 3) return ['Overcast', 'cloud'];
        if ([45, 48].includes(n)) return ['Fog', 'fog'];
        if ([51, 53, 55, 56, 57].includes(n)) return ['Drizzle', 'rain'];
        if ([61, 63, 65, 66, 67, 80, 81, 82].includes(n)) return ['Rain', 'rain'];
        if ([71, 73, 75, 77, 85, 86].includes(n)) return ['Snow', 'snow'];
        if ([95, 96, 99].includes(n)) return ['Thunderstorms', 'storm'];
        return ['Conditions unavailable', 'unknown'];
    }
    function weatherArt(type, night = false) {
        const sun = `<circle cx="110" cy="100" r="47" fill="#f3d490"/><circle cx="110" cy="100" r="64" stroke="#f3d490" opacity=".15"/><circle cx="110" cy="100" r="80" stroke="#f3d490" opacity=".08"/>`;
        const moon = '<path d="M147 48a58 58 0 1 0 21 96 60 60 0 0 1-21-96Z" fill="#cad8eb"/>';
        const cloud = '<path d="M65 161a29 29 0 0 1 2-58 43 43 0 0 1 80-7 32 32 0 0 1 13 62H65Z" fill="#9dbdc9"/><path d="M68 157h89" stroke="#d0e2e7" opacity=".4"/>';
        const rain = '<path d="m77 179-8 15m40-15-8 15m40-15-8 15" stroke="#82c9ef" stroke-width="7" stroke-linecap="round"/>';
        let shape = type === 'sun' ? (night ? moon : sun) : type === 'unknown' ? '<text x="115" y="130" text-anchor="middle" fill="#9badb7" font-size="80">?</text>' : (type === 'cloud' ? (night ? moon : sun) : '') + cloud;
        if (type === 'rain') shape += rain;
        if (type === 'storm') shape += '<path d="m119 166-18 27h15l-7 22 30-33h-17l10-16Z" fill="#f3d490"/>';
        if (type === 'snow') shape += '<g fill="#e9f4fa"><circle cx="75" cy="182" r="4"/><circle cx="110" cy="195" r="4"/><circle cx="145" cy="180" r="4"/></g>';
        if (type === 'fog') shape += '<path d="M45 180h126m-111 17h95" stroke="#9dbdc9" stroke-width="5" stroke-linecap="round"/>';
        return `<svg viewBox="0 0 230 230" aria-hidden="true">${shape}</svg>`;
    }
    function renderWeather() {
        const p = state.payload, now = p.current, daily = p.daily;
        const [desc, type] = weatherInfo(now.weather_code);
        const today = D.dayKey();
        const indexes = daily.time.map((d, i) => d > today ? i : -1).filter(i => i >= 0).slice(0, 5);
        const lows = indexes.map(i => D.numeric(daily.temperature_2m_min?.[i]));
        const highs = indexes.map(i => D.numeric(daily.temperature_2m_max?.[i]));
        const known = [...lows, ...highs].filter(n => n !== null);
        const min = known.length ? Math.min(...known) : 0, max = known.length ? Math.max(...known) : 1;
        const span = Math.max(1, max - min);
        const todayIndex = daily.time.indexOf(today);
        const sunTime = value => typeof value === 'string' && /T\d\d:\d\d/.test(value) ? value.slice(11, 16) : '—';
        content.innerHTML = `<div class="weather-grid"><section class="panel weather-hero"><div class="panel-head"><div><p class="eyebrow">High Wycombe</p><h2>Current conditions</h2></div><span class="panel-index">01</span></div><div class="weather-art">${weatherArt(type, now.is_day === 0)}</div><div class="weather-temperature">${fmt(now.temperature_2m)}<small>°C</small></div><p class="weather-desc">${E(desc)}</p><p class="weather-feels">Feels like ${fmt(now.apparent_temperature)}°C</p><div class="weather-facts"><div><b>${fmt(now.relative_humidity_2m)}%</b><span>Humidity</span></div><div><b>${fmt(now.wind_speed_10m)}<small> km/h</small></b><span>Wind speed</span></div><div><b>${fmt(now.pressure_msl)}</b><span>Pressure · hPa</span></div></div><div class="weather-source">Sunrise ${E(sunTime(daily.sunrise?.[todayIndex]))} · Sunset ${E(sunTime(daily.sunset?.[todayIndex]))} · London time</div></section><section class="panel forecast">${panelHead('What’s on the horizon', 'Daily low → high · same temperature scale', '02')}${indexes.length ? indexes.map((i, n) => {
            const [condition, style] = weatherInfo(daily.weather_code?.[i]);
            const lo = lows[n], hi = highs[n];
            return `<div class="forecast-row"><div class="forecast-day">${E(dateLabel(daily.time[i], { day: undefined, month: undefined, weekday: 'short' }))}<small>${E(dateLabel(daily.time[i]))}</small></div><div title="${E(condition)}" role="img" aria-label="${E(condition)}">${weatherArt(style)}</div><div class="forecast-range" title="${fmt(lo)}°C to ${fmt(hi)}°C">${lo !== null && hi !== null && hi >= lo ? `<i style="left:${(lo - min) / span * 100}%;width:${(hi - lo) / span * 100}%"></i>` : ''}</div><div class="forecast-degrees">${fmt(hi)}°<small>${fmt(lo)}°</small></div></div>`;
        }).join('') : empty('Forecast unavailable', 'The response contains no future forecast days.', 'sun')}<p class="weather-source">Conditions at ${E(typeof now.time === 'string' ? now.time.replace('T', ' ') : 'time not supplied')} · Open-Meteo</p></section></div>`;
    }
    function safeUrl(value) { if (typeof value !== 'string') return null; try { const url = new URL(value, 'https://www.architape.co.uk'); return url.protocol === 'https:' ? url.href : null; } catch (_) { return null; } }
    // Website case studies scroll at reading pace. A project only gives way to the next once its last
    // line has been on screen; the position is saved because the rotation reloads the page each slot.
    const reader = { key: 'architainment-projects-progress', index: 0, y: 0, hold: 0, done: false, last: 0, photo: 0, photoAt: 0, saved: 0 };
    function readProgress(projects) {
        try {
            const saved = JSON.parse(localStorage.getItem(reader.key));
            const index = projects.findIndex(p => p.slug === saved?.slug);
            if (index >= 0) { reader.index = index; reader.y = Math.max(0, (Number(saved.y) || 0) - 120); reader.photo = Number(saved.photo) || 0; return; }
        } catch (_) { /* Storage can be disabled in signage browsers; start at the first project. */ }
        reader.index = 0; reader.y = 0;
    }
    function saveProgress(project) {
        try { localStorage.setItem(reader.key, JSON.stringify({ slug: project.slug, y: Math.round(reader.y), photo: reader.photo })); } catch (_) { /* Progress is kept in memory only. */ }
    }
    function projectBlocks(project) {
        const parts = project.blocks.map(b => b.type === 'h2' ? `<h3 class="case-h2">${E(b.text)}</h3>` : b.type === 'h3' ? `<h4 class="case-h3">${E(b.text)}</h4>` : b.type === 'eyebrow' ? `<p class="case-eyebrow">${E(b.text)}</p>` : b.type === 'label' ? `<p class="case-label">${E(b.text)}</p>` : b.type === 'callout' ? `<p class="case-callout">${E(b.text)}</p>` : `<p class="case-p">${E(b.text)}</p>`);
        if (project.products.length) parts.push(`<p class="case-eyebrow">Products specified in this project</p><div class="case-products">${project.products.map(p => `<div class="case-product"><strong>${E(p.name)}</strong><span>${E([p.category, p.tag].filter(Boolean).join(' · '))}</span></div>`).join('')}</div>`);
        parts.push('<p class="case-end">End of case study</p>');
        return parts.join('');
    }
    function showPhoto(project) {
        const images = project.images.map(i => ({ ...i, src: safeUrl(i.src) })).filter(i => i.src);
        const frame = content.querySelector('.case-media');
        if (!images.length) { frame.classList.add('no-photo'); return; }
        const image = images[reader.photo % images.length];
        const layer = document.createElement('img');
        layer.className = 'case-photo'; layer.alt = image.alt || ''; layer.decoding = 'async';
        layer.onload = () => { frame.classList.remove('no-photo'); layer.classList.add('is-shown'); frame.querySelectorAll('.case-photo').forEach(old => { if (old !== layer) setTimeout(() => old.remove(), 1600); }); };
        layer.onerror = () => { layer.remove(); if (!frame.querySelector('.case-photo')) frame.classList.add('no-photo'); };
        layer.src = image.src;
        frame.querySelector('.case-photos').appendChild(layer);
        frame.querySelector('.case-photo-count').textContent = images.length > 1 ? `Photograph ${reader.photo % images.length + 1} of ${images.length}` : 'Project photograph';
    }
    function renderProjects() {
        const projects = state.payload.projects;
        if (!projects.length) { content.innerHTML = empty('No case studies found', 'Rebuild project-stories.js from the website project pages.', 'box'); return; }
        reader.index %= projects.length;
        const project = projects[reader.index];
        content.innerHTML = `<article class="case"><div class="case-media"><div class="case-photos"></div><div class="case-photo-missing">${icon('box')}<span>Photograph unavailable</span></div><div class="case-media-top"><span class="case-count">${String(reader.index + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}</span><span class="case-photo-count"></span></div></div><div class="case-read"><header class="case-story-heading"><p class="case-meta">${E(project.meta)}</p><h2>${E(project.title)}</h2></header><dl class="case-specs">${project.specs.map(s => `<div><dt>${E(s.label)}</dt><dd>${E(s.value)}</dd></div>`).join('')}</dl><div class="case-scroll"><div class="case-text">${projectBlocks(project)}</div></div><div class="case-progress"><div class="case-bar"><i></i></div><span class="case-progress-label"></span></div></div></article>`;
        reader.hold = reader.y > 0 ? 2 : 6; reader.done = false; reader.photoAt = 0;
        showPhoto(project);
        placeText();
        updateStatus();
    }
    function placeText() {
        const scroll = content.querySelector('.case-scroll'), textEl = content.querySelector('.case-text');
        if (!scroll || !textEl) return null;
        const travel = Math.max(0, textEl.scrollHeight - scroll.clientHeight);
        reader.y = Math.min(reader.y, travel);
        textEl.style.transform = `translateY(${-reader.y}px)`;
        const percent = travel ? reader.y / travel * 100 : 100;
        content.querySelector('.case-bar i').style.width = percent + '%';
        const next = state.payload.projects[(reader.index + 1) % state.payload.projects.length];
        const label = reader.done ? `Next: ${next.title}` : travel ? `Reading · ${Math.round(percent)}%` : 'Whole case study on screen';
        const labelEl = content.querySelector('.case-progress-label');
        if (labelEl.textContent !== label) labelEl.textContent = label;
        return { travel, line: parseFloat(getComputedStyle(textEl).lineHeight) || 40 };
    }
    function projectFrame(now) {
        requestAnimationFrame(projectFrame);
        const delta = reader.last ? Math.min((now - reader.last) / 1000, .1) : 0; reader.last = now;
        if (!R.visible() || !state.payload) return;
        const projects = state.payload.projects, project = projects[reader.index];
        if (!project) return;
        const metrics = placeText(); if (!metrics) return;
        if (reader.hold > 0) reader.hold -= delta;
        else if (reader.y < metrics.travel) {
            // About 26 lines a minute: comfortable reading from across a room.
            reader.y = Math.min(metrics.travel, reader.y + metrics.line * .43 * delta);
        } else if (!reader.done) { reader.done = true; reader.hold = 10; }
        else { reader.index = (reader.index + 1) % projects.length; reader.y = 0; reader.photo = 0; saveProgress(projects[reader.index]); renderProjects(); return; }
        reader.photoAt += delta;
        if (reader.photoAt > 14 && project.images.length > 1) { reader.photoAt = 0; reader.photo++; showPhoto(project); }
        if (now - reader.saved > 1000) { reader.saved = now; saveProgress(project); }
    }
    function startProjects() {
        const data = window.ProjectStories;
        if (!data || !Array.isArray(data.projects)) { content.innerHTML = `<div class="screen-error">${empty('Case studies unavailable', 'project-stories.js did not load. Rebuild it from the website project pages.', 'offline')}</div>`; return; }
        state.payload = data; state.refreshed = new Date();
        readProgress(data.projects);
        renderProjects();
        requestAnimationFrame(projectFrame);
    }
    function londonParts(now) {
        return Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
    }
    function londonInstant(year, month, day, hour, minute) {
        const desired = Date.UTC(year, month - 1, day, hour, minute);
        let guess = desired;
        for (let i = 0; i < 3; i++) { const p = londonParts(new Date(guess)); const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second); guess += desired - represented; }
        return new Date(guess);
    }
    // Keep the clock scene mounted: ticking must not restart animations or repaint the whole screen.
    function updateClockScene(markup) {
        const template = document.createElement('template');
        template.innerHTML = markup;
        function sync(parent, next) {
            Array.from(next.childNodes).forEach((node, index) => {
                const current = parent.childNodes[index];
                if (!current || current.nodeType !== node.nodeType || current.nodeName !== node.nodeName) {
                    if (current) current.replaceWith(node.cloneNode(true));
                    else parent.appendChild(node.cloneNode(true));
                    return;
                }
                if (node.nodeType === Node.TEXT_NODE) {
                    if (current.nodeValue !== node.nodeValue) current.nodeValue = node.nodeValue;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    for (const attr of Array.from(current.attributes)) {
                        if (!node.hasAttribute(attr.name)) current.removeAttribute(attr.name);
                    }
                    for (const attr of Array.from(node.attributes)) {
                        if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
                    }
                    sync(current, node);
                }
            });
            while (parent.childNodes.length > next.childNodes.length) parent.lastChild.remove();
        }
        sync(content, template.content);
    }
    function renderTime() {
        const now = new Date(), p = londonParts(now);
        const hh = String(p.hour).padStart(2, '0'), mm = String(p.minute).padStart(2, '0'), ss = String(p.second).padStart(2, '0');
        const date = new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
        if (kind === 'clock') {
            const day = D.date(D.dayKey());
            const start = new Date(Date.UTC(p.year, 0, 1, 12));
            const dayNumber = Math.floor((day - start) / 86400000) + 1;
            const progress = (p.hour * 3600 + p.minute * 60 + p.second) / 86400 * 100;
            updateClockScene(`<section class="time-scene"><div class="big-time" aria-label="${hh}:${mm}:${ss}">${hh}<span class="colon">:</span>${mm}<span class="seconds">${ss}</span></div><p class="time-date">${E(date)}</p><div class="time-bottom"><div><b>Make today count.</b><small>Day ${dayNumber} of ${p.year}</small></div><div class="day-progress" aria-label="${fmt(progress)}% of today elapsed"><i style="width:${progress}%"></i></div><div><b>High Wycombe</b><small>Europe / London</small></div></div></section>`);
            return;
        }
        const hour = kind === 'lunch' ? 14 : 17, minute = kind === 'lunch' ? 0 : 30;
        let targetDay = D.date(D.dayKey());
        while ([0, 6].includes(targetDay.getUTCDay())) targetDay.setUTCDate(targetDay.getUTCDate() + 1);
        const target = londonInstant(targetDay.getUTCFullYear(), targetDay.getUTCMonth() + 1, targetDay.getUTCDate(), hour, minute);
        const elapsed = target <= now;
        const diff = Math.max(0, Math.ceil((target - now) / 1000));
        const hours = String(Math.floor(diff / 3600)).padStart(2, '0'), minutes = String(Math.floor(diff % 3600 / 60)).padStart(2, '0'), seconds = String(diff % 60).padStart(2, '0');
        const title = elapsed ? (kind === 'lunch' ? 'Refreshed. Ready to go.' : 'Enjoy your evening.') : kind === 'lunch' ? 'Take a breath. Recharge.' : 'A good day. Nearly done.';
        updateClockScene(`<section class="countdown-scene"><div class="countdown-top"><div class="countdown-copy"><p class="eyebrow">${elapsed ? 'Today’s countdown is complete' : kind === 'lunch' ? 'Until the end of lunch' : 'Until hometime'}</p><h2>${E(title)}</h2></div><div class="countdown-target"><div class="countdown-art">${icon(kind === 'lunch' ? 'cup' : 'home')}</div><div><span>${kind === 'lunch' ? 'Lunch ends' : 'Hometime'}</span><strong>${hour}:${String(minute).padStart(2, '0')}</strong><small>${E(dateLabel(D.dayKey(targetDay), { weekday: 'long' }))}</small></div></div></div><div class="countdown-digits" aria-label="${hours} hours ${minutes} minutes ${seconds} seconds remaining"><div><b>${hours}</b><small>Hours</small></div><span class="colon">:</span><div><b>${minutes}</b><small>Minutes</small></div><span class="colon">:</span><div><b class="secs">${seconds}</b><small>Seconds</small></div></div></section>`);
    }

    function tick() {
        const now = new Date();
        document.getElementById('header-date').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, weekday: 'short', day: 'numeric', month: 'short' }).format(now);
        document.getElementById('header-time').textContent = timeLabel(now);
        updateStatus();
        if (localClock) renderTime();
    }
    function start() {
        if (operational) { operationControls(); scope(c.scope, 'Odoo · Partial view of returned records'); }
        else configureSpecial();
        if (demoCharging) {
            subtitle.textContent = 'Demo preview · 6 charging bays · Sample vehicles and readings';
            controls.innerHTML = '<span class="period">DEMO · 6 bays</span>';
            scope('Sample readings for six charging bays, for preview only.', 'DEMO DATA · Not connected to EVCC');
            const banner = document.getElementById('data-banner');
            banner.hidden = false;
            banner.textContent = 'DEMO DATA · Waiting for live EVCC readings · Switches automatically when connected.';
            state.payload = demoChargepoints();
            render();
        }
        const cached = !localClock && kind !== 'projects' && R.read('studio-' + kind, kind === 'charging' ? 86400000 : 7 * 86400000, p => p && (kind === 'charging' ? Array.isArray(p.loadpoints) : kind === 'shipping' ? Array.isArray(p.monthlyThisYear) : true));
        state.page = R.cursor(kind).page || 0;
        if (cached) { state.payload = cached.value; state.refreshed = new Date(cached.at); render(); showFailure(); }
        window.addEventListener('pagehide', () => R.saveCursor({ page: state.page }, kind));
        window.addEventListener('signage-deactivate', () => R.saveCursor({ page: state.page }, kind));
        tick();
        R.report({ ready: true, stale: state.failed, asOf: state.refreshed?.getTime() });
        setInterval(tick, 1000);
        if (localClock) return;
        if (kind === 'projects') { startProjects(); return; }
        refresh();
        setInterval(() => { if (R.visible()) refresh(); }, kind === 'charging' || kind === 'race' ? 15000 : kind === 'weather' ? 300000 : 60000);
        setInterval(() => { if (R.visible() && state.auto && state.payload && (operational || (kind === 'charging' && state.payload.loadpoints.length > 6) || kind === 'race')) cycle(); }, kind === 'projects' ? 20000 : 15000);
        document.addEventListener('visibilitychange', () => { if (R.visible()) { tick(); refresh(); } });
    }
    start();
})();
