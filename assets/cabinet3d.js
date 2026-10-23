/* TMAT — 3D exploded view of a motor control cabinet, driven by scroll.
   Needs three.js (global THREE) loaded before this file. */
(function () {
  var stage = document.getElementById('stage');
  if (!stage) return;
  var canvas = document.getElementById('cab3d');
  var labelsEl = document.getElementById('cab-labels');
  var stepEls = Array.prototype.slice.call(document.querySelectorAll('.istep'));
  var stepsBox = document.querySelector('.isteps');
  var hint = document.getElementById('cab-hint');
  var bar = document.getElementById('cab-bar');
  var stepTag = document.getElementById('cab-step');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fail() { stage.classList.add('no3d'); }
  if (!window.THREE) { fail(); return; }
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
  catch (e) { fail(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x0b1015, 0.6));
  var key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(4, 6, 8); scene.add(key);
  var rim = new THREE.DirectionalLight(0xf3c29a, 0.9); rim.position.set(-6, 3, -4); scene.add(rim);
  var warm = new THREE.PointLight(0xd4895a, 0.9, 22); warm.position.set(-3, -2, 6); scene.add(warm);

  /* ---------- materials ---------- */
  function M(c, o) {
    o = o || {};
    return new THREE.MeshStandardMaterial({
      color: c, metalness: o.m || 0.1, roughness: o.r == null ? 0.6 : o.r,
      emissive: o.e || 0x000000, emissiveIntensity: o.ei || 1
    });
  }
  var mat = {
    white: M(0xe9e7e1, { r: 0.55 }), grey: M(0xc3c8cd, { r: 0.5 }), dark: M(0x2a2f34, { r: 0.5 }),
    black: M(0x15181b, { r: 0.4 }), metal: M(0xb9c1c8, { m: 0.8, r: 0.35 }), plate: M(0x7d878f, { m: 0.7, r: 0.45 }),
    box: M(0x2a3742, { m: 0.55, r: 0.45 }), duct: M(0x8f989f, { r: 0.75 }), copper: M(0xd4895a, { m: 0.85, r: 0.3 }),
    blue: M(0x2f6fb5, { r: 0.5 }), green: M(0x3a9a4a, { r: 0.5 }), yellow: M(0xe0b23a, { r: 0.5 }), red: M(0xc0392b, { r: 0.5 }),
    led: M(0x1a1a1a, { e: 0x5cff8a, ei: 1.5 }), ledO: M(0x1a1a1a, { e: 0xffa040, ei: 1.5 })
  };
  var glowable = []; // meshes that can light up when their group is highlighted

  function box(w, h, d, m, x, y, z, parent, keep) {
    var mm = keep ? m : m.clone();
    var o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mm);
    o.position.set(x || 0, y || 0, z || 0);
    parent.add(o);
    if (!keep) glowable.push(o);
    return o;
  }
  function cyl(r, h, m, x, y, z, parent) {
    var o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), m.clone());
    o.rotation.x = Math.PI / 2; o.position.set(x, y, z); parent.add(o); glowable.push(o); return o;
  }
  function anchor(parent, x, y, z) { var a = new THREE.Object3D(); a.position.set(x, y, z); parent.add(a); return a; }

  /* ---------- devices ---------- */
  function breaker(poles, toggleMat) {
    var g = new THREE.Group(), w = 0.18 * poles - 0.012;
    box(w, 0.62, 0.4, mat.white, 0, 0, 0.2, g);
    box(w, 0.26, 0.08, mat.white, 0, 0, 0.44, g);
    for (var i = 0; i < poles; i++) box(0.07, 0.12, 0.07, toggleMat || mat.black, (-(poles - 1) / 2 + i) * 0.18, 0.03, 0.5, g);
    box(w * 0.8, 0.04, 0.006, mat.copper, 0, -0.2, 0.404, g);
    g.userData.top = anchor(g, 0, 0.34, 0.45);
    return g;
  }
  function contactor() {
    var g = new THREE.Group();
    box(0.46, 0.6, 0.42, mat.grey, 0, 0, 0.21, g);
    box(0.36, 0.3, 0.1, mat.dark, 0, 0, 0.47, g);
    box(0.12, 0.05, 0.02, mat.ledO, 0, 0.07, 0.53, g, true);
    for (var i = 0; i < 3; i++) {
      box(0.08, 0.06, 0.06, mat.metal, -0.13 + i * 0.13, 0.26, 0.42, g);
      box(0.08, 0.06, 0.06, mat.metal, -0.13 + i * 0.13, -0.26, 0.42, g);
    }
    g.userData.top = anchor(g, 0, 0.33, 0.45);
    return g;
  }
  function overload() {
    var g = new THREE.Group();
    box(0.46, 0.3, 0.38, mat.grey, 0, 0, 0.19, g);
    cyl(0.055, 0.04, mat.blue, 0.1, 0.02, 0.4, g);
    cyl(0.03, 0.05, mat.red, -0.12, 0.02, 0.4, g);
    g.userData.top = anchor(g, 0, -0.18, 0.42);
    return g;
  }
  function plc() {
    var g = new THREE.Group();
    box(0.96, 0.62, 0.4, mat.dark, 0, 0, 0.2, g);
    box(0.9, 0.1, 0.06, mat.grey, 0, 0.24, 0.42, g);
    box(0.9, 0.1, 0.06, mat.grey, 0, -0.24, 0.42, g);
    for (var i = 0; i < 10; i++) box(0.03, 0.03, 0.01, i === 8 ? mat.ledO : mat.led, -0.36 + i * 0.05, 0.1, 0.405, g, true);
    box(0.24, 0.07, 0.006, mat.copper, 0.28, -0.02, 0.404, g);
    g.userData.top = anchor(g, 0, 0.34, 0.45);
    return g;
  }
  function psu() {
    var g = new THREE.Group();
    box(0.44, 0.62, 0.38, mat.metal, 0, 0, 0.19, g);
    for (var i = 0; i < 6; i++) box(0.32, 0.012, 0.006, mat.black, 0, 0.22 - i * 0.05, 0.383, g);
    box(0.03, 0.03, 0.01, mat.led, 0.15, -0.12, 0.385, g, true);
    box(0.4, 0.06, 0.05, mat.grey, 0, -0.26, 0.39, g);
    g.userData.top = anchor(g, 0, 0.34, 0.42);
    return g;
  }
  function terminals(n) {
    var g = new THREE.Group();
    for (var i = 0; i < n; i++) {
      var m = i === n - 1 ? mat.green : (i % 4 === 3 ? mat.blue : mat.grey);
      box(0.085, 0.42, 0.34, m, (i - (n - 1) / 2) * 0.095, 0, 0.17, g);
      box(0.05, 0.05, 0.02, mat.metal, (i - (n - 1) / 2) * 0.095, 0.12, 0.345, g);
    }
    box(0.085, 0.06, 0.345, mat.yellow, ((n - 1) - (n - 1) / 2) * 0.095, -0.12, 0.004, g);
    g.userData.top = anchor(g, 0, 0.25, 0.36);
    return g;
  }

  /* ---------- cabinet ---------- */
  var W = 2.6, H = 3.4, D = 0.95, T = 0.05;
  var cab = new THREE.Group(); scene.add(cab);
  box(W, H, T, mat.box, 0, 0, -T / 2, cab, true);
  box(T, H, D, mat.box, -W / 2 + T / 2, 0, D / 2 - T, cab, true);
  box(T, H, D, mat.box, W / 2 - T / 2, 0, D / 2 - T, cab, true);
  box(W, T, D, mat.box, 0, H / 2 - T / 2, D / 2 - T, cab, true);
  box(W, T, D, mat.box, 0, -H / 2 + T / 2, D / 2 - T, cab, true);
  box(2.3, 3.1, 0.03, mat.plate, 0, 0, 0.015, cab, true);
  [0.95, 0, -1.0].forEach(function (y) { box(2.0, 0.075, 0.02, mat.metal, 0, y, 0.04, cab, true); });

  // door hinged on the left edge
  var hinge = new THREE.Group(); hinge.position.set(-W / 2, 0, D - T); cab.add(hinge);
  box(W, H, T, mat.box, W / 2, 0, T / 2, hinge, true);
  box(0.06, 0.4, 0.06, mat.copper, W - 0.16, 0, T + 0.03, hinge, true);
  box(0.5, 0.36, 0.01, mat.yellow, W / 2, 0.9, T + 0.006, hinge, true);
  box(0.9, 0.1, 0.01, mat.copper, W / 2, 1.3, T + 0.006, hinge, true);
  [-0.3, 0.3].forEach(function (x) { cyl(0.11, 0.05, x < 0 ? mat.green : mat.red, W / 2 + x, -0.2, T + 0.03, hinge); });
  cyl(0.06, 0.03, mat.ledO, W / 2, 0.3, T + 0.02, hinge);

  var groups = { prot: new THREE.Group(), motor: new THREE.Group(), brain: new THREE.Group(), wiring: new THREE.Group() };
  Object.keys(groups).forEach(function (k) { groups[k].userData.glow = 0; cab.add(groups[k]); });
  var Z = 0.05;
  function place(g, parent, x, y) { g.position.set(x, y, Z); parent.add(g); return g; }

  var main = place(breaker(3), groups.prot, -0.72, 0.95);
  var rcd = place(breaker(2, mat.blue), groups.prot, -0.26, 0.95);
  box(0.05, 0.05, 0.03, mat.yellow, 0.05, -0.1, 0.42, rcd);
  place(breaker(1), groups.prot, 0.02, 0.95);
  place(breaker(1), groups.prot, 0.2, 0.95);
  var con = place(contactor(), groups.motor, -0.72, 0.02);
  var ol = place(overload(), groups.motor, -0.72, -0.44);
  var brainPlc = place(plc(), groups.brain, 0.4, 0.0);
  var brainPsu = place(psu(), groups.brain, 0.75, 0.95);
  var term = place(terminals(16), groups.wiring, 0, -1.0);
  [0.48, -0.5, -1.42].forEach(function (y) { box(2.05, 0.16, 0.3, mat.duct, 0, y, 0.18, groups.wiring); });
  [-1.09, 1.09].forEach(function (x) { box(0.16, 2.9, 0.3, mat.duct, x, 0, 0.18, groups.wiring); });

  // wires: device bottoms -> duct -> terminals
  var wireMats = [0x7a4a2a, 0x15181b, 0x8b8e91, 0x2f6fb5, 0x7a4a2a, 0x15181b, 0x8b8e91, 0xd4895a].map(function (c) {
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: c === 0xd4895a ? 0.8 : 0.1, transparent: true, opacity: 1 });
  });
  var starts = [[-0.85, 0.64], [-0.72, 0.64], [-0.59, 0.64], [-0.26, 0.64], [-0.85, -0.6], [-0.72, -0.6], [-0.59, -0.6], [0.4, -0.31]];
  starts.forEach(function (s, i) {
    var tx = (i * 2 - 7) * 0.095;
    var curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s[0], s[1], 0.3), new THREE.Vector3(s[0], s[1] < 0 ? -0.66 : 0.48, 0.24),
      new THREE.Vector3((s[0] + tx) / 2, -0.5, 0.22), new THREE.Vector3(tx, -0.62, 0.3), new THREE.Vector3(tx, -0.78, 0.36)
    ]);
    groups.wiring.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.014, 6, false), wireMats[i]));
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

  var target = 0, cur = reduce ? 0 : 0, mouseX = 0, mouseY = 0, visible = false, raf = 0, w = 0, h = 0;
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
      var v = g.userData.glow;
      o.material.emissive.setHex(0xd4895a);
      o.material.emissiveIntensity = v * 0.22;
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
