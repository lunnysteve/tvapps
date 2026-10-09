/* Read-only Odoo dispatch history. Completion time is date_done, never write_date
   or the planned commitment_date. One card represents one fully delivered sale. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.DispatchHistory = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    'use strict';
    const DAY = 86400000;
    const ENDPOINT = 'https://office-intranet.architainment-lighting-dns-website-account.workers.dev/odoo/execute';
    const completed = value => ['full', 'shipped', 'fully delivered'].includes(String(value || '').toLowerCase().trim());
    const name = value => Array.isArray(value) ? String(value[1] || '') : typeof value === 'string' ? value : '';
    function timestamp(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d/.test(value)) return NaN;
        const iso = value.replace(' ', 'T');
        return Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + 'Z');
    }
    function normalise(transfers, orders, now = Date.now()) {
        const byOrder = new Map();
        const seen = new Set();
        for (const transfer of transfers) {
            const when = timestamp(transfer.date_done), saleId = Array.isArray(transfer.sale_id) ? transfer.sale_id[0] : null;
            if (!Number.isInteger(transfer.id) || seen.has(transfer.id) || !Number.isInteger(saleId) || transfer.state !== 'done' || transfer.picking_type_code !== 'outgoing' || !Number.isFinite(when) || when <= now - DAY || when > now) continue;
            seen.add(transfer.id);
            const prior = byOrder.get(saleId);
            if (!prior || when > prior.when) byOrder.set(saleId, { when, transfer: name(transfer.name) });
        }
        const unique = new Map();
        for (const order of orders) {
            const delivery = byOrder.get(order.id);
            if (!delivery || !completed(order.delivery_status) || !['sale', 'done'].includes(order.state)) continue;
            unique.set(order.id, {
                id: order.id, reference: name(order.name) || 'Order ' + order.id,
                customer: name(order.partner_id) || 'Customer not supplied',
                project: name(order.project_id) || name(order.client_order_ref),
                when: delivery.when, transfer: delivery.transfer
            });
        }
        return [...unique.values()].sort((a, b) => b.when - a.when || b.id - a.id);
    }
    async function rpc(model, method, args, kwargs = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(typeof location !== 'undefined' && /^https?:$/.test(location.protocol) ? '/api/signage/odoo' : ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, method, args, kwargs }), signal: controller.signal, cache: 'no-store' });
            if (!response.ok) throw new Error('Odoo HTTP ' + response.status);
            const body = await response.json();
            if (body.error || !Array.isArray(body.result) || body.result.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Invalid dispatch response');
            return body.result;
        } finally { clearTimeout(timeout); }
    }
    async function load(now = Date.now()) {
        const format = ms => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
        const transfers = [];
        let lastId = 0, partial = false;
        // Keyset paging avoids dropping records at the default Odoo response limit.
        for (let page = 0; page < 10; page++) {
            const rows = await rpc('stock.picking', 'search_read', [[
                ['state', '=', 'done'], ['picking_type_code', '=', 'outgoing'], ['sale_id', '!=', false],
                ['date_done', '>', format(now - DAY)], ['date_done', '<=', format(now)], ['id', '>', lastId]
            ]], { fields: ['id', 'name', 'state', 'picking_type_code', 'sale_id', 'date_done'], order: 'id asc', limit: 200 });
            if (rows.some(row => !Number.isInteger(row.id) || row.id <= lastId)) throw new Error('Invalid dispatch pagination');
            transfers.push(...rows);
            if (rows.length < 200) break;
            lastId = Math.max(...rows.map(row => row.id));
            partial = page === 9;
        }
        const ids = [...new Set(transfers.map(row => Array.isArray(row.sale_id) ? row.sale_id[0] : null).filter(Number.isInteger))];
        const orders = [];
        for (let index = 0; index < ids.length; index += 100) {
            orders.push(...await rpc('sale.order', 'read', [ids.slice(index, index + 100)], { fields: ['id', 'name', 'state', 'delivery_status', 'partner_id', 'project_id', 'client_order_ref'] }));
        }
        return { jobs: normalise(transfers, orders, now), partial, asOf: now };
    }
    return { DAY, timestamp, normalise, load, rpc };
});
