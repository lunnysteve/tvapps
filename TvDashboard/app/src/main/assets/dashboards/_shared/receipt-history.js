/* One completed incoming stock receipt is one delivery, even for a partial PO. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./dispatch-history.js'));
    else root.ReceiptHistory = factory(root.DispatchHistory);
})(typeof window === 'undefined' ? globalThis : window, function (source) {
    'use strict';
    const DAY = source.DAY;
    const name = value => Array.isArray(value) ? String(value[1] || '') : typeof value === 'string' ? value.trim() : '';
    function timestamp(value) {
        if (typeof value !== 'string') return NaN;
        const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.exec(value);
        if (!match) return NaN;
        const [, y, m, d, h, min, s] = match.map(Number);
        const date = new Date(Date.UTC(y, m - 1, d, h, min, s));
        if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || h > 23 || min > 59 || s > 59) return NaN;
        return source.timestamp(value);
    }
    function normalise(receipts, purchases, now = Date.now()) {
        const orders = new Map(purchases.map(order => [order.id, order]));
        const seen = new Map();
        for (const receipt of receipts) {
            const when = timestamp(receipt.date_done);
            if (!Number.isInteger(receipt.id) || receipt.id <= 0 || seen.has(receipt.id) || receipt.state !== 'done' || receipt.picking_type_code !== 'incoming' || !Number.isFinite(when) || when <= now - DAY || when > now) continue;
            const purchaseId = Array.isArray(receipt.purchase_id) ? receipt.purchase_id[0] : null;
            const order = orders.get(purchaseId);
            const reference = name(order?.name) || name(receipt.purchase_id) || name(receipt.origin);
            const project = name(order?.x_project_reference) || name(order?.project_id);
            seen.set(receipt.id, {
                id: receipt.id, reference: name(receipt.name) || 'Receipt ' + receipt.id,
                supplier: name(receipt.partner_id) || 'Supplier not supplied',
                project: [reference, project].filter(Boolean).join(' · '),
                order: reference, when
            });
        }
        return [...seen.values()].sort((a, b) => b.when - a.when || b.id - a.id);
    }
    async function load(now = Date.now()) {
        const format = ms => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
        const receipts = [];
        let lastId = 0, partial = false;
        for (let page = 0; page < 10; page++) {
            const rows = await source.rpc('stock.picking', 'search_read', [[
                ['state', '=', 'done'], ['picking_type_code', '=', 'incoming'],
                ['date_done', '>', format(now - DAY)], ['date_done', '<=', format(now)], ['id', '>', lastId]
            ]], { fields: ['id', 'name', 'state', 'picking_type_code', 'purchase_id', 'partner_id', 'origin', 'date_done'], order: 'id asc', limit: 200 });
            if (rows.some(row => !Number.isInteger(row.id) || row.id <= lastId)) throw new Error('Invalid receipt pagination');
            receipts.push(...rows);
            if (rows.length < 200) break;
            lastId = Math.max(...rows.map(row => row.id));
            partial = page === 9;
        }
        const ids = [...new Set(receipts.map(row => Array.isArray(row.purchase_id) ? row.purchase_id[0] : null).filter(Number.isInteger))];
        const purchases = [];
        for (let index = 0; index < ids.length; index += 100) {
            purchases.push(...await source.rpc('purchase.order', 'read', [ids.slice(index, index + 100)], { fields: ['id', 'name', 'x_project_reference', 'project_id'] }));
        }
        return { jobs: normalise(receipts, purchases, now), partial, asOf: now };
    }
    return { DAY, timestamp, normalise, load };
});
