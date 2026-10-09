/* Isolated browser fixtures: verify truck clearance and real-source weather
   failure/recovery behaviour. None of these records ship in the dashboards. */
const { chromium } = require(require('node:path').join(require('node:os').tmpdir(), 'intranet-dashboard-review/node_modules/playwright'));
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'logs/warehouse-review', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'text/plain'); res.end(fs.readFileSync(file));
});
const stamp = new Date(Date.now() - 3600000).toISOString().slice(0, 19).replace('T', ' ');
const observed = new Date().toISOString();
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const makeWeather = (code, isDay) => ({ current: { time: observed, weather_code: code, is_day: isDay, temperature_2m: 12, wind_speed_10m: 18 }, daily: { time: [today], sunrise: [today + 'T07:00'], sunset: [today + 'T18:35'], precipitation_probability_max: [30] } });
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-webgl'] });
  try {
    // Sample the actual SVG poses, testing the fork tips, mast and cargo against
    // the illustrated truck deck rather than asserting a particular track list.
    for (const kind of ['goods_in', 'goods_out']) {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
      await page.setContent('<body style="margin:0;background:#10212b;color:white;font:18px Arial"><p style="text-align:center">WAREHOUSE REPLAY / TEST FIXTURE</p><div id="host" style="width:1200px;height:500px;margin:auto"></div></body>');
      await page.addScriptTag({ path: path.join(root, 'dashboards/_shared/replay-artwork.js') });
      await page.addScriptTag({ path: path.join(root, 'dashboards/_shared/replay-2d.js') });
      const frames = await page.evaluate(kind => {
        window.review = Replay2D.create(document.getElementById('host'), kind);
        review.label({ reference: 'TEST-001', supplier: 'Fixture supplier <img>', project: 'Fixture architectural project reference' });
        const pose = t => {
          review.render(27.9); review.render(t);
          const state = part => { const el = document.querySelector('[data-p="' + part + '"]'), s = getComputedStyle(el), transform = s.transform, opacity = s.opacity, m = new DOMMatrix(transform); el.style.transition = 'none'; el.style.transform = transform; el.style.opacity = opacity; return { x: m.e, y: m.f, scale: m.a, opacity: Number(opacity) }; };
          return { t, fork: state('fork'), carriage: state('carriage'), pallet: state('pallet'), lorry: state('lorry'), shutter: state('shutter') };
        };
        window.poseForReview = pose;
        return Array.from({ length: 85 }, (_, i) => pose(i / 4));
      }, kind);
      for (const f of frames) {
        const rear = f.lorry.x, tineStart = f.fork.x + 168, tineEnd = f.fork.x + 286;
        if (tineEnd > rear + .1 && tineStart < rear + 346) {
          assert.ok(426 + f.carriage.y <= 330.1, `${kind} ${f.t}s: forks intersect truck deck`);
          assert.ok(f.fork.x + 162 <= rear - 5, `${kind} ${f.t}s: mast reaches truck body`);
        }
        if (f.pallet.opacity > .5 && f.pallet.x + 124 * f.pallet.scale > rear + .1 && f.pallet.x < rear + 346) assert.ok(f.pallet.y <= 330.1, `${kind} ${f.t}s: pallet collides with truck deck`);
      }
      const detail = await page.locator('.r2-detail').getAttribute('aria-label');
      assert.equal(detail, kind === 'goods_in' ? 'Fixture supplier <img>' : 'Fixture architectural project reference');
      assert.equal(await page.locator('.r2d image').count(), 0, 'Source labels render as text');
      if (kind === 'goods_in') {
        const end = await page.evaluate(() => poseForReview(24.6));
        assert.equal(end.pallet.opacity, 0); assert.ok(end.shutter.y < -180, 'Pallet inside before door closes');
      }
      for (const t of kind === 'goods_in' ? [6.5, 8.5, 10, 13.5, 23.3] : [9.5, 13, 16.5, 18.5]) {
        await page.evaluate(t => poseForReview(t), t);
        await page.screenshot({ path: path.join(out, `${kind}-${t}.png`) });
      }
      console.log('PASS:', kind, '85 poses: forks, mast and pallet clear truck; source labels; warehouse transfer');
      await page.close();
    }
  for (const name of ['goods-in-24hrs', 'goods-out-24hrs', 'subscriptions']) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      let weather = makeWeather(61, 0), offline = false, weatherRequests = 0;
      await context.addInitScript(() => {
        let value;
        Object.defineProperty(window, 'WarehouseWeather', { configurable: true, get: () => value, set: api => { const mount = api.mount; api.mount = (...args) => { const handle = mount(...args); window.weatherForReview = handle; return handle; }; value = api; } });
      });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/')) return route.continue();
        if (url.pathname.includes('weather') || url.hostname === 'api.open-meteo.com') { weatherRequests++; return route.fulfill(offline ? { status: 503, body: 'Test source unavailable' } : { json: weather }); }
        if (url.pathname !== '/api/signage/odoo') return route.abort();
        const q = route.request().postDataJSON(); assert.ok(['search_read', 'read'].includes(q.method));
      const result = q.model === 'stock.picking' ? [{ id: 1, name: 'TEST/001', state: 'done', picking_type_code: name === 'goods-in-24hrs' ? 'incoming' : 'outgoing', date_done: stamp, sale_id: [1, 'TEST-SO'], purchase_id: [1, 'TEST-PO'], partner_id: [1, 'Fixture supplier'] }] : q.model === 'purchase.order' ? [{ id: 1, name: 'TEST-PO' }] : [{ id: 1, name: 'TEST-SO', state: 'sale', delivery_status: 'full', partner_id: [1, 'Fixture customer'], project_id: [1, 'Fixture project reference'], subscription_state: '3_progress', end_date: '2026-12-01', next_invoice_date: '2026-12-01', plan_id: [1, 'Cloud services'] }];
        return route.fulfill({ json: { result } });
      });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/dashboards/${name}.html`);
      await page.waitForSelector('.history-row'); await page.waitForFunction(() => document.querySelector('.r2d').dataset.weather === 'rain');
      await page.evaluate(() => { const tag = document.createElement('div'); tag.textContent = 'WEATHER REVIEW / TEST FIXTURE'; tag.style.cssText = 'position:fixed;top:0;left:40%;z-index:9999;background:#82331e;color:white;font:12px Arial;padding:4px 12px'; document.body.append(tag); });
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.r2d').getAttribute('data-weather-night'), 'true');
      assert.ok(await page.locator('.warehouse-rain').count());
    if (name !== 'subscriptions') {
      const animations = await page.locator('.r2-beacon').evaluate(el => el.getAnimations({ subtree: true }));
      assert.ok(animations.length > 0, 'Beacon rotates with normal motion');
    } else {
      await page.evaluate(() => {
        const customer = 'A very long customer organisation name with multiple divisions and architectural lighting departments';
        const project = 'Detailed project reference for a large customer building and its cloud lighting controls';
        const host = document.createElement('div');
        host.style.cssText = 'width:1000px'; document.body.append(host);
        const mount = WarehouseWeather.mount;
        WarehouseWeather.mount = () => {};
        const scene = Replay2D.create(host, 'subscriptions');
        WarehouseWeather.mount = mount;
        scene.label({ customer, project });
        const svg = host.querySelector('svg');
        for (const text of svg.querySelectorAll('.site-name,.site-customer tspan')) {
          const box = text.getBBox();
          if (box.width > 345 || box.x < 815 || box.x + box.width > 1163) throw new Error('Customer label clips: ' + JSON.stringify({ text: text.textContent, x: box.x, width: box.width, font: getComputedStyle(text).fontSize, textLength: text.getAttribute('textLength') }));
        }
        if (svg.querySelector('.site-customer').getAttribute('aria-label') !== customer) throw new Error('Customer was truncated');
        const roof = svg.querySelector('.r2-site-roof');
        const architecture = svg.querySelector('.r2-service-architecture');
        if (!(architecture.compareDocumentPosition(roof) & Node.DOCUMENT_POSITION_FOLLOWING)) throw new Error('Roof equipment hidden by architecture');
        host.remove();
      });
    }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0, 'Reduced motion disables beacon and weather motion');
      await page.screenshot({ path: path.join(out, name + '-rain-night.png') });
      for (const [code, isDay, type] of [[0, 1, 'sun'], [0, 0, 'sun'], [2, 1, 'cloud'], [3, 1, 'cloud'], [71, 1, 'snow'], [45, 1, 'fog'], [95, 0, 'storm']]) {
        weather = makeWeather(code, isDay); await page.evaluate(() => weatherForReview.refresh());
        assert.equal(await page.locator('.r2d').getAttribute('data-weather'), type);
        assert.equal(await page.locator('.r2d').getAttribute('data-weather-night'), String(isDay === 0));
        await page.locator('.loading-scene').screenshot({ path: path.join(out, `${name}-${code}-${isDay}.png`) });
      }
      // Preserve real last-known conditions on failure, visibly stale, then recover.
      offline = true; await page.evaluate(() => weatherForReview.refresh());
      assert.equal(await page.locator('.r2d').getAttribute('data-weather'), 'storm');
      assert.equal(await page.locator('.r2d').getAttribute('data-weather-stale'), 'true');
      assert.match(await page.locator('.warehouse-weather-status').textContent(), /STALE WEATHER/);
      offline = false; weather = makeWeather(0, 1); await page.evaluate(() => weatherForReview.refresh());
      assert.equal(await page.locator('.r2d').getAttribute('data-weather-stale'), 'false');
      // Unknown codes and missing day/night do not create clear-sky weather.
      weather = makeWeather(null, null); weather.daily.sunrise = []; weather.daily.sunset = [];
      await page.evaluate(() => weatherForReview.refresh());
      assert.equal(await page.locator('.r2d').getAttribute('data-weather'), 'unknown');
      assert.equal(await page.locator('.r2d').getAttribute('data-weather-night'), 'unknown');
      // Hidden TV tabs pause CSS animations and do not fetch weather.
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const before = weatherRequests;
      await page.evaluate(async () => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); await weatherForReview.refresh(); });
      assert.equal(weatherRequests, before);
      assert.equal(await page.locator('.r2d').evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length), 0);
      assert.deepEqual(errors, []);
    console.log('PASS:', name, 'weather variants, stale retention and recovery, source labels,', name === 'subscriptions' ? 'roof layering and long customer labels,' : 'beacon,', 'reduced motion and hidden-tab pause');
      await context.close();
    }
    console.log(out);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); server.close(); process.exitCode = 1; });
