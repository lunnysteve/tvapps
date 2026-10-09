/* Layered weather illustration. Local SVG gradients, no filters or WebGL.
   Only two cloud groups and one precipitation group move; no frame loop. */
(function (root) {
  'use strict';
  const STYLE = `
    .wx2d{position:absolute;inset:0;width:100%;height:100%;display:block}
    .wx2d .weather-drift{animation:weather-drift 32s ease-in-out infinite alternate}
    .wx2d .weather-drift-back{animation:weather-drift 45s ease-in-out infinite alternate-reverse}
    .wx2d .weather-fall{animation:weather-fall 2.8s linear infinite}
    .wx2d .weather-snow{animation:weather-snow 9s linear infinite}
    .wx2d.paused *{animation-play-state:paused!important}
    @keyframes weather-drift{to{transform:translateX(18px)}}
    @keyframes weather-fall{from{transform:translate(7px,-15px);opacity:.35}to{transform:translate(-7px,15px);opacity:.8}}
    @keyframes weather-snow{from{transform:translate(-5px,-14px)}to{transform:translate(8px,14px)}}
    @media(prefers-reduced-motion:reduce){.wx2d *{animation:none!important}}`;
  const many = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
  function cloud(x, y, scale, dark = false) {
    return `<g transform="translate(${x} ${y}) scale(${scale})">
      <path d="M-145 34C-166 9-151-29-118-34C-116-77-64-96-30-67C-7-118 69-108 86-53C125-67 168-32 151 11C177 40 153 69 116 69H-107C-139 69-155 53-145 34Z" fill="url(#wx-cloud${dark ? '-dark' : ''})"/>
      <path d="M-137 5c1-23 23-36 45-31c-9-38 35-58 61-36C-4-99 54-91 69-51" fill="none" stroke="${dark ? '#aac0cc' : '#fff'}" stroke-width="4" opacity=".35"/>
      <path d="M-108 48c28 14 58-3 67-17c22 25 68 25 90 4c19 12 56 10 77-3" fill="none" stroke="${dark ? '#304758' : '#8ba9bd'}" stroke-width="9" opacity=".18" stroke-linecap="round"/>
    </g>`;
  }
  function picture(a) {
    const type = a.type || 'unknown', night = !!a.night, storm = type === 'storm';
    const grey = storm || a.overcast || ['rain', 'snow', 'fog'].includes(type);
    const top = night ? '#071322' : storm ? '#253b50' : grey ? '#536f87' : '#326eaa';
    const bottom = night ? '#263e58' : grey ? '#b1c5cf' : '#c1e2ef';
    let art = `<defs>
      <linearGradient id="wx-sky" x2="0" y2="1"><stop stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
      <radialGradient id="wx-halo"><stop stop-color="${night ? '#d8eaff' : '#ffe5a3'}" stop-opacity=".45"/><stop offset="1" stop-color="${night ? '#d8eaff' : '#ffe5a3'}" stop-opacity="0"/></radialGradient>
      <radialGradient id="wx-sun" cx=".4" cy=".3"><stop stop-color="#fffbe2"/><stop offset=".65" stop-color="#ffe8a0"/><stop offset="1" stop-color="#ffc466"/></radialGradient>
      <radialGradient id="wx-moon" cx=".32" cy=".25"><stop stop-color="#f6f4e7"/><stop offset="1" stop-color="#9dafbf"/></radialGradient>
      <linearGradient id="wx-cloud" x2=".2" y2="1"><stop stop-color="${night ? '#b2c8da' : '#fffdf6'}"/><stop offset=".48" stop-color="${night ? '#6f8aa4' : '#e3edf0'}"/><stop offset="1" stop-color="${night ? '#3a526e' : '#95b2c6'}"/></linearGradient>
      <linearGradient id="wx-cloud-dark" x2=".15" y2="1"><stop stop-color="#afc2cd"/><stop offset=".55" stop-color="#6f899f"/><stop offset="1" stop-color="#3f576c"/></linearGradient>
      <linearGradient id="wx-land" x2="0" y2="1"><stop stop-color="${night ? '#233e48' : '#648c82'}"/><stop offset="1" stop-color="${night ? '#0d2834' : '#2b5960'}"/></linearGradient>
      <linearGradient id="wx-road" x2="0" y2="1"><stop stop-color="#aec4c8" stop-opacity=".2"/><stop offset="1" stop-color="#d1ded7" stop-opacity=".6"/></linearGradient>
    </defs><rect width="800" height="500" fill="url(#wx-sky)"/>`;
    if (night && !grey) art += many(38, i => `<circle cx="${(i * 137 + 31) % 800}" cy="${18 + (i * 61) % 285}" r="${i % 4 ? .9 : 1.7}" fill="#e3edf5" opacity="${.3 + (i % 5) * .12}"/>`);
    if (type === 'sun' || (type === 'cloud' && !a.overcast)) {
      art += `<circle cx="556" cy="139" r="166" fill="url(#wx-halo)"/>`;
      if (night) art += `<circle cx="556" cy="139" r="53" fill="url(#wx-moon)"/>
        <g fill="#718ba2" opacity=".22"><ellipse cx="536" cy="113" rx="10" ry="13"/><circle cx="574" cy="160" r="13"/><circle cx="530" cy="154" r="6"/><circle cx="570" cy="119" r="5"/></g>
        <path d="M548 87a53 53 0 0 1 0 104c30-20 32-76 0-104Z" fill="#263e58" opacity=".45"/>`;
      else art += `<circle cx="556" cy="139" r="64" fill="url(#wx-sun)"/><circle cx="556" cy="139" r="76" fill="none" stroke="#fff3c2" opacity=".15"/>`;
    }
    if (type !== 'unknown') {
      // Thin distant cloud banks add depth even in a clear sky.
      art += `<g opacity="${night ? '.12' : '.25'}"><path d="M20 235q70-14 150-3t170-1M510 283q105-13 270 1" fill="none" stroke="#e5eff1" stroke-width="6" stroke-linecap="round"/></g>`;
      if (type === 'sun') art += `<g opacity=".65" class="weather-drift-back">${cloud(177, 214, .44)}</g>`;
      if (type === 'cloud' || grey) art += `<g class="weather-drift-back" opacity=".8">${cloud(590, 142, .83, grey)}</g><g class="weather-drift">${cloud(361, 204, 1.12, storm || a.overcast)}</g>`;
    }
    // An illustrative Chiltern landscape, not a camera view or a site measurement.
    art += `<path d="M0 367Q130 300 245 345T476 329T800 340V500H0Z" fill="${night ? '#304454' : '#7c9ca7'}" opacity=".62"/>
      <path d="M0 397Q130 339 272 377T526 363T800 363V500H0Z" fill="${night ? '#243d49' : '#638a88'}"/>
      <path d="M0 415Q142 378 307 419Q470 354 800 402V500H0Z" fill="url(#wx-land)"/>
      <path d="M489 395Q369 428 482 450T576 500H638Q577 453 482 445T506 395Z" fill="url(#wx-road)"/>
      <path d="M0 449q169-15 305 8M620 434q88-14 180 5" fill="none" stroke="${night ? '#69807d' : '#9ab7a0'}" opacity=".3" stroke-width="2"/>
      ${many(17, i => { const x = 18 + i * 49, y = 401 + Math.sin(i * 1.7) * 16, size = 10 + i % 4 * 3; return `<g fill="${night ? '#19303b' : '#3c6c69'}"><path d="M${x} ${y + 8}v-${size}" stroke="${night ? '#19303b' : '#3c6c69'}" stroke-width="3"/><ellipse cx="${x}" cy="${y - size / 2}" rx="${size * .65}" ry="${size}"/></g>`; })}
      <g fill="${night ? '#17303c' : '#456670'}"><path d="M157 392v-22h41v22M151 370l27-17 27 17Z"/><path d="M205 397v-19h29v19M200 378l20-14 19 14Z"/></g>
      <g fill="${night ? '#ddc68d' : '#bed1c7'}" opacity=".8"><path d="M166 377h6v8h-6ZM182 377h6v8h-6ZM212 383h5v7h-5Z"/></g>`;
    if (type === 'rain' || storm) {
      const slant = Math.min(Number(a.wind) || 0, 60) / 5;
      art += `<g class="weather-fall" stroke="#d2e9f6" stroke-width="${storm ? 2.3 : 1.7}" stroke-linecap="round">${many(storm ? 40 : 26, i => { const x = 183 + (i * 67) % 490, y = 260 + (i * 37) % 139; return `<path d="M${x} ${y}l-${6 + slant} 19" opacity="${.3 + i % 4 * .15}"/>`; })}</g>`;
      art += `<g fill="none" stroke="#c1dce4" opacity=".3">${many(10, i => `<ellipse cx="${120 + i * 67}" cy="${441 + i % 3 * 17}" rx="${5 + i % 4}" ry="1.5"/>`)}</g>`;
      if (storm) art += '<path d="M440 255l-25 44h21l-23 40 58-55h-23l18-29Z" fill="#ffe5a3" opacity=".9"/>';
    }
    if (type === 'snow') art += `<g class="weather-snow" fill="#f2f8fa">${many(35, i => `<circle cx="${145 + (i * 79) % 545}" cy="${259 + (i * 37) % 160}" r="${1.6 + i % 3}" opacity="${.4 + i % 3 * .25}"/>`)}</g><path d="M0 417q142-37 307 2q163-65 493-17" fill="none" stroke="#d2e4e8" stroke-width="4" opacity=".55"/>`;
    if (type === 'fog') art += `<g fill="none" stroke="#d6e2e5" stroke-linecap="round"><path d="M40 346Q270 319 741 348" stroke-width="19" opacity=".36"/><path d="M120 381Q356 357 795 384" stroke-width="26" opacity=".28"/><path d="M0 424q300-24 624 0" stroke-width="18" opacity=".25"/></g>`;
    if (type === 'unknown') art += '<text x="400" y="215" text-anchor="middle" fill="#e0eaf0" font-size="28" font-family="Segoe UI,Arial,sans-serif">Conditions unavailable</text>';
    return art;
  }
  function mount(host, kind) {
    if (kind !== 'weather') return;
    if (!document.getElementById('wx2d-style')) {
      const style = document.createElement('style'); style.id = 'wx2d-style'; style.textContent = STYLE; document.head.append(style);
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'wx2d'); svg.setAttribute('viewBox', '0 0 800 500');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice'); svg.setAttribute('aria-hidden', 'true'); host.prepend(svg);
    let shown = '';
    function draw() {
      const a = root.TVAtmosphere || { type: 'unknown' };
      const key = JSON.stringify([a.type, !!a.night, !!a.overcast, Math.round((a.wind || 0) / 10)]);
      if (key === shown) return;
      shown = key; svg.innerHTML = picture(a);
      host.querySelector('.scene-error')?.setAttribute('hidden', '');
    }
    function visibility() { svg.classList.toggle('paused', document.hidden); }
    addEventListener('tv-atmosphere', draw); document.addEventListener('visibilitychange', visibility);
    draw(); visibility();
  }
  root.TVScenes = { mount };
})(window);
