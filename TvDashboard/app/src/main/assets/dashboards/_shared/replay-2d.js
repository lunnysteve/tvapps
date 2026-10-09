/* Flat 2D replay illustrations for the goods in/out, manufacturing and subscription screens.
   They replace the three.js scenes, which older Fire TV sticks cannot run.
   Each scene is a side-on SVG drawing whose moving parts follow per-part keyframe tracks. Motion is
   done by CSS transitions between keyframes, so JavaScript only acts when a part reaches its next
   keyframe (the replay loop calls render() a few times a second) and the page is idle between moves.
   Interface used by the *-scene.js files: label(job), render(seconds, speed, still). */
(function (root) {
    'use strict';
    const NS = 'http://www.w3.org/2000/svg';
    const fit = (text, n) => { text = String(text || ''); return text.length > n ? text.slice(0, n - 1) + '…' : text; };
    const EASE = { io: 'cubic-bezier(.45,0,.55,1)', out: 'cubic-bezier(.15,.6,.3,1)', in: 'cubic-bezier(.55,0,.85,.45)', lin: 'linear', step: 'steps(1,end)' };
    const DEG = 180 / Math.PI;
    const STYLE = `
.r2d{width:100%;height:100%;display:block}
.r2d text{font-family:'Segoe UI',Arial,sans-serif}
.r2d .tone-warn{stroke:#f5c779}.r2d .tone-bad{stroke:#f27979}.r2d .tone-paused,.r2d .tone-unknown{stroke:#9fb1bd}
.r2d .r2-beacon-halo{animation:r2-beacon-glow 1.6s ease-in-out infinite}
.r2d .r2-beacon-beam{transform-origin:93px 219px;animation:r2-beacon-turn 1.6s linear infinite}
.r2d .r2-beacon-sweep{animation:r2-beacon-sweep 1.6s ease-in-out infinite}
.r2d.motion-paused *{animation-play-state:paused!important}
.r2d.motion-still .r2-beacon *{animation:none!important}
.r2d.motion-still .r2-beacon-halo,.r2d.motion-still .r2-beacon-beam{display:none}
@keyframes r2-beacon-glow{0%,50%,100%{opacity:.18}25%,75%{opacity:1}}
@keyframes r2-beacon-turn{0%,100%{transform:scaleX(1);opacity:.08}25%{transform:scaleX(.1);opacity:.7}50%{transform:scaleX(-1);opacity:.08}75%{transform:scaleX(-.1);opacity:.7}}
@keyframes r2-beacon-sweep{0%,100%{transform:translateX(-3px);opacity:.25}25%,75%{opacity:1}50%{transform:translateX(4px);opacity:.25}}
@media(prefers-reduced-motion:reduce){.r2d .r2-beacon *{animation:none!important}.r2d .r2-beacon-halo,.r2d .r2-beacon-beam{display:none}}`;

    // ---------- keyframe engine ----------
    // tracks: { part: [[t, {x,y,r,sx,sy,o,fill,draw}, ease], ...] }. Unlisted values carry forward.
    function engine(svg, scene) {
        const parts = {};
        svg.querySelectorAll('[data-p]').forEach(el => {
            parts[el.dataset.p] = el;
            const o = el.dataset.origin || '';
            if (o === 'c') { el.style.transformBox = 'fill-box'; el.style.transformOrigin = 'center'; }
            else if (/^(left|right)/.test(o)) { el.style.transformBox = 'fill-box'; el.style.transformOrigin = o; }
            else if (o) { el.style.transformBox = 'view-box'; el.style.transformOrigin = o.split(' ').map(n => n + 'px').join(' '); }
            else { el.style.transformBox = 'view-box'; el.style.transformOrigin = '0 0'; }
            if (el.dataset.len !== undefined) { const len = el.getTotalLength(); el.dataset.len = len; el.style.strokeDasharray = len; }
        });
        let tracks = {}, seg = {}, dirty = true, lastT = 0, posterShown = false, active = false;
        const build = list => { let prev = {}; return list.map(([t, p, e]) => (prev = { ...prev, ...p }, { t, p: prev, e: e || 'io' })); };
        function apply(el, p, dur, ease) {
            el.style.transition = dur > 0 ? `transform ${dur}s ${EASE[ease]},opacity ${dur}s ${EASE[ease]},fill ${dur}s ${EASE[ease]},stroke-dashoffset ${dur}s ${EASE[ease]}` : 'none';
            if ('x' in p || 'y' in p || 'r' in p || 'sx' in p || 'sy' in p)
                el.style.transform = `translate(${p.x || 0}px,${p.y || 0}px) rotate(${p.r || 0}deg) scale(${p.sx ?? 1},${p.sy ?? 1})`;
            if ('o' in p) el.style.opacity = p.o;
            if ('fill' in p) el.style.fill = p.fill;
            if ('draw' in p) el.style.strokeDashoffset = (1 - p.draw) * el.dataset.len;
        }
        const index = (tr, t) => { let i = 0; while (i + 1 < tr.length && tr[i + 1].t <= t) i++; return i; };
        function jump(t) {
            for (const name in tracks) {
                const tr = tracks[name], i = index(tr, t), a = tr[i], b = tr[i + 1];
                let p = a.p;
                if (b && b.e !== 'step' && t > a.t) {
                    const u = Math.min(1, (t - a.t) / (b.t - a.t)); p = { ...a.p };
                    for (const k in b.p) if (typeof b.p[k] === 'number' && typeof a.p[k] === 'number') p[k] = a.p[k] + (b.p[k] - a.p[k]) * u;
                }
                apply(parts[name], p, 0); seg[name] = -1;
            }
            svg.getBoundingClientRect(); // commit the jump before any transition starts
        }
        return {
            load(job) { tracks = {}; for (const [name, list] of Object.entries(scene.tracks(job))) if (parts[name]) tracks[name] = build(list); seg = {}; dirty = true; posterShown = false; active = !!job; },
            render(t, speed, still) {
                // No job: hold the resting frame instead of playing an empty replay.
                if (!active) { if (dirty) { jump(0); dirty = false; } return; }
                if (still) { if (!posterShown) { jump(scene.poster ?? 0); posterShown = true; } return; }
                posterShown = false;
                if (dirty || t < lastT - .5) { jump(t); dirty = false; }
                lastT = t;
                for (const name in tracks) {
                    const tr = tracks[name], i = index(tr, t);
                    if (seg[name] === i) continue;
                    seg[name] = i;
                    const b = tr[i + 1];
                    if (b) apply(parts[name], b.p, Math.max(.05, (b.t - t) / Math.max(speed, .1)).toFixed(2), b.e);
                    else apply(parts[name], tr[i].p, .2, 'io');
                }
            }
        };
    }
    // Wheel rotation that matches a horizontal track: rolling distance / radius.
    const roll = (track, r) => { const x0 = track[0][1].x; return track.map(([t, p, e]) => [t, { r: (p.x - x0) / r * DEG }, e]); };
    const lamp = (keys, off, on) => keys.map(([t, lit]) => [t, { fill: lit ? on : off }, 'step']);

    // ---------- shared drawing pieces ----------
    const DEFS = `
<linearGradient id="r2sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#132631"/><stop offset="1" stop-color="#1f3a47"/></linearGradient>
<linearGradient id="r2ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3a41"/><stop offset="1" stop-color="#1a272c"/></linearGradient>
<linearGradient id="r2cab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f5f6"/><stop offset="1" stop-color="#b4c0c6"/></linearGradient>
<linearGradient id="r2glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#36576a"/><stop offset="1" stop-color="#0d1a21"/></linearGradient>
<linearGradient id="r2yellow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7cf55"/><stop offset="1" stop-color="#d79f1c"/></linearGradient>
<linearGradient id="r2red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f76561"/><stop offset=".4" stop-color="#d52c38"/><stop offset="1" stop-color="#8e1428"/></linearGradient>
<radialGradient id="r2beacon"><stop stop-color="#ffc56d" stop-opacity=".7"/><stop offset="1" stop-color="#ff8d24" stop-opacity="0"/></radialGradient>
<linearGradient id="r2box" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d2a46b"/><stop offset="1" stop-color="#a87a45"/></linearGradient>
<linearGradient id="r2alu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d5dde1"/><stop offset="1" stop-color="#7f8e96"/></linearGradient>
<linearGradient id="r2steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5d6e78"/><stop offset=".5" stop-color="#8496a0"/><stop offset="1" stop-color="#55656e"/></linearGradient>
<radialGradient id="r2warm"><stop offset="0" stop-color="#ffe8a6" stop-opacity=".75"/><stop offset="1" stop-color="#ffe8a6" stop-opacity="0"/></radialGradient>
<linearGradient id="r2cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".35"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></linearGradient>
<pattern id="r2clad" width="16" height="10" patternUnits="userSpaceOnUse"><rect width="16" height="10" fill="#2b4555"/><rect width="8" height="10" fill="#27404f"/><rect width="1.5" height="10" fill="#36566a"/></pattern>
<pattern id="r2slat" width="10" height="12" patternUnits="userSpaceOnUse"><rect width="10" height="12" fill="#8c9ba4"/><rect y="9" width="10" height="3" fill="#66757e"/><rect width="10" height="1.5" fill="#aab7be"/></pattern>
<pattern id="r2hazard" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="16" height="16" fill="#f2c230"/><rect width="8" height="16" fill="#1b1b1b"/></pattern>`;
    function wheel(part, cx, cy, r) {
        const nuts = [0, 60, 120, 180, 240, 300].map(a => `<circle cx="${(Math.cos(a / DEG) * r * .34).toFixed(1)}" cy="${(Math.sin(a / DEG) * r * .34).toFixed(1)}" r="${(r * .06).toFixed(1)}" fill="#4f5a60"/>`).join('');
        return `<g transform="translate(${cx} ${cy})"><g data-p="${part}" data-origin="c"><circle r="${r}" fill="#101619"/><circle r="${r - 3}" fill="none" stroke="#283136" stroke-width="4" stroke-dasharray="3 4"/><circle r="${(r * .56).toFixed(1)}" fill="#a3afb5"/><circle r="${(r * .56).toFixed(1)}" fill="none" stroke="#6f7b81" stroke-width="2"/>${nuts}<circle r="${(r * .14).toFixed(1)}" fill="#6f7b81"/></g></g>`;
    }
    // Pallet drawn with its bottom-left corner at the origin; fork pockets between the three blocks.
    const PALLET = `<g data-p="pallet">
  <rect x="0" y="-16" width="124" height="4" fill="#a7835a"/>
  <rect x="0" y="-12" width="14" height="12" fill="#7a5a38"/><rect x="55" y="-12" width="14" height="12" fill="#7a5a38"/><rect x="110" y="-12" width="14" height="12" fill="#7a5a38"/>
  <rect x="2" y="-62" width="60" height="46" fill="url(#r2box)" stroke="#8a6236"/><rect x="62" y="-62" width="60" height="46" fill="url(#r2box)" stroke="#8a6236"/>
  <rect x="2" y="-108" width="60" height="46" fill="url(#r2box)" stroke="#8a6236"/><rect x="62" y="-108" width="60" height="46" fill="url(#r2box)" stroke="#8a6236"/>
  <path d="M30 -108v92M92 -108v92" stroke="#e2c79c" stroke-width="3"/>
  <rect x="0" y="-110" width="124" height="96" fill="#e8f3f7" opacity=".13"/>
  <path d="M6 -104l40 84M58 -104l40 84M96 -80l22 46" stroke="#ffffff" stroke-width="2" opacity=".14"/>
  <rect x="8" y="-105" width="108" height="59" rx="3" fill="#f6f8f6"/>
  <text class="r2-label" data-fit="100" x="62" y="-91" text-anchor="middle" font-size="13" font-weight="600" fill="#50616b"></text>
  <text class="r2-detail" text-anchor="middle" font-size="17" font-weight="700" fill="#16242b"><tspan data-fit="100" x="62" y="-73"></tspan><tspan data-fit="100" x="62" y="-54"></tspan></text>
</g>`;
    function backdrop() {
        const towers = [[560, 300, 90], [660, 270, 70], [740, 320, 120], [870, 290, 80], [960, 330, 140]].map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${430 - y}" fill="#18303b"/>`).join('');
        return `<rect width="1200" height="430" fill="url(#r2sky)"/>${towers}
<rect x="1120" y="230" width="6" height="200" fill="#2a3a41"/><rect x="1100" y="226" width="40" height="8" rx="3" fill="#33444c"/><path d="M1106 234 L1134 234 L1180 430 L1060 430 Z" fill="url(#r2cone)" opacity=".35"/>
<rect y="430" width="1200" height="70" fill="url(#r2ground)"/><rect y="430" width="1200" height="3" fill="#3a4c54"/>
<path d="M540 440 L556 440 L546 500 L530 500 Z M1150 440 L1166 440 L1176 500 L1160 500 Z" fill="#c9a52c" opacity=".7"/>
<path d="M300 433 H460 V470 H300 Z" fill="url(#r2hazard)" opacity=".18"/>
<rect x="300" y="228" width="160" height="202" fill="#0a141a"/>
<path d="M300 430L338 386H422L460 430Z" fill="url(#r2ground)"/>
<path d="M310 430L346 386M450 430L414 386" fill="none" stroke="#56666f" stroke-width="3"/>
<path d="M307 423H453M313 416H447M319 409H441M325 402H435M331 395H429" stroke="url(#r2alu)" stroke-width="3"/>
<path d="M310 260 H450 M310 310 H450 M310 360 H450" stroke="#1b2d36" stroke-width="5"/><rect x="318" y="284" width="40" height="26" fill="#1f3039"/><rect x="392" y="334" width="46" height="26" fill="#1f3039"/><rect x="300" y="228" width="160" height="6" fill="#3b3423" opacity=".8"/>`;
    }
    function facade(sign) {
        return `<path d="M0 120 H472 V430 H460 V228 H300 V430 H0 Z" fill="url(#r2clad)"/>
<rect x="0" y="110" width="482" height="14" fill="#16252d"/><rect x="0" y="400" width="300" height="30" fill="#33444c"/><rect x="460" y="400" width="12" height="30" fill="#33444c"/>
<rect x="36" y="250" width="230" height="44" fill="#0e1b22" stroke="#3d5a69" stroke-width="3"/><path d="M93 250v44M150 250v44M208 250v44" stroke="#3d5a69" stroke-width="3"/><rect x="38" y="252" width="226" height="40" fill="#ffe3a1" opacity=".1"/>
<path d="M136 140H166L265 226H37Z" fill="url(#r2cone)" opacity=".6"/>
<rect x="128" y="128" width="46" height="12" rx="3" fill="#182a34" stroke="#70858f" stroke-width="1.5"/>
<rect x="132" y="137" width="38" height="4" rx="1" fill="#ffe7a8"/>
<rect x="36" y="150" width="230" height="64" rx="4" fill="#0f1d25" stroke="#778477" stroke-width="2"/>
<path d="M40 153H262" stroke="#ffe7a8" stroke-width="2" opacity=".5"/>
<text x="151" y="194" text-anchor="middle" font-size="30" font-weight="700" letter-spacing="3" fill="#f1f5ef">${sign}</text>
<rect x="292" y="222" width="8" height="208" fill="#56666f"/><rect x="460" y="222" width="8" height="208" fill="#56666f"/><rect x="292" y="196" width="176" height="28" fill="#4a5a63"/>
<rect x="282" y="352" width="12" height="78" fill="url(#r2hazard)"/><rect x="466" y="352" width="12" height="78" fill="url(#r2hazard)"/>
<rect x="364" y="174" width="32" height="12" rx="3" fill="#2a363d"/><rect data-p="lamp" x="368" y="184" width="24" height="5" fill="#4b5a62"/>`;
    }
    const SHUTTER = `<clipPath id="r2door"><rect x="300" y="224" width="160" height="206"/></clipPath>
<g clip-path="url(#r2door)"><g data-p="shutter"><rect x="300" y="226" width="160" height="204" fill="url(#r2slat)"/><rect x="300" y="420" width="160" height="10" fill="#56656e"/><rect x="368" y="408" width="24" height="6" rx="2" fill="#3d4a51"/></g></g>
<path data-p="cone" d="M370 189 L390 189 L470 430 L290 430 Z" fill="url(#r2cone)" opacity="0"/>`;
    function lorry(livery) {
        return `<g data-p="lorry">
  <ellipse cx="250" cy="432" rx="272" ry="8" fill="#060d11" opacity=".55"/>
  <rect x="10" y="346" width="462" height="16" fill="#1b2328"/>
  <rect x="266" y="360" width="66" height="30" rx="11" fill="#a2b2ba"/><rect x="266" y="372" width="66" height="3" fill="#7b8b93"/>
  <rect x="0" y="330" width="346" height="18" fill="#3c4d57"/><rect x="0" y="330" width="346" height="4" fill="#61757f"/><rect x="0" y="348" width="346" height="4" fill="#26323a"/>
  <rect x="336" y="236" width="12" height="96" fill="#56666f"/><path d="M338 248h8M338 262h8M338 276h8M338 290h8M338 304h8M338 318h8" stroke="#3a4850" stroke-width="2"/>
  <path d="M30 370 Q105 342 180 370" fill="none" stroke="#1b2328" stroke-width="8"/><path d="M392 370 Q432 344 472 370" fill="none" stroke="#1b2328" stroke-width="8"/>
  <path d="M352 400 V238 Q352 222 368 222 H456 Q468 222 472 234 L488 300 V398 Z" fill="url(#r2cab)" stroke="#8d9aa1" stroke-width="2"/>
  <path d="M398 238 H456 L470 294 H398 Z" fill="url(#r2glass)"/><path d="M406 244 L432 244 L418 288 Z" fill="#ffffff" opacity=".09"/>
  <rect x="392" y="234" width="80" height="156" rx="4" fill="none" stroke="#97a4ab" stroke-width="2"/><rect x="400" y="306" width="18" height="5" rx="2" fill="#6d797f"/>
  ${livery}
  <rect x="398" y="392" width="44" height="6" fill="#26323a"/>
  <path d="M478 254 H496" stroke="#26323a" stroke-width="4"/><rect x="492" y="238" width="10" height="42" rx="3" fill="#1b2328"/>
  <rect x="480" y="336" width="10" height="36" fill="#26323a"/><path d="M482 342h6M482 350h6M482 358h6M482 366h6" stroke="#4d5b62" stroke-width="2"/>
  <rect x="478" y="320" width="12" height="12" rx="3" fill="#ffe9a8"/><rect x="474" y="376" width="18" height="22" rx="3" fill="#26323a"/>
  <rect x="-6" y="332" width="10" height="28" rx="2" fill="#26323a"/><rect data-p="brake" x="-5" y="334" width="8" height="10" fill="#5a1d1d"/><rect data-p="rev" x="-5" y="346" width="8" height="6" fill="#4d5255"/><rect x="-5" y="354" width="8" height="4" fill="#d98a2b"/>
  <rect x="8" y="362" width="8" height="18" fill="#26323a"/><rect x="0" y="378" width="24" height="8" fill="url(#r2hazard)"/>
  <rect x="338" y="388" width="16" height="5" fill="#56666f"/>
  ${wheel('lw0', 70, 400, 30)}${wheel('lw1', 140, 400, 30)}${wheel('lw2', 432, 400, 30)}
</g>
<g data-p="puff" opacity="0"><circle cx="330" cy="384" r="10" fill="#9aa7ae"/><circle cx="314" cy="372" r="14" fill="#9aa7ae" opacity=".7"/><circle cx="294" cy="356" r="18" fill="#9aa7ae" opacity=".45"/></g>`;
    }
    const FORKLIFT = `<g data-p="fork">
  <ellipse data-p="fshadow" cx="140" cy="432" rx="150" ry="6" fill="#060d11" opacity="0"/>
  <rect x="140" y="226" width="10" height="196" fill="url(#r2steel)"/><rect x="152" y="236" width="10" height="186" fill="url(#r2steel)"/><rect x="138" y="230" width="26" height="7" fill="#3d4a51"/>
  <g data-p="carriage">
    <rect x="164" y="344" width="8" height="76" fill="#26323a"/><path d="M164 352h8M164 366h8M164 380h8M164 394h8M164 408h8" stroke="#56666f" stroke-width="2"/>
    <rect x="168" y="398" width="8" height="28" fill="#1b2328"/><rect x="168" y="418" width="118" height="8" rx="2" fill="#1b2328"/><rect x="168" y="418" width="118" height="2" fill="#4d5b62"/>
  </g>
  <path d="M8 400V374Q8 350 31 350H66V390H60Q40 377 20 400Z" fill="url(#r2red)"/><rect x="10" y="378" width="58" height="10" fill="url(#r2hazard)"/>
  <path d="M60 420 V358 H118 L140 380 V420 Z" fill="url(#r2red)"/><rect x="50" y="338" width="60" height="22" rx="4" fill="url(#r2red)"/>
  <path d="M60 340 V298 Q60 292 66 292 H72 V334 H98 V340 Z" fill="#1b2328"/>
  <path d="M78 334 L100 334 L108 354" stroke="#2b3a66" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <rect x="66" y="288" width="26" height="48" rx="10" fill="#f28c28"/><rect x="66" y="312" width="26" height="4" fill="#e9eef0"/>
  <path d="M86 300 L110 318" stroke="#f28c28" stroke-width="9" stroke-linecap="round"/>
  <circle cx="80" cy="276" r="11" fill="#c99a7a"/><path d="M68 274 A12 12 0 0 1 92 274 Z" fill="#f1f5ef"/><rect x="66" y="272" width="28" height="4" rx="2" fill="#f1f5ef"/>
  <path d="M112 334 L118 314" stroke="#1b2328" stroke-width="4"/><ellipse cx="116" cy="312" rx="11" ry="3" fill="#1b2328" transform="rotate(-25 116 312)"/>
  <path d="M48 344 L54 236 M130 372 L134 236" stroke="#1b2328" stroke-width="7"/><rect x="44" y="228" width="98" height="9" rx="2" fill="#1b2328"/>
  <g class="r2-beacon">
    <ellipse class="r2-beacon-halo" cx="93" cy="219" rx="25" ry="13" fill="url(#r2beacon)"/>
    <path class="r2-beacon-beam" d="M93 219L58 211V227Z" fill="#ffad3c"/>
    <rect x="86" y="216" width="14" height="12" rx="4" fill="#26323a"/>
    <rect data-p="flamp" x="88" y="216" width="10" height="10" rx="3" fill="#ffad3c"/>
    <rect class="r2-beacon-sweep" x="92" y="217" width="2.5" height="7" rx="1" fill="#fff1c2"/>
    <path d="M87 226H99" stroke="#344853" stroke-width="2"/>
  </g>
  ${wheel('fw0', 40, 410, 20)}${wheel('fw1', 124, 406, 24)}
</g>`;

    // ---------- goods in / goods out ----------
    // Deck height 330, door 300–460. Pallet bottom rides at 430 − lift on the forks; 100 = lorry deck.
    function yard(inbound) {
        const livery = inbound ? `<rect x="352" y="318" width="136" height="8" fill="#5d7480"/>`
            : `<rect x="352" y="318" width="136" height="8" fill="#c1f279"/><path d="M414 280 L428 254 L442 280 Z" fill="none" stroke="#7fae3e" stroke-width="4" stroke-linejoin="round"/>`;
        const markup = `<defs>${DEFS}</defs>${backdrop()}${facade(inbound ? 'GOODS IN' : 'DISPATCH')}${SHUTTER}${lorry(livery)}${FORKLIFT}${PALLET}`;
        const OFF = '#4b5a62', AMBER = '#ffb340', LIT = '#ffe9a8';
        function tracks(job) {
            if (inbound) {
                const L = [[0, { x: 1240 }], [4, { x: 560 }, 'out'], [23, { x: 560 }], [27.5, { x: 1720 }, 'in']];
                const F = [[0, { x: 20 }], [4.5, { x: 20 }], [6, { x: 230 }], [7.5, { x: 230 }], [9, { x: 388 }], [10, { x: 388 }], [13, { x: 230 }], [14.5, { x: 230 }], [19, { x: 124 }], [21, { x: 124 }], [22.5, { x: 0 }]];
                return {
                    lorry: L, lw0: roll(L, 30), lw1: roll(L, 30), lw2: roll(L, 30),
                    brake: lamp([[0, 1], [4.3, 0]], '#5a1d1d', '#ff5a4f'), rev: lamp([[0, 1], [4, 0]], '#4d5255', '#fff4d6'),
                    puff: [[0, { o: 0, x: 0, y: 0 }], [23, { o: 0 }], [23.4, { o: .9 }, 'out'], [26, { o: 0, x: -40, y: -50 }, 'out']],
                    shutter: [[0, { y: 0 }], [2.5, { y: 0 }], [4.5, { y: -198 }], [24.5, { y: -198 }], [27, { y: 0 }]],
                    lamp: lamp([[0, 0], [2.5, 1], [27, 0]], OFF, LIT), cone: [[0, { o: 0 }], [2.5, { o: 0 }], [3, { o: 1 }], [27, { o: 1 }], [27.5, { o: 0 }]],
                    fork: F, fw0: roll(F, 20), fw1: roll(F, 24), flamp: lamp([[0, 1]], AMBER, AMBER),
                    fshadow: [[0, { o: 0 }], [4.5, { o: 0 }], [5.5, { o: .55 }], [16, { o: .55 }], [18, { o: 0 }]],
                    carriage: [[0, { y: -6 }], [6, { y: -6 }], [7.5, { y: -96 }], [9, { y: -96 }], [10, { y: -108 }], [13, { y: -108 }], [14.5, { y: -30 }], [19, { y: -30 }], [21, { y: 0 }]],
                    // Once the forks are clear, the pallet recedes through the open
                    // doorway before the shutter closes at 24.5 seconds.
                    pallet: [[0, { x: 1260, y: 330, sx: 1, sy: 1, o: job ? 1 : 0 }], [4, { x: 580 }, 'out'], [9, { x: 580 }], [10, { y: 322 }], [13, { x: 422 }], [14.5, { y: 400 }], [19, { x: 316 }], [21, { y: 430 }], [22.5, { x: 316, y: 430 }], [24.1, { x: 334, y: 397, sx: .72, sy: .72 }], [24.5, { o: 0 }]]
                };
            }
            const L = [[0, { x: 1240 }], [2, { x: 1240 }], [6, { x: 560 }, 'out'], [19, { x: 560 }], [23, { x: 1720 }, 'in']];
            const F = [[0, { x: 124 }], [4.5, { x: 124 }], [8, { x: 230 }], [11.5, { x: 230 }], [14, { x: 388 }], [15.5, { x: 388 }], [17.5, { x: 230 }], [19, { x: 230 }], [21, { x: 20 }]];
            return {
                lorry: L, lw0: roll(L, 30), lw1: roll(L, 30), lw2: roll(L, 30),
                brake: lamp([[0, 0], [2, 1], [6.3, 0]], '#5a1d1d', '#ff5a4f'), rev: lamp([[0, 0], [2, 1], [6, 0]], '#4d5255', '#fff4d6'),
                puff: [[0, { o: 0, x: 0, y: 0 }], [19, { o: 0 }], [19.4, { o: .9 }, 'out'], [22, { o: 0, x: -40, y: -50 }, 'out']],
                shutter: [[0, { y: 0 }], [.5, { y: 0 }], [2.5, { y: -198 }], [21, { y: -198 }], [23.5, { y: 0 }]],
                lamp: lamp([[0, 0], [.5, 1], [23.5, 0]], OFF, LIT), cone: [[0, { o: 0 }], [.5, { o: 0 }], [1, { o: 1 }], [23.5, { o: 1 }], [24, { o: 0 }]],
                fork: F, fw0: roll(F, 20), fw1: roll(F, 24), flamp: lamp([[0, 1]], AMBER, AMBER),
                fshadow: [[0, { o: 0 }], [4.5, { o: 0 }], [6, { o: .55 }], [18.5, { o: .55 }], [20, { o: 0 }]],
                carriage: [[0, { y: -30 }], [8, { y: -30 }], [11.5, { y: -108 }], [14, { y: -108 }], [15, { y: -100 }], [15.5, { y: -96 }], [17.5, { y: -96 }], [19, { y: -6 }]],
                pallet: [[0, { x: 316, y: 400, o: job ? 1 : 0 }], [4.5, { x: 316 }], [8, { x: 422 }], [11.5, { y: 322 }], [14, { x: 580 }], [15, { y: 330 }], [19, { x: 580 }], [23, { x: 1740 }, 'in']]
            };
        }
        return { markup, tracks, poster: inbound ? 11.5 : 16,
            label: job => job ? String(job.reference || '') : '',
            detail: job => job ? String(inbound ? job.supplier || 'Supplier not supplied' : job.project || 'Project not supplied') : '' };
    }

    // ---------- manufacturing ----------
    // Bench top 300. Stations: saw 250, tape applicator 530, test jig 800, hoist pick 935, packing 1080.
    function line() {
        const pendant = x => `<rect x="${x - 1}" y="0" width="2" height="40" fill="#2a3a41"/><path d="M${x - 22} 54 L${x - 12} 40 H${x + 12} L${x + 22} 54 Z" fill="#33444c"/><rect x="${x - 18}" y="52" width="36" height="4" fill="#ffe9a8" opacity=".7"/><path d="M${x - 18} 56 L${x + 18} 56 L${x + 70} 300 L${x - 70} 300 Z" fill="url(#r2cone)" opacity=".4"/>`;
        const sign = (x, text) => `<rect x="${x - 54}" y="122" width="108" height="34" rx="4" fill="#0f1d25" stroke="#3d5a69" stroke-width="2"/><rect x="${x - 54}" y="122" width="6" height="34" fill="#c1f279"/><text x="${x + 3}" y="146" text-anchor="middle" font-size="18" font-weight="700" letter-spacing="2" fill="#bdccd4">${text}</text>`;
        const markup = `<defs>${DEFS}<clipPath id="r2hook"><rect x="-120" y="118" width="240" height="400"/></clipPath></defs>
<rect width="1200" height="440" fill="url(#r2sky)"/><path d="M0 100 H1200 M0 220 H1200" stroke="#1a313c" stroke-width="2"/>
<rect x="80" y="20" width="700" height="70" fill="#1f3a47" stroke="#2c4a59" stroke-width="3"/><path d="M255 20v70M430 20v70M605 20v70" stroke="#2c4a59" stroke-width="3"/>
${pendant(250)}${pendant(530)}${pendant(800)}
${sign(250, 'CUT')}${sign(530, 'TAPE')}${sign(800, 'TEST')}
<rect y="440" width="1200" height="60" fill="url(#r2ground)"/><rect y="446" width="1200" height="4" fill="#c9a52c" opacity=".6"/>
<rect x="860" y="84" width="330" height="12" fill="#3d4a51"/><rect x="860" y="80" width="330" height="4" fill="#56666f"/><rect x="870" y="0" width="8" height="84" fill="#2a3a41"/><rect x="1170" y="0" width="8" height="84" fill="#2a3a41"/>
<rect x="40" y="300" width="960" height="14" fill="#4d616c"/><rect x="40" y="300" width="960" height="3" fill="#7b8f99"/><rect x="40" y="314" width="960" height="16" fill="#2c3b43"/>
<path d="M60 330v110M520 330v110M980 330v110" stroke="#26343b" stroke-width="14"/><rect x="50" y="396" width="940" height="8" fill="#26343b"/>
<rect x="990" y="330" width="200" height="12" fill="#4d616c"/><rect x="990" y="330" width="200" height="3" fill="#7b8f99"/><path d="M1004 342v98M1176 342v98" stroke="#26343b" stroke-width="12"/><g transform="translate(0 236)">${sign(1090, 'PACK')}</g>
<rect x="44" y="236" width="80" height="64" fill="none" stroke="#3d4a51" stroke-width="4"/><path d="M48 248h72M48 262h72M48 276h72M48 290h72" stroke="url(#r2alu)" stroke-width="9"/>
<rect x="196" y="286" width="140" height="14" rx="3" fill="#26323a"/><rect x="318" y="244" width="10" height="56" fill="#3d4a51"/><ellipse cx="250" cy="288" rx="46" ry="5" fill="#33434b"/>
<path d="M494 300 V160 M566 300 V160" stroke="#3d4a51" stroke-width="9"/><rect x="486" y="152" width="88" height="10" fill="#3d4a51"/>
<g transform="translate(530 202)"><g data-p="reel" data-origin="c"><circle r="40" fill="#1e2a31"/><circle r="34" fill="none" stroke="#56666f" stroke-width="3"/><circle r="26" fill="none" stroke="#56666f" stroke-width="3"/><circle r="18" fill="none" stroke="#56666f" stroke-width="3"/><path d="M0 -40 V-12 M40 0 H12" stroke="#fff3c9" stroke-width="3" opacity=".5"/><circle r="8" fill="#8d99a0"/></g></g>
<path d="M552 230 L536 282" stroke="#d6dde1" stroke-width="3"/>
<g transform="translate(530 286)"><g data-p="roller" data-origin="c"><circle r="9" fill="#8d99a0"/><path d="M-9 0 H9" stroke="#56666f" stroke-width="2"/></g></g>
<path d="M754 300 V172 M846 300 V172" stroke="#3d4a51" stroke-width="9"/><rect x="746" y="164" width="108" height="10" fill="#3d4a51"/>
<g data-p="probe"><path d="M770 174 V250 M830 174 V250" stroke="#8d99a0" stroke-width="5"/><rect x="760" y="248" width="20" height="16" rx="3" fill="#26323a"/><rect x="820" y="248" width="20" height="16" rx="3" fill="#26323a"/><rect x="764" y="262" width="12" height="4" fill="#d9534f"/><rect x="824" y="262" width="12" height="4" fill="#d9534f"/></g>
<rect x="872" y="258" width="62" height="42" rx="4" fill="#26323a" stroke="#3d4a51" stroke-width="2"/><circle data-p="lamp" cx="903" cy="279" r="8" fill="#4b5a62"/><path d="M872 270 C 850 260, 856 200, 846 190" fill="none" stroke="#1b2328" stroke-width="4"/>
<g data-p="cartonB"><rect x="-100" y="250" width="200" height="80" fill="#7d5a33"/></g>
<g data-p="glow" opacity="0"><ellipse cx="800" cy="284" rx="150" ry="40" fill="url(#r2warm)"/></g>
<g data-p="piece"><rect x="-88" y="284" width="176" height="16" fill="#56666f"/><rect x="-85" y="286" width="170" height="14" fill="url(#r2alu)"/><rect data-p="tape" data-origin="right center" x="-83" y="287" width="166" height="4" fill="#4a5a62"/><rect x="-85" y="282" width="170" height="5" fill="#eef3f5" opacity=".85"/></g>
<g data-p="cartonF"><rect x="-100" y="262" width="200" height="68" fill="url(#r2box)" stroke="#8a6236" stroke-width="2"/><rect x="-62" y="276" width="124" height="38" rx="3" fill="#f6f8f6"/><text class="r2-label" data-fit="116" x="0" y="301" text-anchor="middle" font-size="19" font-weight="700" fill="#16242b"></text>
  <rect data-p="flapL" data-origin="left bottom" x="-100" y="252" width="98" height="10" fill="#c0935c" stroke="#8a6236"/><rect data-p="flapR" data-origin="right bottom" x="2" y="252" width="98" height="10" fill="#b88a52" stroke="#8a6236"/>
  <rect data-p="seal" x="-100" y="254" width="200" height="8" fill="#d8c08f" opacity="0"/></g>
<g data-p="trolley"><g clip-path="url(#r2hook)"><g data-p="hook"><rect x="-1.5" y="-300" width="3" height="452" fill="#8d99a0"/><rect x="-10" y="150" width="20" height="16" rx="3" fill="#f2c230"/><path d="M0 166 V176" stroke="#26323a" stroke-width="4"/><rect x="-92" y="176" width="184" height="6" fill="#26323a"/></g></g>
  <rect x="-28" y="96" width="56" height="24" rx="4" fill="#f2c230"/><circle cx="-16" cy="94" r="5" fill="#26323a"/><circle cx="16" cy="94" r="5" fill="#26323a"/></g>
<g transform="translate(250 226)"><g data-p="arm" data-origin="80 0" ><circle cx="80" cy="0" r="11" fill="#26323a"/><rect x="0" y="-8" width="80" height="16" rx="6" fill="#33444c"/>
  <g data-p="blade" data-origin="c"><circle r="44" fill="#b7c2c8"/><circle r="44" fill="none" stroke="#7b8b93" stroke-width="4" stroke-dasharray="3 4"/><circle r="10" fill="#56666f"/><path d="M0 -30 V-14 M26 15 L12 7 M-26 15 L-12 7" stroke="#7b8b93" stroke-width="3"/></g>
  <path d="M-52 4 A52 52 0 0 1 52 4" fill="#2f6fb0" opacity=".92"/><rect x="12" y="-40" width="44" height="26" rx="8" fill="#2f6fb0"/><path d="M-10 -30 Q-20 -62 10 -64 H30" fill="none" stroke="#1b2328" stroke-width="9" stroke-linecap="round"/></g></g>
<g data-p="sparks" opacity="0"><path d="M238 292 L196 314 M240 294 L204 326 M244 295 L222 330 M236 290 L190 298" stroke="#ffcf5a" stroke-width="3" stroke-linecap="round"/></g>`;
        function tracks(job) {
            const X = [[0, { x: 165, y: 0, o: job ? 1 : 0 }], [2.5, { x: 335 }], [4.5, { x: 335 }], [7, { x: 445 }], [10.5, { x: 615 }, 'lin'], [12.5, { x: 800 }], [17, { x: 800 }], [19, { x: 935 }], [19.6, { y: 0 }], [20.2, { y: -110 }], [21.4, { x: 1080 }], [22, { y: 20 }], [24.5, { x: 1080 }], [27.5, { x: 1400 }]];
            const C = [[0, { x: 1080 }], [24.5, { x: 1080 }], [27.5, { x: 1400 }]];
            const on = (a, b, fade = .4) => [[0, { o: 0 }], [a, { o: 0 }], [a + fade, { o: 1 }], [b, { o: 1 }], [b + fade, { o: 0 }]];
            return {
                piece: X, cartonB: C, cartonF: C,
                arm: [[0, { r: 0 }], [2.5, { r: 0 }], [3.5, { r: -16 }], [4.5, { r: 0 }]],
                blade: [[0, { r: 0 }], [1.5, { r: 0 }], [5.5, { r: 2160 }, 'lin']], sparks: on(3, 3.8, .15),
                reel: [[0, { r: 0 }], [7, { r: 0 }], [10.5, { r: -420 }, 'lin']], roller: [[0, { r: 0 }], [7, { r: 0 }], [10.5, { r: 1300 }, 'lin']],
                tape: [[0, { sx: 0, fill: '#4a5a62' }], [7, { sx: 0 }], [10.5, { sx: 1 }, 'lin'], [13.3, { fill: '#4a5a62' }], [13.7, { fill: '#fff3c9' }], [16.3, { fill: '#fff3c9' }], [16.7, { fill: '#4a5a62' }]],
                glow: on(13.3, 16.3),
                probe: [[0, { y: 0 }], [12.5, { y: 0 }], [13.3, { y: 18 }], [16.3, { y: 18 }], [17, { y: 0 }]],
                lamp: lamp([[0, 0], [13.6, 1], [17, 0]], '#4b5a62', '#ffd75e'),
                trolley: [[0, { x: 1080 }], [18, { x: 1080 }], [19, { x: 935 }], [20.2, { x: 935 }], [21.4, { x: 1080 }]],
                hook: [[0, { y: 0 }], [19, { y: 0 }], [19.6, { y: 100 }], [20.2, { y: -10 }], [21.4, { y: -10 }], [22, { y: 120 }], [22.6, { y: 0 }]],
                flapL: [[0, { r: -98 }], [22.6, { r: -98 }], [23.4, { r: 0 }]], flapR: [[0, { r: 98 }], [22.8, { r: 98 }], [23.6, { r: 0 }]],
                seal: [[0, { o: 0 }], [23.6, { o: 0 }], [24.1, { o: 1 }]]
            };
        }
        return { markup, tracks, poster: 15, label: job => job ? fit(job.reference, 18) : '' };
    }

    // ---------- subscriptions ----------
    // Architainment office → cloud → customer building whose floor-edge LED lines light in turn.
    function remote(tone) {
        const floors = Array.from({ length: 6 }, (_, i) => {
            const y = 434 - i * 48;
            return `<rect x="832" y="${y - 42}" width="276" height="38" fill="#12222b"/><path d="M878 ${y - 42}v38M924 ${y - 42}v38M970 ${y - 42}v38M1016 ${y - 42}v38M1062 ${y - 42}v38" stroke="#24404d" stroke-width="3"/><rect data-p="f${i}" x="830" y="${y - 4}" width="280" height="5" fill="#2e3f47"/>`;
        }).join('');
        const cloud = fill => `<circle cx="560" cy="170" r="42" fill="${fill}"/><circle cx="612" cy="140" r="58" fill="${fill}"/><circle cx="666" cy="166" r="44" fill="${fill}"/><rect x="530" y="166" width="170" height="48" rx="24" fill="${fill}"/>`;
        const markup = `<defs>${DEFS}<linearGradient id="r2wash" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></linearGradient>
<linearGradient id="r2wash2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#8fd3ff" stop-opacity=".55"/><stop offset="1" stop-color="#8fd3ff" stop-opacity="0"/></linearGradient></defs>
<rect width="1200" height="440" fill="#0f1d27"/>
<rect x="430" y="330" width="80" height="110" fill="#14262f"/><rect x="520" y="300" width="60" height="140" fill="#162a34"/><rect x="700" y="320" width="90" height="120" fill="#14262f"/>
<rect y="440" width="1200" height="60" fill="url(#r2ground)"/><path d="M0 470 H1200" stroke="#56666f" stroke-width="3" stroke-dasharray="40 30"/>
<rect x="40" y="226" width="284" height="214" fill="#22394a"/><rect x="40" y="218" width="284" height="10" fill="#16252d"/>
<text class="r2-hq-brand" x="182" y="194" text-anchor="middle" font-size="24" font-weight="700" letter-spacing="2" fill="#f1f5ef">ARCHITAINMENT</text>
<rect x="60" y="244" width="244" height="38" fill="#12222b"/><path d="M121 244v38M182 244v38M243 244v38" stroke="#2c4a59" stroke-width="3"/>
<rect x="60" y="300" width="244" height="130" fill="#0d1a21" stroke="#2c4a59" stroke-width="3"/>
<rect x="96" y="388" width="140" height="8" fill="#33444c"/><rect x="110" y="396" width="6" height="34" fill="#26323a"/><rect x="216" y="396" width="6" height="34" fill="#26323a"/>
<rect x="150" y="380" width="30" height="8" fill="#26323a"/><rect data-p="screen" x="124" y="334" width="84" height="48" rx="3" fill="#16262e"/>
<path d="M74 430 V392 Q74 372 92 372 Q110 372 110 392 V430 Z" fill="#081218"/><circle cx="92" cy="360" r="13" fill="#081218"/>
<rect x="252" y="318" width="44" height="112" fill="#182a33" stroke="#2c4a59" stroke-width="2"/>
<g data-p="rack" opacity=".15">${[0, 1, 2, 3, 4, 5].map(i => `<rect x="260" y="${328 + i * 16}" width="28" height="3" fill="#c1f279"/>`).join('')}</g>
<path d="M300 226 C 360 120, 450 110, 534 168" fill="none" stroke="#3d5a69" stroke-width="5" stroke-dasharray="12 10"/>
<path data-p="l0" data-len="" d="M300 226 C 360 120, 450 110, 534 168" fill="none" stroke="#c1f279" stroke-width="6" stroke-linecap="round"/>
<path d="M694 168 C 780 110, 900 100, 950 124" fill="none" stroke="#3d5a69" stroke-width="5" stroke-dasharray="12 10"/>
<path data-p="l1" data-len="" d="M694 168 C 780 110, 900 100, 950 124" fill="none" stroke="#c1f279" stroke-width="6" stroke-linecap="round"/>
${cloud('#29424f')}<g data-p="cglow" opacity="0">${cloud('#3c6a82')}</g>
<rect x="584" y="146" width="62" height="12" rx="2" fill="#16252d"/><rect x="584" y="162" width="62" height="12" rx="2" fill="#16252d"/><rect x="584" y="178" width="62" height="12" rx="2" fill="#16252d"/>
<path d="M592 152h6M592 168h6M592 184h6" stroke="#c1f279" stroke-width="3"/>
${floors}
<g data-p="wash" opacity="0"><rect x="830" y="146" width="280" height="294" fill="url(#r2wash)"/></g><g data-p="wash2" opacity="0"><rect x="830" y="146" width="280" height="294" fill="url(#r2wash2)"/></g>
<rect class="site" x="830" y="146" width="280" height="294" fill="none" stroke="#49616e" stroke-width="3"/>
<g class="r2-site-roof"><rect x="944" y="126" width="40" height="20" rx="3" fill="#26323a" stroke="#718b99" stroke-width="2"/><circle data-p="ctl" cx="964" cy="136" r="6" fill="#4b5a62"/></g>
${[850, 910, 970, 1030, 1090].map(x => `<rect x="${x - 8}" y="432" width="16" height="8" rx="2" fill="#33444c"/>`).join('')}
<g class="site-labels"><rect x="800" y="58" width="378" height="47" rx="6" fill="#10232b" fill-opacity=".85" stroke="#658191" stroke-opacity=".4"/>
<text class="site-customer" text-anchor="middle" font-size="16" fill="#bdccd4"><tspan data-fit="344" data-auto-fit="16" x="989" y="79"></tspan><tspan data-fit="344" data-auto-fit="16" x="989" y="97"></tspan></text></g>`;
        const DIM = '#2e3f47', WARM = '#ffe7a8';
        function tracks(job) {
            const t = job ? tone(job) : 'idle';
            const floorsAt = list => Object.fromEntries(Array.from({ length: 6 }, (_, i) => ['f' + i, list(i)]));
            const still = { screen: [[0, { fill: '#16262e' }]], rack: [[0, { o: .3 }]], cglow: [[0, { o: .2 }]], l0: [[0, { draw: 0 }]], l1: [[0, { draw: 0 }]], ctl: [[0, { fill: t === 'idle' ? '#4b5a62' : '#f5c779' }]], wash: [[0, { o: 0 }]], wash2: [[0, { o: 0 }]], ...floorsAt(() => [[0, { fill: DIM }]]) };
            if (t === 'idle' || t === 'paused' || t === 'unknown' || (t === 'bad' && !job.ends)) return still;
            const common = {
                screen: [[0, { fill: '#16262e' }], [.6, { fill: '#16262e' }], [1.4, { fill: '#4f8fae' }]],
                rack: [[0, { o: .15 }], [1, { o: .15 }], [1.8, { o: 1 }]],
                l0: [[0, { draw: 0 }], [2, { draw: 0 }], [5, { draw: 1 }]], l1: [[0, { draw: 0 }], [5, { draw: 0 }], [8, { draw: 1 }]],
                cglow: [[0, { o: 0 }], [4.2, { o: 0 }], [4.8, { o: 1 }], [7, { o: 1 }], [8.5, { o: .4 }]]
            };
            if (t === 'bad') {
                // Ended contract: the session reaches the site but the lighting only stutters, then stays dark.
                const flicker = [[0, 0], [8.6, 1], [9, 0], [9.4, 1], [9.9, 0], [10.4, 1], [11, 0]];
                return { ...common, ctl: lamp([[0, 0], [8, 1]], '#4b5a62', '#f27979'), wash: [[0, { o: 0 }]], wash2: [[0, { o: 0 }]], ...floorsAt(() => lamp(flicker, DIM, WARM)) };
            }
            return {
                ...common, ctl: lamp([[0, 0], [8, 1]], '#4b5a62', '#7fe08a'),
                ...floorsAt(i => [[0, { fill: DIM }], [8.5 + i * .5, { fill: DIM }], [9 + i * .5, { fill: WARM }], [22.5, { fill: WARM }], [23.6, { fill: DIM }]]),
                wash: [[0, { o: 0 }], [11, { o: 0 }], [12, { o: 1 }], [22.5, { o: 1 }], [23.6, { o: 0 }]],
                wash2: [[0, { o: 0 }], [15, { o: 0 }], [17, { o: 1 }], [19.5, { o: 1 }], [21.5, { o: 0 }]]
            };
        }
        return { markup, tracks, poster: 14,
            label: job => job ? String(job.project || job.customer || '') : '',
            customer: job => job ? String(job.customer || 'Customer not supplied') : '' };
    }

    function create(host, kind, opts = {}) {
        if (!document.getElementById('r2d-style')) {
            const style = document.createElement('style'); style.id = 'r2d-style'; style.textContent = STYLE; document.head.append(style);
        }
        const tone = opts.tone || (() => '');
        const scene = kind === 'goods_in' ? yard(true) : kind === 'goods_out' ? yard(false) : kind === 'manufacturing' ? line() : remote(tone);
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'r2d'); svg.setAttribute('viewBox', '0 0 1200 500');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); svg.setAttribute('aria-hidden', 'true');
        svg.innerHTML = scene.markup;
        if (root.ReplayArtwork) root.ReplayArtwork.enhance(svg, kind);
        host.prepend(svg);
        if (['goods_in', 'goods_out', 'subscriptions'].includes(kind) && root.WarehouseWeather) root.WarehouseWeather.mount(svg, host, kind);
        const visibility = () => svg.classList.toggle('motion-paused', document.hidden);
        document.addEventListener('visibilitychange', visibility); visibility();
        host.setAttribute('aria-label', {
            goods_in: 'Illustration of a lorry delivery unloaded by forklift into goods in. Illustrated replay, not live vehicle tracking.',
            goods_out: 'Illustration of a forklift loading a pallet from dispatch onto a lorry. Illustrated replay, not live vehicle tracking.',
            manufacturing: 'Illustration of an LED profile being cut, taped, light-tested and boxed. Illustrated replay, not a recorded quality-test result.'
        }[kind] || 'Illustration of the Architainment office connecting through the cloud to a customer building. Illustration only, not a live connection status.');
        const run = engine(svg, scene);
        run.load(null); run.render(0, 1, false);
        const fitText = el => {
            el.removeAttribute('textLength');
            // Text advance omits glyph overhangs; reserve space at both edges.
            const room = +el.dataset.fit - (el.dataset.autoFit ? 6 : 0);
            if (el.dataset.autoFit) {
                const maximum = Number(el.dataset.autoFit); el.setAttribute('font-size', maximum);
                const measured = el.getComputedTextLength();
                if (measured > room) el.setAttribute('font-size', Math.max(12, maximum * room / measured));
            }
            if (room && el.getComputedTextLength() > room) { el.setAttribute('textLength', room); el.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
        };
        const linesFor = (text, limit) => {
            const words = text.split(/\s+/); let lines = [text, ''];
            if (text.length > limit && words.length > 1) {
                let split = 1, distance = Infinity;
                for (let i = 1; i < words.length; i++) {
                    const d = Math.abs(words.slice(0, i).join(' ').length - text.length / 2);
                    if (d < distance) { distance = d; split = i; }
                }
                lines = [words.slice(0, split).join(' '), words.slice(split).join(' ')];
            }
            return lines;
        };
        return {
            label(job) {
                svg.querySelectorAll('.r2-label,.site-name').forEach(el => {
                    el.textContent = scene.label(job); fitText(el);
                });
                const detail = svg.querySelector('.r2-detail');
                if (detail) {
                    const text = (scene.detail?.(job) || '').trim(), lines = linesFor(text, 15);
                    detail.querySelectorAll('tspan').forEach((el, i) => { el.textContent = lines[i]; fitText(el); });
                    detail.setAttribute('aria-label', text);
                }
                const customer = svg.querySelector('.site-customer');
                if (customer) {
                    const text = (scene.customer?.(job) || '').trim(), lines = linesFor(text, 38);
                    customer.querySelectorAll('tspan').forEach((el, i) => { el.textContent = lines[i]; fitText(el); });
                    customer.setAttribute('aria-label', text);
                    svg.querySelector('.site-labels').style.display = job ? '' : 'none';
                }
                const site = svg.querySelector('.site');
                if (site) site.setAttribute('class', 'site' + (job && tone(job) ? ' tone-' + tone(job) : ''));
                run.load(job); run.render(0, 1, false);
            },
            render(t, speed = 1, still = false) { svg.classList.toggle('motion-still', still); run.render(t, speed, still); }
        };
    }
    root.Replay2D = { create };
})(window);
