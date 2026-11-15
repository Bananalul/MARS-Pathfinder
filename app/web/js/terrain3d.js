// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// 3D hazard view: HiRISE DTM terrain around a route point (measured), coloured by slope class (derived),
// with hazard pillars per block (illustrative), the route, a true-scale astronaut and the hazard zone.
// three.js is loaded as an ES module in index.html and handed over via window.THREE_MODS.

const threeReady = new Promise((resolve) => {
  if (window.THREE_MODS) resolve(window.THREE_MODS);
  else window.addEventListener("three-ready", () => resolve(window.THREE_MODS), { once: true });
});

const V3D_COLORS = { base: [0.6, 0.46, 0.35], caution: [0.82, 0.63, 0.23], critical: [0.77, 0.28, 0.25], nodata: [0.25, 0.25, 0.27] };
const V3D_BLOCK_CRIT_SHARE = 0.15; // same rules as the planner's hazard map
const V3D_BLOCK_CAUT_SHARE = 0.4;
const ASTRONAUT_HEIGHT_M = 1.8;
// Apollo LRV: 3.1 m long, 1.83 m wide, 1.14 m high, 2.3 m wheelbase, wheels 0.818 m × 0.23 m (NASA SP-4029, NSSDC).
const LRV = { length: 3.1, width: 1.83, height: 1.14, wheelbase: 2.3, wheelD: 0.818, wheelW: 0.23 };

