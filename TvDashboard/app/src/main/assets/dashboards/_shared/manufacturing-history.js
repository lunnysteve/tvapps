/* Read-only Odoo production history. One card is one production order marked done;
   completion time is date_finished. Quantities are omitted because the gateway can
   substitute default quantities. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./dispatch-history.js'));
    else root.ManufacturingHistory = factory(root.DispatchHistory);
})(typeof window === 'undefined' ? globalThis : window, function (source) {
    'use strict';
    const name = value => Array.isArray(value) ? String(value[1] || '') : typeof value === 'string' ? value.trim() : '';
    const api = { DAY: source.DAY, normalise, load };
    function normalise(rows, now = Date.now()) {
        const seen = new Map();
        for (const row of rows) {
            const when = source.timestamp(row.date_finished);
            if (!Number.isInteger(row.id) || row.id <= 0 || seen.has(row.id) || row.state !== 'done' || !Number.isFinite(when) || when <= now - api.DAY || when > now) continue;
            const full = name(row.product_id), code = (/^\[([^\]]+)\]/.exec(full) || [])[1] || '';
            const product = full.replace(/^\[[^\]]*\]\s*/, '').replace(/\s*\(.*$/, '').trim();
            seen.set(row.id, {
                id: row.id, reference: name(row.name) || 'Order ' + row.id,
                product: product || code || 'Product not supplied', code, origin: name(row.origin),
                detail: [code, name(row.origin)].filter(Boolean).join(' · '), when
            });
        }
        return [...seen.values()].sort((a, b) => b.when - a.when || b.id - a.id);
    }
    async function load(now = Date.now()) {
        const format = ms => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
        const rows = [];
        let lastId = 0, partial = false;
        for (let page = 0; page < 10; page++) {
            const batch = await source.rpc('mrp.production', 'search_read', [[
                ['state', '=', 'done'], ['date_finished', '>', format(now - api.DAY)], ['date_finished', '<=', format(now)], ['id', '>', lastId]
            ]], { fields: ['id', 'name', 'state', 'product_id', 'origin', 'date_finished'], order: 'id asc', limit: 200 });
            if (batch.some(row => !Number.isInteger(row.id) || row.id <= lastId)) throw new Error('Invalid production pagination');
            rows.push(...batch);
            if (batch.length < 200) break;
            lastId = Math.max(...batch.map(row => row.id));
            partial = page === 9;
        }
        return { jobs: normalise(rows, now), partial, asOf: now };
    }
    return api;
});
