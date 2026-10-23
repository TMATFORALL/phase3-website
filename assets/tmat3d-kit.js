/* TMAT 3D kit — shared helpers for the cabinet and PCB scenes:
   studio lighting with reflections, rounded boxes, printed labels and small textures. */
(function () {
  if (!window.THREE) return;
  var T = window.THREE;

  // Renderer settings and a soft studio environment so metal and plastic reflect light.
  function setup(renderer, scene) {
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    var pm = new T.PMREMGenerator(renderer);
    var env = new T.Scene();
    env.add(new T.Mesh(new T.BoxGeometry(30, 30, 30), new T.MeshBasicMaterial({ color: 0x141b22, side: T.BackSide })));
    function softbox(w, h, color, power, x, y, z) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(power), side: T.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    }
    softbox(10, 5, 0xffffff, 1.7, 0, 9, 6);      // overhead key
    softbox(5, 8, 0xfff1e2, 1.0, -10, 2, 4);     // warm left fill
    softbox(5, 8, 0xd4895a, 1.1, 10, 1, -4);     // copper rim
    softbox(12, 2, 0xc8daf0, 0.9, 0, -8, 8);     // cool floor bounce
    scene.environment = pm.fromScene(env, 0.035).texture;
    pm.dispose();
  }

  // Box with rounded edges and corners (w = x, h = y, d = z), centred on the origin.
  var cache = {};
  function rboxGeo(w, h, d, r) {
    var k = [w, h, d, r].map(function (v) { return v.toFixed(3); }).join('|');
    if (cache[k]) return cache[k];
    var b = Math.max(0.001, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
    var sw = w - 2 * b, sh = h - 2 * b, cr = Math.max(0.0005, Math.min(b * 0.6, sw / 2 - 0.0005, sh / 2 - 0.0005));
    var s = new T.Shape(), x = -sw / 2, y = -sh / 2;
    s.moveTo(x + cr, y); s.lineTo(x + sw - cr, y); s.quadraticCurveTo(x + sw, y, x + sw, y + cr);
    s.lineTo(x + sw, y + sh - cr); s.quadraticCurveTo(x + sw, y + sh, x + sw - cr, y + sh);
    s.lineTo(x + cr, y + sh); s.quadraticCurveTo(x, y + sh, x, y + sh - cr);
    s.lineTo(x, y + cr); s.quadraticCurveTo(x, y, x + cr, y);
    var g = new T.ExtrudeGeometry(s, { depth: Math.max(0.0005, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 3 });
    g.translate(0, 0, -(d - 2 * b) / 2);
    g.computeVertexNormals();
    cache[k] = g;
    return g;
  }

  // Canvas-drawn texture (labels, silkscreen, copper artwork).
  function canvasTex(wpx, hpx, draw, color) {
    var c = document.createElement('canvas'); c.width = wpx; c.height = hpx;
    var g = c.getContext('2d'); draw(g, wpx, hpx);
    var t = new T.CanvasTexture(c);
    if (color !== false) t.encoding = T.sRGBEncoding;
    t.anisotropy = 8;
    return t;
  }

  // A printed sticker: background colour, lines of text.
  function label(w, h, bg, fg, lines, opts) {
    opts = opts || {};
    var px = 256, wpx = Math.round(px * w / h * 1.0) || 256;
    wpx = Math.min(2048, Math.max(64, wpx));
    return canvasTex(wpx, px, function (g, W, H) {
      if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
      g.fillStyle = fg; g.textAlign = opts.align || 'center'; g.textBaseline = 'middle';
      var n = lines.length;
      lines.forEach(function (ln, i) {
        var size = (ln.size || (i === 0 ? 0.42 : 0.24)) * H;
        g.font = (ln.weight || (i === 0 ? '700' : '500')) + ' ' + size + 'px Arial, Helvetica, sans-serif';
        var y = H * (n === 1 ? 0.52 : 0.28 + i * (0.5 / Math.max(1, n - 1)));
        g.fillText(ln.t || ln, opts.align === 'left' ? W * 0.08 : W / 2, ln.y != null ? ln.y * H : y);
      });
      if (opts.border) { g.strokeStyle = fg; g.lineWidth = H * 0.04; g.strokeRect(H * 0.04, H * 0.04, W - H * 0.08, H * 0.08 > 0 ? H - H * 0.08 : H); }
    });
  }

  // Fine noise for powder coat, galvanised steel and brushed aluminium.
  function noiseTex(base, amount, streak) {
    var t = canvasTex(256, 256, function (g, W, H) {
      g.fillStyle = base; g.fillRect(0, 0, W, H);
      var img = g.getImageData(0, 0, W, H), d = img.data;
      for (var y = 0; y < H; y++) {
        var row = streak ? (Math.random() - 0.5) * amount * 0.8 : 0;
        for (var x = 0; x < W; x++) {
          var i = (y * W + x) * 4, n = (Math.random() - 0.5) * amount + row;
          d[i] += n; d[i + 1] += n; d[i + 2] += n;
        }
      }
      g.putImageData(img, 0, 0);
    });
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  function plane(w, h, mat) { return new T.Mesh(new T.PlaneGeometry(w, h), mat); }

  window.TMAT3D = { setup: setup, rboxGeo: rboxGeo, canvasTex: canvasTex, label: label, noiseTex: noiseTex, plane: plane };
})();
