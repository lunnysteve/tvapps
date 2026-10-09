/* Browser-only fixtures, never included in the dashboards. */
const { chromium } = require(require('node:path').join(require('node:os').tmpdir(), 'intranet-dashboard-review/node_modules/playwright'));
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'logs/illustration-review', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const stamp = new Date(Date.now() - 3600000).toISOString().slice(0, 19).replace('T', ' ');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const dates = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(today + 'T12:00:00Z') + i * 86400000).toISOString().slice(0, 10));
const weather = { current: { time: today + 'T12:00', temperature_2m: 17, apparent_temperature: 16, relative_humidity_2m: 68, weather_code: 2, is_day: 1, wind_speed_10m: 14 }, daily: { time: dates, weather_code: [2, 0, 61, 3, 95, 71, 45], temperature_2m_max: [18, 20, 16, 17, 15, 11, 14], temperature_2m_min: [9, 10, 8, 8, 7, 2, 6], precipitation_probability_max: [25, 5, 85, 30, 90, 60, 20], sunrise: dates.map(d => d + 'T07:10'), sunset: dates.map(d => d + 'T18:35') } };
weather.current.time = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).replace(' ', 'T');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'text/plain'); res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-webgl'] });
  const report = [];
  try {
    for (const name of ['goods-in-24hrs', 'goods-out-24hrs', 'manufacturing-24hrs', 'subscriptions', 'weather-forecast']) {
      console.log('Review:', name);
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [], requests = []; let failed = false;
      page.on('pageerror', e => errors.push(e.message)); page.on('request', r => requests.push(r.url()));
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/')) return route.continue();
        if (failed) return route.fulfill({ status: 503, body: 'Test source unavailable' });
        if (url.pathname.includes('weather') || url.hostname === 'api.open-meteo.com') return route.fulfill({ json: weather });
        if (!url.pathname.endsWith('/odoo/execute') && url.pathname !== '/api/signage/odoo') return route.abort();
        const q = route.request().postDataJSON(); let result = [];
        assert.ok(['search_read', 'read'].includes(q.method), 'Read-only source access');
        if (q.model === 'stock.picking') result = [{ id: 1, name: 'TEST/TRANSFER/001', state: 'done', picking_type_code: name === 'goods-in-24hrs' ? 'incoming' : 'outgoing', date_done: stamp, sale_id: [1, 'TEST-SO-001'], purchase_id: [1, 'TEST-PO-001'], partner_id: [1, 'TEST FIXTURE supplier'], origin: 'TEST-PO-001' }];
        if (q.model === 'purchase.order') result = [{ id: 1, name: 'TEST-PO-001', x_project_reference: 'Fixture lighting project' }];
        if (q.model === 'sale.order') result = [{ id: 1, name: 'TEST-SO-001', state: 'sale', delivery_status: 'full', partner_id: [1, 'TEST FIXTURE customer'], project_id: [1, 'Fixture lighting project'], subscription_state: '3_progress', end_date: dates[6], next_invoice_date: dates[6], start_date: '2025-01-01', plan_id: [1, 'Cloud services'] }];
        if (q.model === 'mrp.production') result = [{ id: 1, name: 'TEST/MO/001', state: 'done', date_finished: stamp, product_id: [1, '[TEST] Architectural LED profile'], origin: 'TEST-SO-001' }];
        return route.fulfill({ json: { result } });
      });
      for (const [width, height] of [[1920, 1080], [1366, 768]]) {
        await page.setViewportSize({ width, height });
        await page.goto(`http://127.0.0.1:${server.address().port}/dashboards/${name}.html`);
        try { await page.waitForSelector(name === 'weather-forecast' ? '.forecast-day' : '.history-row', { timeout: 10000 }); }
        catch (error) { await page.screenshot({ path: path.join(out, name + '-failure.png') }); console.log({ errors, requests, text: await page.locator('body').innerText() }); throw error; }
        await page.waitForTimeout(300);
        await page.evaluate(() => { const tag = document.createElement('div'); tag.textContent = 'VISUAL REVIEW / TEST FIXTURES'; tag.style.cssText = 'position:fixed;top:0;left:40%;z-index:9999;background:#82331e;color:white;font:12px Arial;padding:4px 12px'; document.body.append(tag); });
        const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth, svg: !!document.querySelector('.r2d,.wx2d'), canvas: document.querySelectorAll('canvas').length, animated: document.getAnimations().filter(a => a.playState === 'running').length, nodes: document.querySelector('.r2d,.wx2d').querySelectorAll('*').length }));
        assert.equal(layout.overflow, false, name + ': viewport overflow'); assert.equal(layout.svg, true); assert.equal(layout.canvas, 0); assert.equal(layout.animated, 0, name + ': reduced motion');
        await page.screenshot({ path: path.join(out, `${name}-${width}.png`) });
        report.push({ name, width, height, ...layout });
      }
      assert.ok(!requests.some(url => /three\.module|visuals\.js|scenes\.js/.test(url)), 'No WebGL bundle downloaded');
      if (name === 'weather-forecast') {
        for (const type of ['sun', 'cloud', 'rain', 'snow', 'storm', 'fog', 'unknown']) {
          await page.evaluate(type => { window.TVAtmosphere = { type, night: type === 'sun', overcast: type === 'cloud', wind: 20 }; dispatchEvent(new Event('tv-atmosphere')); }, type);
          await page.locator('#scene').screenshot({ path: path.join(out, `weather-${type}.png`) });
        }
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => { window.TVAtmosphere = { type: 'rain', night: false, wind: 20 }; dispatchEvent(new Event('tv-atmosphere')); });
        assert.ok(await page.evaluate(() => document.querySelector('.wx2d').getAnimations({ subtree: true }).length <= 3));
      } else {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const before = await page.locator('.r2d').innerHTML(); await page.waitForTimeout(1800);
        assert.notEqual(await page.locator('.r2d').innerHTML(), before, name + ': replay advances');
      }
      failed = true;
      await page.reload();
      await page.waitForTimeout(700);
      assert.ok(await page.locator('.r2d,.wx2d').count(), 'Illustration survives source outage');
      assert.deepEqual(errors, [], name + ': browser errors');
      await context.close();
    }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log('PASS: five screens at 1920x1080 and 1366x768, WebGL disabled, reduced motion, replay movement, seven weather variants, source outage, no browser errors.');
    console.log(out);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
