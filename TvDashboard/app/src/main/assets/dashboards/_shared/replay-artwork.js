/* Static SVG detailing, constructed once. Moving details belong to their existing
   mechanical parent, so there are no extra timers, canvases or WebGL contexts. */
(function (root) {
  'use strict';
  const repeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
  const bolts = (xs, y) => xs.map(x => `<circle cx="${x}" cy="${y}" r="2" fill="#d6e2e5"/><circle cx="${x}" cy="${y}" r=".8" fill="#50616c"/>`).join('');
  function enhance(svg, kind) {
    const add = (selector, markup, first = false) => {
      const node = svg.querySelector(selector);
      if (node) node.insertAdjacentHTML(first ? 'afterbegin' : 'beforeend', markup);
    };
    add('defs', `<linearGradient id="art-red" x2="0" y2="1"><stop stop-color="#ff8580"/><stop offset=".4" stop-color="#df3544"/><stop offset="1" stop-color="#94172c"/></linearGradient>
      <linearGradient id="art-wall" x2="0" y2="1"><stop stop-color="#496370"/><stop offset="1" stop-color="#263e4b"/></linearGradient>
      <linearGradient id="art-cloud" x2=".25" y2="1"><stop stop-color="#f0faff"/><stop offset=".45" stop-color="#b5d5e6"/><stop offset="1" stop-color="#537b98"/></linearGradient>
      <linearGradient id="art-metal" x2="0" y2="1"><stop stop-color="#e4edf0"/><stop offset=".35" stop-color="#9cb2bf"/><stop offset=".5" stop-color="#546b79"/><stop offset="1" stop-color="#9ab0bb"/></linearGradient>
      <pattern id="art-vents" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#233742"/><path d="M1 1h4" stroke="#6a8290" stroke-width="1.5"/></pattern>
      <pattern id="art-leds" width="12" height="4" patternUnits="userSpaceOnUse"><rect width="12" height="4" fill="#c7b679"/><rect x="3" width="5" height="4" fill="#fff4bf"/></pattern>`);
    if (kind === 'goods_in' || kind === 'goods_out') yard();
    else if (kind === 'manufacturing') factory();
    else service();

    function yard() {
      // Architectural depth behind the vehicles; the existing loading aperture stays clear.
      const background = document.createElementNS(svg.namespaceURI, 'g');
      background.innerHTML = `<path d="M0 102H480L510 122V430H478V122H0Z" fill="#0c1b24"/>
        <path d="M482 124l28 12v294h-28z" fill="#37515f"/>
        <path d="M510 428H1200M0 480H1200" stroke="#8399a3" opacity=".18"/>
        ${repeat(10, i => `<path d="M${520 + i * 73} 429l35 71" stroke="#9aacb1" opacity=".07"/>`)}
        <path d="M540 414H1100M540 394H1100" stroke="#617784" stroke-width="2" opacity=".32"/>
        ${repeat(12, i => `<path d="M${544 + i * 49} 378v48" stroke="#617784" opacity=".3"/>`)}
        <rect x="548" y="444" width="100" height="7" fill="#c1cad0" opacity=".5"/>
        <rect x="760" y="444" width="100" height="7" fill="#c1cad0" opacity=".5"/>`;
      svg.insertBefore(background, svg.querySelector('[data-p="lorry"]'));
      add('[data-p="lorry"]', `<path d="M12 326l24-12h296l14 16H12Z" fill="#9caab0"/>
        ${repeat(17, i => `<path d="M${22 + i * 18} 321v8" stroke="#596e7a"/>`)}
        <path d="M20 356H250V382H20" fill="none" stroke="#748994" stroke-width="4"/>
        <path d="M28 360v18M104 360v18M244 360v18" stroke="#3e535f" stroke-width="5"/>
        <rect x="194" y="365" width="47" height="27" rx="3" fill="#344b59" stroke="#8b9da6"/>
        <path d="M209 368v20M228 368v20" stroke="#1c2b34" stroke-width="2"/>
        <rect x="359" y="238" width="25" height="63" rx="4" fill="url(#r2glass)"/>
        <path d="M360 307h25v73h-25z" fill="none" stroke="#81949f"/>
        <path d="M359 322h24M359 327h24M359 332h24" stroke="#8599a4"/>
        <rect x="354" y="213" width="96" height="9" rx="4" fill="#dfe7e9"/>
        <path d="M361 216h14M429 216h14" stroke="#eeb86b" stroke-width="3"/>
        <path d="M410 287l43-7" stroke="#8faab7" stroke-width="2"/>
        <path d="M268 364v23M326 364v23" stroke="#526672" stroke-width="5"/>
        <path d="M401 389h36M401 395h36" stroke="#92a5ad" stroke-width="2"/>
        ${bolts([24, 90, 180, 260, 320], 340)}
        ${repeat(5, i => `<rect x="${24 + i * 64}" y="336" width="10" height="3" rx="1" fill="#ffcf80"/>`)}
        <path d="M16 422h22M166 422h22M454 422h20" stroke="#101a20" stroke-width="7"/>`);
      // Finish and hydraulics follow the forklift, including when it reverses.
      svg.querySelectorAll('[fill="url(#r2red)"]').forEach(el => el.setAttribute('fill', 'url(#art-red)'));
      add('[data-p="fork"]', `<path d="M13 369q0-13 17-13h24v17H13Z" fill="url(#art-red)"/>
        <path d="M17 365h30M17 369h30M17 373h30" stroke="#8e2132" stroke-width="2"/>
        <path d="M67 367h43l20 17v12H67Z" fill="none" stroke="#ffaaa3" stroke-width="1.5"/>
        <rect x="77" y="376" width="27" height="12" rx="2" fill="#ac2436"/>
        ${bolts([72, 112], 401)}
        <path d="M145 240v168" stroke="#c3d2da" stroke-width="2"/>
        <path d="M156 251v147" stroke="#192c36" stroke-width="3" stroke-dasharray="4 3"/>
        <path d="M139 370q-15-62 6-115" fill="none" stroke="#0e1b23" stroke-width="3"/>
        <path d="M50 232h88" stroke="#6a808c" stroke-width="2"/>
        <rect x="127" y="244" width="7" height="12" rx="2" fill="#ffe3a4"/>
        <path d="M69 292v18M86 292v18" stroke="#f8f0c4" stroke-width="3"/>
        <path d="M73 277h9l5 4h-8" fill="#e0b18e"/>
        <path d="M99 345l12 12h-15" fill="#14232b"/>
        <path d="M110 336l-3-13M120 337l4-12" stroke="#899ca4" stroke-width="2"/>
        <circle cx="107" cy="321" r="3" fill="#182731"/>
        <rect x="17" y="387" width="7" height="5" rx="1" fill="#f37751"/>`);
      add('[data-p="pallet"]', `<path d="M3-58h118M3-20h118M3-103h6M114-103h6" stroke="#fff1d2" opacity=".35"/>
        <path d="M6-10h5M58-10h7M113-10h7" stroke="#b89569" stroke-width="2"/>
        <path d="M10-43v13m-4-8 4-5 4 5M22-43v13m-4-8 4-5 4 5" fill="none" stroke="#59452f" stroke-width="1.5"/>
        <rect x="87" y="-49" width="28" height="21" fill="#ede3cb"/>
        ${repeat(9, i => `<path d="M${90 + i * 2.6}-45v13" stroke="#544b40" stroke-width="${i % 3 ? 1 : 2}"/>`)}
        <path d="M4-66h116M4-60h116M4-25h116" stroke="#e4f5ff" opacity=".3"/>`);
      // Small fixed details make the warehouse read as a place, rather than a diagram.
      const buildingDetails = document.createElementNS(svg.namespaceURI, 'g');
      buildingDetails.innerHTML = `<path d="M17 126v270h20" fill="none" stroke="#708894" stroke-width="5"/>
        <path d="M40 302h216M40 309h216" stroke="#132833" stroke-width="3"/>
        <rect x="52" y="332" width="40" height="68" rx="2" fill="#233844" stroke="#69818e"/>
        <path d="M59 343h25M59 349h25M59 355h25" stroke="#708691"/>
        <circle cx="83" cy="375" r="3" fill="#bac7cb"/>
        <rect x="252" y="344" width="16" height="27" rx="2" fill="#192b35" stroke="#718891"/>
        <circle cx="260" cy="352" r="3" fill="#c9d8ca"/>
        <circle cx="260" cy="363" r="3" fill="#d49867"/>
        <path d="M310 454h143" stroke="#bbcad1" stroke-width="3" stroke-dasharray="18 8"/>
        <text x="380" y="489" text-anchor="middle" font-size="16" letter-spacing="4" fill="#b6c4cb">${kind === 'goods_in' ? 'RECEIVING' : 'DISPATCH'}</text>`;
      svg.insertBefore(buildingDetails, svg.querySelector('[data-p="lorry"]'));
    }
    function factory() {
      const operator = document.createElementNS(svg.namespaceURI, 'g');
      operator.innerHTML = `<path d="M655 302l-5 118h17l10-99 11 99h17l-9-118" fill="#243a50"/>
        <path d="M646 419h23v11h-31q0-8 8-11M687 419h18l10 11h-29Z" fill="#11232d"/>
        <path d="M655 230q24-11 42 4l7 64h-54Z" fill="#da8e3e"/>
        <path d="M662 235v59M691 238v56M653 277h47" stroke="#e4e5b7" stroke-width="5"/>
        <path d="M660 238l-15 41 22 11M693 242l19 28 20-8" fill="none" stroke="#da8e3e" stroke-width="12" stroke-linecap="round"/>
        <path d="M662 288l8 3M730 262l7-3" stroke="#c8987b" stroke-width="8" stroke-linecap="round"/>
        <path d="M668 230v-11h13v14" fill="#b78368"/>
        <path d="M664 204h24v15l-7 9h-13l-6-14Z" fill="#d7a889"/>
        <path d="M663 211h26" stroke="#506978" stroke-width="3"/><path d="M679 213v6h8" fill="none" stroke="#ad7c64"/>
        <path d="M659 205q0-19 17-19t17 19Z" fill="#e2e9e8"/><path d="M655 205h42M674 187v15" stroke="#f8faf3" stroke-width="4"/>
        <path d="M667 247v12h11v-12Z" fill="#b96e2c"/>`;
      svg.insertBefore(operator, svg.querySelector('rect[x="40"][y="300"]'));
      const equipment = `<g opacity=".7"><path d="M18 98v321M1190 98v321" stroke="#587382" stroke-width="6"/>
        <path d="M20 112h1160" stroke="#526a78" stroke-width="4"/>
        ${repeat(14, i => `<rect x="${25 + i * 85}" y="108" width="9" height="8" fill="#a7bac3"/>`)}</g>
        <path d="M70 406v22h898v-22" fill="none" stroke="#5b7482" stroke-width="3"/>
        ${repeat(43, i => `<rect x="${45 + i * 22}" y="303" width="16" height="8" rx="4" fill="url(#art-metal)"/>`)}
        ${repeat(9, i => `<rect x="${992 + i * 22}" y="333" width="16" height="6" rx="3" fill="url(#art-metal)"/>`)}
        <path d="M68 433h30M504 433h32M964 433h32" stroke="#12232c" stroke-width="8"/>
        <rect x="359" y="343" width="94" height="49" rx="3" fill="#314d5d" stroke="#678392"/>
        <rect x="366" y="351" width="50" height="31" fill="url(#art-vents)"/>
        <circle cx="437" cy="361" r="5" fill="#d69863"/><circle cx="437" cy="378" r="5" fill="#182c38"/>
        <path d="M460 347c32 0 12 44 42 44h70" fill="none" stroke="#162831" stroke-width="5"/>
        <rect x="628" y="334" width="96" height="67" rx="3" fill="#263e4d" stroke="#6a8492"/>
        <path d="M636 346h80M636 352h80M636 358h80" stroke="#4d697a" stroke-width="2"/>
        <path d="M640 391h14M662 391h14M684 391h14" stroke="#a7b7bf" stroke-width="3"/>
        <path d="M777 354v35h69v-35" fill="none" stroke="#b27b48" stroke-width="3"/>
        <rect x="883" y="345" width="46" height="45" fill="url(#art-vents)" stroke="#627c8b"/>
        <path d="M0 470h1200" stroke="#708996" opacity=".25"/>
        ${repeat(5, i => `<path d="M${80 + i * 245} 440l-45 60" stroke="#607d8c" opacity=".2"/>`)}
        <text x="75" y="477" fill="#a4bac4" font-size="16" letter-spacing="4">PROFILE ASSEMBLY</text>`;
      svg.insertAdjacentHTML('beforeend', equipment);
      add('[data-p="arm"]', `<path d="M-40-7a42 42 0 0 1 78-8" fill="none" stroke="#70a0be" stroke-width="2"/>
        <path d="M24-33h23M24-28h23M24-23h23" stroke="#173b52" stroke-width="2"/>
        ${bolts([-30, 30], -13)}<circle cx="80" cy="0" r="5" fill="url(#art-metal)"/>`);
      add('[data-p="piece"]', `<path d="M-82 293H82M-82 297H82" stroke="#e2ecf0" stroke-width="1"/><path d="M-88 284v16h7v-16Z" fill="#324e5d"/>`);
      add('[data-p="reel"]', `<circle r="31" fill="none" stroke="#c7b679" stroke-width="2" stroke-dasharray="3 4"/>
        <circle r="6" fill="#293f4d"/>`);
      add('[data-p="probe"]', `<path d="M767 185q-14 24 0 56M833 185q14 24 0 56" fill="none" stroke="#b8584b" stroke-width="2"/>`);
      add('[data-p="trolley"]', `<rect x="-23" y="101" width="46" height="12" fill="url(#r2hazard)"/>`);
      add('[data-p="cartonF"]', `<path d="M-95 318h190" stroke="#e5c18d"/><path d="M-80 279v22m-5-16 5-6 5 6" fill="none" stroke="#765331" stroke-width="2"/>`);
    }
    function service() {
      // Shaded cloud and architectural surfaces. Status colours remain driven by the contract.
      svg.querySelectorAll('[fill="#29424f"]').forEach(el => el.setAttribute('fill', 'url(#art-cloud)'));
      const rackDetail = repeat(6, i => `<rect x="255" y="${323 + i * 16}" width="39" height="12" rx="1" fill="#203948" stroke="#5a7788" stroke-width=".7"/><path d="M258 ${328 + i * 16}h18" stroke="#091e2a" stroke-width="2"/><circle cx="287" cy="${328 + i * 16}" r="1.5" fill="#81a6b6"/>`);
      add('[data-p="rack"]', rackDetail, true);
      const serviceDetails = document.createElementNS(svg.namespaceURI, 'g');
      serviceDetails.setAttribute('class', 'r2-service-architecture');
      serviceDetails.innerHTML = `<path d="M324 218l30 20v202h-30Z" fill="#172e3c"/>
        <path d="M1110 146l36 24v270h-36Z" fill="#1c3443"/>
        ${repeat(6, i => `<path d="M1112 ${156 + i * 48}l31 21v30l-31-21Z" fill="#355465"/><path d="M840 ${153 + i * 48}h258" stroke="#638294" opacity=".5"/>`)}
        <path d="M854 147v281M1102 147v281" stroke="#9cb7c7" stroke-width="2" opacity=".35"/>
        <path d="M833 158l80 118M940 156l157 226" stroke="#a7cadd" stroke-width="13" opacity=".06"/>
        <rect x="940" y="399" width="64" height="41" fill="#152b38" stroke="#597a8b"/>
        <path d="M972 400v40" stroke="#7d9aaa"/>
        <path d="M966 422v9M978 422v9" stroke="#b0c3cb" stroke-width="2"/>
        <path d="M922 395h100" stroke="#78919e" stroke-width="4"/>
        <rect x="150" y="340" width="50" height="2" fill="#89b6cf" opacity=".4"/>
        <path d="M137 354h13M137 360h28M137 366h19" stroke="#6d94a9" stroke-width="2" opacity=".5"/>
        <path d="M122 398h110" stroke="#718a97" stroke-width="2"/>
        <path d="M586 149h56M586 165h56M586 181h56" stroke="#5b7b8e"/>
        ${repeat(3, i => `<path d="M607 ${152 + i * 16}h24" stroke="#7896a6" stroke-width="2"/>`)}
        <path d="M0 445h1200M0 494h1200" stroke="#728b97" opacity=".22"/>
        <path d="M392 439v-95h45M754 439v-76h-32" fill="none" stroke="#63818f" stroke-width="4"/>
        <path d="M421 347h22M712 366h22" stroke="#e4d5aa" stroke-width="4"/>
        <text x="175" y="487" text-anchor="middle" fill="#abc4d2" font-size="15" letter-spacing="3">CONTROL</text>
        <text x="615" y="275" text-anchor="middle" fill="#abc4d2" font-size="15" letter-spacing="3">CLOUD SERVICES</text>
        <text x="970" y="487" text-anchor="middle" fill="#abc4d2" font-size="15" letter-spacing="3">CONNECTED SITE</text>`;
      svg.append(serviceDetails);
      // Roof equipment and the customer label sit above the architectural surfaces.
      svg.append(svg.querySelector('.r2-site-roof'), svg.querySelector('.site-labels'));
    }
  }
  root.ReplayArtwork = { enhance };
})(window);
