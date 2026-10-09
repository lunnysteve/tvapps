const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../../dashboards/_shared/receipt-history.js');
const source = require('../../dashboards/_shared/dispatch-history.js');
const now = Date.now(), stamp = ms => new Date(ms).toISOString().slice(0,19).replace('T',' ');
const receipts = Array.from({length:12},(_,i)=>({id:i+1,name:`IN/TEST/${String(i+1).padStart(4,'0')}`,state:'done',picking_type_code:'incoming',purchase_id:[100+Math.floor(i/2),'PO-TEST'],partner_id:[i+1,`Test supplier ${i+1}`],origin:'PO-TEST',date_done:stamp(now-(i+1)*1800000)}));
const purchases = Array.from({length:6},(_,i)=>({id:100+i,name:`PO-TEST-${i+1}`,receipt_status:'partial',x_project_reference:'Lighting project · test fixture',project_id:false}));
assert.equal(D.normalise(receipts,purchases,now).length,12,'Two receipts against one partial PO remain two deliveries');
assert.equal(D.normalise([...receipts,receipts[0]],purchases,now).length,12);
for(const change of [{state:'assigned'},{state:'cancel'},{state:null},{picking_type_code:'outgoing'},{picking_type_code:'internal'},{date_done:stamp(now-D.DAY-1000)},{date_done:stamp(now+60000)},{date_done:false},{date_done:'2026-09-30'},{date_done:'2026-02-30 10:00:00'}]) assert.equal(D.normalise([{...receipts[0],...change}],purchases,now).length,0,JSON.stringify(change));
assert.equal(D.normalise([{...receipts[0],purchase_id:false}],[],now).length,1,'A genuine receipt without a PO remains visible');
assert.equal(D.timestamp('2026-09-30 12:00:00'),Date.parse('2026-09-30T12:00:00Z'));
assert.equal(D.timestamp('2026-10-25T01:30:00+01:00'),Date.parse('2026-10-25T00:30:00Z'));
async function checkPaging() {
 const original=source.rpc;let calls=0;
 try{
  source.rpc=async(model,method,args,kwargs)=>{
   if(model==='purchase.order')return purchases;
   assert.equal(kwargs.limit,200);assert.ok(args[0].some(x=>x[0]==='picking_type_code'&&x[2]==='incoming'));
   const after=args[0].find(x=>x[0]==='id')[2];
   calls++;
   return calls===1?Array.from({length:200},(_,i)=>({...receipts[0],id:i+1})): [{...receipts[0],id:after+1}];
  };
  const data=await D.load(now);assert.equal(data.jobs.length,201);assert.equal(data.partial,false);assert.equal(calls,2);
  source.rpc=async(model,method,args)=>model==='purchase.order'?purchases:Array.from({length:200},(_,i)=>({...receipts[0],id:args[0].find(x=>x[0]==='id')[2]+i+1}));
  const capped=await D.load(now);assert.equal(capped.partial,true);assert.equal(capped.jobs.length,2000);
 }finally{source.rpc=original;}
 console.log('PASS: receipt rules, partial POs, deduplication, dates/DST, pagination and partial coverage');
}
async function main(){
 await checkPaging();
 const {chromium}=require(path.join(process.env.TEMP,'intranet-dashboard-review/node_modules/playwright'));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const live=process.argv.includes('--live');let mode='normal';let extra=[];
  if(!live)await page.route('**/odoo/execute',async route=>{
   if(mode==='offline')return route.abort();
   const body=route.request().postDataJSON();
   return route.fulfill({json:{result:mode==='empty'?[]:body.model==='stock.picking'?[...receipts,...extra]:purchases}});
  });
  const file='file:///'+path.resolve(__dirname,'../../dashboards/goods-in-24hrs.html').replaceAll('\\','/');
  const out=path.resolve(__dirname,'../../logs/goods-in-review');fs.mkdirSync(out,{recursive:true});
  await page.clock.install({time:now});
  for(const [width,height]of[[1920,1080],[1366,768]]){
   await page.setViewportSize({width,height});await page.goto(file);
   await page.waitForFunction(()=>document.getElementById('source-status').textContent.startsWith('Odoo'),{},{timeout:60000});
   await page.clock.runFor(5500);
   const layout=await page.evaluate(()=>({count:document.getElementById('count').textContent,overflow:document.documentElement.scrollHeight>innerHeight,sceneHeight:document.querySelector('.loading-scene').getBoundingClientRect().height,captionClipped:document.querySelector('.job-caption').scrollWidth>document.querySelector('.job-caption').clientWidth,phase:document.getElementById('phase').textContent}));
   console.log(width,height,layout);assert.equal(layout.overflow,false);assert.equal(layout.captionClipped,false);assert.ok(layout.sceneHeight>200);
   if(!live)assert.equal(layout.count,'12');
   await page.screenshot({path:path.join(out,`${live?'live-':''}${width}.png`)});
  }
  if(live){assert.deepEqual(errors,[]);console.log('PASS: live local-file receipt access and both TV sizes');return;}
  // Restart the scene at a known clock time and inspect each unloading phase.
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  const position=()=>page.evaluate(()=>({forklift:document.getElementById('forklift').transform.baseVal.consolidate().matrix.e,forks:document.getElementById('forks').transform.baseVal.consolidate()?.matrix.f||0,palletX:document.getElementById('pallet').transform.baseVal.consolidate().matrix.e,palletY:document.getElementById('pallet').transform.baseVal.consolidate().matrix.f,lorry:document.getElementById('lorry').transform.baseVal.consolidate().matrix.e,phase:document.getElementById('phase').textContent}));
  let elapsed=0;
  for(const seconds of[2,9,11,13,18,22,26]){
   await page.clock.runFor((seconds-elapsed)*1000);elapsed=seconds;const p=await position();console.log(seconds,p);
   if(seconds===2)assert.ok(Math.abs(p.palletX-p.lorry-753)<1,'Pallet travels with lorry');
   if(seconds>=11&&seconds<=18){assert.ok(Math.abs(p.palletX-p.forklift-210)<1,'Pallet stays on forks horizontally');assert.ok(Math.abs(p.palletY-339-p.forks)<1,'Pallet stays on forks vertically');}
   if(seconds>=22){assert.ok(Math.abs(p.palletX-250)<1);assert.ok(Math.abs(p.palletY-339)<1,'Pallet rests at receiving area ground level');}
   await page.screenshot({path:path.join(out,`phase-${seconds}.png`)});
  }
  const scroll=await page.locator('#history-list').evaluate(e=>e.style.transform);assert.notEqual(scroll,'');
  // New receipts are prioritised at the next replay boundary.
  extra=[{...receipts[0],id:99,name:'NEW-RECEIPT',date_done:stamp(now-10000)}];
  await page.clock.runFor(35000);await page.waitForFunction(()=>document.getElementById('count').textContent==='13');
  let prioritised = await page.locator('#job-reference').textContent() === 'NEW-RECEIPT';
  for(let second=0;second<31&&!prioritised;second++){
   await page.clock.runFor(1000);prioritised=await page.locator('#job-reference').textContent()==='NEW-RECEIPT';
  }
  assert.ok(prioritised,'New receipts must play at the next animation boundary');
  mode='offline';await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForFunction(()=>document.querySelector('.dispatch-screen').classList.contains('is-stale'));
  assert.equal(await page.locator('.history-row').count(),13);assert.match(await page.locator('#source-banner').textContent(),/last-known/);
  await page.emulateMedia({reducedMotion:'reduce'});await page.clock.runFor(100);assert.match(await page.locator('#phase').textContent(),/illustrated replay/);assert.equal(await page.locator('.beacon').evaluate(e=>getComputedStyle(e).animationName),'none');
  mode='empty';await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForFunction(()=>document.getElementById('count').textContent==='0');await page.clock.runFor(100);assert.equal(await page.locator('.history-row').count(),0);assert.match(await page.locator('#history-empty').textContent(),/No/);
  assert.deepEqual(errors,[]);console.log('PASS: animation geometry, scrolling, priority, stale/empty/recovery, reduced motion and browser errors');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
