/* TMAT — 3D PCB: an IoT relay board that separates into its layers as the
   visitor scrolls through the steps beside it. Needs THREE and tmat3d-kit.js. */
(function () {
  var stage = document.getElementById('pcb-stage');
  if (!stage) return;
  var section = stage.closest('section');
  var canvas = document.getElementById('pcb3d');
  var labelsEl = document.getElementById('pcb-labels');
  var stepEls = Array.prototype.slice.call(section.querySelectorAll('.istep'));
  var stepsBox = section.querySelector('.isteps');
  var hint = document.getElementById('pcb-hint');
  var bar = document.getElementById('pcb-bar');
  var stepTag = document.getElementById('pcb-step');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!window.THREE || !window.TMAT3D) { stage.classList.add('no3d'); return; }
  var K = window.TMAT3D;
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
  catch (e) { stage.classList.add('no3d'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  var scene = new THREE.Scene();
  K.setup(renderer, scene);
  var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xe6eef5, 0x0b1015, 0.25));
  var key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(2.5, 7, 4); key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.015;
  var sc = key.shadow.camera; sc.left = -2; sc.right = 2; sc.top = 2; sc.bottom = -2; sc.near = 1; sc.far = 20;
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xf3c29a, 0.6); rim.position.set(-5, 2, -4); scene.add(rim);

  /* ---------- helpers ---------- */
  function M(c, o) {
    o = o || {};
    var m = new THREE.MeshStandardMaterial({
      color: c, metalness: o.m || 0, roughness: o.r == null ? 0.5 : o.r,
      emissive: o.e || 0x000000, emissiveIntensity: o.ei || 1, transparent: true, opacity: 1,
      map: o.map || null, alphaMap: o.alpha || null
    });
    if (o.po) { m.polygonOffset = true; m.polygonOffsetFactor = o.po; }
    m.userData.op = 1;
    return m;
  }
  function add(geo, m, x, y, z, parent) {
    var o = new THREE.Mesh(geo, m.clone()); o.material.userData.op = m.userData.op == null ? 1 : m.userData.op;
    o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  }
  function rbox(w, h, d, r, m, x, y, z, parent) { return add(K.rboxGeo(w, h, d, r), m, x, y, z, parent); }
  function box(w, h, d, m, x, y, z, parent) { return add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent); }
  function cyl(r1, r2, h, m, x, y, z, parent, seg) { return add(new THREE.CylinderGeometry(r1, r2, h, seg || 24), m, x, y, z, parent); }
  function topSticker(w, d, tex, x, y, z, parent, rough) {
    var m = M(0xffffff, { map: tex, r: rough == null ? 0.6 : rough, po: -2 });
    var o = add(new THREE.PlaneGeometry(w, d), m, x, y, z, parent); o.rotation.x = -Math.PI / 2; o.castShadow = false; return o;
  }

  var BW = 2.6, BD = 1.7, PX = 500;            // board size and texture resolution (px per unit)
  var CW = BW * PX, CH = BD * PX;
  function px(x) { return (x + BW / 2) * PX; }
  function pz(z) { return (z + BD / 2) * PX; }

  var gold = M(0xe2b65a, { m: 1, r: 0.22 });
  var steel = M(0xd0d6db, { m: 1, r: 0.25 });
  var solder = M(0xdfe3e6, { m: 1, r: 0.18 });

  /* ---------- artwork shared by the copper, mask and silk layers ---------- */
  var traces = [
    { w: 0.025, p: [[-0.94, -0.33], [-0.62, -0.33], [-0.5, -0.45], [-0.5, -0.62], [0.285, -0.62]] },
    { w: 0.025, p: [[-0.94, -0.23], [-0.6, -0.23], [-0.42, -0.41], [-0.42, -0.53], [0.395, -0.53], [0.395, -0.62]] },
    { w: 0.025, p: [[-0.94, -0.13], [-0.66, -0.13], [-0.58, -0.05], [-0.58, 0.05]] },
    { w: 0.04, p: [[0.17, -0.27], [0.17, -0.36], [-0.12, -0.36], [-0.16, -0.32]] },
    { w: 0.04, p: [[0.33, -0.27], [0.33, -0.33], [0.5, -0.33], [0.5, 0.08], [0.33, 0.25], [0.285, 0.25]] },
    { w: 0.05, p: [[0.25, -0.06], [0.25, 0.02], [0.13, 0.14], [0.13, 0.25], [0.085, 0.25]] },
    { w: 0.03, p: [[-1.1, 0.5], [-0.98, 0.4], [-0.05, 0.4], [0.015, 0.33], [0.015, 0.25]] },
    { w: 0.025, p: [[-0.8, 0.62], [-0.8, 0.5], [-0.94, 0.36], [-0.94, 0.08]] },
    { w: 0.025, p: [[-0.6, 0.62], [-0.6, 0.5], [-0.46, 0.36], [-0.46, 0.15]] },
    { w: 0.025, p: [[-0.16, 0.0], [0.08, 0.0], [0.4, -0.18], [0.6, -0.18]] },
    { w: 0.025, p: [[0.665, -0.62], [0.72, -0.62], [0.72, -0.5], [0.6, -0.42]] },
    { w: 0.1, p: [[0.9, -0.42], [1.08, -0.42], [1.08, 0.6], [0.91, 0.6]] },
    { w: 0.1, p: [[0.9, -0.18], [0.98, -0.1], [0.98, 0.42], [0.75, 0.42], [0.75, 0.6]] }
  ];
  var tht = [[0.6, -0.42], [0.6, -0.18], [0.9, -0.42], [0.9, -0.18], [0.75, -0.42],
    [0.59, 0.6], [0.75, 0.6], [0.91, 0.6], [0.015, 0.25], [0.085, 0.25], [0.215, 0.25], [0.285, 0.25],
    [-0.8, 0.62], [-0.7, 0.62], [-0.6, 0.62], [-0.5, 0.62], [-0.4, 0.62], [-0.3, 0.62]];
  var smd = [];
  for (var i = 0; i < 6; i++) { smd.push([-0.94, -0.4 + i * 0.1, 0.06, 0.035]); smd.push([-0.16, -0.4 + i * 0.1, 0.06, 0.035]); }
  for (i = 0; i < 6; i++) smd.push([-0.82 + i * 0.12, 0.15, 0.035, 0.06]);
  [0.17, 0.25, 0.33].forEach(function (x) { smd.push([x, -0.27, 0.045, 0.06]); });
  smd.push([0.25, -0.06, 0.16, 0.08]);
  for (i = 0; i < 4; i++) { smd.push([0.285 + i * 0.11, -0.62, 0.035, 0.05]); smd.push([0.355 + i * 0.11, -0.62, 0.035, 0.05]); }
  [-0.08, 0.06].forEach(function (x) { smd.push([x, -0.62, 0.03, 0.045]); smd.push([x + 0.06, -0.62, 0.03, 0.045]); });
  for (i = 0; i < 6; i++) smd.push([-1.06, 0.53 + i * 0.035, 0.05, 0.018]);
  var holes = [[-1.2, -0.75], [1.2, -0.75], [-1.2, 0.75], [1.2, 0.75]];

  function drawTraces(c, color, extra) {
    c.strokeStyle = color; c.lineCap = 'round'; c.lineJoin = 'round';
    traces.forEach(function (t) {
      c.lineWidth = (t.w + (extra || 0)) * PX; c.beginPath();
      t.p.forEach(function (q, k) { k ? c.lineTo(px(q[0]), pz(q[1])) : c.moveTo(px(q[0]), pz(q[1])); });
      c.stroke();
    });
  }
  function drawPads(c, color, grow) {
    c.fillStyle = color; grow = grow || 0;
    tht.forEach(function (q) { c.beginPath(); c.arc(px(q[0]), pz(q[1]), (0.04 + grow) * PX, 0, 7); c.fill(); });
    smd.forEach(function (q) { c.fillRect(px(q[0] - q[2] / 2 - grow), pz(q[1] - q[3] / 2 - grow), (q[2] + 2 * grow) * PX, (q[3] + 2 * grow) * PX); });
    holes.forEach(function (q) { c.beginPath(); c.arc(px(q[0]), pz(q[1]), (0.075 + grow) * PX, 0, 7); c.fill(); });
  }
  function drawDrills(c, color) {
    c.fillStyle = color;
    tht.forEach(function (q) { c.beginPath(); c.arc(px(q[0]), pz(q[1]), 0.018 * PX, 0, 7); c.fill(); });
    holes.forEach(function (q) { c.beginPath(); c.arc(px(q[0]), pz(q[1]), 0.045 * PX, 0, 7); c.fill(); });
  }

  var root = new THREE.Group(); scene.add(root);
  var layers = {};
  function layer(name, lift) { var g = new THREE.Group(); g.userData = { lift: lift, dim: 1 }; layers[name] = g; root.add(g); return g; }
  function boardPlane(tex, alpha, m, y, parent) {
    var mm = M(m.c, { m: m.m, r: m.r, map: tex, alpha: alpha, po: m.po });
    var o = add(new THREE.PlaneGeometry(BW - 0.01, BD - 0.01), mm, 0, y, 0, parent);
    o.rotation.x = -Math.PI / 2; o.castShadow = false; return o;
  }

  /* --- bottom copper: ground pour with clearances + solder joints --- */
  var Lbot = layer('bottom', -0.55);
  var botTex = K.canvasTex(CW, CH, function (c) {
    c.fillStyle = '#b8703f'; c.fillRect(0, 0, CW, CH);
    c.fillStyle = '#5a3a22'; tht.forEach(function (q) { c.beginPath(); c.arc(px(q[0]), pz(q[1]), 0.07 * PX, 0, 7); c.fill(); });
    drawPads(c, '#e2b65a'); drawDrills(c, '#111');
  });
  var bot = boardPlane(botTex, null, { c: 0xffffff, m: 0.85, r: 0.32 }, -0.028, Lbot);
  bot.rotation.x = Math.PI / 2; bot.scale.y = -1;
  tht.forEach(function (q) { var s = cyl(0.008, 0.03, 0.03, solder, q[0], -0.045, q[1], Lbot, 16); s.rotation.x = Math.PI; });

  /* --- FR-4 core --- */
  var Lcore = layer('core', 0);
  var weave = K.noiseTex('#cdbb7e', 22); weave.repeat.set(4, 3);
  var core = rbox(BW, BD, 0.05, 0.03, M(0xffffff, { r: 0.75, map: weave }), 0, 0, 0, Lcore);
  core.rotation.x = -Math.PI / 2;

  /* --- top copper: traces in copper, pads in gold (ENIG) --- */
  var Lcu = layer('copper', 0.4);
  var cuColor = K.canvasTex(CW, CH, function (c) { c.clearRect(0, 0, CW, CH); drawTraces(c, '#c9784a'); drawPads(c, '#e2b65a'); drawDrills(c, '#111'); });
  var cuAlpha = K.canvasTex(CW, CH, function (c) { c.fillStyle = '#000'; c.fillRect(0, 0, CW, CH); drawTraces(c, '#fff'); drawPads(c, '#fff'); }, false);
  boardPlane(cuColor, cuAlpha, { c: 0xffffff, m: 0.9, r: 0.25, po: -1 }, 0.027, Lcu);

  /* --- solder mask: matte black, traces show as raised lines, pads left open --- */
  var Lmask = layer('mask', 0.8);
  var maskColor = K.canvasTex(CW, CH, function (c) { c.fillStyle = '#0e1113'; c.fillRect(0, 0, CW, CH); drawTraces(c, '#1d2327', 0.01); });
  var maskAlpha = K.canvasTex(CW, CH, function (c) { c.fillStyle = '#fff'; c.fillRect(0, 0, CW, CH); drawPads(c, '#000', 0.008); }, false);
  boardPlane(maskColor, maskAlpha, { c: 0xffffff, m: 0.05, r: 0.55, po: -2 }, 0.031, Lmask);

  /* --- silkscreen --- */
  var Lsilk = layer('silk', 1.15);
  var silkTex = K.canvasTex(CW, CH, function (c) {
    c.clearRect(0, 0, CW, CH);
    c.strokeStyle = '#f2f2ee'; c.fillStyle = '#f2f2ee'; c.lineWidth = 0.008 * PX;
    function rect(x, z, w, d) { c.strokeRect(px(x - w / 2), pz(z - d / 2), w * PX, d * PX); }
    function text(t, x, z, size, align) { c.font = '700 ' + (size * PX) + 'px Arial'; c.textAlign = align || 'center'; c.textBaseline = 'middle'; c.fillText(t, px(x), pz(z)); }
    rect(-0.55, -0.15, 0.84, 0.64); text('U1', -0.55, -0.52, 0.05);
    rect(0.75, -0.3, 0.48, 0.4); text('K1', 0.75, -0.55, 0.05);
    rect(0.75, 0.6, 0.56, 0.3); text('J2', 0.42, 0.6, 0.05);
    [0.05, 0.25].forEach(function (x, k) { c.beginPath(); c.arc(px(x), pz(0.25), 0.085 * PX, 0, 7); c.stroke(); text('C' + (k + 1), x, 0.4, 0.04); text('+', x - 0.06, 0.16, 0.05); });
    rect(0.25, -0.15, 0.3, 0.3); text('U2', 0.25, 0.06 + 0.06, 0.04);
    rect(-1.18, 0.62, 0.3, 0.34); text('J1', -1.18, 0.38, 0.04);
    rect(-0.55, 0.62, 0.66, 0.14); text('J3', -0.55, 0.76, 0.04);
    for (var r = 0; r < 4; r++) text('R' + (r + 1), 0.32 + r * 0.11, -0.7, 0.032);
    text('D1', -0.05, -0.7, 0.032); text('D2', 0.09, -0.7, 0.032);
    c.beginPath(); c.arc(px(-0.96), pz(-0.46), 0.015 * PX, 0, 7); c.fill();
    c.setLineDash([0.03 * PX, 0.02 * PX]); rect(0.86, 0.12, 0.6, 1.24); c.setLineDash([]);
    text('HV 220VAC', 0.86, -0.56 + 1.33, 0.035);
    text('TMAT IoT RELAY', -0.3, 0.86 - 0.06, 0.06, 'center');
    text('REV 1.0  2026', 0.4, 0.86 - 0.06, 0.04);
    text('5V', -1.18, 0.83, 0.035); text('GND', -0.92, 0.83, 0.035);
  });
  var silkAlpha = K.canvasTex(CW, CH, function (c) {
    c.fillStyle = '#000'; c.fillRect(0, 0, CW, CH);
    c.drawImage(silkTex.image, 0, 0);
    var img = c.getImageData(0, 0, CW, CH), d = img.data;
    for (var k = 0; k < d.length; k += 4) { var a = d[k + 3] === 0 ? 0 : 255; d[k] = d[k + 1] = d[k + 2] = Math.max(d[k], a === 255 && d[k] > 40 ? 255 : 0); d[k + 3] = 255; }
    c.putImageData(img, 0, 0);
  }, false);
  boardPlane(silkTex, silkAlpha, { c: 0xffffff, m: 0, r: 0.8, po: -3 }, 0.034, Lsilk);

  /* --- components --- */
  var Lcomp = layer('parts', 1.6);
  var parts = {};
  var Y0 = 0.035;
  function part(name, x, z) { var g = new THREE.Group(); g.position.set(x, Y0, z); Lcomp.add(g); parts[name] = g; return g; }
  function anchor(g, x, y, z) { var a = new THREE.Object3D(); a.position.set(x, y, z); g.add(a); g.userData.top = a; }

  // ESP32 module: blue substrate, steel shield with marking, printed antenna, castellated pads
  var esp = part('esp', -0.55, -0.15);
  rbox(0.8, 0.03, 0.6, 0.008, M(0x1d2a4a, { r: 0.45 }), 0, 0.015, 0, esp);
  rbox(0.56, 0.06, 0.44, 0.01, steel, 0.09, 0.06, 0, esp);
  topSticker(0.5, 0.36, K.canvasTex(512, 368, function (c, W, H) {
    c.fillStyle = '#c3c9ce'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#4a5157'; c.textAlign = 'center';
    c.font = '700 54px Arial'; c.fillText('ESP32-WROOM-32', W / 2, 150);
    c.font = '500 34px Arial'; c.fillText('Wi-Fi  ·  Bluetooth', W / 2, 215);
    c.strokeStyle = '#4a5157'; c.lineWidth = 6; c.strokeRect(40, 40, W - 80, H - 80);
  }), 0.09, 0.091, 0, esp, 0.35);
  topSticker(0.2, 0.52, K.canvasTex(160, 416, function (c, W, H) {
    c.fillStyle = '#1d2a4a'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#d4a04a'; c.lineWidth = 10; c.beginPath(); c.moveTo(130, 400);
    for (var k = 0; k < 7; k++) { c.lineTo(130, 360 - k * 52); c.lineTo(k % 2 ? 130 : 30, 360 - k * 52); c.lineTo(k % 2 ? 130 : 30, 334 - k * 52); }
    c.stroke();
  }), -0.29, 0.031, 0, esp, 0.4);
  for (i = 0; i < 6; i++) { box(0.03, 0.03, 0.04, gold, -0.4, 0.015, -0.25 + i * 0.1, esp); box(0.03, 0.03, 0.04, gold, 0.4, 0.015, -0.25 + i * 0.1, esp); }
  anchor(esp, 0, 0.17, 0);

  // relay
  var relay = part('relay', 0.75, -0.3);
  rbox(0.42, 0.33, 0.34, 0.02, M(0x2f6fb5, { r: 0.35 }), 0, 0.165, 0, relay);
  topSticker(0.36, 0.28, K.canvasTex(384, 300, function (c, W, H) {
    c.fillStyle = '#2f6fb5'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#f2f4f7'; c.textAlign = 'center';
    c.font = '700 46px Arial'; c.fillText('5VDC', W / 2, 80);
    c.font = '500 30px Arial'; c.fillText('10A 250VAC', W / 2, 140); c.fillText('10A 30VDC', W / 2, 185);
    c.strokeStyle = '#f2f4f7'; c.lineWidth = 4; c.strokeRect(50, 220, 60, 50); c.beginPath(); c.moveTo(130, 245); c.lineTo(330, 245); c.stroke();
  }), 0, 0.331, 0, relay, 0.4);
  anchor(relay, 0, 0.42, 0);

  // screw terminal
  var term = part('term', 0.75, 0.6);
  rbox(0.52, 0.24, 0.27, 0.02, M(0x2d8a4a, { r: 0.45 }), 0, 0.12, 0, term);
  for (var s = 0; s < 3; s++) {
    var sx = -0.16 + s * 0.16;
    cyl(0.05, 0.05, 0.02, steel, sx, 0.245, -0.03, term);
    box(0.07, 0.012, 0.012, M(0x2a2e33), sx, 0.258, -0.03, term);
    box(0.09, 0.08, 0.02, M(0x0b0c0e, { r: 0.9 }), sx, 0.1, 0.13, term);
  }
  anchor(term, 0, 0.32, 0);

  // electrolytic capacitors with printed sleeve and vented top
  var sleeve = K.canvasTex(512, 256, function (c, W, H) {
    c.fillStyle = '#1b2433'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#9aa7b8'; c.fillRect(0, 0, 90, H);
    c.fillStyle = '#1b2433'; c.font = '700 40px Arial'; for (var k = 0; k < 4; k++) c.fillText('−', 30, 50 + k * 60);
    c.fillStyle = '#d9e0e8'; c.font = '600 34px Arial'; c.fillText('470µF  16V', 150, 110); c.fillText('105°C', 150, 160);
  });
  var vent = K.canvasTex(128, 128, function (c, W, H) {
    c.fillStyle = '#cfd5da'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#7d858c'; c.lineWidth = 8; c.beginPath(); c.moveTo(20, 64); c.lineTo(108, 64); c.moveTo(64, 20); c.lineTo(64, 108); c.stroke();
  });
  var caps = part('caps', 0.05, 0.25);
  [0, 0.2].forEach(function (cx) {
    cyl(0.075, 0.075, 0.26, M(0xffffff, { map: sleeve, r: 0.35 }), cx, 0.13, 0, caps, 32);
    var top = cyl(0.068, 0.068, 0.004, M(0xffffff, { map: vent, m: 0.8, r: 0.3 }), cx, 0.262, 0, caps, 32);
  });
  anchor(caps, 0.1, 0.35, 0);

  // 3.3 V regulator (SOT-223)
  var reg = part('reg', 0.25, -0.15);
  rbox(0.24, 0.06, 0.16, 0.008, M(0x15181b, { r: 0.55 }), 0, 0.03, -0.04, reg);
  topSticker(0.2, 0.12, K.label(0.2, 0.12, '#15181b', '#c9ced3', [{ t: '1117', size: 0.4 }, { t: '3.3', size: 0.3 }]), 0, 0.061, -0.04, reg, 0.7);
  [-0.08, 0, 0.08].forEach(function (lx) { box(0.03, 0.012, 0.07, solder, lx, 0.006, -0.12, reg); });
  box(0.15, 0.012, 0.07, solder, 0, 0.006, 0.08, reg);
  anchor(reg, 0, 0.13, 0);

  // USB-C
  var usb = part('usb', -1.16, 0.62);
  rbox(0.26, 0.1, 0.3, 0.045, steel, 0, 0.05, 0, usb);
  rbox(0.2, 0.05, 0.02, 0.02, M(0x0b0c0e), -0.0, 0.05, 0.15, usb).rotation.y = 0;
  anchor(usb, 0, 0.17, 0);

  // LEDs and resistors
  var leds = part('leds', 0, -0.62);
  [[-0.05, 0x5cff8a], [0.09, 0xff5a4a]].forEach(function (l) {
    rbox(0.08, 0.035, 0.05, 0.008, M(0xf0f0f0, { r: 0.3 }), l[0], 0.0175, 0, leds);
    rbox(0.05, 0.02, 0.04, 0.008, M(0xffffff, { e: l[1], ei: 2.2, r: 0.2 }), l[0], 0.04, 0, leds);
  });
  var rTex = K.label(0.06, 0.035, '#15181b', '#e9ecef', [{ t: '103', size: 0.7 }]);
  for (var rr = 0; rr < 4; rr++) {
    var rx = 0.32 + rr * 0.11;
    rbox(0.07, 0.022, 0.045, 0.004, M(0x15181b, { r: 0.5 }), rx, 0.011, 0, leds);
    box(0.012, 0.024, 0.046, solder, rx - 0.035, 0.012, 0, leds); box(0.012, 0.024, 0.046, solder, rx + 0.035, 0.012, 0, leds);
    topSticker(0.05, 0.035, rTex, rx, 0.0225, 0, leds, 0.7);
  }
  anchor(leds, 0.2, 0.1, 0);

  // pin header
  var hdr = part('hdr', -0.55, 0.62);
  rbox(0.62, 0.1, 0.1, 0.008, M(0x15181b, { r: 0.6 }), 0, 0.05, 0, hdr);
  for (var hp = 0; hp < 6; hp++) box(0.025, 0.24, 0.025, gold, -0.25 + hp * 0.1, 0.13, 0, hdr);
  anchor(hdr, 0, 0.29, 0);

  /* --- labels --- */
  var labelDefs = [
    { g: 'esp', t: 'ESP32 Wi-Fi', n: 'U1' }, { g: 'relay', t: 'รีเลย์ 5 V', n: 'K1' },
    { g: 'term', t: 'เทอร์มินัลสกรู', n: 'J2' }, { g: 'caps', t: 'ตัวเก็บประจุ', n: 'C1' },
    { g: 'reg', t: 'เรกูเลเตอร์ 3.3 V', n: 'U2' }, { g: 'usb', t: 'USB-C', n: 'J1' }, { g: 'leds', t: 'LED และตัวต้านทาน', n: 'D1' }
  ];
  labelDefs.forEach(function (d) {
    d.el = document.createElement('span'); d.el.className = 'cab-label';
    d.el.innerHTML = '<b>' + d.n + '</b>' + d.t; labelsEl.appendChild(d.el);
  });

  /* --- scroll-driven state --- */
  var stepFocus = [null, ['parts'], ['silk', 'mask'], ['copper'], ['core', 'bottom']];
  var target = 0, cur = 0, mouseX = 0, mouseY = 0, w = 0, h = 0, visible = false, raf = 0;
  var tmp = new THREE.Vector3();
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // Phones resize the viewport when the address bar hides on scroll; keep one
  // height until the width changes (rotation) so the animation does not jump.
  var viewW = window.innerWidth, viewH = document.documentElement.clientHeight;
  function measure() {
    if (window.innerWidth !== viewW) { viewW = window.innerWidth; viewH = document.documentElement.clientHeight; }
    var r = stepsBox.getBoundingClientRect();
    var span = r.height - viewH * 0.6;
    target = Math.min(1, Math.max(0, (viewH * 0.5 - r.top) / Math.max(1, span)));
  }
  function resize() {
    var nw = stage.clientWidth, nh = stage.clientHeight;
    if (nw === w && nh === h) return;
    w = nw; h = nh; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w < h * 0.9 ? 44 : 34; camera.updateProjectionMatrix();
  }

  function frame() {
    raf = 0; resize();
    cur += (target - cur) * (reduce ? 1 : 0.08);
    var p = cur;
    var step = Math.min(4, Math.floor(p * 5 + 0.0001));
    var focus = stepFocus[step];
    var explode = smooth(0.12, 0.42, p);
    var busy = false;

    Object.keys(layers).forEach(function (k) {
      var L = layers[k];
      L.position.y = L.userData.lift * explode;
      var want = !focus || focus.indexOf(k) >= 0 ? 1 : 0.14;
      L.userData.dim += (want - L.userData.dim) * 0.15;
      if (Math.abs(L.userData.dim - want) > 0.01) busy = true;
      L.traverse(function (o) { if (o.material) { o.material.opacity = (o.material.userData.op == null ? 1 : o.material.userData.op) * L.userData.dim; o.material.depthWrite = L.userData.dim > 0.6; } });
    });

    var yaw = -0.75 + 0.9 * p + mouseX * 0.12;
    var pitch = 0.78 - 0.22 * p + mouseY * 0.08;
    var r = 5.0 + explode * 1.6;
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * r, Math.sin(pitch) * r + 0.2, Math.cos(yaw) * Math.cos(pitch) * r);
    camera.lookAt(0, 0.3 + explode * 0.45, 0);
    renderer.render(scene, camera);

    var showLabels = step === 1 && layers.parts.userData.dim > 0.6;
    labelDefs.forEach(function (d) {
      parts[d.g].userData.top.getWorldPosition(tmp); tmp.project(camera);
      d.el.style.transform = 'translate(' + ((tmp.x + 1) / 2 * w) + 'px,' + ((1 - tmp.y) / 2 * h) + 'px) translate(-50%, calc(-100% - 14px))';
      d.el.classList.toggle('on', showLabels);
    });

    stepEls.forEach(function (el, i) { el.classList.toggle('active', i === step); });
    if (stepTag) stepTag.textContent = '0' + (step + 1) + ' / 05';
    if (bar) bar.style.width = (p * 100) + '%';
    if (hint) hint.style.opacity = p < 0.03 ? 1 : 0;

    if (visible && (busy || Math.abs(target - cur) > 0.0005)) kick();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  window.addEventListener('scroll', function () { measure(); kick(); }, { passive: true });
  window.addEventListener('resize', function () { if (window.innerWidth !== viewW) { measure(); kick(); } });
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
