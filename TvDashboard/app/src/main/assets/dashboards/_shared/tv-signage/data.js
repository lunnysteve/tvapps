/* TV data adapter. All Odoo operations are read-only; no display fixtures. */
(function (root, factory) {
  const api = factory(typeof module === 'object' ? require('../dashboard-data.js') : root.DashboardData);
  if (typeof module === 'object') module.exports = api; else root.TVData = api;
})(typeof window === 'undefined' ? globalThis : window, function (D) {
  'use strict';
  const API = 'https://office-intranet.architainment-lighting-dns-website-account.workers.dev';
  const name = D.name, day = D.dayKey;
  async function request(url, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw Error('Source HTTP ' + response.status);
      const data = await response.json();
      if (!data || data.error || data.mock || data.is_mock || data.demo || data.is_demo) throw Error('Invalid source response');
      return data;
    } finally { clearTimeout(timer); }
  }
  async function rpc(model, method, args, kwargs = {}) {
    const data = await request(typeof location !== 'undefined' && /^https?:$/.test(location.protocol) ? '/api/signage/odoo' : API + '/odoo/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, method, args, kwargs }) });
    if (method === 'fields_get') {
      if (!data.result || typeof data.result !== 'object' || Array.isArray(data.result)) throw Error('Invalid field metadata');
    } else if (!Array.isArray(data.result) || data.result.some(r => !r || typeof r !== 'object' || Array.isArray(r))) throw Error('Invalid records');
    return data.result;
  }
  async function paged(model, domain, fields) {
    const rows = []; let last = 0;
    for (let page = 0; page < 20; page++) {
      const batch = await rpc(model, 'search_read', [[...domain, ['id', '>', last]]], { fields, order: 'id asc', limit: 200 });
      if (batch.some(r => !Number.isInteger(r.id) || r.id <= last)) throw Error('Invalid pagination');
      rows.push(...batch); if (batch.length < 200) return { rows: unique(rows), partial: false };
      last = Math.max(...batch.map(r => r.id));
    }
    return { rows: unique(rows), partial: true };
  }
  function unique(rows) { return [...new Map(rows.filter(r => Number.isInteger(r.id)).map(r => [r.id, r])).values()]; }
  function addDays(key, amount) { const d = D.date(key); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10); }
  function addMonths(key, amount) {
    const [y, m, d] = key.split('-').map(Number), target = new Date(Date.UTC(y, m - 1 + amount, 1, 12));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d, last)); return target.toISOString().slice(0, 10);
  }
  function londonMidnight(key) {
    let instant = Date.parse(key + 'T00:00:00Z');
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    for (let i = 0; i < 3; i++) {
      const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).filter(p => p.type !== 'literal').map(p => [p.type, +p.value]));
      instant += Date.parse(key + 'T00:00:00Z') - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    }
    return new Date(instant).toISOString().slice(0, 19).replace('T', ' ');
  }
  function week(now = new Date()) { const days = D.days(0, now); return { start: days[0], end: days[6], from: londonMidnight(days[0]), until: londonMidnight(addDays(days[6], 1)) }; }
  function isoWeek(now = new Date()) {
    const d = D.date(day(now)); d.setUTCDate(d.getUTCDate() + 3 - (d.getUTCDay() + 6) % 7);
    return Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1, 12)) / 86400000 + 1) / 7);
  }
  async function metadata(model) { try { return await rpc(model, 'fields_get', [], { attributes: ['type', 'string'] }); } catch (_) { return {}; } }
  async function logistics(kind, now = new Date()) {
    const w = week(now), incoming = kind === 'goods_in', code = incoming ? 'incoming' : 'outgoing';
    const relation = incoming ? 'purchase_id' : 'sale_id';
    const schema = await metadata('stock.picking');
    const optional = ['carrier_id', 'number_of_packages'].filter(k => schema[k]);
    const fields = ['id', 'name', 'partner_id', 'origin', relation, 'state', 'picking_type_code', 'scheduled_date', 'date_done', ...optional];
    const [done, due] = await Promise.all([
      paged('stock.picking', [['picking_type_code', '=', code], ['state', '=', 'done'], ['date_done', '>=', w.from], ['date_done', '<', w.until]], fields),
      paged('stock.picking', [['picking_type_code', '=', code], ['state', 'in', ['draft', 'waiting', 'confirmed', 'assigned']], ['scheduled_date', '>=', w.from], ['scheduled_date', '<', w.until]], fields)
    ]);
    if (incoming) {
      const transfers = [...done.rows, ...due.rows];
      const ids = [...new Set(transfers.map(r => Array.isArray(r.purchase_id) ? r.purchase_id[0] : null).filter(Number.isInteger))];
      const descriptions = new Map();
      // Optional PO context must not hide otherwise valid stock receipt records.
      try {
        for (let i = 0; i < ids.length; i += 100) {
          const orders = await rpc('purchase.order', 'read', [ids.slice(i, i + 100)], { fields: ['id', 'x_project_reference', 'project_id'] });
          orders.forEach(order => descriptions.set(order.id, name(order.x_project_reference) || name(order.project_id)));
        }
      } catch (_) { /* Missing context is explicitly labelled on each card. */ }
      transfers.forEach(r => { r.project_description = descriptions.get(r.purchase_id?.[0]) || ''; });
    }
    return { kind, done: done.rows, due: due.rows, partial: done.partial || due.partial, period: w.start, asOf: Date.now() };
  }
  function logisticsRows(payload, completed, now = new Date()) {
    const w = week(now), incoming = payload.kind === 'goods_in', relation = incoming ? 'purchase_id' : 'sale_id';
    const groups = new Map();
    for (const r of unique(completed ? payload.done : payload.due)) {
      const date = completed ? r.date_done : r.scheduled_date, key = day(date);
      if (!key || key < w.start || key > w.end || r.picking_type_code !== (incoming ? 'incoming' : 'outgoing')) continue;
      if (completed ? r.state !== 'done' || D.date(date) > now : !['draft', 'waiting', 'confirmed', 'assigned'].includes(r.state)) continue;
      const id = !incoming && Array.isArray(r[relation]) ? 'order-' + r[relation][0] : 'transfer-' + r.id;
      const previous = groups.get(id);
      const status = completed ? (incoming ? 'Received' : 'Dispatched') : ({ draft: 'Draft', waiting: 'Waiting', confirmed: 'Awaiting stock', assigned: 'Ready' }[r.state]);
      const record = { id, reference: name(r[relation]) || name(r.origin) || name(r.name), partner: name(r.partner_id) || 'Name not supplied', description: name(r.project_description) || 'Description not supplied', date, status, state: r.state, packages: D.nonnegative(r.number_of_packages), carrier: name(r.carrier_id), count: 1 };
      if (previous) {
        previous.count++;
        if (completed ? D.date(date) > D.date(previous.date) : D.date(date) < D.date(previous.date)) previous.date = date;
        if (previous.status !== status) previous.status = 'Mixed progress';
        previous.packages = previous.packages !== null && record.packages !== null ? previous.packages + record.packages : null;
        if (record.carrier !== previous.carrier) previous.carrier = 'Multiple / unspecified';
      } else groups.set(id, record);
    }
    return [...groups.values()].sort((a, b) => completed ? D.date(b.date) - D.date(a.date) : D.date(a.date) - D.date(b.date));
  }
  async function manufacturing(now = new Date()) {
    const w = week(now), schema = await metadata('mrp.production');
    const optional = ['date_deadline', 'components_availability'].filter(key => schema[key]);
    const fields = ['id', 'name', 'product_id', 'origin', 'state', 'date_start', 'date_finished', ...optional];
    const [done, due] = await Promise.all([
      paged('mrp.production', [['state', '=', 'done'], ['date_finished', '>=', w.from], ['date_finished', '<', w.until]], fields),
      paged('mrp.production', [['state', 'in', ['draft', 'confirmed', 'progress', 'to_close']], ['date_start', '>=', w.from], ['date_start', '<', w.until]], fields)
    ]);
    return { kind: 'manufacturing', done: done.rows, due: due.rows, partial: done.partial || due.partial, period: w.start, asOf: Date.now() };
  }
  function manufacturingRows(payload, completed, now = new Date()) {
    const w = week(now), states = { draft: 'Draft', confirmed: 'Confirmed', progress: 'In progress', to_close: 'To close', done: 'Completed' };
    return unique(completed ? payload.done : payload.due).filter(row => {
      const date = completed ? row.date_finished : row.date_start, key = day(date);
      return key && key >= w.start && key <= w.end && (completed ? row.state === 'done' && D.date(date) <= now : ['draft', 'confirmed', 'progress', 'to_close'].includes(row.state));
    }).map(row => ({ id: row.id, reference: name(row.name) || 'Production order ' + row.id, partner: name(row.product_id).replace(/^\[[^\]]*\]\s*/, '') || name(row.product_id) || 'Product not supplied', description: name(row.origin) || 'Source order not supplied', date: completed ? row.date_finished : row.date_start, deadline: D.date(row.date_deadline) ? row.date_deadline : null, components: name(row.components_availability), status: states[row.state], state: row.state }))
      .sort((a,b) => completed ? D.date(b.date) - D.date(a.date) : D.date(a.date) - D.date(b.date));
  }
  async function subscriptions() {
    const schema = await metadata('sale.order');
    const optional = ['user_id', 'currency_id', 'recurring_total', 'amount_recurring'].filter(k => schema[k]);
    const data = await paged('sale.order', [['subscription_state', 'in', ['3_progress', '4_paused']]], ['id', 'name', 'partner_id', 'project_id', 'client_order_ref', 'plan_id', 'subscription_state', 'start_date', 'end_date', 'next_invoice_date', ...optional]);
    return { kind: 'subscriptions', rows: data.rows, partial: data.partial, asOf: Date.now() };
  }
  function subscriptionRows(payload, now = new Date()) {
    const today = day(now), end = addMonths(today, 3);
    const all = unique(payload.rows).filter(r => ['3_progress', '4_paused'].includes(r.subscription_state));
    const rows = all.map(r => {
      const expiry = D.date(r.end_date) ? r.end_date : null, invoice = D.date(r.next_invoice_date) ? r.next_invoice_date : null;
      return { ...r, due: expiry || invoice, basis: expiry ? 'Contract end' : 'Next invoice', paused: r.subscription_state === '4_paused' };
    });
    return { all: rows, active: rows.filter(r => !r.paused).length, paused: rows.filter(r => r.paused).length, undated: rows.filter(r => !r.due).length, overdue: rows.filter(r => r.due && r.due < today).length,
      upcoming: rows.filter(r => r.due && r.due >= today && r.due <= end).sort((a, b) => a.due.localeCompare(b.due) || a.id - b.id), today, end };
  }
  function validWeather(p) { return p && typeof p.current === 'object' && p.current !== null && Array.isArray(p.daily?.time) && D.numeric(p.current.temperature_2m) !== null; }
  function weatherAge(p, now = Date.now()) {
    const stamp = p.current?.time;
    let observed = null;
    if (typeof stamp === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(stamp)) {
      if (/[Zz]$|[+-]\d\d:\d\d$/.test(stamp)) observed = Date.parse(stamp);
      else {
        const raw = Date.parse(stamp + 'Z');
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(raw)).map(x => [x.type, x.value]));
        observed = raw - (Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second) - raw);
      }
    }
    return Number.isFinite(observed) && observed <= now + 60000 ? observed : null;
  }
  async function weather() {
    const direct = 'https://api.open-meteo.com/v1/forecast?latitude=51.6291&longitude=-0.7493&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max&timezone=Europe%2FLondon&forecast_days=7';
    let fallback;
    for (const url of ['/api/weather', direct]) {
      try {
        const p = await request(url); if (!validWeather(p)) continue;
        const observed = weatherAge(p), value = { ...p, kind: 'weather', asOf: Number(p.fetchedAt) || Date.now(), observed, stale: observed === null || Date.now() - observed > 90 * 60000 };
        if (!fallback || (value.observed || 0) > (fallback.observed || 0)) fallback = value;
        if (!value.stale && p.daily.precipitation_probability_max) return value;
      } catch (_) { /* Preserve the real fallback with its original observation time. */ }
    }
    if (fallback) return fallback;
    throw Error('Weather unavailable');
  }
  function weatherInfo(code) {
    const n = D.numeric(code);
    if (n === 0) return ['Clear sky', 'sun']; if (n === 1) return ['Mainly clear', 'sun'];
    if (n === 2) return ['Partly cloudy', 'cloud']; if (n === 3) return ['Overcast', 'cloud'];
    if ([45, 48].includes(n)) return ['Fog', 'fog'];
    if ([51, 53, 55, 56, 57].includes(n)) return ['Drizzle', 'rain'];
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(n)) return ['Rain', 'rain'];
    if ([71, 73, 75, 77, 85, 86].includes(n)) return ['Snow', 'snow'];
    if ([95, 96, 99].includes(n)) return ['Thunderstorms', 'storm'];
    return ['Conditions unavailable', 'unknown'];
  }
  return { rpc, logistics, logisticsRows, manufacturing, manufacturingRows, subscriptions, subscriptionRows, weather, weatherInfo, week, isoWeek, addDays, addMonths, londonMidnight, unique, validWeather, weatherAge };
});
