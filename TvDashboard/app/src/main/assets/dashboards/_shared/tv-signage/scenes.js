import * as THREE from './vendor/three.module.js';

// Procedural illustrations, never a representation of live equipment or stock levels.
const C = { lime: 0xc1f279, blue: 0x94d8f2, steel: 0x597786, dark: 0x132632, white: 0xf1f5ef, amber: 0xffd18b };
export function mount(host, kind) {
  const fallback = host.querySelector('.scene-error');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch (_) { fallback.innerHTML = '3D unavailable on this display<small>Operational data remains available</small>'; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
  host.prepend(renderer.domElement); renderer.domElement.setAttribute('aria-label', `${kind.replace('_',' ')} procedural 3D illustration`);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
  camera.position.set(10, 8, 12); camera.lookAt(0, 1, 0);
  scene.add(new THREE.HemisphereLight(0xe6f4ff, 0x223b35, 2.5));
  const key = new THREE.DirectionalLight(0xfff3d9, 4); key.position.set(4, 9, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(C.blue, 3); rim.position.set(-6, 4, -5); scene.add(rim);
  const materials = new Map(), geometries = new Map();
  function material(color, metallic = false, glow = false) {
    const k = [color, metallic, glow].join();
    if (!materials.has(k)) materials.set(k, new THREE.MeshStandardMaterial({ color, metalness: metallic ? .75 : .15, roughness: metallic ? .3 : .65, emissive: glow ? color : 0, emissiveIntensity: glow ? .6 : 0 }));
    return materials.get(k);
  }
  function geometry(key, create) { if (!geometries.has(key)) geometries.set(key, create()); return geometries.get(key); }
  function box(parent, x, y, z, w, h, d, color = C.steel, metallic = false) {
    const m = new THREE.Mesh(geometry('box', () => new THREE.BoxGeometry()), material(color, metallic)); m.position.set(x,y,z); m.scale.set(w,h,d); parent.add(m); return m;
  }
  function sphere(parent, x, y, z, size, color, glow = false) {
    const m = new THREE.Mesh(geometry('sphere', () => new THREE.SphereGeometry(1,24,16)), material(color, false, glow)); m.position.set(x,y,z); m.scale.setScalar(size); parent.add(m); return m;
  }
  function cylinder(parent,x,y,z,r,h,color=C.steel) {
    const m = new THREE.Mesh(geometry('cylinder', () => new THREE.CylinderGeometry(1,1,1,20)),material(color,true)); m.position.set(x,y,z); m.scale.set(r,h,r); parent.add(m); return m;
  }
  function ring(parent, radius, thickness, color, glow = false) {
    const m = new THREE.Mesh(geometry(`ring${radius}/${thickness}`, () => new THREE.TorusGeometry(radius, thickness,12,96)),material(color,true,glow)); parent.add(m); return m;
  }
  function beam(parent, a, b, radius, color) {
    const delta = new THREE.Vector3().subVectors(b,a), mesh = cylinder(parent,0,0,0,radius,delta.length(),color);
    mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); return mesh;
  }
  function cargo(parent,x,y,z,scale=1) {
    const g = new THREE.Group(); parent.add(g); g.position.set(x,y,z); g.scale.setScalar(scale);
    box(g,0,.36,0,1,.72,.8,0xb39c72); box(g,0,.73,0,.13,.018,.82,0xe5cf9b);
    box(g,0,.36,.409,.13,.72,.014,0xe5cf9b); box(g,.27,.37,.42,.25,.23,.016,C.white);
    for(let i=0;i<5;i++) box(g,.19+i*.031,.37,.433,.013,.15,.009,C.dark);
    box(g,0,.76,0,1.02,.025,.82,0xd6bc8a); return g;
  }
  function platform(parent,w=11,d=6) {
    box(parent,0,-.3,0,w,.35,d,C.dark,true);
    const grid = new THREE.GridHelper(w,22,0x48626a,0x293f4b); grid.position.y=-.115; grid.scale.z=d/w; parent.add(grid);
    for(const x of [-w/2,w/2]) box(parent,x,-.12,0,.035,.03,d,C.lime);
  }
  function conveyor() {
    camera.position.set(10,7,13); camera.lookAt(0,.6,0);
    const g = new THREE.Group(); scene.add(g); platform(g,12,5);
    for(const z of [-1,1]) { box(g,0,.5,z,11,.3,.13,C.steel,true); for(const x of [-4,0,4]) box(g,x,.15,z,.15,.8,.15,C.steel,true); }
    const rollers=[];
    for(let i=0;i<35;i++) { const roller=cylinder(g,-5.15+i*.3,.66,0,.095,1.9,C.steel); roller.rotation.x=Math.PI/2; rollers.push(roller); }
    box(g,1.6,2.7,0,.25,.25,2.7,C.dark,true);
    for(const z of [-1.3,1.3]) { box(g,1.6,1.6,z,.28,2.4,.28,C.dark,true); box(g,1.42,1.7,z,.04,1.7,.08,C.lime); }
    box(g,1.6,2.55,0,.07,.04,2.2,C.lime);
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(2,1.7), new THREE.MeshBasicMaterial({color:C.lime,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));
    scan.rotation.y=Math.PI/2; scan.position.set(1.6,1.5,0); g.add(scan);
    const crates=Array.from({length:5},(_,i)=>cargo(g,i*2.4-5,.8,0,.82));
    const consoleGroup=new THREE.Group();g.add(consoleGroup); consoleGroup.position.set(3.4,.1,1.9);
    box(consoleGroup,0,.55,0,.13,1.1,.13,C.steel,true); const monitor=box(consoleGroup,0,1.25,0,.75,.55,.1,C.dark); monitor.rotation.x=-.25;
    for(let i=0;i<4;i++) box(consoleGroup,-.1,1.13+i*.09,.07,.42-i*.06,.028,.015,C.lime);
    const beacon=sphere(g,1.6,2.95,0,.13,C.amber,true);
    return t=>{crates.forEach((b,i)=>b.position.x=((t*.85+i*2.4)%12)-6); rollers.forEach(r=>r.rotation.y=-t*3); scan.material.opacity=.09+Math.sin(t*2)*.035;beacon.scale.setScalar(.13+Math.sin(t*2)*.008);};
  }
  function warehouse() {
    camera.position.set(11,9,13); camera.lookAt(0,.8,0);
    const g=new THREE.Group();scene.add(g);platform(g,12,7);
    for(const x of [-4,-1,2]) {
      for(const px of [-1.2,1.2]) for(const z of [-2.7,-1.3]) box(g,x+px,1.55,z,.09,3.2,.09,C.steel,true);
      for(const y of [.15,1.45,2.75]) {box(g,x,y,-2,2.7,.12,1.7,C.steel,true); for(let k=0;k<2;k++)cargo(g,x-.65+k*1.25,y+.08,-2,.82);}
      for(const z of [-2.8,-1.2])box(g,x,2.83,z,2.7,.045,.05,C.lime);
    }
    // A clear outbound aisle, two mobile platforms and a loading gate.
    for(let i=0;i<13;i++)box(g,-5.5+i*.9,-.095,1.5,.42,.025,.035,C.lime);
    const vehicles=[];
    for(let i=0;i<2;i++) {
      const agv=new THREE.Group();g.add(agv);box(agv,0,.2,0,1.5,.3,1.1,C.steel,true);box(agv,0,.39,0,1.35,.1,1,C.lime);cargo(agv,0,.47,0,.95);
      for(const x of [-.5,.5])for(const z of [-.55,.55]){const wheel=cylinder(agv,x,.08,z,.16,.09,C.dark);wheel.rotation.x=Math.PI/2;}
      for(const z of [-.35,.35])sphere(agv,.77,.25,z,.07,C.blue,true);
      vehicles.push(agv);
    }
    for(const z of [.4,2.65])box(g,4.8,1.3,z,.12,2.8,.12,C.steel,true);
    box(g,4.8,2.65,1.5,.12,.12,2.4,C.lime);
    return t=>vehicles.forEach((v,i)=>{v.position.set(((t*.6+i*6)%12)-6,0,1.45);});
  }
  function manufacturing() {
    camera.position.set(9,6,11);camera.lookAt(0,1,0);
    const g=new THREE.Group();scene.add(g);platform(g,11,6);
    // Assembly bed, driven rollers and aluminium lighting housings.
    for(const z of [-.1,1.5]) {box(g,0,.65,z,9,.25,.13,C.steel,true);for(const x of [-3.6,0,3.6])box(g,x,.2,z,.14,.9,.14,C.steel,true);}
    for(let i=0;i<30;i++){const r=cylinder(g,-4.3+i*.3,.78,.7,.085,1.45,C.steel);r.rotation.x=Math.PI/2;}
    const products=[];
    for(let i=0;i<4;i++){
      const p=new THREE.Group();g.add(p);p.position.set(i*2.4-4,.9,.7);
      box(p,0,0,0,1.7,.11,.38,C.steel,true);for(const z of [-.2,.2])box(p,0,.065,z,1.75,.08,.035,C.steel,true);
      box(p,0,.075,0,1.58,.035,.2,C.dark);
      for(let j=0;j<9;j++)box(p,-.68+j*.17,.11,0,.07,.018,.1,C.lime);
      products.push(p);
    }
    // Articulated industrial arm: turntable, shoulder, elbow, wrist, gripper.
    const robot=new THREE.Group();g.add(robot);robot.position.set(-.5,0,-1.6);
    box(robot,0,.05,0,1.2,.3,1.2,C.dark,true);cylinder(robot,0,.38,0,.43,.55,C.steel);
    const turret=new THREE.Group();turret.position.y=.7;robot.add(turret);
    cylinder(turret,0,0,0,.48,.16,C.lime);
    const shoulder=new THREE.Group();turret.add(shoulder);
    const joint=cylinder(shoulder,0,0,0,.25,.55,C.dark);joint.rotation.x=Math.PI/2;
    box(shoulder,0,.8,0,.33,1.6,.36,C.lime);box(shoulder,0,.8,.2,.12,1.3,.035,C.dark);
    const elbow=new THREE.Group();elbow.position.y=1.6;shoulder.add(elbow);
    const pin=cylinder(elbow,0,0,0,.23,.6,C.steel);pin.rotation.x=Math.PI/2;
    box(elbow,0,.65,0,.27,1.3,.3,C.lime);box(elbow,0,.65,.17,.12,1.05,.04,C.dark);
    const wrist=new THREE.Group();wrist.position.y=1.3;elbow.add(wrist);
    sphere(wrist,0,0,0,.18,C.steel);box(wrist,0,.22,0,.36,.22,.34,C.dark,true);
    for(const x of [-.2,.2]) {box(wrist,x,.48,0,.08,.4,.14,C.steel,true);box(wrist,x*.65,.68,0,.16,.06,.14,C.steel,true);}
    // Hydraulic cylinder and cable detail, anchored to the base.
    const hydraulic=cylinder(robot,.36,1.2,0,.075,1.2,C.steel);hydraulic.rotation.z=-.25;
    for(const z of [-.5,.5])box(robot,0,.21,z,1.1,.03,.025,C.amber);
    // Inspection gantry and control cabinet at the outfeed.
    for(const z of [-.25,1.65])box(g,3.1,1.65,z,.14,1.9,.14,C.dark,true);
    box(g,3.1,2.62,.7,.2,.16,2.1,C.steel,true);box(g,3.1,2.48,.7,.1,.035,1.6,C.blue);
    box(g,3.6,.6,-1.6,1,.95,.65,C.dark,true);box(g,3.6,1.2,-1.6,.95,.45,.12,C.steel,true);
    box(g,3.45,1.2,-1.52,.46,.25,.02,C.blue);for(let i=0;i<3;i++)sphere(g,3.82,1.1+i*.1,-1.51,.026,i===0?C.lime:C.amber,true);
    return t=>{turret.rotation.y=.45+Math.sin(t*.55)*.5;shoulder.rotation.z=-.45+Math.sin(t*.55)*.22;elbow.rotation.z=-1.2+Math.cos(t*.55)*.22;wrist.rotation.z=-.5-elbow.rotation.z-shoulder.rotation.z;products.forEach((p,i)=>p.position.x=((t*.55+i*2.4)%9.6)-4.8);};
  }
  function chronometer() {
    camera.position.set(0,2,13);camera.lookAt(0,0,0);
    const g=new THREE.Group();scene.add(g);g.rotation.set(.22,-.25,0);
    const outer=ring(g,3.1,.09,C.steel), inner=ring(g,2.75,.035,C.lime,true);
    for(let i=0;i<60;i++){const angle=i*Math.PI/30;const tick=box(g,Math.sin(angle)*2.98,Math.cos(angle)*2.98,0,i%5===0?.045:.022,i%5===0?.22:.09,.07,i%5===0?C.lime:C.steel,true);tick.rotation.z=-angle;}
    const orbitA=new THREE.Group(),orbitB=new THREE.Group();g.add(orbitA,orbitB);
    ring(orbitA,2.38,.065,C.blue);ring(orbitB,2.04,.065,C.lime);orbitA.rotation.x=.8;orbitB.rotation.y=1;
    for(let i=0;i<4;i++)sphere(orbitA,Math.cos(i*Math.PI/2)*2.38,Math.sin(i*Math.PI/2)*2.38,0,.115,C.blue,true);
    const core=sphere(g,0,0,0,.7,C.dark);const wire=new THREE.Mesh(new THREE.IcosahedronGeometry(.84,1),new THREE.MeshBasicMaterial({color:C.lime,wireframe:true,transparent:true,opacity:.6}));g.add(wire);
    function gear(x,y,r,teeth){const gear=new THREE.Group();g.add(gear);gear.position.set(x,y,.35);ring(gear,r,.13,C.steel);ring(gear,r*.5,.05,C.amber);for(let i=0;i<teeth;i++){const a=i*Math.PI*2/teeth;const tooth=box(gear,Math.sin(a)*r,Math.cos(a)*r,0,.14,.23,.17,C.steel,true);tooth.rotation.z=-a;}for(let i=0;i<3;i++){const spoke=box(gear,0,0,0,r*1.7,.065,.12,C.steel,true);spoke.rotation.z=i*Math.PI/3;}sphere(gear,0,0,0,.1,C.lime,true);return gear;}
    const a=gear(-1.03,-1.4,.65,18),b=gear(.09,-1.76,.48,14),c=gear(.94,-1.2,.49,14);
    outer.rotation.y=.03;inner.rotation.y=-.03;
    return t=>{orbitA.rotation.y=t*.2;orbitB.rotation.x=t*.16;orbitB.rotation.z=t*.08;wire.rotation.y=t*.18;core.rotation.y=t*.1;a.rotation.z=t*.3;b.rotation.z=-t*.3*18/14;c.rotation.z=t*.3*18/14;g.rotation.y=-.25+Math.sin(t*.12)*.12;};
  }
  function network() {
    camera.position.set(0,1,13);camera.lookAt(0,0,0);
    const g=new THREE.Group();scene.add(g);
    const nodes=[],edges=[],packets=[];
    sphere(g,0,0,0,.48,C.lime,true);
    const cage=new THREE.Mesh(new THREE.IcosahedronGeometry(.77,0),new THREE.MeshBasicMaterial({color:C.lime,wireframe:true}));g.add(cage);
    for(let i=0;i<18;i++) {const y=1-(i/17)*2,r=Math.sqrt(1-y*y),a=i*2.39996;const p=new THREE.Vector3(Math.cos(a)*r*2.8,y*2.8,Math.sin(a)*r*2.8);nodes.push(p);sphere(g,p.x,p.y,p.z,.11,i%3===0?C.lime:C.blue,true);}
    for(let i=0;i<nodes.length;i++) {edges.push([nodes[i],nodes[(i+3)%nodes.length]]);if(i%3===0)edges.push([new THREE.Vector3(),nodes[i]]);}
    const lineGeo=new THREE.BufferGeometry().setFromPoints(edges.flat());g.add(new THREE.LineSegments(lineGeo,new THREE.LineBasicMaterial({color:C.steel,transparent:true,opacity:.7})));
    edges.forEach((edge,i)=>packets.push({mesh:sphere(g,0,0,0,.04,i%2?C.lime:C.blue,true),edge}));
    const orbit=ring(g,3.15,.025,C.lime);orbit.rotation.x=1.2;const orbit2=ring(g,3.4,.018,C.steel);orbit2.rotation.y=.7;
    return t=>{g.rotation.y=t*.085;g.rotation.z=Math.sin(t*.1)*.08;cage.rotation.z=t*.2;packets.forEach((p,i)=>p.mesh.position.lerpVectors(p.edge[0],p.edge[1],(t*.18+i*.17)%1));};
  }
  function canvasTexture(size, paint) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;paint(canvas.getContext('2d'),size);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }
  function glowTexture(stops) {
    return canvasTexture(256,(c,s)=>{const g=c.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);stops.forEach(([o,col])=>g.addColorStop(o,col));c.fillStyle=g;c.fillRect(0,0,s,s);});
  }
  function atmosphere() {
    camera.position.set(0,1,13);camera.lookAt(0,0,0);
    const g=new THREE.Group();scene.add(g);
    const sprite=(texture,scale,opacity=1,additive=true)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,opacity,depthWrite:false,toneMapped:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending}));s.scale.set(scale,scale,1);return s;};
    // Sun: a bright disc with a warm corona and slowly turning soft rays.
    const sun=new THREE.Group();g.add(sun);sun.position.set(1.7,1.05,-1);
    const sunDisc=canvasTexture(256,(c,s)=>{const r=s/2,gr=c.createRadialGradient(r*.8,r*.75,0,r,r,r);gr.addColorStop(0,'#fffbe8');gr.addColorStop(.55,'#ffe08a');gr.addColorStop(.94,'#ffb43c');gr.addColorStop(1,'rgba(255,170,50,0)');c.fillStyle=gr;c.beginPath();c.arc(r,r,r,0,Math.PI*2);c.fill();});
    const rayTexture=canvasTexture(512,(c,s)=>{const r=s/2;c.translate(r,r);for(let i=0;i<14;i++){c.rotate(Math.PI*2/14);const gr=c.createLinearGradient(0,0,0,-r);gr.addColorStop(0,'rgba(255,214,120,.55)');gr.addColorStop(1,'rgba(255,214,120,0)');c.fillStyle=gr;c.beginPath();c.moveTo(-r*.035,0);c.lineTo(0,-r*(i%2?.78:1));c.lineTo(r*.035,0);c.fill();}});
    const corona=sprite(glowTexture([[0,'rgba(255,220,130,.9)'],[.25,'rgba(255,190,90,.35)'],[1,'rgba(255,170,60,0)']]),6.4,.8);
    const rays=sprite(rayTexture,5.6,.55);const disc=sprite(sunDisc,2.1,1,false);sun.add(corona,rays,disc);
    // Moon: a mottled disc with its shading painted in, so stage lighting cannot flatten it, and a cool halo.
    const moon=new THREE.Group();g.add(moon);moon.position.copy(sun.position);
    const moonDisc=canvasTexture(512,(c,s)=>{const r=s/2;c.save();c.beginPath();c.arc(r,r,r*.96,0,Math.PI*2);c.clip();
      const base=c.createRadialGradient(r*.75,r*.7,0,r,r,r);base.addColorStop(0,'#f7fbff');base.addColorStop(.7,'#dbe5ee');base.addColorStop(1,'#a9bac8');c.fillStyle=base;c.fillRect(0,0,s,s);
      for(let i=0;i<34;i++){const x=(Math.sin(i*12.9898)*.42+.5)*s,y=(Math.sin(i*78.233)*.42+.5)*s,rr=s*(.025+(i%6)*.016),gr=c.createRadialGradient(x,y,0,x,y,rr);gr.addColorStop(0,`rgba(118,138,158,${.16+(i%3)*.06})`);gr.addColorStop(1,'rgba(118,138,158,0)');c.fillStyle=gr;c.beginPath();c.arc(x,y,rr,0,Math.PI*2);c.fill();}
      const shade=c.createLinearGradient(s*.35,s*.2,s*1.05,s*.8);shade.addColorStop(0,'rgba(10,22,32,0)');shade.addColorStop(.55,'rgba(10,22,32,.18)');shade.addColorStop(1,'rgba(10,22,32,.82)');c.fillStyle=shade;c.fillRect(0,0,s,s);c.restore();});
    const moonBall=sprite(moonDisc,1.9,1,false);
    moon.add(sprite(glowTexture([[0,'rgba(210,230,255,.5)'],[.35,'rgba(170,200,235,.14)'],[1,'rgba(150,180,220,0)']]),5.2,.75),moonBall);
    const starPositions=new Float32Array(140*3);for(let i=0;i<140;i++){starPositions[i*3]=Math.sin(i*91.7)*7;starPositions[i*3+1]=Math.cos(i*47.3)*3.8+.5;starPositions[i*3+2]=-4-Math.abs(Math.sin(i*13.1))*3;}
    const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
    const dot=glowTexture([[0,'rgba(255,255,255,1)'],[.3,'rgba(255,255,255,.6)'],[1,'rgba(255,255,255,0)']]);
    const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({map:dot,color:0xe8f2ff,size:.09,transparent:true,opacity:.8,depthWrite:false,toneMapped:false}));g.add(stars);
    // Clouds: overlapping soft puffs, tinted for day, night, overcast and storms.
    const puff=canvasTexture(256,(c,s)=>{for(let i=0;i<9;i++){const x=s*(.3+.4*(Math.sin(i*2.1)*.5+.5)),y=s*(.42+.16*Math.cos(i*1.7)),r=s*(.2+.06*(i%3)),gr=c.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.72,'rgba(255,255,255,.85)');gr.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gr;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}});
    const clouds=new THREE.Group();g.add(clouds);
    const puffs=Array.from({length:16},(_,i)=>{const s=sprite(puff,2.3+(i%4)*.75,.95,false);s.material=s.material.clone();s.position.set(-3.4+(i%8)*.95+Math.sin(i*3.7)*.35,-.15+Math.cos(i*2.3)*.45+(i<8?.35:-.35),1+(i%3)*.25);s.userData={x:s.position.x,phase:i*1.3};clouds.add(s);return s;});
    // Rain streaks fall at a slight angle; snow uses soft round flakes.
    const DROPS=220,rainPositions=new Float32Array(DROPS*6);
    const seeds=Array.from({length:DROPS},(_,i)=>({x:Math.sin(i*17.13)*4.6,y:(i%40)/40*7-3.5,z:.6+Math.cos(i*7.8)*1.4}));
    const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
    const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0x9fdcff,transparent:true,opacity:.55,depthWrite:false}));g.add(rain);
    const snowPositions=new Float32Array(DROPS*3),snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPositions,3));
    const snow=new THREE.Points(snowGeo,new THREE.PointsMaterial({map:dot,color:0xffffff,size:.26,transparent:true,opacity:.95,depthWrite:false,toneMapped:false}));g.add(snow);
    const flash=new THREE.PointLight(0xdfe9ff,0,30);flash.position.set(0,2,4);g.add(flash);
    const fog=new THREE.Group();g.add(fog);
    const band=canvasTexture(256,(c,s)=>{const gr=c.createLinearGradient(0,0,s,0);gr.addColorStop(0,'rgba(200,215,225,0)');gr.addColorStop(.5,'rgba(200,215,225,.55)');gr.addColorStop(1,'rgba(200,215,225,0)');c.fillStyle=gr;c.fillRect(0,s*.35,s,s*.3);});
    for(let i=0;i<5;i++){const b=sprite(band,1,.5-i*.06,false);b.scale.set(11-i,1.2,1);b.position.set(0,-1.2-i*.42,1.6);fog.add(b);}
    const windGeo=new THREE.BufferGeometry(),windPositions=[];
    for(let i=0;i<24;i++){const y=Math.sin(i*7)*3,z=Math.cos(i*3)*2,x=(i%6)-3;windPositions.push(x,y,z,x+.4,y,z);}
    windGeo.setAttribute('position',new THREE.Float32BufferAttribute(windPositions,3));const wind=new THREE.LineSegments(windGeo,new THREE.LineBasicMaterial({color:C.blue,transparent:true,opacity:.14}));g.add(wind);
    const unknown=ring(g,1.6,.02,C.steel);
    let nextFlash=3;
    return (t,delta)=>{
      const data=window.TVAtmosphere||{type:'unknown',wind:0},type=data.type,night=!!data.night,storm=type==='storm';
      const clear=['sun','cloud'].includes(type)&&!data.overcast;
      sun.visible=clear&&!night;moon.visible=clear&&night;stars.visible=night&&type!=='fog'&&!(data.overcast||storm);
      clouds.visible=['cloud','fog','rain','storm','snow'].includes(type);rain.visible=type==='rain'||storm;snow.visible=type==='snow';fog.visible=type==='fog';unknown.visible=type==='unknown';wind.visible=type!=='unknown';
      const tint=storm?0x5d6f7c:data.overcast||type==='rain'?(night?0x5a6b78:0x9fb1bd):night?0x8394a3:0xf3f8fb;
      puffs.forEach((p,i)=>{p.material.color.setHex(i%3===0&&!night&&!storm?0xdfe8ee:tint);p.position.x=p.userData.x+Math.sin(t*.06+p.userData.phase)*.35;p.position.y+=Math.sin(t*.4+p.userData.phase)*.0006;});
      clouds.position.x=data.overcast||storm||type==='rain'||type==='snow'?0:-.5+Math.sin(t*.05)*.3;
      clouds.scale.setScalar(type==='cloud'&&!data.overcast?.8:1);
      rays.material.rotation=t*.03;corona.material.opacity=.72+Math.sin(t*.8)*.08;
      stars.material.opacity=.65+Math.sin(t*1.7)*.15;
      wind.position.x=((t*(.08+Math.min(data.wind,60)*.008))%2)-1;
      if(rain.visible){const slant=.08+Math.min(data.wind,60)*.004;seeds.forEach((d,i)=>{d.y-=delta*7;d.x-=delta*7*slant;if(d.y<-3.8){d.y=3.2;d.x=Math.sin(i*17.13+t)*4.6;}rainPositions.set([d.x,d.y,d.z,d.x+slant*.45,d.y+.45,d.z],i*6);});rainGeo.attributes.position.needsUpdate=true;}
      if(snow.visible){seeds.forEach((d,i)=>{d.y-=delta*.45;if(d.y<-3.8)d.y=3.4;snowPositions.set([d.x+Math.sin(t*.6+i)*.25,d.y,d.z],i*3);});snowGeo.attributes.position.needsUpdate=true;}
      if(storm){nextFlash-=delta;if(nextFlash<0){flash.intensity=60;nextFlash=4+Math.abs(Math.sin(t*3.1))*5;}flash.intensity*=Math.pow(.02,delta);}else flash.intensity=0;
      fog.children.forEach((b,i)=>{b.position.x=Math.sin(t*.12+i)*.6;});
      unknown.rotation.y=t*.08;
    };
  }
  const update=kind==='manufacturing'?manufacturing():kind==='goods_in'?conveyor():kind==='warehouse'?warehouse():kind==='weather'?atmosphere():kind==='time'?chronometer():network();
  // Subtle ambient particles use one draw call, independent of the process illustration.
  const positions=new Float32Array(70*3);for(let i=0;i<70;i++){positions[i*3]=Math.sin(i*11.9)*7;positions[i*3+1]=Math.cos(i*9.7)*4;positions[i*3+2]=Math.sin(i*4.3)*5;}
  const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const dust=new THREE.Points(particleGeo,new THREE.PointsMaterial({color:C.lime,size:.025,transparent:true,opacity:.32,depthWrite:false}));scene.add(dust);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let time=0,last=0,frames=0,slow=0,lost=false;
  function resize(){const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();if(reduced.matches)draw(performance.now());}
  function draw(now){if(document.hidden||lost){last=0;return;}const delta=last?Math.min((now-last)/1000,.05):0;last=now;if(!reduced.matches)time+=delta;update(reduced.matches?0:time,reduced.matches?0:delta);dust.rotation.y=time*.012;renderer.render(scene,camera);fallback.hidden=true;
    if(++frames<=180&&delta>.028)slow++;if(frames===180&&slow>90){renderer.setPixelRatio(1);resize();}
  }
  function start(){renderer.setAnimationLoop(reduced.matches?null:draw);if(reduced.matches)draw(performance.now());}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();start();
  reduced.addEventListener('change',start);
  const atmosphereChanged=()=>{if(reduced.matches)draw(performance.now());};addEventListener('tv-atmosphere',atmosphereChanged);
  const visibility=()=>{last=0;if(document.hidden)renderer.setAnimationLoop(null);else start();};document.addEventListener('visibilitychange',visibility);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;renderer.setAnimationLoop(null);fallback.hidden=false;fallback.innerHTML='Restoring visualisation<small>Operational information is still updating</small>';});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;start();});
  addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);observer.disconnect();reduced.removeEventListener('change',start);document.removeEventListener('visibilitychange',visibility);scene.traverse(o=>{o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m?.dispose());});renderer.dispose();},{once:true});
}
