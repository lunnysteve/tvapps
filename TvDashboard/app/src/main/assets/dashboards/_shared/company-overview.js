/* Company overview: the week's ins and outs around Architainment. Read-only Odoo data through the
   office gateway (TVData). Suppliers flow in, customers and projects flow out, manufacturing loops
   through the centre and cloud subscriptions run out to customers. Nothing is invented: an empty
   lane says so, a failed source keeps its last-known records marked stale. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./dashboard-data.js') : root.DashboardData, typeof module === 'object' && module.exports ? require('./tv-signage/data.js') : root.TVData);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.CompanyOverview = api;
})(typeof window === 'undefined' ? globalThis : window, function (D, T) {
  'use strict';
  const LANES = ['inbound', 'outbound', 'manufacturing', 'subscriptions'];
  const OPEN_IN = { draft: 'Draft', waiting: 'Waiting', confirmed: 'Awaiting stock', assigned: 'Ready to receive' };

  // Turn source payloads into display records. Pure, so it can be checked in Node.
  function shape(payloads, now = new Date()) {
    const w = T.week(now), today = D.dayKey(now);
    const lanes = {};
    if (payloads.inbound) {
      const p = payloads.inbound;
      const done = T.logisticsRows(p, true, now).map(r => ({ ...r, flow: 'done', status: 'Received' }));
      const due = T.logisticsRows(p, false, now).map(r => ({ ...r, flow: 'due', status: OPEN_IN[r.state] || r.status, late: D.overdue(r.date, now) }));
      lanes.inbound = { done, due, partial: !!p.partial, asOf: p.asOf, records: [...done, ...due].map(r => ({
        key: r.id, flow: r.flow, late: !!r.late, title: r.partner, reference: r.reference,
        detail: r.description && r.description !== 'Description not supplied' ? r.description : '', status: r.late ? r.status + ' · Late' : r.status, date: r.date
      })) };
    }
    if (payloads.outbound) {
      const p = payloads.outbound, projects = p.projects || {};
      const done = T.logisticsRows(p, true, now).map(r => ({ ...r, flow: 'done' }));
      const due = T.logisticsRows(p, false, now).map(r => ({ ...r, flow: 'due', late: D.overdue(r.date, now) }));
      lanes.outbound = { done, due, partial: !!p.partial, asOf: p.asOf, records: [...done, ...due].map(r => ({
        key: r.id, flow: r.flow, late: !!r.late, title: projects[r.id] || r.partner, reference: r.reference,
        detail: projects[r.id] ? r.partner : (r.carrier ? 'Carrier: ' + r.carrier : ''), status: r.late ? r.status + ' · Late' : r.status, date: r.date
      })) };
    }
    if (payloads.manufacturing) {
      const p = payloads.manufacturing;
      const done = T.manufacturingRows(p, true, now).map(r => ({ ...r, flow: 'done' }));
      const due = T.manufacturingRows(p, false, now).map(r => ({ ...r, flow: 'due', late: !!r.deadline && D.overdue(r.deadline, now) }));
      lanes.manufacturing = { done, due, partial: !!p.partial, asOf: p.asOf, records: [...done, ...due].map(r => ({
        key: 'mo-' + r.id, flow: r.flow, late: r.late, title: r.partner, reference: r.reference,
        detail: r.description !== 'Source order not supplied' ? 'For ' + r.description : '', status: r.late ? r.status + ' · Past deadline' : r.status, date: r.date
      })) };
    }
    if (payloads.subscriptions) {
      const p = payloads.subscriptions, data = T.subscriptionRows(p, now);
      const label = r => D.name(r.project_id).replace(/^SO\d+\s*[-–:]\s*/i, '') || D.name(r.client_order_ref) || D.name(r.plan_id) || D.name(r.name);
      const thisWeek = data.all.filter(r => r.due && r.due >= w.start && r.due <= w.end).sort((a, b) => a.due.localeCompare(b.due) || a.id - b.id);
      const soon = data.upcoming.filter(r => r.due > w.end).slice(0, 6);
      const expired = data.all.filter(r => r.due && r.due < w.start && r.basis === 'Contract end');
      lanes.subscriptions = { active: data.active, paused: data.paused, thisWeek, soon, expired, partial: !!p.partial, asOf: p.asOf, records: [...thisWeek.map(r => ({ r, flow: 'due', week: true })), ...soon.map(r => ({ r, flow: 'next', week: false }))].map(({ r, flow, week }) => ({
        key: 'sub-' + r.id, flow, late: r.due < today, title: label(r) || 'Contract ' + r.id, reference: D.name(r.name),
        detail: D.name(r.partner_id), status: `${r.basis === 'Contract end' ? 'Ends' : 'Renews'}${r.paused ? ' · Paused' : ''}`, next: !week, date: r.due
      })) };
    }
    Object.values(lanes).forEach(l => l.records.sort((a,b) => Number(b.late) - Number(a.late) || Number(a.flow === 'done') - Number(b.flow === 'done') || String(a.date || '9999').localeCompare(String(b.date || '9999'))));
    return lanes;
  }

  async function loadOutbound(now) {
    const p = await T.logistics('warehouse', now);
    // Project names for each sale order; optional context, never required for a record to show.
    p.projects = {};
    try {
      const ids = [...new Set([...p.done, ...p.due].map(r => Array.isArray(r.sale_id) ? r.sale_id[0] : null).filter(Number.isInteger))];
      for (let i = 0; i < ids.length; i += 100) {
        const orders = await T.rpc('sale.order', 'read', [ids.slice(i, i + 100)], { fields: ['id', 'project_id', 'client_order_ref'] });
        orders.forEach(o => { const n = D.name(o.project_id).replace(/^SO\d+\s*[-–:]\s*/i, '') || D.name(o.client_order_ref); if (n) p.projects['order-' + o.id] = n; });
      }
    } catch (_) { /* Customer names still identify each order. */ }
    return p;
  }
  const loaders = { inbound: now => T.logistics('goods_in', now), outbound: loadOutbound, manufacturing: now => T.manufacturing(now), subscriptions: () => T.subscriptions() };

  if (typeof document === 'undefined') return { shape, LANES };

  // ---------------------------------------------------------------- Display
  const E = D.esc;
  const COLORS = { inbound: '#94d8f2', outbound: '#f5be8c', manufacturing: '#c1f279', subscriptions: '#c7b7fa' };
  const HUB = { x: 960, y: 532, r: 128 };
  const SLOTS = {
    inbound: Array.from({ length: 4 }, (_, i) => ({ x: 36, y: 196 + i * 174, w: 500, h: 158 })),
    outbound: Array.from({ length: 4 }, (_, i) => ({ x: 1384, y: 196 + i * 174, w: 500, h: 158 })),
    subscriptions: Array.from({ length: 2 }, (_, i) => ({ x: 598 + i * 366, y: 196, w: 354, h: 156 })),
    manufacturing: Array.from({ length: 2 }, (_, i) => ({ x: 598 + i * 366, y: 748, w: 354, h: 156 }))
  };
  const state = { payloads: {}, failed: {}, page: { inbound: 0, outbound: 0, manufacturing: 0, subscriptions: 0 }, flows: [] };
  Object.assign(state.page, window.Signage?.cursor('overview').page || {});
  const app = document.getElementById('overview');
  const dateFmt = (value, opts) => { const d = D.date(value); return d ? new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, ...opts }).format(d) : 'No date'; };
  const fmt = n => n === null || n === undefined ? '—' : Number(n).toLocaleString('en-GB');

  app.innerHTML = `<div class="stage" id="stage">
    <header class="ov-head"><div class="ov-brand"><svg viewBox="0 0 30 30" fill="none" aria-hidden="true"><path d="M2 26 15 3l13 23H2Z" stroke="currentColor" stroke-width="2"/><path d="m9 26 6-11 6 11" stroke="currentColor" stroke-width="2"/></svg>ARCHITAINMENT<span class="ov-divider"></span><span class="ov-channel">Company overview</span></div>
      <div class="ov-title"><p class="ov-eyebrow">The week in motion</p><h1 id="week-title">This week</h1></div>
      <div class="ov-clock"><span id="ov-date"></span><time id="ov-time"></time></div></header>
    <svg class="flows" id="flows" viewBox="0 0 1920 1080" aria-hidden="true"><defs>${Object.entries(COLORS).map(([k, c]) => `<marker id="arrow-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="${c}"/></marker><radialGradient id="glow-${k}"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('')}
      <radialGradient id="hub-fill" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#20404a"/><stop offset="1" stop-color="#0b161c"/></radialGradient></defs>
      <g id="flow-lines"></g><g id="flow-dots"></g>
      <g class="hub"><circle class="hub-pulse" cx="${HUB.x}" cy="${HUB.y}" r="${HUB.r}"/><circle class="hub-pulse delay" cx="${HUB.x}" cy="${HUB.y}" r="${HUB.r}"/>
        <circle cx="${HUB.x}" cy="${HUB.y}" r="${HUB.r + 18}" class="hub-orbit"/><circle cx="${HUB.x}" cy="${HUB.y}" r="${HUB.r}" fill="url(#hub-fill)" class="hub-core"/>
        <g id="hub-ring"></g></g></svg>
    <div class="hub-label" style="left:${HUB.x}px;top:${HUB.y}px"><svg viewBox="0 0 30 30" fill="none" aria-hidden="true"><path d="M2 26 15 3l13 23H2Z" stroke="currentColor" stroke-width="2"/><path d="m9 26 6-11 6 11" stroke="currentColor" stroke-width="2"/></svg><strong>ARCHITAINMENT</strong><span id="hub-week">This week</span></div>
    ${LANES.map(k => `<section class="lane lane-${k}" style="--c:${COLORS[k]}"><div class="lane-head" id="head-${k}"></div><div class="lane-cards" id="cards-${k}"></div></section>`).join('')}
    <div class="kpis" id="kpis"></div>
    <footer class="ov-foot"><span class="legend"><i class="solid"></i>Completed this week<i class="dashed"></i>Scheduled or due this week<span class="arrow-note">Arrows point the way work moves</span></span><span id="ov-source"></span><span class="ov-status" id="ov-status">Connecting to Odoo…</span></footer>
  </div>`;
  const stage = document.getElementById('stage');
  function fit() { const s = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px, ${(innerHeight - 1080 * s) / 2}px) scale(${s})`; }
  addEventListener('resize', fit); fit();

  const headings = {
    inbound: ['In', 'Suppliers', l => `<b>${fmt(l.done.length)}${l.partial ? '+' : ''}</b> received · <b>${fmt(l.due.length)}${l.partial ? '+' : ''}</b> expected`],
    outbound: ['Out', 'Customers & projects', l => `<b>${fmt(l.done.length)}${l.partial ? '+' : ''}</b> dispatched · <b>${fmt(l.due.length)}${l.partial ? '+' : ''}</b> due`],
    manufacturing: ['Make', 'Manufacturing', l => `<b>${fmt(l.done.length)}${l.partial ? '+' : ''}</b> made · <b>${fmt(l.due.length)}${l.partial ? '+' : ''}</b> scheduled`],
    subscriptions: ['Service', 'Cloud subscriptions', l => `<b>${fmt(l.active)}${l.partial ? '+' : ''}</b> active · <b>${fmt(l.thisWeek.length)}</b> due this week`]
  };
  const empties = { inbound: 'No supplier receipts this week', outbound: 'No dispatches this week', manufacturing: 'No production orders this week', subscriptions: 'No renewals or contract ends soon' };

  // A curve between a card edge and the hub rim; the direction follows the work.
  function curve(lane, slot, outward) {
    const cx = slot.x + slot.w / 2, cy = slot.y + slot.h / 2;
    let a, c1, c2;
    if (lane === 'inbound' || lane === 'outbound') {
      const left = lane === 'inbound', x = left ? slot.x + slot.w + 6 : slot.x - 6;
      a = { x, y: cy };
      // Fan the arrows over the hub's near side: higher cards meet the rim higher up.
      const spread = Math.max(-1, Math.min(1, (cy - HUB.y) / 360)) * .85, angle = left ? Math.PI - spread : spread;
      const rim = { x: HUB.x + Math.cos(angle) * (HUB.r + 26), y: HUB.y + Math.sin(angle) * (HUB.r + 26) };
      c1 = { x: x + (left ? 140 : -140), y: cy }; c2 = { x: rim.x + (left ? -110 : 110), y: rim.y + (cy - HUB.y) * .12 };
      return path(outward ? [rim, c2, c1, a] : [a, c1, c2, rim]);
    }
    const top = lane === 'subscriptions', y = top ? slot.y + slot.h + 6 : slot.y - 6;
    a = { x: cx, y };
    const angle = Math.atan2(y - HUB.y, cx - HUB.x);
    const rim = { x: HUB.x + Math.cos(angle) * (HUB.r + 26), y: HUB.y + Math.sin(angle) * (HUB.r + 26) };
    c1 = { x: cx, y: y + (top ? 70 : -70) }; c2 = { x: rim.x + (cx - HUB.x) * .25, y: rim.y + (top ? -60 : 60) };
    return path(outward ? [rim, c2, c1, a] : [a, c1, c2, rim]);
  }
  const path = ([a, b, c, d]) => `M${a.x.toFixed(1)} ${a.y.toFixed(1)}C${b.x.toFixed(1)} ${b.y.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)} ${d.x.toFixed(1)} ${d.y.toFixed(1)}`;
  const outwards = (lane, flow) => lane === 'outbound' || lane === 'subscriptions' || (lane === 'manufacturing' && flow !== 'done');

  function pages(lane, records) { return Math.max(1, Math.ceil(records.length / SLOTS[lane].length)); }
  function renderLane(lane) {
    const l = state.lanes[lane], head = document.getElementById('head-' + lane), cards = document.getElementById('cards-' + lane);
    const [verb, name, counts] = headings[lane];
    const stale = state.failed[lane] && l, unavailable = !l;
    const page = l ? state.page[lane] % pages(lane, l.records) : 0, total = l ? pages(lane, l.records) : 1;
    head.innerHTML = `<span class="lane-verb">${verb}</span><span class="lane-name">${name}</span><span class="lane-counts">${unavailable ? (state.failed[lane] ? 'Source unavailable' : 'Connecting…') : counts(l)}</span>${stale ? '<span class="lane-stale">Stale</span>' : ''}${total > 1 ? `<span class="lane-page">${page + 1} / ${total}</span>` : ''}`;
    const slots = SLOTS[lane], shown = l ? l.records.slice(page * slots.length, (page + 1) * slots.length) : [];
    cards.innerHTML = (shown.length ? shown : [null]).map((r, i) => {
      const s = slots[i], style = `left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px;animation-delay:${i * 90}ms`;
      if (!r) return `<article class="card card-empty" style="${style}"><strong>${E(unavailable ? (state.failed[lane] ? 'Data unavailable' : 'Connecting to Odoo') : empties[lane])}</strong><span>${E(unavailable ? 'Retrying automatically' : lane === 'subscriptions' ? 'Active and paused contracts checked' : 'Monday to Sunday, London time')}</span></article>`;
      const when = lane === 'subscriptions' ? (r.next ? 'Next · ' : '') + dateFmt(r.date + 'T12:00:00Z', { day: 'numeric', month: 'short' }) : dateFmt(r.date, { weekday: 'short', day: 'numeric' });
      return `<article class="card ${r.flow} ${r.late ? 'late' : ''}" style="${style}"><div class="card-top"><span class="chip">${E(r.status)}</span><time>${E(when)}</time></div><strong class="card-title">${E(r.title)}</strong><span class="card-sub">${E([r.reference, r.detail].filter(Boolean).join(' · '))}</span></article>`;
    }).join('');
    return shown.map((r, i) => ({ lane, flow: r.flow, d: curve(lane, slots[i], outwards(lane, r.flow)) }));
  }
  function renderFlows(flows) {
    state.flows = flows;
    document.getElementById('flow-lines').innerHTML = flows.map((f, i) => `<path class="flow-glow" d="${f.d}" stroke="${COLORS[f.lane]}"/><path class="flow ${f.flow === 'done' ? 'solid' : 'dashed'}" id="flow-${i}" d="${f.d}" stroke="${COLORS[f.lane]}" marker-end="url(#arrow-${f.lane})"/>`).join('');
    document.getElementById('flow-dots').innerHTML = flows.map((f, i) => Array.from({ length: f.flow === 'done' ? 3 : 1 }, (_, k) => `<circle class="dot" data-flow="${i}" data-offset="${k / 3}" r="${f.flow === 'done' ? 7 : 5}" fill="url(#glow-${f.lane})"/>`).join('')).join('');
    state.paths = flows.map((_, i) => document.getElementById('flow-' + i));
    state.lengths = state.paths.map(p => p.getTotalLength());
  }
  function renderHubRing() {
    // The ring splits this week's records by lane: a proportion of activity, not a target.
    const counts = LANES.map(k => { const l = state.lanes[k]; return l ? (k === 'subscriptions' ? l.thisWeek.length : l.done.length + l.due.length) : 0; });
    const total = counts.reduce((a, b) => a + b, 0), r = HUB.r + 18, C = 2 * Math.PI * r;
    let start = -Math.PI / 2;
    document.getElementById('hub-ring').innerHTML = total ? counts.map((n, i) => {
      if (!n) return '';
      const len = n / total * C, seg = `<circle cx="${HUB.x}" cy="${HUB.y}" r="${r}" fill="none" stroke="${COLORS[LANES[i]]}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${Math.max(0, len - 10)} ${C}" transform="rotate(${start * 180 / Math.PI} ${HUB.x} ${HUB.y})"/>`;
      start += n / total * 2 * Math.PI; return seg;
    }).join('') : '';
  }
  function renderKpis() {
    const l = state.lanes, plus = k => l[k]?.partial ? '+' : '';
    const tiles = [
      ['inbound', 'Received', l.inbound && fmt(l.inbound.done.length) + plus('inbound'), 'Supplier receipts'],
      ['inbound', 'Expected', l.inbound && fmt(l.inbound.due.length) + plus('inbound'), l.inbound ? `${l.inbound.due.filter(r => r.late).length} late` : 'Open receipts'],
      ['manufacturing', 'Made', l.manufacturing && fmt(l.manufacturing.done.length) + plus('manufacturing'), 'Production orders done'],
      ['manufacturing', 'Scheduled', l.manufacturing && fmt(l.manufacturing.due.length) + plus('manufacturing'), l.manufacturing ? `${l.manufacturing.due.filter(r => r.state === 'progress').length} in progress` : 'Open orders'],
      ['outbound', 'Dispatched', l.outbound && fmt(l.outbound.done.length) + plus('outbound'), 'Sales orders shipped'],
      ['outbound', 'Due out', l.outbound && fmt(l.outbound.due.length) + plus('outbound'), l.outbound ? `${l.outbound.due.filter(r => r.late).length} late` : 'Open dispatches'],
      ['subscriptions', 'Active contracts', l.subscriptions && fmt(l.subscriptions.active) + plus('subscriptions'), l.subscriptions ? `${fmt(l.subscriptions.paused)} paused` : 'Cloud subscriptions'],
      ['subscriptions', 'Due this week', l.subscriptions && fmt(l.subscriptions.thisWeek.length), 'Renewals and contract ends']
    ];
    document.getElementById('kpis').innerHTML = tiles.map(([k, label, value, note]) => `<div class="kpi" style="--c:${COLORS[k]}"><span>${E(label)}</span><b>${E(value || '—')}</b><small>${E(note)}</small></div>`).join('');
  }
  function render() {
    const now = new Date(), w = T.week(now);
    state.lanes = shape(state.payloads, now);
    document.getElementById('week-title').textContent = `Week ${T.isoWeek(now)} · ${dateFmt(w.start + 'T12:00:00Z', { day: 'numeric', month: 'short' })} – ${dateFmt(w.end + 'T12:00:00Z', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    document.getElementById('hub-week').textContent = `Week ${T.isoWeek(now)} · ins & outs`;
    renderFlows(LANES.flatMap(renderLane));
    renderHubRing(); renderKpis(); status();
    window.Signage?.report({ asOf: Math.min(...Object.values(state.payloads).map(p => p.asOf)), stale: Object.values(state.failed).some(Boolean) });
  }
  function status() {
    const el = document.getElementById('ov-status'), loaded = LANES.filter(k => state.payloads[k]), failed = LANES.filter(k => state.failed[k]);
    const oldest = loaded.length ? Math.min(...loaded.map(k => state.payloads[k].asOf)) : null;
    const at = oldest ? new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, hour: '2-digit', minute: '2-digit' }).format(new Date(oldest)) : '';
    el.className = 'ov-status ' + (failed.length ? 'stale' : loaded.length === LANES.length ? 'ok' : '');
    el.textContent = !loaded.length ? (failed.length ? 'Odoo unavailable · retrying automatically' : 'Connecting to Odoo…') : failed.length ? `STALE · ${failed.length} source${failed.length > 1 ? 's' : ''} unavailable · showing data from ${at}` : `Updated ${at}`;
    const partial = LANES.filter(k => state.payloads[k]?.partial);
    document.getElementById('ov-source').textContent = partial.length ? `Partial coverage (${partial.join(', ')}): safety limit reached, counts are lower bounds` : 'Odoo · Monday–Sunday, Europe/London · read-only';
  }
  const cacheKey = k => 'architainment-overview-v1-' + k;
  LANES.forEach(k => { try { const c = JSON.parse(localStorage.getItem(cacheKey(k))); if (c && Number.isFinite(c.asOf) && c.asOf <= Date.now() && c.period === T.week().start) { state.payloads[k] = c; state.failed[k] = true; } } catch (_) { /* Storage can be disabled on signage browsers. */ } });
  async function refresh() {
    await Promise.all(LANES.map(async k => {
      try {
        const p = await loaders[k](new Date());
        if (k === 'subscriptions') p.period = T.week().start;
        state.payloads[k] = p; state.failed[k] = false;
        try { localStorage.setItem(cacheKey(k), JSON.stringify(p)); } catch (_) { /* In-memory copy remains. */ }
      } catch (error) { state.failed[k] = true; console.warn(`Overview ${k} unavailable:`, error.message); }
    }));
    render();
  }
  function tick() {
    const now = new Date();
    document.getElementById('ov-date').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, weekday: 'short', day: 'numeric', month: 'short' }).format(now);
    document.getElementById('ov-time').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  }
  // Flow markers sit still along their paths (the TVs are low-power Fire TV sticks); placed once a second
  // so they follow the paths when the cards page.
  function animate() {
    setTimeout(() => requestAnimationFrame(animate), 1000);
    if (document.hidden || !state.paths) return;
    const t = 0;
    document.querySelectorAll('#flow-dots .dot').forEach(dot => {
      const i = +dot.dataset.flow, path = state.paths[i], len = state.lengths[i];
      if (!path) return;
      const speed = state.flows[i].flow === 'done' ? .16 : .09, u = ((t * speed + +dot.dataset.offset + i * .137) % 1);
      const p = path.getPointAtLength(u * len * .96);
      dot.setAttribute('cx', p.x.toFixed(1)); dot.setAttribute('cy', p.y.toFixed(1));
      dot.setAttribute('opacity', Math.min(1, u * 8, (1 - u) * 8).toFixed(2));
    });
  }
  tick(); render(); refresh();
  setInterval(tick, 1000);
  setInterval(() => { if (!document.hidden) refresh(); }, 180000);
  setInterval(() => { if (!window.Signage?.visible()) return; LANES.forEach(k => state.page[k]++); window.Signage.saveCursor({ page: state.page }, 'overview'); render(); }, 12000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); refresh(); } });
  requestAnimationFrame(animate);
  return { shape, LANES };
});
