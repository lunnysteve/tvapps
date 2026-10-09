const assert = require('node:assert/strict');
const D = require('../../dashboards/_shared/dashboard-data.js');
const now = new Date('2026-09-25T12:00:00Z');
assert.equal(D.numeric(null), null);
assert.equal(D.numeric(false), null);
assert.equal(D.numeric(''), null);
assert.equal(D.numeric('0'), 0);
assert.equal(D.nonnegative(-1), null);
assert.equal(D.sumKnown([100, 0]), 100);
assert.equal(D.sumKnown([100, null]), null);
assert.equal(D.dayKey('2026-09-24 23:30:00'), '2026-09-25', 'Odoo UTC datetime must become London date');
assert.equal(D.overdue('2026-09-25', now), false, 'A date-only invoice is not overdue during its due date');
assert.equal(D.overdue('2026-09-24', now), true);
assert.equal(D.overdue('2026-09-25 11:00:00', now), true);
assert.deepEqual(D.days(0, now), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
assert.deepEqual(D.months(0, new Date('2026-12-20T12:00Z')), ['2026-12', '2027-01', '2027-02', '2027-03', '2027-04']);
assert.equal(D.classify({ state: 'to_close' }, 'manufacturing'), 'closing');
assert.equal(D.classify({ state: 'cancel' }, 'manufacturing'), 'cancelled');
assert.equal(D.classify({ delivery_status: 'fully delivered' }, 'outbound'), 'done');
assert.equal(D.classify({ subscription_state: 'payment_exception' }, 'subscriptions'), 'paused');
assert.equal(D.classify({ subscription_state: '6_churn' }, 'subscriptions'), 'closed');
assert.equal(D.classify({}, 'subscriptions'), 'unknown');
assert.equal(D.classify({ subscription_state: '5_renewed' }, 'subscriptions'), 'renewed', 'Renewed contracts must not inflate the active count');
assert.equal(D.date('2026-02-30'), null, 'Invalid calendar dates must not roll into a different month');
assert.equal(D.records([{ name: 'Unknown', next_invoice_date: '2026-09-01' }], 'subscriptions', now)[0].late, false, 'Unknown status must not imply unfinished work');
const rows = D.records([
    { name: 'A', subscription_state: '3_progress', next_invoice_date: '2026-09-25' },
    { name: 'A', subscription_state: '3_progress', next_invoice_date: '2026-09-25' },
    { name: 'B', subscription_state: '4_paused', next_invoice_date: '2026-10-01' },
    { name: 'C', subscription_state: '3_progress', next_invoice_date: false },
    { name: 'D', subscription_state: 'cancel', next_invoice_date: '2026-09-01' }
], 'subscriptions', now);
const metrics = D.metrics(rows, D.months(0, now), true);
assert.equal(rows.length, 3, 'Duplicate and cancelled records must not inflate totals');
assert.equal(metrics.average, 0.4, 'Average uses plotted invoices, not all returned records');
assert.equal(metrics.undated, 1);
assert.equal(metrics.late, 0);
assert.equal(D.esc('<img onerror="bad">'), '&lt;img onerror=&quot;bad&quot;&gt;');
console.log('Data regression checks passed: dates, statuses, duplicates, scope, missing numbers, averages and escaping.');
