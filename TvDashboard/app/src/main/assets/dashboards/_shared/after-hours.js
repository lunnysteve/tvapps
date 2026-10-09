/* After-hours screen: the time as a strip of 60 LEDs, one per minute. Device clock, shown in Europe/London.
   There is no data source, so nothing here can be stale, simulated or missing. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object') module.exports = api; else root.AfterHours = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const TZ = 'Europe/London';
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  function londonParts(date = new Date()) {
    const p = {};
    for (const part of formatter.formatToParts(date)) p[part.type] = part.value;
    return { weekday: WEEKDAYS.indexOf(p.weekday), dayName: p.weekday, day: Number(p.day), month: p.month, hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second) };
  }

  function greeting(parts) {
    const { weekday, hour } = parts;
    if (weekday === 0 || weekday === 6) return 'Enjoy your weekend';
    if (weekday === 5 && hour >= 17) return 'Have a good weekend';
    if (hour >= 22 || hour < 5) return 'Good night';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  // Warm-white by day, easing to amber and then ember through the evening; dimmer overnight.
  const STOPS = [
    [0, [196, 98, 45], 0.55], [240, [196, 98, 45], 0.55], [390, [255, 207, 148], 0.85],
    [720, [255, 227, 191], 1], [1050, [255, 217, 168], 1], [1200, [255, 184, 112], 0.95],
    [1350, [255, 148, 72], 0.8], [1440, [196, 98, 45], 0.55]
  ];
  function light(minutesOfDay) {
    const m = Math.max(0, Math.min(1440, minutesOfDay));
    for (let i = 1; i < STOPS.length; i++) {
      if (m <= STOPS[i][0]) {
        const [m0, c0, l0] = STOPS[i - 1], [m1, c1, l1] = STOPS[i], t = (m - m0) / (m1 - m0);
        return { rgb: c0.map((v, k) => Math.round(v + (c1[k] - v) * t)), level: l0 + (l1 - l0) * t };
      }
    }
    return { rgb: STOPS[STOPS.length - 1][1], level: STOPS[STOPS.length - 1][2] };
  }

  // 60 brightness values (0 to 1): the current minute is brightest, earlier minutes fade behind it, later ones are off.
  function leds(minute) {
    const m = Math.max(0, Math.min(59, Math.floor(minute)));
    return Array.from({ length: 60 }, (_, i) => i > m ? 0 : i === m ? 1 : 0.22 + 0.5 * ((i + 1) / (m + 1)));
  }

  // A slow wander of a few pixels so a static picture never sits on the same pixels.
  function drift(ms) {
    const s = ms / 1000;
    return { x: Math.round(Math.sin(s / 900 * 2 * Math.PI) * 28), y: Math.round(Math.cos(s / 1300 * 2 * Math.PI) * 18) };
  }

  function start(doc) {
    const stage = doc.getElementById('stage'); if (!stage) return;
    const root = doc.documentElement, timeEl = doc.getElementById('time'), dateEl = doc.getElementById('date'), greetEl = doc.getElementById('greeting');
    const strip = doc.getElementById('strip'), cells = [];
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (let i = 0; i < 60; i++) { const d = doc.createElement('div'); d.className = 'led'; strip.appendChild(d); cells.push(d); }
    let lastMinute = -1, lastDrift = 0;
    const pad = n => String(n).padStart(2, '0');
    function tick() {
      const now = new Date(), p = londonParts(now);
      if (p.minute !== lastMinute) {
        lastMinute = p.minute;
        timeEl.innerHTML = pad(p.hour) + '<span class="colon">:</span>' + pad(p.minute);
        timeEl.setAttribute('aria-label', pad(p.hour) + ':' + pad(p.minute));
        dateEl.textContent = p.dayName + ' ' + p.day + ' ' + p.month;
        greetEl.textContent = greeting(p);
        const lvl = leds(p.minute), l = light(p.hour * 60 + p.minute);
        root.style.setProperty('--light', l.rgb.join(','));
        root.style.setProperty('--level', l.level.toFixed(3));
        cells.forEach((el, k) => { el.classList.toggle('on', lvl[k] > 0); el.style.setProperty('--lvl', lvl[k].toFixed(3)); });
      }
      if (!still && now - lastDrift > 10000) {
        lastDrift = +now; const d = drift(+now);
        root.style.setProperty('--dx', d.x + 'px'); root.style.setProperty('--dy', d.y + 'px');
      }
    }
    tick(); setInterval(tick, 1000);
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => start(document)); else start(document);
  }

  return { londonParts, greeting, light, leds, drift, TZ };
});
