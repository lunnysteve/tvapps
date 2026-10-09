(function(){
    'use strict';
    const Q=window.SignageSchedule,screenName=new URLSearchParams(location.search).get('screen')||'default';
    const key='architainment-playlist-v2',wrapper=document.getElementById('iframe-wrapper'),notice=document.getElementById('error-msg');
    let config={},selected,signature='',index=0,current=document.getElementById('kiosk-frame'),pending=null;
    let rotationTimer,preloadTimer,readyTimer,deadlineTimer,busy=false,reloadToken,generation=0,lastHeartbeat=Date.now(),recoveries=0;
    let info={},currentItem,pendingItem,pendingReady=false,waitingToSwap=false,started=0,lastConfig=null;
    const health=new Map();
    try{const saved=JSON.parse(localStorage.getItem(key));if(Q.valid(saved?.config)&&Date.now()-saved.at<7*86400000){config=saved.config;lastConfig=saved.at;}}catch(_){}
    function banner(text){notice.textContent=text;notice.hidden=!text;}
    function post(frame,type,data={}){frame?.contentWindow?.postMessage({type,...data},location.origin);}
    function clearTimers(){clearTimeout(rotationTimer);clearTimeout(preloadTimer);clearTimeout(readyTimer);clearTimeout(deadlineTimer);}
    function url(item,preload=false){const u=new URL('/'+item.name,location.origin);if(preload)u.searchParams.set('preload','1');return u.pathname+u.search;}
    function updateList(){const next=Q.select(config,screenName),sig=JSON.stringify([next.name,next.files]);selected=next;if(sig===signature)return false;signature=sig;index=0;
        if(selected.screen.sync){let elapsed=selected.parts.second%selected.files.reduce((n,f)=>n+f.duration,0);while(elapsed>=selected.files[index].duration)elapsed-=selected.files[index++].duration;}return true;}
    function nextItem(){const item=selected.files[index%selected.files.length];index=(index+1)%selected.files.length;return item;}
    function schedule(item){clearTimers();const dwell=Math.max(10,Math.min(item.duration,health.get(item.name)?.quiet?20:item.duration))*1000;started=Date.now();
        if(selected.files.length===1&&/(?:after-hours|digital-clock|lunch-timer|end-of-day)\.html/.test(item.name))return;
        preloadTimer=setTimeout(prepare,Math.max(0,dwell-6000));rotationTimer=setTimeout(()=>{waitingToSwap=true;if(!pending)prepare();if(pendingReady)swap();},dwell);}
    function enforceVp(frame){try{const d=frame?.contentDocument||frame?.contentWindow?.document;if(d){let m=d.querySelector('meta[name="viewport"]');if(!m){m=d.createElement('meta');m.name='viewport';(d.head||d.documentElement).appendChild(m);}m.content='width=1920, user-scalable=no, initial-scale=1.0';if(d.documentElement)d.documentElement.style.overflow='hidden';}}catch(_){}}
    function prepare(){if(pending)return;pendingItem=nextItem();pendingReady=false;pending=document.createElement('iframe');pending.title='Next office dashboard';pending.setAttribute('aria-hidden','true');const mine=++generation;
        pending.onload=()=>{enforceVp(pending);if(mine!==generation)return;readyTimer=setTimeout(()=>{pendingReady=true;if(waitingToSwap)swap();},3000);};
        pending.src=url(pendingItem,true);wrapper.append(pending);deadlineTimer=setTimeout(()=>{if(mine!==generation||!pending)return;pendingReady=true;if(waitingToSwap)swap();},12000);}
    function swap(){if(!pending)return;clearTimers();generation++;waitingToSwap=false;const old=current;post(old,'signage-deactivate');old.removeAttribute('id');old.classList.remove('active');old.setAttribute('aria-hidden','true');
        current=pending;currentItem=pendingItem;pending=null;pendingItem=null;info=health.get(currentItem.name)||{};current.id='kiosk-frame';current.removeAttribute('aria-hidden');current.classList.add('active');post(current,'signage-activate',{calendar:config.calendar||{}});
        document.body.classList.add('changing');setTimeout(()=>{old.remove();document.body.classList.remove('changing');},750);lastHeartbeat=Date.now();recoveries=0;schedule(currentItem);}
    function start(){clearTimers();generation++;if(pending){post(pending,'signage-deactivate');pending.remove();pending=null;}waitingToSwap=false;currentItem=nextItem();info={};lastHeartbeat=Date.now();post(current,'signage-deactivate');current.src=url(currentItem);schedule(currentItem);}
    async function fetchConfig(){if(busy)return;busy=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7000);
        try{const response=await fetch('/api/config',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();if(!Q.valid(data))throw Error('Invalid playlist');config=data;lastConfig=Date.now();try{localStorage.setItem(key,JSON.stringify({config,at:lastConfig}));}catch(_){}banner('');
            const token=data.screens.force_reload_trigger;if(reloadToken!==undefined&&token!==undefined&&token!==reloadToken){location.reload();return;}reloadToken=token;
        }catch(_){banner(lastConfig?'Playlist connection interrupted · continuing the saved schedule':'Playlist unavailable · showing the office clock · retrying automatically');}
        finally{clearTimeout(timeout);busy=false;}if(updateList())start();}
    addEventListener('message',event=>{if(event.origin!==location.origin||!event.data||!['signage-ready','signage-heartbeat'].includes(event.data.type))return;
        if(pending&&event.source===pending.contentWindow){health.set(pendingItem.name,event.data);pendingReady=true;if(waitingToSwap)swap();}
        else if(event.source===current.contentWindow){lastHeartbeat=Date.now();info=event.data;health.set(currentItem.name,info);}});
    async function heartbeat(){if(!currentItem)return;if(Date.now()-lastHeartbeat>45000&&recoveries<2){recoveries++;current.src=url(currentItem);lastHeartbeat=Date.now();banner('Recovering this display · retrying automatically');}
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);try{await fetch('/api/signage/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({display:screenName,screen:currentItem.name,group:selected.name,asOf:info.asOf||null,stale:!!info.stale,errors:(info.errors||[]).slice(-3),renderer:info.renderer||null,lastConfig,recoveries}),signal:controller.signal});}catch(_){}finally{clearTimeout(timer);}}
    current.onload=()=>{enforceVp(current);post(current,'signage-activate',{calendar:config.calendar||{}});};
    updateList();start();fetchConfig();setInterval(fetchConfig,10000);setInterval(()=>{if(updateList())start();},1000);setInterval(heartbeat,15000);
    window.SignageRunner={inspect:()=>({screen:currentItem?.name,group:selected?.name,pending:pendingItem?.name,started,recoveries})};
})();
