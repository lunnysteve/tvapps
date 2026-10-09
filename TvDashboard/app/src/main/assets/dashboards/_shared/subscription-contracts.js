/* Read-only Odoo cloud subscriptions (lighting control remote access). One card is one
   active or paused subscription order. Expiry is end_date when set, otherwise the next
   invoice date, which is when the plan renews. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./dispatch-history.js'));
    else root.SubscriptionContracts = factory(root.DispatchHistory);
})(typeof window === 'undefined' ? globalThis : window, function (source) {
    'use strict';
    const DAY = source.DAY, STATES = { '3_progress': 'Active', '4_paused': 'Paused' };
    const name = value => Array.isArray(value) ? String(value[1] || '') : typeof value === 'string' ? value.trim() : '';
    // Noon is only a display anchor. Countdown arithmetic uses London calendar days.
    function day(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value)) return NaN;
        const ms = Date.parse(value + 'T12:00:00Z');
        return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : NaN;
    }
    const londonDay = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
    function daysLeft(expiry, now = Date.now()) {
        return expiry === null ? null : Math.round((day(new Date(expiry).toISOString().slice(0, 10)) - day(londonDay(now))) / DAY);
    }
    function summary(jobs, now = Date.now()) {
        const days = jobs.map(j => daysLeft(j.expiry, now));
        return { active: jobs.filter(j => j.state === 'Active').length, paused: jobs.filter(j => j.state === 'Paused').length,
            overdue: days.filter(d => d !== null && d < 0).length, soon: days.filter(d => d !== null && d >= 0 && d <= 60).length,
            undated: days.filter(d => d === null).length };
    }
    function normalise(rows, now = Date.now()) {
        const seen = new Map();
        for (const row of rows) {
            if (!Number.isInteger(row.id) || row.id <= 0 || seen.has(row.id) || !STATES[row.subscription_state]) continue;
            const end = day(row.end_date), renew = day(row.next_invoice_date);
            const expiry = Number.isFinite(end) ? end : Number.isFinite(renew) ? renew : null;
            seen.set(row.id, {
                id: row.id, reference: name(row.name) || 'Contract ' + row.id,
                customer: name(row.partner_id) || 'Customer not supplied',
                // Projects are often named "SO12345 - Site name"; the order number is shown separately.
                project: (name(row.project_id) || name(row.client_order_ref)).replace(/^SO\d+\s*[-–:]\s*/i, '') || 'Remote access',
                plan: name(row.plan_id), state: STATES[row.subscription_state],
                expiry, ends: Number.isFinite(end), started: day(row.start_date),
                days: daysLeft(expiry, now)
            });
        }
        // Soonest expiry first; contracts without a date go last.
        return [...seen.values()].sort((a, b) => (a.expiry ?? Infinity) - (b.expiry ?? Infinity) || a.id - b.id);
    }
    async function load(now = Date.now()) {
        const rows = [];
        let lastId = 0, partial = false;
        for (let page = 0; page < 10; page++) {
            const batch = await source.rpc('sale.order', 'search_read', [[
                ['is_subscription', '=', true], ['subscription_state', 'in', Object.keys(STATES)], ['id', '>', lastId]
            ]], { fields: ['id', 'name', 'partner_id', 'project_id', 'client_order_ref', 'plan_id', 'subscription_state', 'start_date', 'end_date', 'next_invoice_date'], order: 'id asc', limit: 200 });
            if (batch.some(row => !Number.isInteger(row.id) || row.id <= lastId)) throw new Error('Invalid subscription pagination');
            rows.push(...batch);
            if (batch.length < 200) break;
            lastId = Math.max(...batch.map(row => row.id));
            partial = page === 9;
        }
        return { jobs: normalise(rows, now), partial, asOf: now };
    }
    return { DAY, normalise, load, daysLeft, summary, day, londonDay };
});
