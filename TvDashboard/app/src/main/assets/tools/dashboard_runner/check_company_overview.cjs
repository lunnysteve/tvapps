/* Data rules for the company overview (dashboards/company-overview.html). No network access.
   node tools/dashboard_runner/check_company_overview.cjs */
const assert = require('node:assert/strict');
const O = require('../../dashboards/_shared/company-overview.js');

// Thursday 1 October 2026, 12:00 London (BST). Week: Mon 28 Sep – Sun 4 Oct.
const now = new Date('2026-10-01T11:00:00Z');
const asOf = now.getTime();

const inbound = { kind: 'goods_in', period: '2026-09-28', asOf, partial: false,
    done: [
        { id: 1, name: 'WH/IN/1', partner_id: [5, 'Holectron'], purchase_id: [9, 'PO1'], state: 'done', picking_type_code: 'incoming', date_done: '2026-09-29 09:00:00', project_description: 'Stock' },
        { id: 1, name: 'WH/IN/1', partner_id: [5, 'Holectron'], purchase_id: [9, 'PO1'], state: 'done', picking_type_code: 'incoming', date_done: '2026-09-29 09:00:00', project_description: 'Stock' },
        { id: 2, name: 'WH/IN/2', partner_id: [6, 'Midwich'], purchase_id: [10, 'PO2'], state: 'done', picking_type_code: 'incoming', date_done: '2026-10-02 09:00:00' }
    ],
    due: [
        { id: 3, partner_id: [7, 'Penn Elcom'], purchase_id: [11, 'PO3'], state: 'assigned', picking_type_code: 'incoming', scheduled_date: '2026-09-29 08:00:00' },
        { id: 4, partner_id: [8, 'Ecopac'], purchase_id: [12, 'PO4'], state: 'confirmed', picking_type_code: 'incoming', scheduled_date: '2026-10-03 08:00:00' },
        { id: 5, partner_id: [8, 'Ecopac'], purchase_id: [13, 'PO5'], state: 'cancel', picking_type_code: 'incoming', scheduled_date: '2026-10-03 08:00:00' }
    ] };
const outbound = { kind: 'warehouse', period: '2026-09-28', asOf, partial: true, projects: { 'order-20': 'Hotham Hall' },
    done: [
        { id: 30, partner_id: [1, 'Mistry Lighting'], sale_id: [20, 'SO20'], state: 'done', picking_type_code: 'outgoing', date_done: '2026-09-30 10:00:00' },
        { id: 31, partner_id: [1, 'Mistry Lighting'], sale_id: [20, 'SO20'], state: 'done', picking_type_code: 'outgoing', date_done: '2026-09-30 15:00:00' }
    ],
    due: [{ id: 32, partner_id: [2, 'Southampton University'], sale_id: [21, 'SO21'], state: 'assigned', picking_type_code: 'outgoing', scheduled_date: '2026-10-05 08:00:00' }] };
const manufacturing = { kind: 'manufacturing', period: '2026-09-28', asOf, partial: false,
    done: [{ id: 40, name: 'MO/40', product_id: [3, '[A1] Architape Indoor'], origin: 'SO20', state: 'done', date_finished: '2026-09-29 12:00:00' }],
    due: [
        { id: 41, name: 'MO/41', product_id: [4, 'Controls Enclosure'], origin: false, state: 'progress', date_start: '2026-09-30 08:00:00', date_deadline: '2026-09-30 17:00:00' },
        { id: 42, name: 'MO/42', product_id: [4, 'Controls Enclosure'], state: 'cancel', date_start: '2026-09-30 08:00:00' }
    ] };
const subscriptions = { kind: 'subscriptions', asOf, partial: false, rows: [
    { id: 50, name: 'SO50', partner_id: [1, 'BGIS'], project_id: [1, 'SO50 - OCW cloud renewal'], subscription_state: '3_progress', next_invoice_date: '2026-10-02' },
    { id: 51, name: 'SO51', partner_id: [2, 'Hijingo'], subscription_state: '4_paused', end_date: '2026-11-08', next_invoice_date: '2026-10-01' },
    { id: 52, name: 'SO52', partner_id: [3, 'Medway'], subscription_state: '3_progress', next_invoice_date: '2026-10-20' },
    { id: 53, name: 'SO53', partner_id: [4, 'Old'], subscription_state: '6_churn', next_invoice_date: '2026-10-02' }
] };

const lanes = O.shape({ inbound, outbound, manufacturing, subscriptions }, now);

// Inbound: duplicate receipts collapse; future completions are ignored; cancelled receipts are not "due".
assert.equal(lanes.inbound.done.length, 1, 'Repeated receipt counted once; a completion after "now" is ignored');
assert.deepEqual(lanes.inbound.due.map(r => r.reference), ['PO3', 'PO4'], 'Only open receipt states are expected');
assert.equal(lanes.inbound.records.find(r => r.reference === 'PO3').status, 'Ready to receive · Late');
assert.equal(lanes.inbound.records.find(r => r.reference === 'PO4').late, false, 'A receipt due later this week is not late');
assert.equal(lanes.inbound.records.find(r => r.reference === 'PO1').detail, 'Stock');
assert.equal(lanes.inbound.records[0].reference, 'PO3', 'Late records come first');

// Outbound: one card per sale order, project name preferred, scheduled dates outside the week excluded.
assert.equal(lanes.outbound.done.length, 1, 'Two transfers of one order are one dispatched order');
assert.equal(lanes.outbound.records[0].title, 'Hotham Hall');
assert.equal(lanes.outbound.records[0].detail, 'Mistry Lighting');
assert.equal(lanes.outbound.due.length, 0, 'A dispatch scheduled next week is not due this week');
assert.equal(lanes.outbound.partial, true);

// Manufacturing: product names without internal codes; cancelled orders excluded; deadline drives lateness.
assert.ok(lanes.manufacturing.records.some(r => r.title === 'Architape Indoor'));
const lateMo = lanes.manufacturing.records.find(r => r.title === 'Controls Enclosure');
assert.equal(lanes.manufacturing.records[0], lateMo, 'Late manufacturing comes first');
assert.equal(lanes.manufacturing.due.length, 1);
assert.equal(lateMo.late, true);
assert.equal(lateMo.detail, '', 'A missing source order is not invented');

// Subscriptions: active and paused only; contract end beats next invoice; this week before next-up.
assert.equal(lanes.subscriptions.active, 2);
assert.equal(lanes.subscriptions.paused, 1);
assert.deepEqual(lanes.subscriptions.thisWeek.map(r => r.id), [50], 'Paused contract ending in November is not due this week');
assert.equal(lanes.subscriptions.records[0].title, 'OCW cloud renewal', 'Leading SO number stripped from the project name');
assert.equal(lanes.subscriptions.records[0].next, false);
assert.deepEqual(lanes.subscriptions.records.filter(r => r.next).map(r => r.key), ['sub-52', 'sub-51']);
assert.equal(lanes.subscriptions.records.find(r => r.key === 'sub-51').status, 'Ends · Paused');

// A missing source stays missing rather than becoming zero.
assert.equal(O.shape({ inbound }, now).outbound, undefined);
console.log('Company overview data checks passed.');
