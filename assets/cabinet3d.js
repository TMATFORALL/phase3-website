/* TMAT — 3D exploded view of a motor control cabinet, driven by scroll.
   Needs three.js (global THREE) and tmat3d-kit.js loaded before this file. */
(function () {
  var stage = document.getElementById('stage');
  if (!stage) return;
  var section = stage.closest('section');
  var canvas = document.getElementById('cab3d');
  var labelsEl = document.getElementById('cab-labels');
  var stepEls = Array.prototype.slice.call(section.querySelectorAll('.istep'));
  var stepsBox = section.querySelector('.isteps');
  var hint = document.getElementById('cab-hint');
  var bar = document.getElementById('cab-bar');
  var stepTag = document.getElementById('cab-step');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fail() { stage.classList.add('no3d'); }
  if (!window.THREE || !window.TMAT3D) { fail(); return; }
  var K = window.TMAT3D;
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
  catch (e) { fail(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  var scene = new THREE.Scene();
  K.setup(renderer, scene);
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x0b1015, 0.25));
  var key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3.5, 6, 7); key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
  var sc = key.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; sc.near = 1; sc.far = 20;
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xf3c29a, 0.7); rim.position.set(-6, 3, -4); scene.add(rim);

  /* ---------- materials ---------- */
  function M(c, o) {
    o = o || {};
    var m = new THREE.MeshStandardMaterial({
      color: c, metalness: o.m || 0, roughness: o.r == null ? 0.5 : o.r,
      emissive: o.e || 0x000000, emissiveIntensity: o.ei || 1, map: o.map || null, envMapIntensity: o.env == null ? 1 : o.env
    });
    if (o.t) { m.transparent = true; m.opacity = 1; }
    return m;
  }
  var powder = K.noiseTex('#808080', 26); powder.repeat.set(3, 3);
  var galv = K.noiseTex('#9aa2a8', 40); galv.repeat.set(2, 3);
  var brushed = K.noiseTex('#b8bfc5', 30, true); brushed.repeat.set(1, 4);
  var mat = {
    cabinet: M(0xd2d4cf, { r: 0.62, map: powder, env: 0.6 }),     // RAL 7035 powder coat
    plate: M(0xffffff, { m: 0.75, r: 0.38, map: galv }),             // galvanised mounting plate
    white: M(0xeeece6, { r: 0.42 }), grey: M(0xd9dcdf, { r: 0.45 }), midgrey: M(0x9aa1a8, { r: 0.5 }),
    dark: M(0x24282c, { r: 0.6, env: 0.45 }), black: M(0x141619, { r: 0.45, env: 0.5 }), rubber: M(0x0c0d0f, { r: 0.85 }),
    steel: M(0xd0d6db, { m: 1, r: 0.28 }), alu: M(0xffffff, { m: 0.9, r: 0.35, map: brushed }),
    zinc: M(0xc9ced2, { m: 1, r: 0.32 }), duct: M(0x8e959b, { r: 0.7 }),
    copper: M(0xd4895a, { m: 1, r: 0.25 }), blue: M(0x2f6fb5, { r: 0.42 }), green: M(0x2e8b45, { r: 0.45 }),
    yellow: M(0xe8b830, { r: 0.45 }), red: M(0xa8121b, { r: 0.4 }), orange: M(0xe0702a, { r: 0.45 }),
    ledG: M(0x0f7a35, { e: 0x19e05a, ei: 1.1, r: 0.25 }), ledO: M(0x8a4a10, { e: 0xff8a1a, ei: 1.1, r: 0.25 }), ledR: M(0x8a1010, { e: 0xff2a1a, ei: 1.0, r: 0.25 })
  };

  var glowable = [];
  function mesh(geo, m, x, y, z, parent, keep) {
    var o = new THREE.Mesh(geo, keep ? m : m.clone());
    o.position.set(x || 0, y || 0, z || 0);
    o.castShadow = true; o.receiveShadow = true;
    parent.add(o);
    if (!keep) glowable.push(o);
    return o;
  }
  function rbox(w, h, d, r, m, x, y, z, parent, keep) { return mesh(K.rboxGeo(w, h, d, r), m, x, y, z, parent, keep); }
  function box(w, h, d, m, x, y, z, parent, keep) { return mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, keep); }
  function cylZ(r, h, m, x, y, z, parent, keep, seg) {
    var o = mesh(new THREE.CylinderGeometry(r, r, h, seg || 24), m, x, y, z, parent, keep); o.rotation.x = Math.PI / 2; return o;
  }
  function cylY(r, h, m, x, y, z, parent, keep) { return mesh(new THREE.CylinderGeometry(r, r, h, 20), m, x, y, z, parent, keep); }
  function sticker(w, h, tex, x, y, z, parent, rough) {
    var m = new THREE.MeshStandardMaterial({ map: tex, roughness: rough == null ? 0.55 : rough, envMapIntensity: 0.5, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
    var o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); parent.add(o); glowable.push(o); return o;
  }
  // slotted screw head facing +z (front) or +y (top)
  function screw(x, y, z, parent, up) {
    var g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    var head = mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.014, 18), mat.zinc, 0, 0, 0, g);
    var slot = mesh(new THREE.BoxGeometry(0.036, 0.016, 0.006), mat.dark, 0, 0.002, 0, g);
    if (!up) { g.rotation.x = Math.PI / 2; }
    return g;
  }
  function anchor(parent, x, y, z) { var a = new THREE.Object3D(); a.position.set(x, y, z); parent.add(a); return a; }

  /* ---------- devices ---------- */
  function breaker(poles, rating, toggleMat, extra) {
    var g = new THREE.Group(), w = 0.18 * poles - 0.012;
    rbox(w, 0.64, 0.4, 0.025, mat.white, 0, 0, 0.2, g);
    rbox(w - 0.01, 0.3, 0.12, 0.02, mat.white, 0, 0, 0.42, g);
    for (var i = 0; i < poles; i++) {
      var px = (-(poles - 1) / 2 + i) * 0.18;
      box(0.084, 0.16, 0.02, mat.dark, px, 0.04, 0.483, g);
      rbox(0.064, 0.11, 0.07, 0.012, toggleMat || mat.black, px, 0.07, 0.51, g);
      screw(px, 0.325, 0.3, g, true); screw(px, -0.325, 0.3, g, true);
    }
    sticker(w * 0.86, 0.1, K.label(w * 0.86, 0.1, '#eeece6', '#1b1d20', [{ t: rating, size: 0.62 }]), 0, -0.2, 0.401, g);
    sticker(w * 0.5, 0.05, K.label(w * 0.5, 0.05, null, '#3a3f45', [{ t: 'ON  I', size: 0.7 }]), 0, 0.2, 0.481, g);
    if (extra) extra(g, w);
    g.userData.top = anchor(g, 0, 0.36, 0.45);
    return g;
  }
  function contactor() {
    var g = new THREE.Group();
    rbox(0.46, 0.62, 0.42, 0.03, mat.grey, 0, 0, 0.21, g);
    rbox(0.38, 0.34, 0.1, 0.025, mat.midgrey, 0, 0, 0.46, g);
    rbox(0.16, 0.08, 0.03, 0.01, mat.dark, 0, 0.08, 0.515, g);
    box(0.1, 0.03, 0.01, mat.ledO, 0, 0.08, 0.532, g, true);
    sticker(0.3, 0.1, K.label(0.3, 0.1, '#9aa1a8', '#16181b', [{ t: 'K1', size: 0.5 }, { t: 'AC-3  9A  230V', size: 0.26 }]), 0, -0.07, 0.511, g);
    for (var i = 0; i < 3; i++) {
      screw(-0.13 + i * 0.13, 0.27, 0.43, g); screw(-0.13 + i * 0.13, -0.27, 0.43, g);
    }
    sticker(0.08, 0.04, K.label(0.08, 0.04, null, '#2a2e33', [{ t: 'A1', size: 0.8 }]), -0.2, 0.17, 0.421, g);
    g.userData.top = anchor(g, 0, 0.34, 0.45);
    return g;
  }
  function overload() {
    var g = new THREE.Group();
    rbox(0.46, 0.3, 0.38, 0.025, mat.grey, 0, 0, 0.19, g);
    cylZ(0.055, 0.04, mat.blue, 0.11, 0.03, 0.4, g);
    box(0.012, 0.06, 0.01, mat.white, 0.11, 0.03, 0.422, g);
    cylZ(0.035, 0.05, mat.red, -0.12, 0.03, 0.405, g);
    sticker(0.2, 0.06, K.label(0.2, 0.06, null, '#16181b', [{ t: 'F1  7–10 A', size: 0.6 }]), 0, -0.09, 0.381, g);
    g.userData.top = anchor(g, 0, -0.19, 0.42);
    return g;
  }
  function plc() {
    var g = new THREE.Group();
    rbox(0.96, 0.64, 0.4, 0.03, mat.dark, 0, 0, 0.2, g);
    rbox(0.92, 0.12, 0.06, 0.015, mat.midgrey, 0, 0.245, 0.42, g);
    rbox(0.92, 0.12, 0.06, 0.015, mat.midgrey, 0, -0.245, 0.42, g);
    for (var i = 0; i < 9; i++) { screw(-0.4 + i * 0.1, 0.245, 0.455, g); screw(-0.4 + i * 0.1, -0.245, 0.455, g); }
    var face = K.canvasTex(768, 256, function (c, W, H) {
      c.fillStyle = '#2c3035'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#e9ecef'; c.font = '700 44px Arial'; c.fillText('TMAT PLC', 470, 70);
      c.fillStyle = '#9aa3ab'; c.font = '500 22px Arial'; c.fillText('CPU 14DI / 10DO  24VDC', 470, 110);
      c.font = '600 18px Arial'; c.fillText('IN', 30, 70); c.fillText('OUT', 30, 170);
      for (var k = 0; k < 8; k++) { c.fillText(String(k), 80 + k * 42, 112); c.fillText(String(k), 80 + k * 42, 212); }
      c.fillStyle = '#d4895a'; c.fillRect(470, 150, 220, 6);
      c.fillStyle = '#9aa3ab'; c.font = '600 18px Arial'; c.fillText('RUN', 470, 200); c.fillText('ERR', 560, 200);
    });
    sticker(0.9, 0.3, face, 0, 0, 0.401, g, 0.6);
    for (var j = 0; j < 8; j++) {
      box(0.022, 0.022, 0.008, j % 3 === 0 ? mat.ledG : mat.black, -0.338 + j * 0.0492, 0.06, 0.404, g, true);
      box(0.022, 0.022, 0.008, j % 4 === 1 ? mat.ledO : mat.black, -0.338 + j * 0.0492, -0.058, 0.404, g, true);
    }
    box(0.022, 0.022, 0.008, mat.ledG, 0.09, -0.05, 0.404, g, true);
    g.userData.top = anchor(g, 0, 0.35, 0.45);
    return g;
  }
  function psu() {
    var g = new THREE.Group();
    rbox(0.44, 0.64, 0.38, 0.02, mat.alu, 0, 0, 0.19, g);
    for (var i = 0; i < 7; i++) box(0.3, 0.012, 0.006, mat.black, 0, 0.25 - i * 0.04, 0.381, g);
    sticker(0.3, 0.12, K.label(0.3, 0.12, '#1b1e22', '#e9ecef', [{ t: '24V DC', size: 0.46 }, { t: '2.5A  60W  POWER SUPPLY', size: 0.2 }]), 0, -0.08, 0.382, g);
    box(0.022, 0.022, 0.008, mat.ledG, 0.16, -0.17, 0.384, g, true);
    rbox(0.4, 0.07, 0.06, 0.012, mat.dark, 0, -0.27, 0.38, g);
    for (var j = 0; j < 4; j++) screw(-0.15 + j * 0.1, -0.27, 0.414, g);
    g.userData.top = anchor(g, 0, 0.35, 0.42);
    return g;
  }
  function terminals(n) {
    var g = new THREE.Group();
    for (var i = 0; i < n; i++) {
      var x = (i - (n - 1) / 2) * 0.095;
      var m = i === n - 1 ? mat.green : (i % 4 === 3 ? mat.blue : mat.midgrey);
      rbox(0.085, 0.44, 0.34, 0.012, m, x, 0, 0.17, g);
      screw(x, 0.14, 0.345, g); screw(x, -0.14, 0.345, g);
      sticker(0.06, 0.05, K.label(0.06, 0.05, '#f2f2ee', '#1b1d20', [{ t: String(i + 1), size: 0.75 }]), x, 0, 0.342, g);
    }
    box(0.083, 0.035, 0.344, mat.yellow, ((n - 1) - (n - 1) / 2) * 0.095, -0.06, 0.003, g);
    g.userData.top = anchor(g, 0, 0.26, 0.36);
    return g;
  }
  function dinRail(y, parent) {
    box(2.0, 0.035, 0.012, mat.steel, 0, y, 0.036, parent, true);
    box(2.0, 0.01, 0.03, mat.steel, 0, y + 0.0175, 0.05, parent, true);
    box(2.0, 0.01, 0.03, mat.steel, 0, y - 0.0175, 0.05, parent, true);
  }
  var slotTex = K.canvasTex(64, 64, function (c, W, H) {
    c.fillStyle = '#8e959b'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#3c4247'; c.fillRect(W * 0.38, 0, W * 0.24, H * 0.72);
  });
  slotTex.wrapS = slotTex.wrapT = THREE.RepeatWrapping;
  function duct(len, horizontal, x, y, parent) {
    var t = slotTex.clone(); t.needsUpdate = true; t.repeat.set(len / 0.05, 1);
    var side = new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 });
    var g = new THREE.Group(); g.position.set(x, y, 0.18); parent.add(g);
    var body = mesh(new THREE.BoxGeometry(len, 0.15, 0.28), side, 0, 0, 0, g);
    rbox(len + 0.004, 0.17, 0.03, 0.01, mat.duct, 0, 0, 0.15, g);
    if (!horizontal) g.rotation.z = Math.PI / 2;
    return g;
  }

  /* ---------- cabinet shell ---------- */
  var W = 2.6, H = 3.4, D = 0.95, T = 0.05;
  var cab = new THREE.Group(); scene.add(cab);
  rbox(W, H, T, 0.02, mat.cabinet, 0, 0, -T / 2, cab, true);
  rbox(T, H, D, 0.02, mat.cabinet, -W / 2 + T / 2, 0, D / 2 - T, cab, true);
  rbox(T, H, D, 0.02, mat.cabinet, W / 2 - T / 2, 0, D / 2 - T, cab, true);
  rbox(W, T, D, 0.02, mat.cabinet, 0, H / 2 - T / 2, D / 2 - T, cab, true);
  rbox(W, T, D, 0.02, mat.cabinet, 0, -H / 2 + T / 2, D / 2 - T, cab, true);
  box(W - 0.12, 0.03, 0.03, mat.rubber, 0, H / 2 - 0.07, D - T - 0.015, cab, true);   // door gasket
  box(W - 0.12, 0.03, 0.03, mat.rubber, 0, -H / 2 + 0.07, D - T - 0.015, cab, true);
  rbox(2.3, 3.1, 0.03, 0.01, mat.plate, 0, 0, 0.015, cab, true);
  [[-1.08, 1.48], [1.08, 1.48], [-1.08, -1.48], [1.08, -1.48]].forEach(function (p) { screw(p[0], p[1], 0.035, cab); });
  [0.95, 0, -1.0].forEach(function (y) { dinRail(y, cab); });

  // door, hinged on the left edge
  var hinge = new THREE.Group(); hinge.position.set(-W / 2, 0, D - T); cab.add(hinge);
  rbox(W, H, T, 0.02, mat.cabinet, W / 2, 0, T / 2, hinge, true);
  [1.2, -1.2].forEach(function (y) { cylY(0.03, 0.22, mat.steel, -0.005, y, T / 2, hinge, true); });
  rbox(0.08, 0.36, 0.05, 0.02, mat.black, W - 0.16, 0, T + 0.025, hinge, true);         // swing handle
  rbox(0.05, 0.22, 0.04, 0.015, mat.black, W - 0.16, -0.02, T + 0.07, hinge, true);
  var warn = K.canvasTex(256, 256, function (c, Wd) {
    c.fillStyle = '#e8b830'; c.beginPath(); c.moveTo(128, 18); c.lineTo(240, 228); c.lineTo(16, 228); c.closePath(); c.fill();
    c.lineWidth = 14; c.strokeStyle = '#111'; c.stroke();
    c.fillStyle = '#111'; c.beginPath(); c.moveTo(140, 70); c.lineTo(100, 150); c.lineTo(132, 150); c.lineTo(112, 205); c.lineTo(160, 122); c.lineTo(128, 122); c.closePath(); c.fill();
  });
  sticker(0.36, 0.36, warn, W / 2, 1.0, T + 0.002, hinge, 0.4);
  sticker(1.1, 0.16, K.label(1.1, 0.16, '#1b1e22', '#f3c29a', [{ t: 'MCC-01  MOTOR CONTROL', size: 0.34 }]), W / 2, 1.38, T + 0.002, hinge, 0.4);
  // pilot lights and push buttons on the door
  [[-0.35, mat.ledG, 'ON'], [0, mat.ledO, 'RUN'], [0.35, mat.ledR, 'TRIP']].forEach(function (p) {
    cylZ(0.085, 0.03, mat.steel, W / 2 + p[0], 0.35, T + 0.015, hinge, true);
    cylZ(0.065, 0.05, p[1], W / 2 + p[0], 0.35, T + 0.03, hinge, true);
    sticker(0.22, 0.06, K.label(0.22, 0.06, null, '#1b1e22', [{ t: p[2], size: 0.8 }]), W / 2 + p[0], 0.2, T + 0.002, hinge);
  });
  [[-0.28, mat.green, 'START'], [0.28, mat.red, 'STOP']].forEach(function (p) {
    cylZ(0.11, 0.035, mat.steel, W / 2 + p[0], -0.25, T + 0.018, hinge, true);
    cylZ(0.085, 0.07, p[1], W / 2 + p[0], -0.25, T + 0.05, hinge, true);
    sticker(0.3, 0.06, K.label(0.3, 0.06, null, '#1b1e22', [{ t: p[2], size: 0.8 }]), W / 2 + p[0], -0.43, T + 0.002, hinge);
  });
  rbox(0.5, 0.5, 0.12, 0.05, mat.red, W / 2, -0.95, T + 0.06, hinge, true);            // emergency stop
  cylZ(0.17, 0.08, mat.red, W / 2, -0.95, T + 0.16, hinge, true);
  sticker(0.42, 0.06, K.label(0.42, 0.06, null, '#1b1e22', [{ t: 'EMERGENCY', size: 0.8 }]), W / 2, -1.27, T + 0.002, hinge);

  /* ---------- device groups ---------- */
  var groups = { prot: new THREE.Group(), motor: new THREE.Group(), brain: new THREE.Group(), wiring: new THREE.Group() };
  Object.keys(groups).forEach(function (k) { groups[k].userData.glow = 0; cab.add(groups[k]); });
  var Z = 0.05;
  function place(g, parent, x, y) { g.position.set(x, y, Z); parent.add(g); return g; }

  var main = place(breaker(3, 'C32'), groups.prot, -0.72, 0.95);
  var rcd = place(breaker(2, 'RCD 30mA', mat.blue, function (g) { cylZ(0.022, 0.03, mat.yellow, 0.05, -0.08, 0.43, g); }), groups.prot, -0.26, 0.95);
  place(breaker(1, 'C10'), groups.prot, 0.02, 0.95);
  place(breaker(1, 'C6'), groups.prot, 0.2, 0.95);
  var con = place(contactor(), groups.motor, -0.72, 0.02);
  var ol = place(overload(), groups.motor, -0.72, -0.45);
  var brainPlc = place(plc(), groups.brain, 0.4, 0.0);
  var brainPsu = place(psu(), groups.brain, 0.75, 0.95);
  var term = place(terminals(16), groups.wiring, 0, -1.0);
  [0.48, -0.5, -1.42].forEach(function (y) { duct(2.02, true, 0, y, groups.wiring); });
  [-1.09, 1.09].forEach(function (x) { duct(2.7, false, x, 0, groups.wiring); });

  // wires with ferrules: device terminals -> duct -> terminal strip
  var wireColors = [0x6b3f22, 0x151719, 0x7f8285, 0x6b3f22, 0x151719, 0x7f8285, 0x2f6fb5, 0x2f6fb5, 0xd23b2b, 0x2f6fb5];
  var wireMats = wireColors.map(function (c) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.38, transparent: true, opacity: 1 }); });
  var starts = [[-0.9, 0.62], [-0.72, 0.62], [-0.54, 0.62], [-0.85, -0.62], [-0.72, -0.62], [-0.59, -0.62], [-0.26, 0.62], [0.65, 0.66], [0.1, -0.33], [0.3, -0.33]];
  starts.forEach(function (s, i) {
    var tx = (i * 1.6 - 7.2) * 0.095;
    var upper = s[1] > 0;
    var curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s[0], s[1], 0.32), new THREE.Vector3(s[0], upper ? 0.5 : -0.5, 0.22),
      new THREE.Vector3((s[0] + tx) / 2, -0.5, 0.2), new THREE.Vector3(tx, -0.6, 0.26), new THREE.Vector3(tx, -0.76, 0.34)
    ]);
    var tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.016, 8, false), wireMats[i]);
    tube.castShadow = true; groups.wiring.add(tube);
    cylY(0.02, 0.05, mat.steel, s[0], s[1] + (upper ? -0.02 : 0.02), 0.32, groups.wiring, true);
  });

  /* ---------- labels ---------- */
  var labelDefs = [
    { g: 'prot', o: main, t: 'เบรกเกอร์หลัก 3P', n: 'Q1' },
    { g: 'prot', o: rcd, t: 'RCD 30 mA', n: 'Q2' },
    { g: 'motor', o: con, t: 'คอนแทคเตอร์', n: 'K1' },
    { g: 'motor', o: ol, t: 'โอเวอร์โหลดรีเลย์', n: 'F1' },
    { g: 'brain', o: brainPlc, t: 'PLC', n: 'A1' },
    { g: 'brain', o: brainPsu, t: 'Power Supply 24 VDC', n: 'G1' },
    { g: 'wiring', o: term, t: 'เทอร์มินัล', n: 'X1' }
  ];
  labelDefs.forEach(function (d) {
    d.el = document.createElement('span');
    d.el.className = 'cab-label';
    d.el.innerHTML = '<b>' + d.n + '</b>' + d.t;
    labelsEl.appendChild(d.el);
  });

  /* ---------- layout & motion ---------- */
  var explode = {
    prot: new THREE.Vector3(0, 0.35, 1.3), motor: new THREE.Vector3(-0.35, 0, 1.75),
    brain: new THREE.Vector3(0.4, 0.1, 2.15), wiring: new THREE.Vector3(0, -0.3, 0.75)
  };
  var order = ['prot', 'motor', 'brain', 'wiring'];
  var stepGroup = [null, 'prot', 'motor', 'brain', 'wiring'];
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  var target = 0, cur = 0, mouseX = 0, mouseY = 0, visible = false, raf = 0, w = 0, h = 0;
  var tmp = new THREE.Vector3();

  function measure() {
    var r = stepsBox.getBoundingClientRect();
    var span = r.height - window.innerHeight * 0.6;
    target = Math.min(1, Math.max(0, (window.innerHeight * 0.5 - r.top) / Math.max(1, span)));
  }
  function resize() {
    var nw = stage.clientWidth, nh = stage.clientHeight;
    if (nw === w && nh === h) return;
    w = nw; h = nh;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 40 : 32;
    camera.updateProjectionMatrix();
  }

  function frame() {
    raf = 0;
    resize();
    cur += (target - cur) * (reduce ? 1 : 0.08);
    var p = cur;
    var step = Math.min(4, Math.floor(p * 5 + 0.0001));

    hinge.rotation.y = -smooth(0.02, 0.2, p) * 1.95;
    order.forEach(function (k, i) {
      var e = smooth(0.2 + 0.12 * i, 0.46 + 0.12 * i, p);
      groups[k].position.copy(explode[k]).multiplyScalar(e);
      var want = stepGroup[step] === k ? 1 : 0;
      groups[k].userData.glow += (want - groups[k].userData.glow) * 0.12;
    });
    var fade = 1 - smooth(0.62, 0.8, p) * 0.75;
    wireMats.forEach(function (m) { m.opacity = fade; });

    glowable.forEach(function (o) {
      var g = o.parent;
      while (g && g.userData.glow === undefined) g = g.parent;
      if (!g) return;
      o.material.emissive.setHex(0xd4895a);
      o.material.emissiveIntensity = g.userData.glow * 0.18;
    });

    var a = 0.15 + 0.45 * smooth(0.15, 0.9, p) + mouseX * 0.12;
    var r = (w < h ? 9.4 : 8.4) + smooth(0.2, 0.75, p) * 1.8;
    camera.position.set(Math.sin(a) * r, 0.7 + 0.5 * p + mouseY * 0.3, Math.cos(a) * r);
    camera.lookAt(0, 0, 0.75 + p * 0.5);

    renderer.render(scene, camera);

    labelDefs.forEach(function (d) {
      var on = stepGroup[step] === d.g && groups[d.g].userData.glow > 0.5;
      d.o.userData.top.getWorldPosition(tmp);
      tmp.project(camera);
      d.el.style.transform = 'translate(' + ((tmp.x + 1) / 2 * w) + 'px,' + ((1 - tmp.y) / 2 * h) + 'px) translate(-50%, calc(-100% - 14px))';
      d.el.classList.toggle('on', on);
    });

    stepEls.forEach(function (el, i) { el.classList.toggle('active', i === step); });
    if (stepTag) stepTag.textContent = '0' + (step + 1) + ' / 05';
    if (bar) bar.style.width = (p * 100) + '%';
    if (hint) hint.style.opacity = p < 0.03 ? 1 : 0;

    if (visible && (Math.abs(target - cur) > 0.0005 || order.some(function (k) { return Math.abs(groups[k].userData.glow - (stepGroup[step] === k ? 1 : 0)) > 0.01; }))) kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  window.addEventListener('scroll', function () { measure(); kick(); }, { passive: true });
  window.addEventListener('resize', function () { measure(); kick(); });
  stage.addEventListener('pointermove', function (e) {
    if (reduce || e.pointerType !== 'mouse') return;
    var r = stage.getBoundingClientRect();
    mouseX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    mouseY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    kick();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) { measure(); kick(); } }).observe(stage);
  } else { visible = true; }
  measure(); kick();
})();
