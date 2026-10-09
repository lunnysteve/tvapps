/* Shared unattended-display lifecycle. No operational fixtures or inferred history. */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.Signage = api;
})(typeof window === 'undefined' ? globalThis : window, function (root) {
    'use strict';
    const prefix = 'architainment-signage-v2-';
    const screen = root.location?.pathname.split('/').pop() || 'test';
    let active = !root.location || new URLSearchParams(root.location.search).get('preload') !== '1';
    let details = {}, errors = [], lastSave = 0;
    function read(key, maxAge = 7 * 86400000, validate = () => true) {
        try {
            const item = JSON.parse(root.localStorage?.getItem(prefix + key));
            if (!item || !Number.isFinite(item.at) || item.at > Date.now() || Date.now() - item.at > maxAge || !validate(item.value)) return null;
            return item;
        } catch (_) { return null; }
    }
    function write(key, value, at = Date.now()) {
        try { root.localStorage?.setItem(prefix + key, JSON.stringify({ at, value })); } catch (_) { /* Private mode / full storage: retain memory. */ }
    }
    function send(type, data = {}) {
        if (root.parent && root.parent !== root) root.parent.postMessage({ type, screen, ...data }, root.location.origin);
    }
    function report(data = {}) { details = { ...details, ...data }; send('signage-ready', details); }
    function visible() { return active && !root.document?.hidden; }
    function cursor(key = screen) { return read('cursor-' + key, 30 * 86400000)?.value || {}; }
    function saveCursor(value, key = screen) { write('cursor-' + key, value); }
    function attachScene(state, choose, tick, key = screen) {
        const saved = cursor(key);
        state.previous = saved.previous ?? null;
        const cached = read('scene-' + key, key.includes('subscriptions') ? 7 * 86400000 : 2 * 86400000,
            p => p && Array.isArray(p.jobs) && p.jobs.every(j => j && Number.isInteger(j.id) && j.id > 0));
        if (cached) {
            Object.assign(state, { jobs: cached.value.jobs, hasData: true, stale: true, partial: !!cached.value.partial, refreshed: cached.at });
            state.jobs.forEach(j => state.seen?.add(j.id));
            const banner = root.document.getElementById('source-banner');
            banner.hidden = false; banner.textContent = 'Last-known data · reconnecting to the source';
            root.document.querySelector('.dispatch-screen')?.classList.add('is-stale');
        }
        state.scrollStart = performance.now() - (saved.scrollElapsed || 0);
        const save = () => saveCursor({ previous: state.previous, scrollElapsed: Math.max(0, performance.now() - state.scrollStart) }, key);
        root.addEventListener('pagehide', save);
        root.addEventListener('signage-deactivate', save);
        root.addEventListener('signage-activate', () => { state.start = performance.now(); tick(); });
        setInterval(() => { if (visible()) save(); }, 2000);
        choose(performance.now()); tick();
    }
    function sceneReceived(state, data, key = screen) {
        if (!new URLSearchParams(root.location.search).has('demo')) write('scene-' + key, { jobs: data.jobs, partial: !!data.partial }, data.asOf || Date.now());
        report({ stale: false, asOf: data.asOf || Date.now(), records: data.jobs.length, quiet: data.jobs.length === 0 });
    }
    function scrollList(state, now, reduced) {
        const list = root.document.getElementById('history-list'), viewport = root.document.getElementById('history-viewport');
        const overflow = Math.max(0, list.scrollHeight - viewport.clientHeight);
        if (!overflow) { list.style.transform = ''; return; }
        const travel = overflow / 22 * 1000, cycle = 8000 + travel * 2, t = (now - state.scrollStart) % cycle;
        let y = t < 4000 ? 0 : t < 4000 + travel ? (t - 4000) / travel * overflow : t < 8000 + travel ? overflow : overflow * (1 - (t - 8000 - travel) / travel);
        if (reduced) y = Math.min(overflow, Math.floor((now - state.scrollStart) / 8000) % (Math.ceil(overflow / viewport.clientHeight) + 1) * viewport.clientHeight);
        list.style.transform = `translateY(-${y.toFixed(1)}px)`;
    }
    function hours(jobs, now = Date.now()) {
        const hour = 3600000, start = Math.floor(now / hour) * hour - 23 * hour, buckets = Array(24).fill(0);
        for (const job of jobs) { const i = Math.floor((job.when - start) / hour); if (job.when <= now && i >= 0 && i < 24) buckets[i]++; }
        return { buckets, start, peak: buckets.indexOf(Math.max(...buckets)) };
    }
    async function three() { return import('./tv-signage/vendor/three.module.js'); }
    function protectRenderer(renderer, host) {
        renderer.domElement.addEventListener('webglcontextlost', event => {
            event.preventDefault(); host.classList.add('renderer-unavailable');
            const sign = host.querySelector('.idle-sign'); if (sign) { sign.hidden = false; sign.querySelector('strong').textContent = 'Scene paused · verified records remain below'; }
            report({ renderer: 'unavailable' });
        });
        renderer.domElement.addEventListener('webglcontextrestored', () => { host.classList.remove('renderer-unavailable'); report({ renderer: 'restored' }); });
    }
    if (root.document) {
        root.addEventListener('message', event => {
            if (event.source !== root.parent || event.origin !== root.location.origin) return;
            if (event.data?.type === 'signage-activate' || event.data?.type === 'signage-deactivate') {
                active = event.data.type === 'signage-activate';
                root.dispatchEvent(new Event(event.data.type));
            }
        });
        root.addEventListener('error', e => { errors = [...errors.slice(-3), String(e.message).slice(0, 200)]; });
        root.addEventListener('unhandledrejection', e => { errors = [...errors.slice(-3), String(e.reason?.message || e.reason).slice(0, 200)]; });
        setInterval(() => {
            send('signage-heartbeat', { ...details, errors, active });
            // Move only persistent chrome; leave the layout and camera framing intact.
            if (visible() && !root.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                const drift = Math.round(Math.sin(Date.now() / 90000) * 2);
                root.document.querySelectorAll('.mast,.masthead,.footer,.foot').forEach(el => { el.style.translate = `${drift}px 0`; });
            }
        }, 5000);
    }
    return { read, write, cursor, saveCursor, visible, report, attachScene, sceneReceived, scrollList, hours, three, protectRenderer };
});
