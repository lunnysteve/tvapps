import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const base = 'https://office-intranet.architainment-lighting-dns-website-account.workers.dev';
const urls = ['/manufacturing', '/purchases', '/sales?type=dispatches', '/subscriptions', '/sales?type=shipping_review', '/blogs', '/weather', 'http://192.168.0.194:7070/api/state'];
const results = await Promise.all(urls.map(async endpoint => {
    try {
        const res = await fetch(endpoint.startsWith('http') ? endpoint : base + endpoint, { signal: AbortSignal.timeout(15000) });
        const data = await res.json();
        const rows = data.orders || data.shipments || [];
        const states = rows.reduce((out, row) => { const key = row.state || row.receipt_status || row.delivery_status || row.subscription_state || 'missing'; out[key] = (out[key] || 0) + 1; return out; }, {});
        let details = data.loadpoints ? data.loadpoints.map(lp => Object.fromEntries(Object.entries(lp).filter(([k]) => /soc|connected|charging|features/i.test(k) && !/title|vehicleName/i.test(k)))) : states;
        if (data.blogs?.length) {
            const original = new URL(data.blogs[0].cover_image_url);
            details = await Promise.all([original.href, 'https://www.architainment.co.uk' + original.pathname, 'https://architainment.co.uk' + original.pathname].map(async url => {
                try { const image = await fetch(url, { signal: AbortSignal.timeout(10000) }); return { host: new URL(url).host, status: image.status, type: image.headers.get('content-type'), finalHost: new URL(image.url).host }; }
                catch (e) { return { host: new URL(url).host, error: e.message }; }
            }));
        }
        return { endpoint, status: res.status, keys: Object.keys(data), records: Array.isArray(data.orders) ? data.orders.length : Array.isArray(data.shipments) ? data.shipments.length : Array.isArray(data.blogs) ? data.blogs.length : Array.isArray(data.loadpoints) ? data.loadpoints.length : null, details, error: data.error ? 'Source returned an error' : null };
    } catch (e) { return { endpoint, error: e.name + ': ' + e.message }; }
}));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
fs.mkdirSync(path.join(root, 'logs/dashboard-review'), { recursive: true });
fs.writeFileSync(path.join(root, 'logs/dashboard-review/source-check.json'), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
console.log(JSON.stringify(results, null, 2));
