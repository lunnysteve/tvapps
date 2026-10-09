const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../../dashboards/_shared/dispatch-history.js');
const now = Date.now(), stamp = ms => new Date(ms).toISOString().slice(0,19).replace('T',' ');
const transfers = Array.from({length:12},(_,i)=>({id:i+1,name:`OUT/TEST/${i+1}`,state:'done',picking_type_code:'outgoing',sale_id:[i+100,`TEST-${i+1}`],date_done:stamp(now-(i+1)*1800000)}));
const orders = transfers.map((row,i)=>({id:row.sale_id[0],name:`TEST-${String(i+1).padStart(4,'0')}`,state:'sale',delivery_status:'full',partner_id:[i+1,`Layout test customer ${i+1}`],project_id:[i+1,'Lighting project · test fixture'],client_order_ref:false}));
const base = D.normalise(transfers,orders,now);
assert.equal(base.length,12);
assert.equal(D.normalise([...transfers,transfers[0]],orders,now).length,12);
assert.equal(D.normalise([{...transfers[0],date_done:stamp(now-D.DAY-1000)}],orders,now).length,0);
assert.equal(D.normalise([{...transfers[0],date_done:stamp(now+60000)}],orders,now).length,0);
assert.equal(D.normalise([{...transfers[0],date_done:'2026-09-30'}],orders,now).length,0);
for(const change of [{state:'assigned'},{picking_type_code:'internal'},{sale_id:false}]) assert.equal(D.normalise([{...transfers[0],...change}],orders,now).length,0);
for(const change of [{delivery_status:'partial'},{delivery_status:'unknown'},{state:'cancel'}]) assert.equal(D.normalise([transfers[0]],[{...orders[0],...change}],now).length,0);
assert.equal(D.timestamp('2026-09-30 12:00:00'),Date.parse('2026-09-30T12:00:00Z'));
console.log('PASS: completion rules, deduplication, rolling window, UTC and invalid/missing dates');
if(process.argv.includes('--live')) {
  D.load().then(data=>console.log(JSON.stringify({liveJobs:data.jobs.length,partial:data.partial,asOf:new Date(data.asOf).toISOString()}))).catch(e=>{console.error(e);process.exitCode=1});
} else {
  const {chromium} = require(path.join(process.env.TEMP,'intranet-dashboard-review/node_modules/playwright'));
  (async()=>{
    const browser = await chromium.launch({headless:true,channel:'msedge'});
    try {
      const page = await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      let offline=false;
      await page.route('**/odoo/execute',async route=>{
        if(offline) return route.abort();
        const body=route.request().postDataJSON();
        await route.fulfill({json:{result:body.model==='stock.picking'?transfers:orders}});
      });
      const file='file:///'+path.resolve(__dirname,'../../dashboards/goods-out-24hrs.html').replaceAll('\\','/');
      const out=path.resolve(__dirname,'../../logs/dispatch-review'); fs.mkdirSync(out,{recursive:true});
      for(const [width,height] of [[1920,1080],[1366,768]]) {
        await page.setViewportSize({width,height}); await page.goto(file); await page.waitForFunction(()=>document.querySelectorAll('.history-row').length===12);
        await page.waitForTimeout(5500);
        const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollHeight>innerHeight,sceneHeight:document.querySelector('.loading-scene').getBoundingClientRect().height,listScrolls:document.getElementById('history-list').scrollHeight>document.getElementById('history-viewport').clientHeight,phase:document.getElementById('phase').textContent,ref:document.getElementById('box-ref').textContent,bar:document.getElementById('source-banner').hidden}));
        console.log(width,height,layout); assert.equal(layout.overflow,false);assert.ok(layout.sceneHeight>200);assert.equal(layout.listScrolls,true);assert.equal(layout.ref,'TEST-0001');assert.equal(layout.bar,true);
        await page.screenshot({path:path.join(out,`${width}.png`)});
      }
      await page.waitForTimeout(9500);
      assert.equal(await page.locator('#phase').textContent(),'Loading the van');
      await page.screenshot({path:path.join(out,'loading.png')});
      offline=true; await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange'))); await page.waitForFunction(()=>document.querySelector('.dispatch-screen').classList.contains('is-stale'));
      assert.equal(await page.locator('.history-row').count(),12);
      assert.match(await page.locator('#source-banner').textContent(),/last-known/);
      await page.emulateMedia({reducedMotion:'reduce'}); await page.waitForTimeout(100);
      assert.match(await page.locator('#phase').textContent(),/illustrated replay/);
      assert.deepEqual(errors,[]);
      console.log('PASS: both TV sizes, scrolling, pickup/loading animation, stale retention, reduced motion, no browser errors');
    } finally {await browser.close();}
  })().catch(e=>{console.error(e);process.exitCode=1});
}
