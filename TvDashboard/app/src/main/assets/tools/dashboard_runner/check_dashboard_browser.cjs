/* Test fixtures only. Production pages never import or fetch these values. */
const { chromium } = require(require('node:path').join(require('node:os').tmpdir(), 'intranet-dashboard-review/node_modules/playwright'));
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const D = require('../../dashboards/_shared/dashboard-data.js');
const root = path.resolve(__dirname, '../..');
const live = process.argv.includes('--live');
const out = path.join(root, 'logs/dashboard-review', live ? 'live' : '');
fs.mkdirSync(out, { recursive: true });
const dates = D.days();
const months = D.months();
const records = Array.from({ length: 23 }, (_, i) => ({
    id: i + 1, name: 'TEST-' + String(i + 1).padStart(4, '0'),
    partner_id: ['North Gallery', 'Riverside Theatre', 'Atrium Studio', 'City Museum'][i % 4],
    product_id: 'Architectural linear lighting / ' + (i + 1), project_id: 'Sample project — ' + (i + 1),
    x_project_reference: 'Project ' + (i + 1), plan_id: 'Service & support',
    date_start: dates[i % 7] + ' 09:00:00', date_deadline: dates[i % 7] + ' 17:00:00',
    commitment_date: dates[i % 7] + ' 12:00:00', date_planned: dates[i % 7] + ' 12:00:00',
    next_invoice_date: months[i % 5] + '-20',
    state: ['done', 'progress', 'confirmed', 'to_close'][i % 4],
    delivery_status: ['full', 'picking', 'ready', 'waiting'][i % 4],
    receipt_status: ['full', 'partial', 'pending'][i % 3],
    subscription_state: ['3_progress', 'draft', '4_paused', '3_progress'][i % 4],
    components_availability: i % 5 === 0 ? 'Late' : 'Available'
}));
records.push({ ...records[0], id: 24, name: 'TEST-0024', date_start: false, date_deadline: false, commitment_date: false, date_planned: false, next_invoice_date: false, state: 'confirmed', receipt_status: 'pending', delivery_status: 'pending', subscription_state: '3_progress' });
const loadpoints = [
    { title: 'Bay 01', vehicleTitle: 'Vehicle A', connected: true, charging: true, chargePower: 7400, sessionEnergy: 18320, vehicleSoc: 64, mode: 'now' },
    { title: 'Bay 02', vehicleTitle: 'Vehicle B', connected: true, charging: true, chargePower: 3600, sessionEnergy: 6450, vehicleSoc: 38, mode: 'pv' },
    { title: 'Bay 03', connected: false, charging: false, chargePower: 0, sessionEnergy: 0, vehicleSoc: -1, mode: 'off' }
];
const day = D.date(D.dayKey());
const forecastDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(day); d.setUTCDate(d.getUTCDate() + i); return D.dayKey(d); });
const weather = { current: { temperature_2m: 18, apparent_temperature: 17, relative_humidity_2m: 68, wind_speed_10m: 12, pressure_msl: 1018, weather_code: 2, is_day: 1, time: D.dayKey() + 'T12:00' }, daily: { time: forecastDates, weather_code: [2, 0, 3, 61, 2, 1, 3], temperature_2m_min: [10, 11, 12, 9, 8, 10, 9], temperature_2m_max: [18, 20, 17, 15, 17, 19, 16], sunrise: forecastDates.map(d => d + 'T06:50'), sunset: forecastDates.map(d => d + 'T18:55') } };
const shipping = { ytdThisYear: 248.5, totalLastYear: 320, ordersThisYear: 890, ordersLastYear: 1100, avgWeight: 0.28, weighedProducts: 421, unweighedProducts: 29, monthlyThisYear: [21, 24, 30, 25, 36, 32, 31, 29, 20.5, 0, 0, 0], monthlyLastYear: [22, 21, 28, 25, 31, 26, 29, 25, 26, 23, 30, 34] };
const only = process.argv.find(x => x.startsWith('--only='))?.slice(7).split(',');
// Studio pages only. The 3D pages and weather-forecast have their own DOM; see check_goods_in, check_dispatch_loading and check_tv_screens.
const studioPages = ['charging-status', 'digital-clock', 'end-of-day', 'lunch-timer', 'shipping_weight-overview', 'website_projects'];
const pages = studioPages.map(x => x + '.html').filter(x => !only || only.includes(x.replace('.html', '')));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + requested);
    if (!file.startsWith(path.join(root, 'dashboards') + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
    const results = [], errors = [];
    try {
        for (const viewport of (live ? [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }] : [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 390, height: 844 }])) {
            const context = await browser.newContext({ viewport, timezoneId: 'America/New_York', reducedMotion: 'reduce' }); // Dates must still be London.
            let offline = false, invalid = false;
            await context.route('**/*', async route => {
                const url = new URL(route.request().url());
                if (url.hostname === '127.0.0.1' && url.pathname !== '/api/weather') return route.continue();
                if (live) return route.continue();
                if (url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) return route.continue();
                if (offline) return route.fulfill({ status: 503, body: '{}' });
                let body;
                if (url.pathname === '/api/state') body = { siteTitle: 'TEST FIXTURES', loadpoints };
                else if (url.pathname.includes('weather')) body = weather;
                else if (url.pathname === '/manufacturing') body = { orders: records };
                else if (url.pathname === '/purchases' || url.pathname === '/subscriptions') body = { shipments: records };
                else if (url.pathname === '/sales') body = url.searchParams.get('type') === 'shipping_review' ? shipping : { shipments: records };
                else return route.abort();
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify(invalid ? { error: 'upstream failed' } : body) });
            });
            const page = await context.newPage();
            page.on('pageerror', e => errors.push(e.message));
            page.on('requestfailed', req => { if (live && req.resourceType() === 'image') console.log('Image request failed:', new URL(req.url()).host, req.failure()?.errorText); });
            for (const file of pages) {
                await page.goto(base + '/dashboards/' + file);
                await page.waitForFunction(() => !document.querySelector('.skeleton'), null, { timeout: 45000 });
                await page.evaluate(() => document.fonts.ready);
                if (file === 'website_projects.html') await page.waitForFunction(() => [...document.images].every(img => img.complete), null, { timeout: 20000 });
                await page.waitForTimeout(100);
                const layout = await page.evaluate(() => ({
                    width: document.documentElement.scrollWidth,
                    height: document.documentElement.scrollHeight,
                    content: document.getElementById('content').innerText,
                    heading: document.querySelector('h1')?.innerText,
                    badNumbers: /\bNaN\b|\bundefined\b/.test(document.getElementById('content').innerText),
                    unavailable: !!document.querySelector('.screen-error'),
                    clipped: [...document.querySelectorAll('.panel > :last-child,.planner-card > :last-child')].filter(el => { const panel = el.parentElement; return panel && el.getBoundingClientRect().bottom > panel.getBoundingClientRect().bottom - 2; }).map(el => el.className),
                    controls: document.querySelectorAll('button,a[href],input,select').length
                }));
                assert.ok(!layout.badNumbers, file + ': invalid value displayed');
                assert.equal(layout.controls, 0, file + ': unattended displays must not require controls');
                assert.ok(layout.width <= viewport.width + 1, file + ': horizontal overflow ' + layout.width);
                if (viewport.width >= 1100 && layout.height > viewport.height + 2) errors.push(`${file} ${viewport.width}x${viewport.height}: vertical overflow ${layout.height}`);
                if (layout.clipped.length) errors.push(`${file} ${viewport.width}: clipped ${layout.clipped.join(', ')}`);
                if (!live && file === 'charging-status.html') assert.match(layout.content, /11\.0/, 'Watts must be converted to kW');
                if (!live) await page.evaluate(() => { const tag = document.createElement('div'); tag.id = 'test-watermark'; tag.textContent = 'LAYOUT PREVIEW · TEST DATA'; tag.style.cssText = 'position:fixed;right:12px;bottom:2px;font:9px sans-serif;color:#829097;z-index:9999;pointer-events:none'; document.body.append(tag); });
                if (viewport.width !== 390 || ['charging-status.html', 'digital-clock.html'].includes(file)) await page.screenshot({ path: path.join(out, file.replace('.html', '') + '-' + viewport.width + '.png'), fullPage: true });
                results.push({ file, viewport, height: layout.height, width: layout.width, unavailable: layout.unavailable });
            }
            if (!live && viewport.width === 1366) {
                await page.clock.install();
                await page.goto(base + '/dashboards/website_projects.html');
                await page.waitForSelector('.case');
                const titles = await page.evaluate(() => window.ProjectStories.projects.map(p => p.title));
                await page.evaluate(() => localStorage.removeItem('architainment-projects-progress'));
                await page.reload(); await page.waitForSelector('.case');
                await page.clock.runFor(30000);
                assert.equal(await page.locator('.case-title-block h2').innerText(), titles[0], 'A case study must not give way before its text has been shown');
                await page.evaluate(slug => localStorage.setItem('architainment-projects-progress', JSON.stringify({ slug, y: 1e6 })), await page.evaluate(() => window.ProjectStories.projects[0].slug));
                await page.reload(); await page.waitForSelector('.case');
                assert.equal(await page.locator('.case-title-block h2').innerText(), titles[0], 'Saved reading position must survive the rotation reload');
                await page.clock.runFor(40000);
                assert.equal(await page.locator('.case-title-block h2').innerText(), titles[1], 'The next case study follows once the last line has been shown');
                await page.clock.setFixedTime(new Date('2026-10-25T12:00:00Z'));
                await page.goto(base + '/dashboards/end-of-day.html');
                await page.waitForSelector('.countdown-digits');
                assert.deepEqual(await page.locator('.countdown-digits b').allTextContents(), ['29', '30', '00'], 'Sunday after DST must target Monday 17:30 London time');
                await page.clock.setFixedTime(new Date('2026-09-25T16:30:00Z'));
                await page.reload();
                await page.waitForSelector('.countdown-digits');
                assert.match(await page.locator('.countdown-copy h2').innerText(), /Enjoy your evening/, 'Hometime completion must not jump immediately to tomorrow');
            }
            await context.close();
        }
        fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2));
        console.log(JSON.stringify({ pages: pages.length, checks: results.length, errors, screenshots: out }, null, 2));
        assert.equal(errors.length, 0, errors.join('\n'));
    } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
