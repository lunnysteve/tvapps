/* Isolated fixture checks. No fixture data is shipped in the display code. */
const { chromium } = require(require('node:path').join(require('node:os').tmpdir(), 'intranet-dashboard-review/node_modules/playwright'));
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const D = require('../../dashboards/_shared/dashboard-data.js'), T = require('../../dashboards/_shared/tv-signage/data.js');
const out = path.join(root, 'logs/tv-screens-review'); fs.mkdirSync(out, { recursive: true });
const live = process.argv.includes('--live'), today = D.dayKey(), w = T.week();
const only = process.argv.find(arg=>arg.startsWith('--only='))?.slice(7).split(',');
const localFile = process.argv.includes('--file');
const pageUrl = (base,name) => localFile ? require('node:url').pathToFileURL(path.join(root,'dashboards/tv-screens',name+'.html')).href : base+'/dashboards/tv-screens/'+name+'.html';
assert.equal(T.londonMidnight('2026-10-26'), '2026-10-26 00:00:00');
assert.equal(T.londonMidnight('2026-10-19'), '2026-10-18 23:00:00');
assert.equal(T.londonMidnight('2026-03-30'), '2026-03-29 23:00:00');
assert.equal(T.addMonths('2026-11-30', 3), '2027-02-28');
assert.equal(T.isoWeek(new Date('2027-01-01T12:00:00Z')), 53);
const dates = Array.from({ length: 7 }, (_, i) => { const d = D.date(today); d.setUTCDate(d.getUTCDate()+i); return D.dayKey(d); });
const weather = { current: { temperature_2m: 17, relative_humidity_2m: 68, apparent_temperature: 16, wind_speed_10m: 14, weather_code: 2, is_day: 1, time: today+'T12:00' }, daily: { time: dates, weather_code: [2,0,61,3,95,71,45], temperature_2m_max: [18,20,16,17,15,11,14], temperature_2m_min: [9,10,8,8,7,2,6], sunrise: dates.map(d=>d+'T07:10'), sunset: dates.map(d=>d+'T18:35'), precipitation_probability_max: [25,5,85,30,90,60,20] } };
const instant = new Date(Date.now()-60000).toISOString().slice(0,19).replace('T',' ');
const receipts = (incoming, done) => Array.from({length:11},(_,i)=>({id:i+1+(done?0:100),name:(incoming?'WH/IN/':'WH/OUT/')+(i+1),partner_id:[i+1,i===0?'<img src=x onerror="window.injected=true"> Example supplier':'TEST FIXTURE · '+['Lighting supply','Riverside theatre','Central gallery','Project partner'][i%4]], origin:(incoming?'PO':'SO')+(25000+i),[incoming?'purchase_id':'sale_id']:[i+1,(incoming?'PO':'SO')+(25000+i)],state:done?'done':['assigned','waiting','confirmed'][i%3],picking_type_code:incoming?'incoming':'outgoing',date_done:done?instant:false,scheduled_date:today+' 09:00:00',carrier_id:[1,'TEST carrier'],number_of_packages:i}));
const contracts = Array.from({length:11},(_,i)=>({id:i+1,name:'SO'+(24000+i),partner_id:[i+1,'TEST customer '+(i+1)],project_id:[i+1,['Cloud lighting services','Remote access & support','Control system subscription','Connected infrastructure'][i%4]],plan_id:[1,'Annual service'],subscription_state:i%4===0?'4_paused':'3_progress',start_date:'2025-01-01',end_date:i%2?false:today,next_invoice_date:today,user_id:[1,'TEST owner'],currency_id:[1,'GBP'],recurring_total:i===0?0:250+i*25}));
const report={mode:live?'LIVE':'FIXTURES ONLY',screens:[]};
const production = done => Array.from({length:11},(_,i)=>({id:i+1+(done?0:100),name:'WH/MO/'+String(1200+i),product_id:[i+1,'TEST · Linear architectural luminaire '+(i+1)],origin:'SO'+(15000+i),state:done?'done':['confirmed','progress','to_close','draft'][i%4],date_start:today+' 09:00:00',date_finished:done?instant:false,date_deadline:today+' 17:00:00',components_availability:'Available'}));
const productionSample = production(true)[0];
assert.equal(T.manufacturingRows({done:[productionSample,productionSample,{...productionSample,id:900,state:'to_close'},{...productionSample,id:901,date_finished:'2099-01-01 00:00:00'}],due:[]},true).length,1,'Only unique actually completed production orders');
assert.equal(T.manufacturingRows({done:[],due:[...production(false),{...production(false)[0],id:999,state:'unknown'}]},false).length,11,'Unknown production states excluded');
assert.equal(T.manufacturingRows({done:[],due:[{...production(false)[0],date_deadline:false}]},false)[0].deadline,null,'Missing deadlines are not inferred');
const sample=receipts(true,true)[0];
const normal=T.logisticsRows({kind:'goods_in',done:[sample,sample,{...sample,id:999,date_done:'2099-01-01 12:00:00'}],due:[]},true);
assert.equal(normal.length,1);assert.equal(normal[0].packages,0);
assert.equal(T.subscriptionRows({rows:[...contracts,contracts[0],{id:999,subscription_state:'unknown'}]}).all.length,11);
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    for(const name of ['weather','time','goods_in','warehouse','subscriptions','manufacturing'].filter(name=>!only||only.includes(name))){
      const context=await browser.newContext({viewport:{width:1920,height:1080},timezoneId:'America/New_York'});
      let fail=false,empty=false;const errors=[];
      if(!live)await context.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if((url.hostname==='127.0.0.1'||url.protocol==='file:')&&!url.pathname.endsWith('/api/weather'))return route.continue();
        if(fail)return route.fulfill({status:503,body:'Offline'});
        let result;
        if(url.pathname.includes('weather')||url.hostname==='api.open-meteo.com')result=weather;
        else if(url.pathname==='/odoo/execute'){
          const q=route.request().postDataJSON();assert.ok(['fields_get','search_read','read'].includes(q.method),'Only read-only operations');
          if(q.method==='fields_get')result={result:{carrier_id:{type:'many2one'},number_of_packages:{type:'integer'},user_id:{type:'many2one'},currency_id:{type:'many2one'},recurring_total:{type:'float'},date_deadline:{type:'datetime'},components_availability:{type:'char'}}};
          else if(empty)result={result:[]};
          else if(q.model==='purchase.order')result={result:q.args[0].map(id=>({id,x_project_reference:'TEST · Architectural lighting project',project_id:false}))};
          else if(q.model==='mrp.production')result={result:production(q.args[0].some(c=>c[0]==='state'&&c[2]==='done'))};
          else if(q.model==='stock.picking'){const incoming=q.args[0].some(c=>c[0]==='picking_type_code'&&c[2]==='incoming'),done=q.args[0].some(c=>c[0]==='state'&&c[2]==='done');result={result:receipts(incoming,done)};}
          else result={result:contracts};
        }else return route.fulfill({status:404,body:'Unknown fixture route'});
        return route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
      });
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      if(localFile)page.on('console',message=>{if(message.type()==='warning'||message.type()==='error')console.log(message.text());});
      await page.goto(pageUrl(base,name));
      await page.waitForFunction(()=>document.querySelector('#status').textContent.match(/Updated|Sun times|unavailable/i),{},{timeout:live?120000:20000});
      await page.waitForFunction(()=>document.querySelector('canvas')||document.querySelector('#scene-error').textContent.includes('unavailable'),{},{timeout:30000});
      await page.waitForTimeout(1000);
      const status=await page.locator('#status').innerText();
      for(const [width,height] of [[1920,1080],[1366,768],[3840,2160]]){
        await page.setViewportSize({width,height});await page.waitForTimeout(200);
        const layout=await page.evaluate(()=>{
          const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
          const outside=[...document.querySelectorAll('#screen header,#screen footer,#content,.panel,.record,.renewal,.forecast-day')].filter(visible).filter(el=>{const r=el.getBoundingClientRect();return r.left<-.8||r.top<-.8||r.right>innerWidth+.8||r.bottom>innerHeight+.8;}).map(el=>el.className||el.tagName);
          const overflow=[...document.querySelectorAll('.panel,.records,.renewal-rows,.weather-current,.process-stat,.clock-panel')].filter(el=>el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2).map(el=>({class:el.className,w:el.scrollWidth-el.clientWidth,h:el.scrollHeight-el.clientHeight}));
          const clippedDetails=[...document.querySelectorAll('.record .detail,.renewal .meta')].filter(el=>el.clientHeight<18||el.scrollHeight>el.clientHeight+2).map(el=>el.className);
          return {outside,overflow,clippedDetails,scroll:document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth,canvas:!!document.querySelector('canvas'),rendered:document.querySelector('#scene-error').hidden,injected:!!window.injected};
        });
        assert.deepEqual(layout.outside,[],name+' offscreen '+width);assert.deepEqual(layout.overflow,[],name+' panel clipping '+width);assert.deepEqual(layout.clippedDetails,[],name+' hidden record details');assert.equal(layout.scroll,false);assert.equal(layout.injected,false);assert.equal(layout.rendered,true,name+' 3D rendered');
        report.screens.push({name,width,height,status,...layout});
        if(width===1920){if(!live)await page.evaluate(()=>{const el=document.createElement('div');el.id='fixture-mark';el.textContent='LAYOUT TEST · SYNTHETIC FIXTURES';el.style='position:fixed;top:0;left:0;z-index:100;background:#782525;color:white;padding:3px 9px;font:14px Arial';document.body.append(el);});await page.screenshot({path:path.join(out,name+(live?'-live':'-fixture')+'.png')});}
      }
      if(!live){
        assert.ok(!status.includes('unavailable'),name+' data loaded');assert.equal(errors.length,0,name+' script errors: '+errors.join());
        if(name==='weather'){
          await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);
          assert.equal(await page.locator('#scene-error').isVisible(),false,'Reduced motion keeps a rendered scene');
          await page.emulateMedia({reducedMotion:'no-preference'});
          const loss=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');window.lossExtension=gl?.getExtension('WEBGL_lose_context');if(window.lossExtension){window.lossExtension.loseContext();return true;}return false;});
          if(loss){await page.waitForFunction(()=>!document.querySelector('#scene-error').hidden);await page.waitForTimeout(500);await page.evaluate(()=>window.lossExtension.restoreContext());await page.waitForFunction(()=>document.querySelector('#scene-error').hidden);}
          const noGPU=await context.newPage();await noGPU.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args);};});
          await noGPU.goto(pageUrl(base,'weather'));await noGPU.waitForFunction(()=>document.querySelector('#status').textContent.includes('Updated'));
          await noGPU.waitForFunction(()=>document.querySelector('#scene-error').textContent.includes('3D unavailable'));
          assert.equal(await noGPU.locator('#temp').innerText(),'17','Data works without WebGL');await noGPU.close();
        }
        if(['goods_in','warehouse','subscriptions','manufacturing'].includes(name)){
          const selector=name==='subscriptions'?'#renewals':'#done-list',before=await page.locator(selector).innerText();
          await page.waitForTimeout(15500);assert.notEqual(await page.locator(selector).innerText(),before,'Records rotate automatically');
        }
        fail=true;await page.evaluate(()=>dispatchEvent(new Event('online')));await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('STALE'));
        await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('STALE'));
        assert.ok((await page.locator('#content').innerText()).length>150,'Cache persists after reload');
        fail=false;await page.evaluate(()=>dispatchEvent(new Event('online')));await page.waitForFunction(()=>!document.querySelector('#status').textContent.includes('STALE'));
        if(['goods_in','warehouse','subscriptions','manufacturing'].includes(name)){
          empty=true;await page.evaluate(()=>dispatchEvent(new Event('online')));const id=name==='subscriptions'?'active-count':'done-count';await page.waitForFunction(id=>document.getElementById(id).textContent==='0',id);empty=false;
        }
        fail=true;await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('unavailable'));
        if(['goods_in','warehouse','subscriptions','manufacturing'].includes(name))assert.equal(await page.locator(name==='subscriptions'?'#active-count':'#done-count').innerText(),'—','Missing source is not zero');
      }
      assert.deepEqual(errors,[],name+' script errors');await context.close();
    }
    console.log(JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,(live?'live-results':'results')+(localFile?'-file':'')+(only?'-'+only.join('-'):'')+'.json'),JSON.stringify(report,null,2));
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
