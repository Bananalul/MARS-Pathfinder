// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Globe view: zoom out to the whole planet as a sphere (three.js), textured with the Viking MDIM 2.1 colour mosaic
// (NASA Mars Trek tiles) and optionally the active thematic or environment layer. Click the globe to fly the map there.

function initGlobe(map, getOverlayCanvas, getTime = () => Date.now()) {
  const tr = (en, de) => (LANG === "de" ? de : en);
  const dlg = document.getElementById("globe-dialog");
  const host = document.getElementById("globe-canvas");
  const ctx = { renderer: null, scene: null, camera: null, controls: null, mesh: null, overlay: null, base: null, raf: null, features: null, labels: null, sun: null, sunLight: null, ambient: null };

  // Everything currently drawn on the map (route, zones, bases, NASA findings, thematic points, labels)
  // rendered onto an equirectangular canvas; text labels become 3D sprites so they stay readable.
  function collectFeatures() {
    const W = 4096, H = 2048;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const cx = cv.getContext("2d");
    const X = (lon) => ((normalizeLon180(lon) + 180) / 360) * W, Y = (lat) => ((90 - lat) / 180) * H;
    const labels = [];
    const seen = new Set();
    const grat = window.mapGraticule;
    if (grat) {
      seen.add(grat);
      grat.eachLayer((l) => seen.add(l));
    }
    // Full 30° grid when the map graticule is switched on.
    if (document.getElementById("toggle-graticule")?.checked) {
      cx.strokeStyle = "rgba(255,255,255,0.35)";
      cx.lineWidth = 2;
      for (let lat = -60; lat <= 60; lat += 30) (cx.beginPath(), cx.moveTo(0, Y(lat)), cx.lineTo(W, Y(lat)), cx.stroke());
      for (let lon = -180; lon < 180; lon += 30) (cx.beginPath(), cx.moveTo(X(lon), 0), cx.lineTo(X(lon), H), cx.stroke());
    }
    const visit = (layer) => {
      if (seen.has(layer)) return;
      seen.add(layer);
      if (layer instanceof L.LayerGroup) return layer.eachLayer(visit);
      if (layer instanceof L.TileLayer || layer instanceof L.ImageOverlay) return;
      const o = layer.options || {};
      if (layer instanceof L.CircleMarker) {
        const p = layer.getLatLng();
        cx.beginPath();
        cx.arc(X(p.lng), Y(p.lat), Math.max(3, (o.radius || 4) * 1.4), 0, Math.PI * 2);
        cx.fillStyle = o.fillColor || o.color || "#fff";
        cx.globalAlpha = o.fillOpacity ?? 0.9;
        cx.fill();
        cx.globalAlpha = 1;
        cx.lineWidth = 1.5;
        cx.strokeStyle = "#111";
        cx.stroke();
      } else if (layer instanceof L.Polyline) {
        const rings = layer.getLatLngs();
        const flat = (a) => (a.length && Array.isArray(a[0]) ? a : [a]);
        for (const ring of flat(Array.isArray(rings[0]) && Array.isArray(rings[0][0]) ? rings.flat() : rings)) {
          if (!ring.length) continue;
          cx.beginPath();
          ring.forEach((q, k) => (k ? cx.lineTo(X(q.lng), Y(q.lat)) : cx.moveTo(X(q.lng), Y(q.lat))));
          if (layer instanceof L.Polygon) {
            cx.closePath();
            if (o.fill !== false) {
              cx.fillStyle = o.fillColor || o.color || "#3388ff";
              cx.globalAlpha = Math.max(0.12, o.fillOpacity ?? 0.2);
              cx.fill();
              cx.globalAlpha = 1;
            }
          }
          cx.strokeStyle = o.color || "#fff";
          cx.lineWidth = Math.max(2, (o.weight || 2) * 1.5);
          cx.setLineDash(o.dashArray ? [8, 6] : []);
          cx.stroke();
          cx.setLineDash([]);
        }
      } else if (layer instanceof L.Marker) {
        const p = layer.getLatLng();
        const node = layer.getElement && layer.getElement();
        const text = (node ? node.textContent : "").replace(/\s+/g, " ").trim();
        const cls = node ? node.className : "";
        const kind = /danger-title/.test(cls) ? (/caution/.test(cls) ? "caution" : "danger") : /base-marker/.test(cls) ? "base" : /volc-icon/.test(cls) ? "volcano" : "label";
        cx.beginPath();
        cx.arc(X(p.lng), Y(p.lat), 5, 0, Math.PI * 2);
        cx.fillStyle = kind === "base" ? "#2a7fff" : kind === "danger" ? "#e5483b" : kind === "volcano" ? "#ff5a36" : "#ffffff";
        cx.fill();
        if (text && labels.length < 400) labels.push({ lat: p.lat, lon: p.lng, text: kind === "volcano" ? "▲ " + (layer.getPopup()?.getContent()?.replace(/<[^>]+>/g, " ").trim().split("  ")[0] || "") : text, kind });
      }
    };
    map.eachLayer(visit);
    return { canvas: cv, labels };
  }

  function makeLabel(THREE, l) {
    const txt = l.text.length > 46 ? l.text.slice(0, 44) + "…" : l.text;
    const c = document.createElement("canvas");
    const fs = 36;
    const g = c.getContext("2d");
    g.font = `600 ${fs}px sans-serif`;
    const w = Math.ceil(g.measureText(txt).width) + 24;
    c.width = w;
    c.height = fs + 18;
    const bg = { danger: "rgba(179,38,30,0.92)", caution: "rgba(176,122,16,0.92)", base: "rgba(42,127,255,0.92)" }[l.kind];
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, c.height);
    }
    g.font = `600 ${fs}px sans-serif`;
    g.fillStyle = "#fff";
    g.strokeStyle = "rgba(0,0,0,0.85)";
    g.lineWidth = 6;
    g.strokeText(txt, 12, fs);
    g.fillText(txt, 12, fs);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
    const h = 0.035;
    sp.scale.set((h * w) / c.height, h, 1);
    sp.center.set(0, 0);
    sp.position.copy(lonLatToVec(THREE, l.lat, l.lon).multiplyScalar(1.012));
    return sp;
  }

  // Sun direction from Mars24: subsolar latitude = declination, subsolar longitude where local true solar time = 12 h.
  function sunDir(THREE) {
    const mt = marsTime(getTime());
    const lonSub = ((((12 - mt.mtc - mt.eotDeg / 15) * 15 + 180) % 360) + 360) % 360 - 180;
    return { v: lonLatToVec(THREE, mt.decl, lonSub), lat: mt.decl, lon: lonSub, mt };
  }

  async function baseTexture(z = 3) {
    if (ctx.base) return ctx.base;
    const n = 2 ** z, W = 256 * 2 * n, H = 256 * n;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const cx = cv.getContext("2d");
    cx.fillStyle = "#6b4a33";
    cx.fillRect(0, 0, W, H);
    const url = trekTileUrl("Mars_Viking_MDIM21_ClrMosaic_global_232m", "jpg");
    const jobs = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < 2 * n; x++) jobs.push([x, y]);
    let done = 0;
    const worker = async () => {
      while (jobs.length) {
        const [x, y] = jobs.shift();
        await new Promise((res) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => (cx.drawImage(img, x * 256, y * 256), res());
          img.onerror = () => res();
          img.src = url.replace("{z}", z).replace("{y}", y).replace("{x}", x);
        });
        done++;
        busyBar.set("globe", tr("Loading the global Viking mosaic …", "Lade globales Viking-Mosaik …"), (100 * done) / (2 * n * n));
      }
    };
    await Promise.all(Array.from({ length: 12 }, worker));
    busyBar.done("globe");
    ctx.base = cv;
    return cv;
  }

  async function open() {
    const { THREE, OrbitControls } = await threeReady;
    if (!dlg.open) dlg.showModal();
    const base = await baseTexture();
    if (!ctx.renderer) {
      ctx.renderer = new THREE.WebGLRenderer({ antialias: true });
      ctx.renderer.setPixelRatio(window.devicePixelRatio || 1);
      host.appendChild(ctx.renderer.domElement);
      ctx.scene = new THREE.Scene();
      ctx.scene.background = new THREE.Color(0x05060a);
      ctx.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
      ctx.camera.position.set(0, 0.6, 3.6);
      ctx.controls = new OrbitControls(ctx.camera, ctx.renderer.domElement);
      ctx.controls.enableDamping = true;
      ctx.controls.minDistance = 1.3;
      ctx.controls.maxDistance = 8;
      ctx.ambient = new THREE.AmbientLight(0xffffff, 0.22);
      ctx.scene.add(ctx.ambient);
      ctx.sunLight = new THREE.DirectionalLight(0xfff4e6, 2.6);
      ctx.scene.add(ctx.sunLight);
      // The Sun in the background: a glowing sprite far away in the sun direction.
      const sc = document.createElement("canvas");
      sc.width = sc.height = 256;
      const sg2 = sc.getContext("2d");
      const grad = sg2.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, "rgba(255,255,245,1)");
      grad.addColorStop(0.12, "rgba(255,240,200,1)");
      grad.addColorStop(0.3, "rgba(255,200,120,0.45)");
      grad.addColorStop(1, "rgba(255,160,60,0)");
      sg2.fillStyle = grad;
      sg2.fillRect(0, 0, 256, 256);
      const st = new THREE.CanvasTexture(sc);
      ctx.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      ctx.sun.scale.set(9, 9, 1);
      ctx.scene.add(ctx.sun);
      // Stars
      const sg = new THREE.BufferGeometry(), sp = [];
      for (let i = 0; i < 1500; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 20);
        sp.push(v.x, v.y, v.z);
      }
      sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
      ctx.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 })));
      const tex = new THREE.CanvasTexture(base);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      ctx.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 }));
      ctx.scene.add(ctx.mesh);
      ctx.renderer.domElement.addEventListener("click", onClick);
      ctx.renderer.domElement.addEventListener("pointermove", onMove);
    }
    // Overlay of the active thematic/environment layer (equirectangular canvas, −180…180).
    if (ctx.overlay) {
      ctx.scene.remove(ctx.overlay);
      ctx.overlay = null;
    }
    const ov = getOverlayCanvas ? getOverlayCanvas() : null;
    const showOv = document.getElementById("globe-overlay").checked;
    if (ov && showOv) {
      const t2 = new THREE.CanvasTexture(ov);
      t2.colorSpace = THREE.SRGBColorSpace;
      ctx.overlay = new THREE.Mesh(new THREE.SphereGeometry(1.003, 128, 64), new THREE.MeshBasicMaterial({ map: t2, transparent: true, opacity: 0.75, depthWrite: false }));
      ctx.scene.add(ctx.overlay);
    }
    document.getElementById("globe-overlay-row").hidden = !ov;
    // Map features and labels
    if (ctx.features) ctx.scene.remove(ctx.features);
    if (ctx.labels) ctx.scene.remove(ctx.labels);
    ctx.features = ctx.labels = null;
    if (document.getElementById("globe-features").checked) {
      const f = collectFeatures();
      const t3 = new THREE.CanvasTexture(f.canvas);
      t3.colorSpace = THREE.SRGBColorSpace;
      t3.anisotropy = 8;
      ctx.features = new THREE.Mesh(new THREE.SphereGeometry(1.006, 128, 64), new THREE.MeshBasicMaterial({ map: t3, transparent: true, depthWrite: false }));
      ctx.scene.add(ctx.features);
      ctx.labels = new THREE.Group();
      for (const l of f.labels) ctx.labels.add(makeLabel(THREE, l));
      ctx.scene.add(ctx.labels);
    }
    applyLighting(THREE);
    // Face the current map centre.
    const c = map.getCenter();
    const p = lonLatToVec(THREE, c.lat, c.lng).multiplyScalar(3.6);
    ctx.camera.position.copy(p);
    ctx.controls.update();
    resize();
    if (!ctx.raf) loop();
  }

  function applyLighting(THREE) {
    const mode = document.getElementById("globe-light").value;
    const s = sunDir(THREE);
    ctx.sunLight.position.copy(s.v.clone().multiplyScalar(10));
    ctx.sun.position.copy(s.v.clone().multiplyScalar(45));
    ctx.sun.visible = true;
    if (mode === "full") {
      ctx.ambient.intensity = 2.2;
      ctx.sunLight.intensity = 0.4;
    } else {
      ctx.ambient.intensity = 0.22;
      ctx.sunLight.intensity = 2.6;
    }
    document.getElementById("globe-sun").textContent = `${tr("Sun over", "Sonne über")} ${formatLat(s.lat, 1)}, ${formatLonEast(s.lon, 1)} · Ls ${s.mt.ls.toFixed(0)}° · ${new Date(getTime()).toISOString().slice(0, 16).replace("T", " ")} UTC`;
  }

  // Three.js sphere UV: u = 0 at lon −180 (texture left edge) → x = −cos(u·2π), z = sin(u·2π).
  function lonLatToVec(THREE, lat, lon) {
    const u = (lon + 180) / 360, v = (lat * Math.PI) / 180;
    const phi = u * Math.PI * 2;
    return new THREE.Vector3(-Math.cos(phi) * Math.cos(v), Math.sin(v), Math.sin(phi) * Math.cos(v));
  }

  function pick(e) {
    const { THREE } = window.THREE_MODS;
    const r = ctx.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, ctx.camera);
    const hit = ray.intersectObject(ctx.mesh)[0];
    if (!hit) return null;
    const uv = hit.uv;
    return { lat: uv.y * 180 - 90, lon: uv.x * 360 - 180 };
  }
  let downAt = null;
  function onMove(e) {
    const p = pick(e);
    document.getElementById("globe-read").textContent = p ? `${formatLat(p.lat, 2)}, ${formatLonEast(p.lon, 2)} – ${tr("click to fly there", "klicken, um dorthin zu fliegen")}` : "";
  }
  function onClick(e) {
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return; // was a drag
    const p = pick(e);
    if (!p) return;
    dlg.close();
    map.setView([p.lat, p.lon], Math.max(4, map.getZoom()));
  }
  host.addEventListener("pointerdown", (e) => (downAt = [e.clientX, e.clientY]));

  function resize() {
    const w = host.clientWidth || 800, h = host.clientHeight || 600;
    ctx.renderer.setSize(w, h, false);
    ctx.renderer.domElement.style.width = "100%";
    ctx.renderer.domElement.style.height = "100%";
    ctx.camera.aspect = w / h;
    ctx.camera.updateProjectionMatrix();
  }
  function loop() {
    if (!dlg.open) {
      ctx.raf = null;
      return;
    }
    ctx.controls.update();
    ctx.renderer.render(ctx.scene, ctx.camera);
    ctx.raf = requestAnimationFrame(loop);
  }
  window.addEventListener("resize", () => dlg.open && ctx.renderer && resize());
  document.getElementById("globe-close").addEventListener("click", () => dlg.close());
  document.getElementById("globe-overlay").addEventListener("change", () => open());
  document.getElementById("globe-features").addEventListener("change", () => open());
  document.getElementById("globe-light").addEventListener("change", () => threeReady.then(({ THREE }) => applyLighting(THREE)));

  // Map control + zooming out past the smallest map zoom opens the globe.
  const Btn = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const b = L.DomUtil.create("button", "leaflet-bar cut-btn globe-btn");
      b.type = "button";
      b.textContent = tr("🌐 Globe", "🌐 Globus");
      b.title = tr("View Mars as a globe", "Mars als Kugel ansehen");
      L.DomEvent.disableClickPropagation(b);
      L.DomEvent.on(b, "click", open);
      return b;
    },
  });
  new Btn().addTo(map);
  let outTries = 0;
  map.getContainer().addEventListener(
    "wheel",
    (e) => {
      if (e.deltaY > 0 && map.getZoom() <= map.getMinZoom()) {
        if (++outTries >= 2) {
          outTries = 0;
          open();
        }
      } else outTries = 0;
    },
    { passive: true }
  );
  return { open };
}
