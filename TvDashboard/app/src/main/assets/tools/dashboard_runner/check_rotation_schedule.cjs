/* Loads the real runner with the real rotation_config.json at boundary times (London time, including the October clock change) and checks which dashboard it shows. */
const { chromium } = require(require('node:path').join(require('node:os').tmpdir(), 'intranet-dashboard-review/node_modules/playwright'));
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/config') { res.setHeader('Content-Type', 'application/json'); res.end(fs.readFileSync(path.join(root, 'rotation_config.json'))); return; }
  if (p.startsWith('/api/')) { res.setHeader('Content-Type', 'application/json'); res.end('{}'); return; }
  const f = path.resolve(root, '.' + p); if (!f.startsWith(root) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(f)] || 'text/plain'); res.end(fs.readFileSync(f));
});
const AFTER = 'after-hours', LUNCH = 'lunch-timer', HOME = 'end-of-day', BIZ = 'charging-status';
// [label, UTC instant, expected page]. October 2026 is BST, so London local = UTC + 1h.
const T = [
  ['Mon 00:00', '2026-10-04T23:00:00Z', AFTER], ['Mon 00:30', '2026-10-04T23:30:00Z', AFTER], ['Mon 05:59', '2026-10-05T04:59:00Z', AFTER],
  ['Mon 06:00', '2026-10-05T05:00:00Z', BIZ], ['Mon 10:00', '2026-10-05T09:00:00Z', BIZ], ['Mon 12:59', '2026-10-05T11:59:00Z', BIZ],
  ['Mon 13:00', '2026-10-05T12:00:00Z', LUNCH], ['Mon 13:59', '2026-10-05T12:59:00Z', LUNCH], ['Mon 14:00 (end is exclusive)', '2026-10-05T13:00:00Z', BIZ], ['Mon 14:01', '2026-10-05T13:01:00Z', BIZ],
  ['Tue 17:14', '2026-10-06T16:14:00Z', BIZ], ['Tue 17:15', '2026-10-06T16:15:00Z', HOME], ['Tue 17:29', '2026-10-06T16:29:00Z', HOME], ['Tue 17:30 (end is exclusive)', '2026-10-06T16:30:00Z', AFTER], ['Tue 17:31', '2026-10-06T16:31:00Z', AFTER],
  ['Wed 22:30', '2026-10-07T21:30:00Z', AFTER], ['Thu 03:15', '2026-10-08T02:15:00Z', AFTER],
  ['Fri 09:00', '2026-10-09T08:00:00Z', BIZ], ['Fri 13:30', '2026-10-09T12:30:00Z', LUNCH], ['Fri 17:20', '2026-10-09T16:20:00Z', HOME], ['Fri 18:00', '2026-10-09T17:00:00Z', AFTER], ['Fri 23:59', '2026-10-09T22:59:00Z', AFTER],
  ['Sat 00:00', '2026-10-09T23:00:00Z', AFTER], ['Sat 06:30', '2026-10-10T05:30:00Z', AFTER], ['Sat 10:00', '2026-10-10T09:00:00Z', AFTER], ['Sat 13:30', '2026-10-10T12:30:00Z', AFTER], ['Sat 17:20', '2026-10-10T16:20:00Z', AFTER],
  ['Sun 09:00', '2026-10-11T08:00:00Z', AFTER], ['Sun 13:30', '2026-10-11T12:30:00Z', AFTER], ['Sun 17:20', '2026-10-11T16:20:00Z', AFTER], ['Sun 23:59', '2026-10-11T22:59:00Z', AFTER],
  ['Mon 00:00 (after Sun)', '2026-10-11T23:00:00Z', AFTER],
  // clocks go back on Sunday 25 Oct 2026: London is GMT (UTC+0) from then
  ['Mon 26 Oct 06:00 GMT', '2026-10-26T06:00:00Z', BIZ], ['Mon 26 Oct 05:59 GMT', '2026-10-26T05:59:00Z', AFTER],
];
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  let fail = 0;
  for (const [label, iso, want] of T) {
    for (const screen of ['default', 'tv2']) {
      if (screen === 'tv2' && !/Sat 10:00|Tue 17:31|Mon 10:00/.test(label)) continue;
      const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: 'Europe/London' });
      const page = await ctx.newPage(); await page.clock.setFixedTime(new Date(iso));
      await page.goto(`${base}/tools/dashboard_runner/dashboard_runner.html?screen=${screen}`);
      await page.waitForFunction(() => { const f = document.querySelector('iframe'); return f && /\.html/.test(f.getAttribute('src') || ''); }, null, { timeout: 8000 }).catch(() => {});
      const src = await page.evaluate(() => (document.querySelector('iframe')?.getAttribute('src')) || '(none)');
      const ok = src.includes(want + '.html'); if (!ok) fail++;
      console.log(ok ? 'PASS' : 'FAIL', label.padEnd(24), screen.padEnd(8), src);
      await ctx.close();
    }
  }
  await browser.close(); server.close(); console.log(fail ? fail + ' FAILURES' : 'ALL SCHEDULE CHECKS PASSED'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
