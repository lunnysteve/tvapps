/* v3 animated TV dashboards: EV chargepoints.
   Same data rules as dashboard-studio.js (DashboardData): no invented values,
   missing differs from zero, failures keep last-known data marked stale. */
(function () {
    'use strict';
    const D = window.DashboardData;
    const E = D.esc;
    const API = 'https://office-intranet.architainment-lighting-dns-website-account.workers.dev';
    const EVCC = 'http://192.168.0.194:7070/api/state';
    const kind = document.body.dataset.dashboard;
    const root = document.getElementById('dashboard');
    const S = { payload: null, refreshed: null, failed: false, page: 0, busy: false, history: {} };

    /* ---------- helpers ---------- */
    const fmt = (v, d = 0) => { const n = D.numeric(v); return n === null ? '—' : n.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }); };
    const hhmm = d => new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    async function request(url, ms = 15000) {
        const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
        try {
            const r = await fetch(url, { signal: c.signal, cache: 'no-store' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return await r.json();
        } finally { clearTimeout(t); }
    }
    // Animate every [data-count] element from its previous value to its new one.
    const shown = new Map();
    function countUp() {
        root.querySelectorAll('[data-count]').forEach(el => {
            const id = el.dataset.id || el.dataset.count, to = Number(el.dataset.count), d = Number(el.dataset.dp || 0);
            if (!Number.isFinite(to)) return;
            const from = shown.get(id) ?? 0, start = performance.now();
            shown.set(id, to);
            const step = t => {
                const k = Math.min(1, (t - start) / 1400), e = 1 - Math.pow(1 - k, 3);
                el.textContent = (from + (to - from) * e).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
                if (k < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        });
    }
    // Missing values render as a dash, never as a counted-up zero.
    const num = (id, v, d = 0) => { const n = D.numeric(v); return n === null ? '—' : `<span data-id="${id}" data-count="${n}" data-dp="${d}">${fmt(0, d)}</span>`; };
    function pathLen(svg) { svg.querySelectorAll('.draw').forEach(p => { if (p.getTotalLength) p.style.setProperty('--len', Math.ceil(p.getTotalLength())); }); }

    /* ---------- shell ---------- */
    const titles = {
        charging: ['Office chargepoints · Live', 'Energy, flowing.']
    };
    root.innerHTML = `<canvas class="v3-bg" id="bg"></canvas><div class="v3">
        <header class="v3-mast"><div class="v3-brand">Architainment <span>${E(titles[kind][0])}</span></div>
        <div class="v3-clock"><span class="v3-status loading" id="status">Connecting</span><span id="date"></span><time id="time"></time></div></header>
        <div class="v3-head"><p class="v3-eyebrow" id="eyebrow"></p><h1>${E(titles[kind][1])}</h1></div>
        <div class="v3-banner" id="banner" hidden></div>
        <main class="v3-main ev" id="content"><div class="card unavail">Loading current data…</div></main>
        <footer class="v3-foot"><span id="scope"></span><span id="refreshed"></span></footer></div>`;
    const content = document.getElementById('content');
    function tick() {
        const now = new Date();
        document.getElementById('time').textContent = hhmm(now);
        document.getElementById('date').textContent = now.toLocaleDateString('en-GB', { timeZone: D.zone, weekday: 'long', day: 'numeric', month: 'long' });
    }
    function status() {
        const el = document.getElementById('status');
        if (!S.payload) { el.className = 'v3-status ' + (S.failed ? 'error' : 'loading'); el.textContent = S.failed ? 'Unavailable' : 'Connecting'; return; }
        el.className = 'v3-status ' + (S.failed ? 'stale' : DEMO ? 'stale' : 'ok'); el.textContent = S.failed ? 'Stale' : DEMO ? 'Demo' : 'Live';
        document.getElementById('refreshed').textContent = 'Updated ' + hhmm(S.refreshed);
    }

    /* ---------- animated background ---------- */
    const bg = document.getElementById('bg'), ctx = bg.getContext('2d');
    let scene = 'calm', parts = [];
    function setScene(s) {
        if (s === scene && parts.length) return; scene = s;
        const n = s === 'rain' ? 220 : s === 'storm' ? 280 : s === 'snow' ? 160 : s === 'cloud' || s === 'fog' ? 14 : 60;
        parts = Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() * .8 + .2, r: Math.random() }));
    }
    let flash = 0;
    function frame() {
        const w = bg.width = innerWidth, h = bg.height = innerHeight;
        const g = ctx.createRadialGradient(w * .8, -h * .2, 0, w * .8, -h * .2, h * 1.3);
        g.addColorStop(0, scene === 'sun' ? 'rgba(243,212,144,.16)' : scene === 'night' ? 'rgba(130,160,220,.10)' : 'rgba(193,242,121,.08)'); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        for (const p of parts) {
            if (scene === 'rain' || scene === 'storm') {
                p.y += .012 * p.z; p.x -= .002 * p.z;
                ctx.strokeStyle = `rgba(130,201,239,${.25 * p.z})`; ctx.lineWidth = p.z * 1.4;
                ctx.beginPath(); ctx.moveTo(p.x * w, p.y * h); ctx.lineTo(p.x * w - 5 * p.z, p.y * h + 22 * p.z); ctx.stroke();
            } else if (scene === 'snow') {
                p.y += .0015 * p.z; p.x += Math.sin((p.y + p.r) * 12) * .0006;
                ctx.fillStyle = `rgba(233,244,250,${.5 * p.z})`; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 2.5 * p.z, 0, 7); ctx.fill();
            } else if (scene === 'cloud' || scene === 'fog') {
                p.x += .00015 * p.z;
                const cg = ctx.createRadialGradient(p.x * w, p.y * h * .7, 0, p.x * w, p.y * h * .7, 260 * p.z);
                cg.addColorStop(0, `rgba(157,189,201,${scene === 'fog' ? .09 : .06})`); cg.addColorStop(1, 'transparent');
                ctx.fillStyle = cg; ctx.fillRect(p.x * w - 300, p.y * h * .7 - 300, 600, 600);
            } else {
                p.y -= .0004 * p.z;
                ctx.fillStyle = `rgba(${scene === 'sun' ? '243,212,144' : '193,242,121'},${.35 * p.z * (0.5 + .5 * Math.sin(performance.now() / 900 + p.r * 9))})`;
                ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 1.8 * p.z, 0, 7); ctx.fill();
            }
            if (p.y > 1.05) { p.y = -.05; p.x = Math.random() * 1.1; } if (p.y < -.05) { p.y = 1.05; } if (p.x > 1.2) p.x = -.2; if (p.x < -.1) p.x = 1.1;
        }
        if (scene === 'storm') { if (Math.random() < .003) flash = 1; if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * .18})`; ctx.fillRect(0, 0, w, h); flash -= .06; } }
        setTimeout(() => requestAnimationFrame(frame), 33); // ~30fps is plenty for a TV and keeps CPU low
    }
    setScene('calm'); frame();

    /* ---------- EV ---------- */
    const socOf = lp => { const n = D.nonnegative(lp.vehicleSoc); return lp.connected === true && n !== null && n <= 100 ? n : null; };
    function renderCharging() {
        const p = S.payload, lps = p.loadpoints;
        document.getElementById('eyebrow').textContent = `${p.siteTitle || 'Office chargepoints'} · EVCC`;
        document.getElementById('scope').textContent = 'EVCC readings: W ÷ 1,000 → kW, Wh ÷ 1,000 → kWh. Battery rings show reported vehicle SOC; disconnected bays show none. Missing readings show as —.';
        const kw = w => w === null ? null : w / 1000;
        const pages = Math.max(1, Math.ceil(lps.length / 6)), page = S.page % pages;
        const bays = lps.slice(page * 6, page * 6 + 6).map((lp, j) => ({ lp, i: page * 6 + j }));
        // Three bays either side of the hub; filled alternately so smaller sites stay balanced.
        const slots = [[330, 140], [1270, 140], [260, 400], [1340, 400], [330, 660], [1270, 660]];
        const HX = 800, HY = 400, R = 78, C = 2 * Math.PI * R;
        const sig = `${lps.length}:${page}`;
        if (content.dataset.layout !== sig) {
            content.dataset.layout = sig; content.classList.remove('settled');
            const cable = (x, y) => { const mx = (HX + x) / 2; return `M${HX} ${HY} C${mx} ${HY} ${mx} ${y} ${x} ${y}`; };
            const baySvg = bays.map(({ lp, i }, n) => {
                const [x, y] = slots[n], left = x < HX, tx = left ? x - R - 26 : x + R + 26, an = left ? 'end' : 'start';
                return `<path id="cab${n}" d="${cable(x, y)}" class="cable" data-b="${n}"/>
                    <g class="dots" data-b="${n}">${[0, 1, 2].map(k => `<circle r="6"><animateMotion dur="2.4s" begin="${k * .8}s" repeatCount="indefinite"><mpath href="#cab${n}"/></animateMotion></circle>`).join('')}</g>
                    <g class="bay-node" data-b="${n}"><circle cx="${x}" cy="${y}" r="${R + 14}" class="halo"/><circle cx="${x}" cy="${y}" r="${R}" class="track"/>
                    <circle cx="${x}" cy="${y}" r="${R}" class="soc" stroke-dasharray="0 ${C}" transform="rotate(-90 ${x} ${y})"/>
                    <text x="${x}" y="${y + 8}" class="soc-val"><tspan data-f="soc"></tspan></text><text x="${x}" y="${y + 36}" class="soc-lbl">battery %</text>
                    <text x="${tx}" y="${y - 46}" text-anchor="${an}" class="bay-name">${E(lp.title || 'Chargepoint ' + (i + 1))}</text>
                    <text x="${tx}" y="${y + 14}" text-anchor="${an}" class="bay-kw"><tspan data-f="kw"></tspan><tspan class="u"> kW</tspan></text>
                    <text x="${tx}" y="${y + 50}" text-anchor="${an}" class="bay-sub" data-f="state"></text>
                    <text x="${tx}" y="${y + 80}" text-anchor="${an}" class="bay-sub dim" data-f="car"></text></g>`;
            }).join('');
            content.innerHTML = `<section class="card ev-stage"><svg viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid meet">${baySvg}
                <circle cx="${HX}" cy="${HY}" r="178" class="hub-ring"/><circle cx="${HX}" cy="${HY}" r="150" class="hub-pulse"/><circle cx="${HX}" cy="${HY}" r="135" class="hub"/>
                <text x="${HX}" y="${HY - 62}" class="hub-lbl">TOTAL POWER</text><text x="${HX}" y="${HY + 32}" class="hub-val"><tspan data-f="total"></tspan></text><text x="${HX}" y="${HY + 70}" class="hub-lbl">kW</text>
                <text x="${HX}" y="${HY + 104}" class="hub-sub" data-f="hubsub"></text>
                ${lps.length ? '' : `<text x="${HX}" y="${HY + 260}" class="hub-sub">No chargepoints reported</text>`}</svg>
                ${pages > 1 ? `<div class="bay-page">Page ${page + 1} of ${pages} · rotates automatically</div>` : ''}</section>
                <div class="ev-kpis"><section class="card"><div class="card-label">Charging now</div><div class="big"><span data-f="charging"></span><small>of ${lps.length}</small></div><p class="note">Chargepoints drawing power</p></section>
                <section class="card"><div class="card-label">Connected</div><div class="big" data-f="connected"></div><p class="note">Vehicles plugged in</p></section>
                <section class="card"><div class="card-label">Free bays</div><div class="big" data-f="free"></div><p class="note">Reported as not connected</p></section>
                <section class="card"><div class="card-label">Session energy</div><div class="big"><span data-f="energy"></span><small>kWh</small></div><p class="note">Across current sessions</p></section></div>`;
        }
        // In-place updates so the moving dots and rings never restart between refreshes.
        const setNum = (el, id, v, d = 0) => {
            const n = D.numeric(v);
            if (n === null) { el.removeAttribute('data-count'); el.textContent = '—'; return; }
            el.dataset.id = id; el.dataset.count = n; el.dataset.dp = d;
            if (!shown.has(id)) el.textContent = fmt(0, d);
        };
        const f = (scope, name) => scope.querySelector(`[data-f="${name}"]`);
        const total = D.sumKnown(lps.map(lp => lp.chargePower)), energy = D.sumKnown(lps.map(lp => lp.chargedEnergy));
        const charging = lps.filter(lp => lp.charging === true).length, connected = lps.filter(lp => lp.connected === true).length;
        setNum(f(content, 'total'), 'tot', kw(total), 1);
        f(content, 'hubsub').textContent = `${charging} of ${lps.length} charging`;
        setNum(f(content, 'charging'), 'ch', charging);
        setNum(f(content, 'connected'), 'co', connected);
        setNum(f(content, 'free'), 'fr', lps.filter(lp => lp.connected === false).length);
        setNum(f(content, 'energy'), 'en', energy === null ? null : energy / 1000, 1);
        content.querySelector('.hub-pulse').classList.toggle('on', charging > 0);
        bays.forEach(({ lp, i }, n) => {
            const g = content.querySelector(`.bay-node[data-b="${n}"]`), cab = content.querySelector(`.cable[data-b="${n}"]`);
            const soc = socOf(lp), w = D.nonnegative(lp.chargePower), limit = D.nonnegative(lp.limitSoc ?? lp.effectiveLimitSoc);
            const state = lp.charging === true ? 'charging' : lp.connected === true ? 'connected' : lp.connected === false ? 'free' : 'unknown';
            g.dataset.state = cab.dataset.state = content.querySelector(`.dots[data-b="${n}"]`).dataset.state = state;
            cab.style.strokeWidth = 3 + Math.min(9, (w || 0) / 1000); // thicker cable at higher power
            g.querySelector('.soc').style.opacity = soc === null ? 0 : 1;
            g.querySelector('.soc').style.strokeDasharray = `${((soc ?? 0) / 100 * C).toFixed(1)} ${C.toFixed(1)}`;
            setNum(f(g, 'soc'), 'soc' + i, soc);
            setNum(f(g, 'kw'), 'kw' + i, kw(w), 1);
            f(g, 'state').textContent = { charging: 'Charging', connected: 'Connected · idle', free: 'Free', unknown: 'Status unknown' }[state]
                + (lp.connected === true && D.nonnegative(lp.chargedEnergy) !== null ? ` · ${fmt(lp.chargedEnergy / 1000, 1)} kWh` : '');
            f(g, 'car').textContent = lp.connected === true ? `${lp.vehicleTitle || 'Vehicle not identified'}${limit !== null ? ` · limit ${fmt(limit)}%` : ''}` : '';
        });
    }

    /* ---------- polling ---------- */
    // Preview only: ?demo on the URL swaps EVCC for clearly labelled fake chargepoints.
    const DEMO = new URLSearchParams(location.search).has('demo');
    let demoT = 0;
    function demoEv() {
        demoT++;
        const wob = (base, amp, ph) => Math.max(0, Math.round(base + amp * Math.sin(demoT / 3 + ph)));
        return { siteTitle: 'DEMO · Office chargepoints', loadpoints: [
            { title: 'Bay 1', mode: 'pv', connected: true, charging: true, chargePower: wob(7200, 300, 0), chargedEnergy: 8400 + demoT * 30, vehicleSoc: Math.min(100, 46 + demoT * .2), limitSoc: 80, vehicleTitle: 'Tesla Model 3' },
            { title: 'Bay 2', mode: 'now', connected: true, charging: true, chargePower: wob(3600, 800, 2), chargedEnergy: 2100 + demoT * 15, vehicleSoc: Math.min(100, 71 + demoT * .1), limitSoc: 90, vehicleTitle: 'Kia EV6' },
            { title: 'Bay 3', mode: 'pv', connected: true, charging: false, chargePower: 0, chargedEnergy: 15300, vehicleSoc: 100, vehicleTitle: 'VW ID.4' },
            { title: 'Bay 4', mode: 'now', connected: true, charging: true, chargePower: wob(11000, 400, 4), chargedEnergy: 12600 + demoT * 45, vehicleSoc: Math.min(100, 22 + demoT * .3), limitSoc: 100, vehicleTitle: 'Polestar 2' },
            { title: 'Bay 5', mode: 'off', connected: false, charging: false, chargePower: 0, chargedEnergy: 0 },
            { title: 'Bay 6', mode: 'minpv', connected: true, charging: true, chargePower: wob(1400, 300, 5), chargedEnergy: 900 + demoT * 6, vehicleSoc: Math.min(100, 58 + demoT * .05), limitSoc: 80, vehicleTitle: 'BMW i4' }
        ] };
    }
    if (DEMO) { const b = document.getElementById('banner'); b.hidden = false; b.textContent = 'DEMO DATA: fake chargepoint readings for preview. Remove ?demo from the address to show live EVCC data.'; }
    const cfg = {
        charging: { load: async () => { if (DEMO) return demoEv(); const p = await request(EVCC); const r = p.result || p; if (!Array.isArray(r.loadpoints)) throw new Error('Invalid chargepoints'); return r; }, render: renderCharging, every: DEMO ? 3000 : 15000 }
    }[kind];
    function draw() {
        if (!S.payload) return; cfg.render(); countUp(); status();
        // Glide battery fills from their last level, then stop replaying entry animations.
        requestAnimationFrame(() => requestAnimationFrame(() => content.querySelectorAll('[data-h]').forEach(el => { el.style.height = el.dataset.h + '%'; shown.set(el.dataset.id, Number(el.dataset.h)); })));
        setTimeout(() => content.classList.add('settled'), 2500);
    }
    async function refresh() {
        if (S.busy) return; S.busy = true;
        try { S.payload = await cfg.load(); S.refreshed = new Date(); S.failed = false; if (!DEMO) document.getElementById('banner').hidden = true; draw(); }
        catch (e) {
            console.warn('Dashboard source unavailable:', e.message); S.failed = true;
            const b = document.getElementById('banner'); b.hidden = false;
            b.textContent = S.payload ? `Source not responding. Showing last data from ${hhmm(S.refreshed)}; retrying automatically.` : 'Source unavailable. Retrying automatically.';
            if (!S.payload) content.innerHTML = '<div class="card unavail" style="grid-column:1/-1">Current data unavailable</div>';
            status();
        } finally { S.busy = false; }
    }
    tick(); setInterval(tick, 1000);
    refresh(); setInterval(() => { if (!document.hidden) refresh(); }, cfg.every);
    if (kind === 'charging') setInterval(() => { S.page++; if (S.payload && S.payload.loadpoints.length > 6) draw(); }, 15000);
})();