function initTerrain3D(mobility) {
  const el = (id) => document.getElementById(id);
  const dialog = el("view3d");
  const holder = el("v3d-canvas");
  let T = null, OrbitControls = null;
  let renderer = null, scene = null, camera = null, controls = null, terrain = null, frame = null;
  let ctx = null; // { lat, lon, route, focusRadius, title, patch }
  let patchFns = null;

  const thresholds = () => mobility.thresholds() || computeLimits(mobility.profile());

  async function ensureRenderer() {
    if (renderer) return;
    ({ THREE: T, OrbitControls } = await threeReady);
    renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    holder.appendChild(renderer.domElement);
    camera = new T.PerspectiveCamera(50, 1, 0.2, 5000);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 2;
    renderer.domElement.addEventListener("pointermove", onHover);
    new ResizeObserver(resize).observe(holder);
  }

  function resize() {
    if (!renderer) return;
    const w = holder.clientWidth, h = holder.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function loop() {
    frame = requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  }

  // ---------- Terrain helpers ----------

  function makePatchFns(p, zRef, exag) {
    const at = (i, j) => (i < 0 || j < 0 || i >= p.w || j >= p.h ? NaN : p.z[j * p.w + i]);
    // Bilinear height (m above zRef, exaggerated) at local east/north metres.
    const height = (east, north) => {
      const fi = p.cx + east / p.dx, fj = p.cy - north / p.dy;
      const i = Math.floor(fi), j = Math.floor(fj), fx = fi - i, fy = fj - j;
      const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
      const v = [a, b, c, d].every(Number.isFinite)
        ? a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
        : [a, b, c, d].find(Number.isFinite);
      return v == null ? 0 : (v - zRef) * exag;
    };
    const slope = (i, j) => {
      const z = [];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) z.push(at(i + di, j + dj));
      if (!z.every(Number.isFinite)) return NaN;
      const dzdx = (z[2] + 2 * z[5] + z[8] - (z[0] + 2 * z[3] + z[6])) / (8 * p.dx);
      const dzdy = (z[6] + 2 * z[7] + z[8] - (z[0] + 2 * z[1] + z[2])) / (8 * p.dy);
      return (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
    };
    const toScene = (east, north, up = 0) => new T.Vector3(east, height(east, north) + up, -north);
    return { at, height, slope, toScene };
  }

  // ---------- Terrain: coarse mesh + fine textures ----------
  // The mesh keeps a manageable vertex count; the full-resolution elevation drives lighting (object-space
  // normal map), slope colours and the photo texture, so small relief stays visible on large areas.

  const MESH_MAX = { 1024: 1024, 2048: 1024, 3072: 1280, 4096: 1536 };

  // Per-pixel slopes, statistics and the slope-colour texture (once per elevation patch).
  function analyse(p, f, thr) {
    const n = p.w * p.h;
    const slopes = new Float32Array(n);
    const img = new ImageData(p.w, p.h);
    const d = img.data;
    let crit = 0, valid = 0, maxSlope = 0;
    for (let j = 0; j < p.h; j++)
      for (let i = 0; i < p.w; i++) {
        const k = j * p.w + i;
        const sl = f.slope(i, j);
        slopes[k] = sl;
        let c;
        if (!Number.isFinite(p.z[k])) c = V3D_COLORS.nodata;
        else if (!Number.isFinite(sl)) c = V3D_COLORS.base;
        else {
          valid++;
          if (sl > maxSlope) maxSlope = sl;
          if (sl >= thr.critical) (c = V3D_COLORS.critical), crit++;
          else if (sl >= thr.caution) c = V3D_COLORS.caution;
          else {
            const k2 = 1 - 0.3 * (sl / thr.caution);
            c = [V3D_COLORS.base[0] * k2, V3D_COLORS.base[1] * k2, V3D_COLORS.base[2] * k2];
          }
        }
        d[k * 4] = c[0] * 255;
        d[k * 4 + 1] = c[1] * 255;
        d[k * 4 + 2] = c[2] * 255;
        d[k * 4 + 3] = sl >= thr.caution ? 255 : 0; // alpha marks hazard pixels for the photo overlay
      }
    const slopeCanvas = document.createElement("canvas");
    slopeCanvas.width = p.w;
    slopeCanvas.height = p.h;
    const opaque = new ImageData(new Uint8ClampedArray(d), p.w, p.h);
    for (let k = 3; k < opaque.data.length; k += 4) opaque.data[k] = 255;
    slopeCanvas.getContext("2d").putImageData(opaque, 0, 0);
    const hazardCanvas = document.createElement("canvas");
    hazardCanvas.width = p.w;
    hazardCanvas.height = p.h;
    hazardCanvas.getContext("2d").putImageData(img, 0, 0);
    return { slopes, slopeCanvas, hazardCanvas, stats: { critShare: valid ? crit / valid : 0, maxSlope } };
  }

  // Object-space normals from the full-resolution heights (x east, y up, z south), encoded as RGB.
  function normalCanvas(p, exag) {
    const img = new ImageData(p.w, p.h);
    const d = img.data;
    const at = (i, j) => {
      i = Math.min(p.w - 1, Math.max(0, i));
      j = Math.min(p.h - 1, Math.max(0, j));
      const v = p.z[j * p.w + i];
      return Number.isFinite(v) ? v : NaN;
    };
    for (let j = 0; j < p.h; j++)
      for (let i = 0; i < p.w; i++) {
        const c = at(i, j);
        let gx = (at(i + 1, j) - at(i - 1, j)) / (2 * p.dx);
        let gy = (at(i, j + 1) - at(i, j - 1)) / (2 * p.dy); // towards south
        if (!Number.isFinite(gx)) gx = 0;
        if (!Number.isFinite(gy)) gy = 0;
        if (!Number.isFinite(c)) gx = gy = 0;
        let nx = -gx * exag, ny = 1, nz = -gy * exag;
        const len = Math.hypot(nx, ny, nz);
        const k = (j * p.w + i) * 4;
        d[k] = ((nx / len + 1) / 2) * 255;
        d[k + 1] = ((ny / len + 1) / 2) * 255;
        d[k + 2] = ((nz / len + 1) / 2) * 255;
        d[k + 3] = 255;
      }
    const cv = document.createElement("canvas");
    cv.width = p.w;
    cv.height = p.h;
    cv.getContext("2d").putImageData(img, 0, 0);
    return cv;
  }

  function buildMesh(p, zRef, exag, meshMax) {
    const k = Math.max(1, Math.ceil(Math.max(p.w, p.h) / meshMax));
    const mw = Math.floor((p.w - 1) / k) + 1, mh = Math.floor((p.h - 1) / k) + 1;
    const n = mw * mh;
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    const valid = new Uint8Array(n);
    let minY = Infinity;
    for (let j = 0; j < mh; j++)
      for (let i = 0; i < mw; i++) {
        const v = j * mw + i, pi = i * k, pj = j * k;
        const z = p.z[pj * p.w + pi];
        pos[v * 3] = (pi - p.cx) * p.dx;
        pos[v * 3 + 2] = (pj - p.cy) * p.dy;
        if (Number.isFinite(z)) {
          pos[v * 3 + 1] = (z - zRef) * exag;
          valid[v] = 1;
          if (pos[v * 3 + 1] < minY) minY = pos[v * 3 + 1];
        }
        uv[v * 2] = (pi + 0.5) / p.w;
        uv[v * 2 + 1] = 1 - (pj + 0.5) / p.h;
      }
    for (let v = 0; v < n; v++) if (!valid[v]) pos[v * 3 + 1] = minY;
    // Triangles touching a no-data vertex are left out (edges of DTM coverage show as gaps, not walls).
    const idx = new Uint32Array((mw - 1) * (mh - 1) * 6);
    let m = 0;
    for (let j = 0; j < mh - 1; j++)
      for (let i = 0; i < mw - 1; i++) {
        const a = j * mw + i, b = a + 1, c = a + mw, d = c + 1;
        if (valid[a] && valid[c] && valid[b]) (idx[m++] = a), (idx[m++] = c), (idx[m++] = b);
        if (valid[b] && valid[c] && valid[d]) (idx[m++] = b), (idx[m++] = c), (idx[m++] = d);
      }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("uv", new T.BufferAttribute(uv, 2));
    geo.setIndex(new T.BufferAttribute(idx.subarray(0, m), 1));
    geo.computeVertexNormals();
    return { geo, mw, mh };
  }

  function canvasTexture(cv, color = true) {
    const tex = new T.CanvasTexture(cv);
    if (color) tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.generateMipmaps = true;
    tex.minFilter = T.LinearMipmapLinearFilter;
    return tex;
  }

  // Surface texture for the chosen mode: photo, slope colours, or photo with hazard overlay.
  function surfaceCanvas(mode) {
    const an = ctx.analysis;
    if (mode === "slope" || !ctx.photo) return an.slopeCanvas;
    if (mode === "photo") return ctx.photo.canvas;
    const cv = document.createElement("canvas");
    cv.width = ctx.photo.canvas.width;
    cv.height = ctx.photo.canvas.height;
    const cx = cv.getContext("2d");
    cx.drawImage(ctx.photo.canvas, 0, 0);
    cx.globalAlpha = 0.5;
    cx.drawImage(an.hazardCanvas, 0, 0, cv.width, cv.height);
    return cv;
  }

  function applySurface() {
    if (!terrain) return;
    const mat = terrain.material;
    if (mat.map) mat.map.dispose();
    mat.map = canvasTexture(surfaceCanvas(el("v3d-surface").value));
    mat.needsUpdate = true;
  }

  // Hazard pillars: one per block where the planner's hazard-map rules fire. Height is symbolic.
  function buildPillars(p, f, slopes, thr, half) {
    const group = new T.Group();
    const blockM = Math.max(5, Math.round((2 * half) / 14));
    const bi = Math.max(2, Math.round(blockM / p.dx)), bj = Math.max(2, Math.round(blockM / p.dy));
    for (let j0 = 0; j0 < p.h - 1; j0 += bj)
      for (let i0 = 0; i0 < p.w - 1; i0 += bi) {
        let n = 0, c = 0, u = 0, top = -Infinity, smax = 0;
        for (let j = j0; j < Math.min(p.h, j0 + bj); j++)
          for (let i = i0; i < Math.min(p.w, i0 + bi); i++) {
            const s = slopes[j * p.w + i];
            if (!Number.isFinite(s)) continue;
            n++;
            if (s >= thr.critical) c++;
            if (s >= thr.caution) u++;
            smax = Math.max(smax, s);
            const zz = f.at(i, j);
            if (Number.isFinite(zz)) top = Math.max(top, zz);
          }
        if (!n) continue;
        const critical = c / n >= V3D_BLOCK_CRIT_SHARE;
        if (!critical && u / n < V3D_BLOCK_CAUT_SHARE) continue;
        const color = critical ? 0xc4473f : 0xe0903c;
        const height = critical ? blockM * (0.3 + 0.9 * (c / n)) : blockM * (0.12 + 0.2 * (u / n));
        const w = bi * p.dx * 0.8, d = bj * p.dy * 0.8;
        const box = new T.BoxGeometry(w, height, d);
        const cxm = (i0 + bi / 2 - 0.5 - p.cx) * p.dx, czm = (j0 + bj / 2 - 0.5 - p.cy) * p.dy;
        const baseY = f.height(cxm, -czm);
        const fill = new T.Mesh(box, new T.MeshLambertMaterial({ color, transparent: true, opacity: critical ? 0.22 : 0.1, depthWrite: false }));
        const edges = new T.LineSegments(new T.EdgesGeometry(box), new T.LineBasicMaterial({ color }));
        for (const o of [fill, edges]) {
          o.position.set(cxm, baseY + height / 2, czm);
          o.userData = { slope: smax, critical };
          group.add(o);
        }
      }
    return group;
  }

  function buildAstronaut() {
    const g = new T.Group();
    const suit = new T.MeshLambertMaterial({ color: 0xf2f2ee });
    const visor = new T.MeshLambertMaterial({ color: 0xd9813f });
    const s = ASTRONAUT_HEIGHT_M / 1.8;
    const leg = new T.CylinderGeometry(0.09 * s, 0.1 * s, 0.85 * s, 10);
    for (const x of [-0.12, 0.12]) {
      const m = new T.Mesh(leg, suit);
      m.position.set(x * s, 0.425 * s, 0);
      g.add(m);
    }
    const torso = new T.Mesh(new T.BoxGeometry(0.5 * s, 0.6 * s, 0.32 * s), suit);
    torso.position.y = 1.15 * s;
    g.add(torso);
    const pack = new T.Mesh(new T.BoxGeometry(0.45 * s, 0.55 * s, 0.2 * s), suit);
    pack.position.set(0, 1.18 * s, 0.25 * s);
    g.add(pack);
    for (const x of [-0.32, 0.32]) {
      const arm = new T.Mesh(new T.CylinderGeometry(0.07 * s, 0.07 * s, 0.6 * s, 8), suit);
      arm.position.set(x * s, 1.12 * s, 0);
      g.add(arm);
    }
    const head = new T.Mesh(new T.SphereGeometry(0.17 * s, 16, 12), suit);
    head.position.y = 1.62 * s;
    g.add(head);
    const v = new T.Mesh(new T.SphereGeometry(0.12 * s, 12, 8, 0, Math.PI), visor);
    v.position.set(0, 1.63 * s, -0.08 * s);
    v.rotation.y = Math.PI;
    g.add(v);
    // Green ring + label so the true-scale figure can be found from afar.
    const ring = new T.Mesh(new T.TorusGeometry(1.5, 0.08, 6, 40), new T.MeshBasicMaterial({ color: 0x4f9d69 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    g.add(ring);
    g.add(labelSprite(t("Astronaut {h} m (true scale)", { h: ASTRONAUT_HEIGHT_M.toFixed(1) }), 2.6));
    return g;
  }

  // Apollo-LRV-sized rover, placed on the terrain and tilted to it (pitch/roll from the four wheel contact heights).
  function buildRover(f, east, north, heading) {
    const g = new T.Group();
    const body = new T.MeshLambertMaterial({ color: 0xc9c3b4 });
    const dark = new T.MeshLambertMaterial({ color: 0x44464c });
    const gold = new T.MeshLambertMaterial({ color: 0xc8a046 });
    const track = LRV.width - LRV.wheelW;
    const r = LRV.wheelD / 2;
    const chassis = new T.Mesh(new T.BoxGeometry(LRV.length, 0.12, track - 0.35), body);
    chassis.position.y = r + 0.12;
    g.add(chassis);
    for (const x of [-LRV.wheelbase / 2, LRV.wheelbase / 2])
      for (const z of [-track / 2, track / 2]) {
        const wheel = new T.Mesh(new T.CylinderGeometry(r, r, LRV.wheelW, 18), dark);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, r, z);
        g.add(wheel);
        const fender = new T.Mesh(new T.BoxGeometry(LRV.wheelD * 0.9, 0.03, LRV.wheelW + 0.06), gold);
        fender.position.set(x, LRV.wheelD + 0.04, z);
        g.add(fender);
      }
    for (const z of [-0.4, 0.4]) {
      const seat = new T.Mesh(new T.BoxGeometry(0.45, 0.4, 0.5), dark);
      seat.position.set(-0.1, r + 0.38, z);
      g.add(seat);
    }
    const consoleBox = new T.Mesh(new T.BoxGeometry(0.25, 0.35, 0.3), body);
    consoleBox.position.set(0.45, r + 0.35, 0);
    g.add(consoleBox);
    const mast = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, LRV.height - r - 0.2, 6), body);
    mast.position.set(1.1, r + 0.12 + (LRV.height - r - 0.2) / 2, 0.3);
    g.add(mast);
    const dish = new T.Mesh(new T.SphereGeometry(0.4, 16, 6, 0, Math.PI * 2, 0, 0.6), gold);
    dish.position.set(1.1, LRV.height - 0.05, 0.3);
    dish.rotation.z = -Math.PI / 2.5;
    g.add(dish);

    // Pose: heading = direction of travel (unit vector east/north); tilt from wheel contact heights.
    const fwd = { x: heading.x, y: heading.y }, left = { x: -heading.y, y: heading.x };
    const hAt = (a, b) => f.height(east + fwd.x * a + left.x * b, north + fwd.y * a + left.y * b);
    const hf = (hAt(LRV.wheelbase / 2, track / 2) + hAt(LRV.wheelbase / 2, -track / 2)) / 2;
    const hr = (hAt(-LRV.wheelbase / 2, track / 2) + hAt(-LRV.wheelbase / 2, -track / 2)) / 2;
    const hl = (hAt(LRV.wheelbase / 2, track / 2) + hAt(-LRV.wheelbase / 2, track / 2)) / 2;
    const hri = (hAt(LRV.wheelbase / 2, -track / 2) + hAt(-LRV.wheelbase / 2, -track / 2)) / 2;
    const pitch = Math.atan2(hf - hr, LRV.wheelbase), roll = Math.atan2(hl - hri, track);
    const pose = new T.Group();
    pose.add(g);
    // local x = forward, local +z = right side; left wheels higher -> positive rotation about x lifts the left (-z) side.
    g.rotation.set(roll, 0, pitch, "XZY");
    pose.rotation.y = Math.atan2(fwd.y, fwd.x); // scene: x east, -z north
    pose.position.set(east, (hf + hr) / 2, -north);
    pose.add(labelSprite(t("Rover {l} m (Apollo LRV size)", { l: LRV.length.toFixed(1) }), 2.2));
    // Heights are exaggerated in the scene: the real tilt uses tan / exaggeration.
    const exag = parseFloat(el("v3d-exag").value);
    const tilt = (Math.atan(Math.hypot(Math.tan(pitch), Math.tan(roll)) / exag) * 180) / Math.PI;
    return { obj: pose, tilt };
  }

  function labelSprite(text, y) {
    const cv = document.createElement("canvas");
    const cx = cv.getContext("2d");
    cx.font = "600 26px Segoe UI, sans-serif";
    cv.width = Math.ceil(cx.measureText(text).width) + 20;
    cv.height = 40;
    cx.font = "600 26px Segoe UI, sans-serif";
    cx.fillStyle = "rgba(20,22,26,0.8)";
    cx.fillRect(0, 0, cv.width, cv.height);
    cx.fillStyle = "#fff";
    cx.fillText(text, 10, 29);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), depthTest: false, sizeAttenuation: false }));
    sp.scale.set((0.028 * cv.width) / cv.height, 0.028, 1);
    sp.position.y = y;
    sp.renderOrder = 10;
    return sp;
  }

  // Route as a tube draped on the terrain (resampled at DTM spacing).
  function buildRoute(p, f, route, half, hx = half, hy = half) {
    const group = new T.Group();
    const step = Math.max(p.dx, 0.5);
    let seg = [];
    const flush = () => {
      if (seg.length > 1) {
        const path = new T.CurvePath();
        for (let i = 1; i < seg.length; i++) path.add(new T.LineCurve3(seg[i - 1], seg[i]));
        group.add(new T.Mesh(new T.TubeGeometry(path, seg.length * 2, Math.max(0.3, half / 250), 6, false), new T.MeshLambertMaterial({ color: 0x4fbf6a, emissive: 0x16391f })));
      }
      seg = [];
    };
    for (let i = 1; i < route.length; i++) {
      const a = p.toLocal(route[i - 1][0], route[i - 1][1]), b = p.toLocal(route[i][0], route[i][1]);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.ceil(len / step));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) {
        const x = a.x + ((b.x - a.x) * k) / n, y = a.y + ((b.y - a.y) * k) / n;
        if (Math.abs(x) > hx || Math.abs(y) > hy) flush();
        else seg.push(f.toScene(x, y, 0.4));
      }
    }
    flush();
    return group;
  }

  function buildZone(f, radius) {
    const pts = [];
    for (let k = 0; k <= 180; k++) {
      const a = (k / 180) * Math.PI * 2;
      pts.push(f.toScene(Math.cos(a) * radius, Math.sin(a) * radius, 0.5));
    }
    const line = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineDashedMaterial({ color: 0xf0a0c0, dashSize: radius / 12, gapSize: radius / 18 }));
    line.computeLineDistances();
    return line;
  }

  // ---------- Scene ----------

  async function build(resetCamera) {
    const thr = thresholds();
    const maxPx = parseInt(el("v3d-res").value, 10);
    // Point views are a square box around the point; cut-outs use their own box.
    let box = ctx.box;
    if (!box) {
      const sq = parseFloat(el("v3d-size").value);
      const mPerDeg = (MARS_R_KM * 1000 * Math.PI) / 180;
      const dLat = sq / mPerDeg, dLon = sq / (mPerDeg * Math.cos((ctx.lat * Math.PI) / 180));
      box = [ctx.lon - dLon, ctx.lat - dLat, ctx.lon + dLon, ctx.lat + dLat];
    }
    const key = `${box.join(",")}|${maxPx}`;
    if (!ctx.patch || ctx.patchKey !== key) {
      el("v3d-status").textContent = t("Loading elevation data ({n} points per side max.) …", { n: maxPx });
      const tok = ++buildToken;
      const patch = await readDemMosaic(box, maxPx, (pr) =>
        (el("v3d-status").textContent = t("Loading elevation models ({i}/{n}, {k}) …", { i: pr.i, n: pr.n, k: DEM_LABEL[pr.kind] }))
      );
      if (tok !== buildToken) return;
      Object.assign(ctx, { patch, patchKey: key, analysis: null, photo: null, normals: null });
      if (patch) loadPhoto(patch, tok);
    }
    const p = ctx.patch;
    if (!p) {
      el("v3d-status").textContent = t("No elevation data could be read for this area.");
      return;
    }
    const hx = p.halfX, hy = p.halfY;
    const half = Math.max(hx, hy);
    if (ctx.box && resetCamera) {
      // Auto vertical exaggeration so the relief is visible: aim for relief ≈ 12 % of the area width.
      let lo = Infinity, hi = -Infinity;
      for (const v of p.z) if (Number.isFinite(v)) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
      const relief = Math.max(1, hi - lo);
      const auto = Math.min(20, Math.max(1, Math.round((0.12 * 2 * half) / relief)));
      el("v3d-exag").value = auto;
      el("v3d-exag-val").textContent = `${auto}×`;
    }
    const zc = p.z[Math.round(p.cy) * p.w + Math.round(p.cx)];
    const zRef = Number.isFinite(zc) ? zc : p.z.find(Number.isFinite);
    const exag = parseFloat(el("v3d-exag").value);
    el("v3d-exag-val").textContent = `${exag}×`;
    const f = makePatchFns(p, zRef, exag);
    patchFns = { ...f, p, zRef, exag };

    el("v3d-status").textContent = t("Computing slopes and lighting at full resolution …");
    await new Promise((r) => setTimeout(r));
    if (!ctx.analysis) ctx.analysis = analyse(p, f, thr);
    if (!ctx.normals || ctx.normals.exag !== exag) ctx.normals = { exag, canvas: normalCanvas(p, exag) };

    if (scene) scene.traverse((o) => (o.geometry?.dispose(), o.material?.map?.dispose?.(), o.material?.normalMap?.dispose?.(), o.material?.dispose?.()));
    scene = new T.Scene();
    scene.background = new T.Color(0x2b211c);
    scene.fog = new T.Fog(0x2b211c, half * (ctx.box ? 4 : 2.2), half * (ctx.box ? 10 : 5));
    scene.add(new T.HemisphereLight(0xffe6cc, 0x3a2a20, 1.0));
    const sun = new T.DirectionalLight(0xfff1dd, 2.2);
    sun.position.set(-half, half * 0.9, -half); // from the north-west, like a hillshade
    scene.add(sun);

    const { geo, mw, mh } = buildMesh(p, zRef, exag, MESH_MAX[maxPx] || 1024);
    const mat = new T.MeshStandardMaterial({ roughness: 1, metalness: 0, normalMap: canvasTexture(ctx.normals.canvas, false), normalMapType: T.ObjectSpaceNormalMap });
    terrain = new T.Mesh(geo, mat);
    scene.add(terrain);
    ctx.meshSize = [mw, mh];
    applySurface();
    const ter = { slopes: ctx.analysis.slopes, stats: ctx.analysis.stats };
    if (el("v3d-pillars").checked) scene.add(buildPillars(p, f, ter.slopes, thr, half));
    if (ctx.route?.length > 1) scene.add(buildRoute(p, f, ctx.route, half, hx, hy));
    if (ctx.focusRadius) scene.add(buildZone(f, ctx.focusRadius));
    // Direction of the route at the point (for the rover heading and the camera).
    let dir = { x: 1, y: 0 };
    const r = ctx.route || [];
    if (r.length > 1) {
      let k = 0;
      r.forEach((q, i) => {
        const a = p.toLocal(q[0], q[1]), b = p.toLocal(r[k][0], r[k][1]);
        if (Math.hypot(a.x, a.y) < Math.hypot(b.x, b.y)) k = i;
      });
      const a = p.toLocal(...r[Math.max(0, k - 1)]), b = p.toLocal(...r[Math.min(r.length - 1, k + 1)]);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > 0) dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    }
    const figure = el("v3d-figure").value;
    ctx.dir = dir;
    let roverTilt = null;
    if (figure === "rover" || figure === "both") {
      // Rover on the route point; with both, the astronaut stands 3 m to its side.
      const rv = buildRover(f, 0, 0, dir);
      scene.add(rv.obj);
      roverTilt = rv.tilt;
    }
    if (figure === "astronaut" || figure === "both") {
      const off = figure === "both" ? { x: -dir.y * 3, y: dir.x * 3 } : { x: 0, y: 0 };
      const astro = buildAstronaut();
      astro.position.copy(f.toScene(off.x, off.y));
      scene.add(astro);
    }

    if (resetCamera && ctx.box) {
      // Overview of the cut-out from the south-west, above the terrain.
      const d = half * 1.6;
      controls.target.copy(f.toScene(0, 0));
      camera.position.set(-d * 0.55, controls.target.y + d * 0.75, d * 0.8);
      camera.far = half * 10;
      camera.updateProjectionMatrix();
    } else if (resetCamera) {
      // Look across the route (perpendicular to its direction at the point), from slightly above.
      const d = Math.max(25, half * 0.7);
      // Perpendicular, on the side that is lower (looking uphill at the hazard).
      let side = { x: -dir.y, y: dir.x };
      if (f.height(side.x * d * 0.5, side.y * d * 0.5) > f.height(-side.x * d * 0.5, -side.y * d * 0.5)) side = { x: dir.y, y: -dir.x };
      controls.target.copy(f.toScene(0, 0, 1));
      camera.position.set(side.x * d, controls.target.y + d * 0.95, -side.y * d);
      camera.far = half * 8;
      camera.updateProjectionMatrix();
    }
    controls.maxDistance = half * 4;

    el("v3d-status").textContent = "";
    el("v3d-stats").innerHTML = `
      <tr><th>${t("Area")}</th><td>${fmtLen(2 * hx)} × ${fmtLen(2 * hy)}</td></tr>
      <tr><th>${t(ctx.box ? "Elevation at the centre" : "Elevation at the point")}</th><td>${zRef.toFixed(1)} m</td></tr>
      <tr><th>${t("Max. slope in view")}</th><td>${ter.stats.maxSlope.toFixed(1)}°</td></tr>
      <tr><th>${t("Area at/above critical ({c}°)", { c: thr.critical.toFixed(1) })}</th><td>${(ter.stats.critShare * 100).toFixed(1)} %</td></tr>
      ${roverTilt != null ? `<tr><th>${t("Rover tilt at the point")}</th><td>${roverTilt.toFixed(1)}°</td></tr>` : ""}
      <tr><th>${t("Elevation resolution")}</th><td>${p.pixel.toFixed(p.pixel < 10 ? 1 : 0)} m/px</td></tr>
      <tr><th>${t("Elevation sources")}</th><td>${p.sources.filter((u) => u.share >= 0.005).map((u) => `${DEM_LABEL[u.kind]} ${Math.round(u.share * 100)} %`).join("<br>")}</td></tr>
      <tr><td colspan="2" class="muted small wrap">${t("Elevation grid {w} × {h} (lighting, slopes); 3D mesh {mw} × {mh}. Larger areas are read coarser.", { w: p.w, h: p.h, mw: ctx.meshSize[0], mh: ctx.meshSize[1] })}</td></tr>
      <tr><th>${t("Surface image")}</th><td id="v3d-photo-src" class="wrap">${photoSourcesHtml()}</td></tr>
      <tr><th>DTM</th><td class="wrap">${p.sources.filter((u) => u.share >= 0.005).map((u) => demLink(u.id)).join("<br>")}</td></tr>`;
  }

  let lastHover = 0;
  function onHover(e) {
    if (!terrain || !patchFns) return;
    // Raycasting a fine mesh is expensive: at most every 150 ms.
    const now = performance.now();
    if (now - lastHover < 150) return;
    lastHover = now;
    const r = renderer.domElement.getBoundingClientRect();
    const ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObject(terrain)[0];
    if (!hit) return (el("v3d-readout").textContent = "");
    const { p, zRef, exag } = patchFns;
    const i = Math.round(p.cx + hit.point.x / p.dx), j = Math.round(p.cy + hit.point.z / p.dy);
    const s = patchFns.slope(i, j);
    const dist = Math.hypot(hit.point.x, hit.point.z);
    el("v3d-readout").textContent = `${t("Elevation")} ${(hit.point.y / exag + zRef).toFixed(1)} m · ${t("slope")} ${Number.isFinite(s) ? s.toFixed(1) + "°" : "–"} · ${dist.toFixed(0)} m ${t("from the point")}`;
  }

  // Camera close to the reference figure (≈ 10 m), looking across the route.
  function focusFigure() {
    if (!patchFns || !ctx?.dir || el("v3d-figure").value === "none") return;
    const { toScene } = patchFns;
    const side = { x: -ctx.dir.y, y: ctx.dir.x };
    controls.target.copy(toScene(0, 0, 1));
    const eye = toScene(side.x * 8 - ctx.dir.x * 4, side.y * 8 - ctx.dir.y * 4, 5);
    camera.position.copy(eye);
  }

  // ---------- Public ----------

  let buildToken = 0;
  function photoSourcesHtml() {
    if (!ctx.photo) return `<span class="muted">${t(ctx.photoFailed ? "not available" : "loading …")}</span>`;
    return ctx.photo.sources.map((x) => `${escHtml(x.name)} · ${x.mPerPx < 10 ? x.mPerPx.toFixed(1) : Math.round(x.mPerPx)} m/px`).join("<br>") || t("not available");
  }
  // Loads the surface photo for the patch (same lon/lat box and pixel grid as the elevation).
  async function loadPhoto(patch, tok) {
    ctx.photoFailed = false;
    // Photo canvas independent of the elevation grid: imagery is much sharper (HiRISE 0.25 m, CTX 5 m).
    // Aim for 0.5 m per pixel, at most 4096 px per side.
    const ext = Math.max(2 * patch.halfX, 2 * patch.halfY);
    const side = Math.min(4096, Math.max(512, Math.round(ext / 0.5)));
    const W = Math.round((side * 2 * patch.halfX) / ext), H = Math.round((side * 2 * patch.halfY) / ext);
    try {
      const ph = await composeImagery(patch.box, W, H, (pr) => {
        if (tok === buildToken) el("v3d-readout").textContent = t("Loading surface images ({l}: {a}/{b}) …", { l: pr.layer, a: pr.a, b: pr.b });
      });
      if (tok !== buildToken || ctx.patch !== patch) return;
      ctx.photo = ph;
    } catch (err) {
      console.warn("Surface images failed:", err);
      ctx.photoFailed = true;
    }
    if (tok !== buildToken) return;
    el("v3d-readout").textContent = "";
    const srcCell = document.getElementById("v3d-photo-src");
    if (srcCell) srcCell.innerHTML = photoSourcesHtml();
    applySurface();
  }

  const fmtLen = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${m.toFixed(0)} m`);

  async function open(opts) {
    ctx = { ...opts, patch: null };
    el("v3d-size").closest("label").hidden = !!ctx.box;
    el("v3d-res").closest("label").hidden = false;
    el("v3d-res").value = String(opts.maxPx || 2048);
    if (ctx.box) {
      ctx.lat = (ctx.box[1] + ctx.box[3]) / 2;
      ctx.lon = (ctx.box[0] + ctx.box[2]) / 2;
      el("v3d-figure").value = "none";
    } else if (!ctx.keepFigure) el("v3d-figure").value = isOnFoot(mobility.profile()) ? "astronaut" : "both";
    el("v3d-title").textContent = opts.title || t("3D view");
    el("v3d-sub").textContent = ctx.box
      ? `${formatLat(ctx.box[1])} … ${formatLat(ctx.box[3])}, ${formatLonEast(ctx.box[0])} … ${formatLonEast(ctx.box[2])}`
      : `${formatLat(ctx.lat)}, ${formatLonEast(ctx.lon)}`;
    el("v3d-exag").max = ctx.box ? 20 : 4;
    if (!ctx.box && parseFloat(el("v3d-exag").value) > 4) el("v3d-exag").value = 1.5;
    el("v3d-readout").textContent = "";
    dialog.showModal();
    await ensureRenderer();
    resize();
    try {
      await build(true);
    } catch (err) {
      console.error(err);
      el("v3d-status").textContent = t("3D view failed: {msg}", { msg: err.message });
      return;
    }
    if (!frame) loop();
  }

  function close() {
    if (frame) cancelAnimationFrame(frame);
    frame = null;
    dialog.close();
  }

  el("v3d-close").addEventListener("click", close);
  dialog.addEventListener("close", () => {
    if (frame) cancelAnimationFrame(frame);
    frame = null;
  });
  el("v3d-size").addEventListener("change", () => ctx && build(true));
  el("v3d-exag").addEventListener("input", () => ctx && ctx.patch && build(false));
  el("v3d-pillars").addEventListener("change", () => ctx && ctx.patch && build(false));
  el("v3d-figure").addEventListener("change", () => ctx && ctx.patch && build(false));
  el("v3d-res").addEventListener("change", () => ctx && build(false));
  el("v3d-surface").addEventListener("change", () => ctx && ctx.analysis && applySurface());
  el("v3d-focus").addEventListener("click", focusFigure);

  return { open };
}
