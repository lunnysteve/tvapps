(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SignageSchedule=api;})(typeof window==='undefined'?globalThis:window,function(){
    'use strict';
    function london(now=new Date()) {
        const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
        const date=`${p.year}-${p.month}-${p.day}`;
        return {date,day:new Date(date+'T12:00:00Z').getUTCDay(),minute:+p.hour*60 + +p.minute,second:+p.hour*3600 + +p.minute*60 + +p.second};
    }
    function minute(value) {if(!/^\d{2}:\d{2}$/.test(value||''))return null;const [h,m]=value.split(':').map(Number);return(h<24&&m<60)||(h===24&&m===0)?h*60+m:null;}
    function windowMatches(now,start,end) {if(!start&&!end)return true;const a=minute(start),b=minute(end);if(a===null||b===null)return false;return a===b?true:a<b?now>=a&&now<b:now>=a||now<b;}
    function file(item) {if(!item||typeof item.name!=='string'||!/^dashboards\/[a-zA-Z0-9_-]+\.html(?:\?[a-zA-Z0-9_=&%-]*)?$/.test(item.name))return null;const n=Number(item.duration);return {...item,duration:Number.isFinite(n)?Math.min(3600,Math.max(10,n)):60};}
    const fallback=[{name:'dashboards/after-hours.html',duration:3600}];
    function select(config,screenName,now=new Date()) {
        const screen=config?.screens?.[screenName]||config?.screens?.default||{},parts=london(now),calendar={...config?.calendar,...screen.calendar};
        if(Array.isArray(calendar.closedDates)&&calendar.closedDates.includes(parts.date))return {name:'Office closed',files:fallback,screen,parts};
        const profile=screen.profile||'office',groups=Array.isArray(screen.groups)?screen.groups:[];
        const group=groups.find(g=>g&&(!g.days?.length||g.days.map(String).includes(String(parts.day)))&&windowMatches(parts.minute,g.start_time,g.end_time));
        const raw=group?.files||screen.files;
        const files=(Array.isArray(raw)?raw:[]).map(file).filter(Boolean).filter(f=>(!f.audiences?.length||f.audiences.includes(profile))&&windowMatches(parts.minute,f.start_time,f.end_time));
        return {name:group?.name||'Default',files:files.length?files:fallback,screen,parts};
    }
    function valid(c) {return !!c&&typeof c==='object'&&c.screens&&typeof c.screens==='object'&&!Array.isArray(c.screens)&&Object.values(c.screens).some(s=>s&&typeof s==='object'&&(Array.isArray(s.files)||Array.isArray(s.groups)));}
    return {london,minute,windowMatches,select,valid,file};
});
