/* Shared, dependency-free data rules. Also loaded by the Node regression checks. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.DashboardData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const zone = 'Europe/London';
    const numeric = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) ? Number(value) : null;
    const nonnegative = value => { const n = numeric(value); return n !== null && n >= 0 ? n : null; };
    const name = value => Array.isArray(value) ? String(value[1] || '') : (value == null || value === false ? '' : String(value));
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function date(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(value)) return null;
        const [year, month, day] = value.slice(0, 10).split('-').map(Number);
        const calendar = new Date(Date.UTC(year, month - 1, day));
        if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
        let iso = value.replace(' ', 'T');
        if (iso.length === 10) iso += 'T12:00:00Z';
        else if (!/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) iso += 'Z'; // Odoo datetime fields are UTC.
        const d = new Date(iso);
        return Number.isFinite(d.getTime()) ? d : null;
    }
    function dayKey(value = new Date()) {
        const d = value instanceof Date ? value : date(value);
        if (!d || !Number.isFinite(d.getTime())) return null;
        return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    }
    function overdue(value, now = new Date()) {
        const d = date(value);
        if (!d) return false;
        return value.length === 10 ? value < dayKey(now) : d < now;
    }
    function days(offset = 0, now = new Date()) {
        const d = date(dayKey(now));
        d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + offset * 7);
        return Array.from({ length: 7 }, (_, i) => {
            const t = new Date(d); t.setUTCDate(t.getUTCDate() + i); return dayKey(t);
        });
    }
    function months(offset = 0, now = new Date()) {
        const key = dayKey(now);
        return Array.from({ length: 5 }, (_, i) => {
            const d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + offset * 5 + i, 1, 12));
            return dayKey(d).slice(0, 7);
        });
    }
    function classify(item, kind) {
        const raw = name(kind === 'manufacturing' ? item.state : kind === 'inbound' ? item.receipt_status : kind === 'outbound' ? item.delivery_status : item.subscription_state).toLowerCase().trim();
        if (raw === 'cancel' || raw === 'cancelled') return 'cancelled';
        if (kind === 'manufacturing') {
            if (raw === 'done') return 'done';
            if (raw === 'to_close') return 'closing';
            if (raw === 'progress') return 'working';
            if (['confirmed', 'draft'].includes(raw)) return /late|unavailable|not available/.test(name(item.components_availability).toLowerCase()) ? 'blocked' : 'queued';
        } else if (kind === 'inbound') {
            if (raw === 'full') return 'done';
            if (raw === 'partial') return 'working';
            if (['pending', 'waiting', 'none'].includes(raw)) return 'queued';
        } else if (kind === 'outbound') {
            if (['full', 'shipped', 'fully delivered'].includes(raw)) return 'done';
            if (['started', 'picking', 'partial'].includes(raw)) return 'working';
            if (raw === 'ready') return 'ready';
            if (['waiting', 'pending', 'no'].includes(raw)) return 'queued';
        } else {
            if (/close|churn/.test(raw)) return 'closed';
            if (/pause/.test(raw) || raw === 'payment_exception') return 'paused';
            if (['draft', 'sent', '1_draft', '2_renewal'].includes(raw)) return 'draft';
            if (['5_renewed', 'renewed'].includes(raw)) return 'renewed';
            if (['3_progress', 'progress', 'active', 'in_progress'].includes(raw)) return 'active';
        }
        return 'unknown';
    }
    function records(items, kind, now = new Date()) {
        const seen = new Set();
        return items.filter(item => {
            const key = item.id ?? item.name;
            if (key && seen.has(key)) return false;
            if (key) seen.add(key);
            return true;
        }).map(item => {
            const state = classify(item, kind);
            const scheduled = kind === 'manufacturing' ? item.date_start : kind === 'inbound' ? item.date_planned : kind === 'outbound' ? item.commitment_date : item.next_invoice_date;
            const due = kind === 'manufacturing' ? item.date_deadline : scheduled;
            const terminal = ['done', 'closed', 'renewed', 'cancelled'].includes(state);
            const open = !terminal && state !== 'unknown';
            return { item, state, scheduled, due, key: dayKey(scheduled), terminal,
                open, late: open && overdue(due, now),
                title: name(item.name) || 'Unnamed record',
                detail: name(kind === 'manufacturing' ? item.product_id : item.partner_id) || 'Not supplied',
                reference: name(kind === 'inbound' ? item.x_project_reference : kind === 'subscriptions' ? item.plan_id : item.project_id) };
        }).filter(r => r.state !== 'cancelled');
    }
    function metrics(rows, keys, monthly = false) {
        const buckets = keys.map(key => rows.filter(r => r.key && (monthly ? r.key.slice(0, 7) : r.key) === key));
        const counts = buckets.map(b => b.length);
        return { buckets, counts, total: rows.length, dated: counts.reduce((a, b) => a + b, 0),
            average: counts.reduce((a, b) => a + b, 0) / keys.length,
            late: rows.filter(r => r.late).length, undated: rows.filter(r => !r.key && r.open).length };
    }
    function sumKnown(values) {
        if (!values.length) return 0;
        const nums = values.map(nonnegative);
        return nums.some(n => n === null) ? null : nums.reduce((a, b) => a + b, 0);
    }
    return { zone, numeric, nonnegative, name, esc, date, dayKey, overdue, days, months, classify, records, metrics, sumKnown };
});
