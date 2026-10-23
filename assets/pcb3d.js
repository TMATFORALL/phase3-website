/* TMAT — 3D PCB: an IoT relay board that separates into its layers as the
   visitor scrolls through the steps beside it. Needs global THREE. */
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

  if (!window.THREE) { stage.classList.add('no3d'); return; }
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
  catch (e) { stage.classList.add('no3d'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xe6eef5, 0x0b1015, 0.7));
  var key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(3, 7, 5); scene.add(key);
  var rim = new THREE.DirectionalLight(0xf3c29a, 0.8); rim.position.set(-5, 2, -4); scene.add(rim);

  function M(c, o) {
    o = o || {};
    return new THREE.MeshStandardMaterial({
      color: c, metalness: o.m || 0.1, roughness: o.r == null ? 0.6 : o.r,
      emissive: o.e || 0x000000, emissiveIntensity: o.ei || 1, transparent: true, opacity: o.o == null ? 1 : o.o
    });
  }
  var root = new THREE.Group(); scene.add(root);
  var layers = {};
  function layer(name) { var g = new THREE.Group(); g.userData = { base: 0, lift: 0, dim: 1 }; layers[name] = g; root.add(g); return g; }
  function box(w, h, d, m, x, y, z, parent) {
    var o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m.clone());
    o.material.userData.op = m.opacity;
    o.position.set(x, y, z); parent.add(o); return o;
  }
  function cyl(r, h, m, x, y, z, parent, seg) {
    var o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 18), m.clone());
    o.material.userData.op = m.opacity;
    o.position.set(x, y, z); parent.add(o); return o;
  }

  var BW = 2.6, BD = 1.7;               // board width (x) and depth (z)
  var gold = M(0xe2b65a, { m: 0.9, r: 0.25 });
  var copper = M(0xd4895a, { m: 0.85, r: 0.3 });

  /* --- bottom copper --- */
  var Lbot = layer('bottom'); Lbot.userData.lift = -0.55;
  box(BW - 0.08, 0.012, BD - 0.08, M(0xb06a3e, { m: 0.8, r: 0.4, o: 0.9 }), 0, -0.04, 0, Lbot);

  /* --- FR-4 core --- */
  var Lcore = layer('core');
  box(BW, 0.06, BD, M(0xc9b77a, { r: 0.8, o: 0.92 }), 0, 0, 0, Lcore);
  [[-1.2, -0.78], [1.2, -0.78], [-1.2, 0.78], [1.2, 0.78]].forEach(function (p) { cyl(0.05, 0.065, M(0x1a1a1a), p[0], 0, p[1], Lcore); });

  /* --- top copper: pads and traces --- */
  var Lcu = layer('copper'); Lcu.userData.lift = 0.4;
  var routes = [
    [[-0.95, -0.35], [-0.55, -0.35], [-0.55, -0.6], [0.3, -0.6]],
    [[-0.95, -0.2], [-0.4, -0.2], [-0.4, 0.1], [0.45, 0.1]],
    [[-0.95, -0.05], [-0.6, -0.05], [-0.6, 0.45], [0.2, 0.45], [0.2, 0.3]],
    [[-0.95, 0.1], [-0.75, 0.1], [-0.75, 0.62], [0.8, 0.62]],
    [[0.45, 0.1], [0.9, 0.1], [0.9, -0.15]],
    [[0.3, -0.6], [0.95, -0.6], [0.95, -0.35]],
    [[-1.15, 0.5], [-1.15, -0.65], [-0.2, -0.65]],
    [[0.15, -0.3], [0.15, -0.05], [-0.2, -0.05]]
  ];
  routes.forEach(function (r) {
    for (var i = 1; i < r.length; i++) {
      var a = r[i - 1], b = r[i], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.abs(dx) + Math.abs(dz);
      box(dx ? len + 0.03 : 0.03, 0.008, dz ? len + 0.03 : 0.03, copper, (a[0] + b[0]) / 2, 0.035, (a[1] + b[1]) / 2, Lcu);
    }
    [r[0], r[r.length - 1]].forEach(function (p) { cyl(0.04, 0.01, gold, p[0], 0.036, p[1], Lcu); });
  });
  box(0.9, 0.006, 0.12, copper, 0.75, 0.034, -0.8, Lcu);      // wide power trace to terminal

  /* --- solder mask (matte black) with pad openings implied by gold pads above --- */
  var Lmask = layer('mask'); Lmask.userData.lift = 0.8;
  box(BW, 0.01, BD, M(0x111417, { r: 0.85, o: 0.82 }), 0, 0.045, 0, Lmask);

  /* --- silkscreen --- */
  var Lsilk = layer('silk'); Lsilk.userData.lift = 1.15;
  var white = M(0xf2f2ee, { r: 0.7 });
  function outline(x, z, w, d) {
    box(w, 0.004, 0.012, white, x, 0.053, z - d / 2, Lsilk); box(w, 0.004, 0.012, white, x, 0.053, z + d / 2, Lsilk);
    box(0.012, 0.004, d, white, x - w / 2, 0.053, z, Lsilk); box(0.012, 0.004, d, white, x + w / 2, 0.053, z, Lsilk);
  }
  outline(-0.55, -0.15, 0.82, 0.62); outline(0.75, -0.3, 0.46, 0.38); outline(0.75, 0.6, 0.55, 0.3);
  outline(-1.05, 0.62, 0.3, 0.2);
  for (var t = 0; t < 6; t++) box(0.12 + (t % 3) * 0.04, 0.004, 0.025, white, 0.05 + t * 0.18, 0.053, 0.8, Lsilk);   // "TMAT IoT v1" text blocks
  box(0.3, 0.004, 0.04, copper, -0.95, 0.053, 0.8, Lsilk);

  /* --- components --- */
  var Lcomp = layer('parts'); Lcomp.userData.lift = 1.6;
  var parts = {};
  function part(name, group) { parts[name] = group; Lcomp.add(group); return group; }
  function anchor(g, x, y, z) { var a = new THREE.Object3D(); a.position.set(x, y, z); g.add(a); g.userData.top = a; }

  var esp = part('esp', new THREE.Group()); esp.position.set(-0.55, 0.06, -0.15);
  box(0.78, 0.03, 0.58, M(0x1d2a4a, { r: 0.6 }), 0, 0.015, 0, esp);
  box(0.58, 0.07, 0.42, M(0xc7ced4, { m: 0.85, r: 0.3 }), 0.08, 0.065, 0, esp);
  for (var i = 0; i < 5; i++) box(0.025, 0.004, 0.1, gold, -0.33, 0.032, -0.2 + i * 0.1, esp);
  anchor(esp, 0, 0.16, 0);

  var relay = part('relay', new THREE.Group()); relay.position.set(0.75, 0.06, -0.3);
  box(0.42, 0.32, 0.34, M(0x2f6fb5, { r: 0.45 }), 0, 0.16, 0, relay);
  box(0.3, 0.004, 0.12, white, 0, 0.322, 0, relay);
  anchor(relay, 0, 0.4, 0);

  var term = part('term', new THREE.Group()); term.position.set(0.75, 0.06, 0.6);
  box(0.52, 0.22, 0.26, M(0x2d8a4a, { r: 0.55 }), 0, 0.11, 0, term);
  for (var s = 0; s < 3; s++) cyl(0.045, 0.02, M(0xb9c1c8, { m: 0.85, r: 0.3 }), -0.16 + s * 0.16, 0.23, 0, term);
  anchor(term, 0, 0.3, 0);

  var caps = part('caps', new THREE.Group()); caps.position.set(0.05, 0.06, 0.25);
  [[0, 0], [0.2, 0]].forEach(function (c) {
    cyl(0.075, 0.26, M(0x1c1f24, { r: 0.4 }), c[0], 0.13, c[1], caps, 24);
    cyl(0.07, 0.01, M(0xb9c1c8, { m: 0.8, r: 0.3 }), c[0], 0.265, c[1], caps, 24);
    box(0.03, 0.262, 0.02, M(0xd9d9d9), c[0] + 0.065, 0.13, c[1], caps);
  });
  anchor(caps, 0.1, 0.34, 0);

  var reg = part('reg', new THREE.Group()); reg.position.set(0.25, 0.06, -0.15);
  box(0.24, 0.06, 0.16, M(0x15181b, { r: 0.5 }), 0, 0.03, 0.03, reg);
  box(0.2, 0.012, 0.08, M(0xb9c1c8, { m: 0.85, r: 0.3 }), 0, 0.006, -0.1, reg);
  anchor(reg, 0, 0.12, 0);

  var usb = part('usb', new THREE.Group()); usb.position.set(-1.18, 0.06, 0.62);
  box(0.24, 0.1, 0.3, M(0xc7ced4, { m: 0.9, r: 0.25 }), 0, 0.05, 0, usb);
  anchor(usb, 0, 0.16, 0);

  var leds = part('leds', new THREE.Group()); leds.position.set(-0.05, 0.06, -0.62);
  [[0, 0x5cff8a], [0.14, 0xff5a4a]].forEach(function (l) {
    box(0.07, 0.04, 0.05, M(0xf0f0f0, { e: l[1], ei: 1.6 }), l[0], 0.02, 0, leds);
  });
  for (var rr = 0; rr < 4; rr++) box(0.08, 0.025, 0.045, M(0x1a1a1a), 0.32 + rr * 0.11, 0.0125, 0, leds);
  anchor(leds, 0.2, 0.1, 0);

  var hdr = part('hdr', new THREE.Group()); hdr.position.set(-0.55, 0.06, 0.62);
  box(0.62, 0.1, 0.1, M(0x15181b), 0, 0.05, 0, hdr);
  for (var hp = 0; hp < 6; hp++) box(0.025, 0.22, 0.025, gold, -0.25 + hp * 0.1, 0.13, 0, hdr);
  anchor(hdr, 0, 0.28, 0);

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
  // which layers are in focus at each step (null = all)
  var stepFocus = [null, ['parts'], ['silk', 'mask'], ['copper'], ['core', 'bottom']];
  var target = 0, cur = 0, mouseX = 0, mouseY = 0, w = 0, h = 0, visible = false, raf = 0;
  var tmp = new THREE.Vector3();
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  function measure() {
    var r = stepsBox.getBoundingClientRect();
    var span = r.height - window.innerHeight * 0.6;
    target = Math.min(1, Math.max(0, (window.innerHeight * 0.5 - r.top) / Math.max(1, span)));
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
      L.traverse(function (o) { if (o.material) o.material.opacity = (o.material.userData.op == null ? 1 : o.material.userData.op) * L.userData.dim; });
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
