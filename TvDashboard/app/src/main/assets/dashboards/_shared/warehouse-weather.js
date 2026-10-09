/* Outdoor scenery uses the same High Wycombe source and observation-age rules
   as the weather screen. SVG groups animate with CSS; there is no frame loop. */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg', D = root.DashboardData, T = root.TVData;
  const CACHE = 'architainment-tv-v1-weather';
  const STYLE = `
    .warehouse-clouds{animation:warehouse-cloud-drift 38s ease-in-out infinite alternate}
    .warehouse-rain{animation:warehouse-rain 2s linear infinite}
    .warehouse-snow{animation:warehouse-snow 8s linear infinite}
    .r2d.motion-still .warehouse-clouds,.r2d.motion-still .warehouse-rain,.r2d.motion-still .warehouse-snow{animation:none}
    @keyframes warehouse-cloud-drift{to{transform:translateX(14px)}}
    @keyframes warehouse-rain{from{transform:translate(4px,-8px)}to{transform:translate(-4px,8px)}}
    @keyframes warehouse-snow{from{transform:translate(-4px,-10px)}to{transform:translate(5px,10px)}}
    @media(prefers-reduced-motion:reduce){.warehouse-clouds,.warehouse-rain,.warehouse-snow{animation:none!important}}`;
  const repeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
  const node = tag => document.createElementNS(NS, tag);
  function cloud(x, y, scale, dark) {
    return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M-131 23C-151 2-134-27-110-31C-107-69-64-87-31-61C-8-103 49-97 72-53C110-64 146-32 128 0C151 26 130 50 98 50H-102C-128 50-140 40-131 23Z" fill="url(#yard-cloud-${dark ? 'dark' : 'light'})"/><path d="M-118-9q10-29 38-19q-5-29 28-35M-23-65q31-32 63-5" fill="none" stroke="#f2f7f8" stroke-width="2" opacity=".2"/></g>`;
  }
  function mount(svg, host, kind) {
    if (!D || !T) return;
    const service = kind === 'subscriptions';
    if (!document.getElementById('warehouse-weather-style')) {
      const style = document.createElement('style'); style.id = 'warehouse-weather-style'; style.textContent = STYLE; document.head.append(style);
    }
    svg.querySelector('defs').insertAdjacentHTML('beforeend', `
      <linearGradient id="yard-weather-sky" x2="0" y2="1"><stop offset="0"/><stop offset="1"/></linearGradient>
      <linearGradient id="yard-weather-ground" x2="0" y2="1"><stop offset="0"/><stop offset="1"/></linearGradient>
      <linearGradient id="yard-cloud-light" x2="0" y2="1"><stop stop-color="#edf3f4"/><stop offset="1" stop-color="#779aaa"/></linearGradient>
      <linearGradient id="yard-cloud-dark" x2="0" y2="1"><stop stop-color="#91a9b6"/><stop offset="1" stop-color="#384f63"/></linearGradient>
      <radialGradient id="yard-sun"><stop stop-color="#fff4c3"/><stop offset="1" stop-color="#ffcb75"/></radialGradient>
      <radialGradient id="yard-moon" cx=".3" cy=".3"><stop stop-color="#ecf2ee"/><stop offset="1" stop-color="#94a9bc"/></radialGradient>
      <radialGradient id="yard-halo"><stop stop-color="#ffe2a1" stop-opacity=".3"/><stop offset="1" stop-color="#ffe2a1" stop-opacity="0"/></radialGradient>`);
    const skyRect = svg.querySelector(`rect[width="1200"][height="${service ? 440 : 430}"]`);
    const groundRect = svg.querySelector(`rect[y="${service ? 440 : 430}"][width="1200"][height="${service ? 60 : 70}"]`);
    skyRect.setAttribute('fill', 'url(#yard-weather-sky)'); groundRect.setAttribute('fill', 'url(#yard-weather-ground)');
    const sky = node('g'), conditions = node('g'), status = node('g');
    sky.setAttribute('class', 'warehouse-weather-sky'); conditions.setAttribute('class', 'warehouse-weather-ground');
    skyRect.after(sky); svg.insertBefore(conditions, svg.querySelector(service ? '.r2-site-roof' : '[data-p="lorry"]'));
    status.innerHTML = '<text class="warehouse-weather-label" x="1178" y="30" text-anchor="end" fill="#eef5f4" font-size="18" font-weight="600"></text><text class="warehouse-weather-status" x="1178" y="52" text-anchor="end" fill="#bed0d7" font-size="15"></text>';
    svg.append(status);
    let payload = null, failed = false, busy = false, signature = '';
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE));
      if (T.validWeather(cached) && Number.isFinite(cached.asOf) && cached.asOf <= Date.now() && !cached.demo && !cached.mock) payload = cached;
    } catch (_) { /* Use live data if storage is unavailable. */ }
    function nightFrom(p) {
      if (p.current.is_day === 0) return true;
      if (p.current.is_day === 1) return false;
      // Some real providers omit is_day: use their actual sunrise/sunset for today.
      const i = p.daily.time.indexOf(D.dayKey()), rise = p.daily.sunrise?.[i], set = p.daily.sunset?.[i];
      if (typeof rise !== 'string' || typeof set !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(rise) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(set)) return null;
      const time = new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
      return time < rise.slice(11, 16) || time >= set.slice(11, 16);
    }
    function draw() {
      const code = D.numeric(payload?.current?.weather_code), [description, type] = payload ? T.weatherInfo(code) : ['Weather unavailable', 'unknown'];
      const night = payload ? nightFrom(payload) : null, grey = ['rain', 'snow', 'fog', 'storm'].includes(type) || code === 3;
      const observed = payload ? T.weatherAge(payload) : null;
      const stale = !!payload && (failed || observed === null || Date.now() - observed > 90 * 60000);
      svg.dataset.weather = type; svg.dataset.weatherNight = night === null ? 'unknown' : String(night);
      svg.dataset.weatherStale = String(stale);
      const temperature = D.numeric(payload?.current?.temperature_2m);
      status.querySelector('.warehouse-weather-label').textContent = payload ? `High Wycombe · ${description}${temperature === null ? '' : ' · ' + Math.round(temperature) + '°C'}${night === null ? '' : night ? ' · NIGHT' : ' · DAYLIGHT'}` : 'High Wycombe · Weather ' + (failed ? 'unavailable' : 'connecting');
      status.querySelector('.warehouse-weather-status').textContent = payload ? `${stale ? 'STALE WEATHER · ' : ''}${observed === null ? 'Observation time unavailable' : 'Weather observed ' + new Intl.DateTimeFormat('en-GB', { timeZone: D.zone, hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(observed))}` : 'Scenery awaits current conditions';
      status.querySelector('.warehouse-weather-status').setAttribute('fill', stale ? '#ffd398' : '#bed0d7');
      const next = JSON.stringify([code, night, type, Math.round((D.nonnegative(payload?.current?.wind_speed_10m) || 0) / 10)]);
      if (next === signature) return;
      signature = next;
      const neutral = type === 'unknown' || night === null;
      const top = neutral ? '#223a49' : night ? '#081623' : grey ? '#4d677b' : '#377ca6';
      const bottom = neutral ? '#42616f' : night ? '#203c50' : grey ? '#9eb3bd' : '#acd1df';
      const stops = svg.querySelectorAll('#yard-weather-sky stop'); stops[0].setAttribute('stop-color', top); stops[1].setAttribute('stop-color', bottom);
      const groundStops = svg.querySelectorAll('#yard-weather-ground stop');
      groundStops[0].setAttribute('stop-color', type === 'snow' ? '#a6b8ba' : grey ? '#293b46' : night ? '#243841' : '#4a606a');
      groundStops[1].setAttribute('stop-color', type === 'snow' ? '#657d88' : grey ? '#172733' : night ? '#152730' : '#2a414c');
      let air = '';
      if (night && !grey && !neutral) air += repeat(25, i => `<circle cx="${service ? 22 + (i * 131) % 1160 : 505 + (i * 131) % 670}" cy="${16 + (i * 43) % (service ? 100 : 170)}" r="${i % 4 ? 1 : 1.6}" fill="#dcebf3" opacity="${.3 + i % 3 * .2}"/>`);
      if ((type === 'sun' || code === 2) && !neutral) {
        air += `<g${service ? ' transform="translate(-645 -28)"' : ''}>`;
        if (night) air += '<circle cx="1055" cy="103" r="35" fill="url(#yard-moon)"/><g fill="#7892ab" opacity=".25"><circle cx="1042" cy="89" r="7"/><circle cx="1067" cy="112" r="9"/><circle cx="1040" cy="119" r="4"/></g>';
        else air += '<circle cx="1055" cy="103" r="80" fill="url(#yard-halo)"/><circle cx="1055" cy="103" r="38" fill="url(#yard-sun)"/>';
        air += '</g>';
      }
      if (type === 'cloud' || grey) air += `<g class="warehouse-clouds" opacity="${night ? '.68' : '.92'}">${service ? cloud(442, 55, .48, grey) + cloud(678, 52, .58, grey) + (grey ? cloud(1122, 74, .55, true) : '') : cloud(653, 113, .82, grey) + cloud(896, 164, 1.05, grey) + (grey ? cloud(1122, 134, .78, true) : '')}</g>`;
      sky.innerHTML = air;
      let ground = '';
      if (type === 'rain' || type === 'storm') {
        const slant = Math.min(D.nonnegative(payload?.current?.wind_speed_10m) || 0, 60) / 6;
        ground += `<g class="warehouse-rain" stroke="#cae2f0" stroke-width="1.5" stroke-linecap="round" opacity=".38">${repeat(type === 'storm' ? 60 : 38, i => `<path d="M${28 + (i * 97) % 1140} ${76 + (i * 47) % 346}l-${5 + slant} 17"/>`)}</g>`;
        ground += '<g fill="#b4d3df" opacity=".12"><ellipse cx="737" cy="455" rx="95" ry="4"/><ellipse cx="1027" cy="473" rx="134" ry="6"/><ellipse cx="135" cy="458" rx="76" ry="4"/></g>';
      }
      if (type === 'snow') ground += `<g class="warehouse-snow" fill="#eff7f8" opacity=".8">${repeat(40, i => `<circle cx="${20 + (i * 79) % 1160}" cy="${80 + (i * 47) % 348}" r="${1.4 + i % 3 * .5}"/>`)}</g><path d="M515 ${service ? 439 : 429}H1200M0 ${service ? 440 : 430}H276" stroke="#dbe8e9" stroke-width="5" opacity=".7"/>`;
      if (type === 'fog') ground += '<g fill="none" stroke="#bfced4" stroke-linecap="round"><path d="M20 330H1190" stroke-width="32" opacity=".16"/><path d="M525 383H1190" stroke-width="23" opacity=".2"/></g>';
      conditions.innerHTML = ground;
    }
    async function refresh() {
      if (busy || document.hidden) return;
      busy = true;
      try {
        payload = await T.weather(); failed = !!payload.stale;
        try { localStorage.setItem(CACHE, JSON.stringify(payload)); } catch (_) { /* Keep the real value in memory. */ }
      } catch (_) { failed = true; }
      finally { busy = false; draw(); }
    }
    draw(); refresh();
    setInterval(refresh, 10 * 60000);
    setInterval(() => { if (!document.hidden) draw(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { draw(); refresh(); } });
    return { refresh };
  }
  root.WarehouseWeather = { mount };
})(window);
