// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// 3D cut-out: drag a rectangle on the map (or type exact corners) and view that area in 3D.
// The finest elevation model covering the area is used; larger areas are read coarser (detail level chosen in the panel).

function initCut3D(map, terrain3d, hooks = {}) {
  const el = (id) => document.getElementById(id);
  const panel = el("cut-panel");
  let drawing = false, start = null, rect = null, quietUntil = 0;

  // Map button below the zoom control.
  const Btn = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const b = L.DomUtil.create("button", "leaflet-bar cut-btn");
      b.type = "button";
      b.textContent = "⬚ 3D";
      b.title = t("Cut out an area and view it in 3D: drag a rectangle on the map");
      L.DomEvent.disableClickPropagation(b);
      L.DomEvent.on(b, "click", () => setDrawing(!drawing));
      this.btn = b;
      return b;
    },
  });
  const ctl = new Btn().addTo(map);

  function setDrawing(on) {
    drawing = on;
    ctl.btn.classList.toggle("active", on);
    map.getContainer().classList.toggle("drawing", on);
    if (on) {
      map.dragging.disable();
      if (hooks.onStart) hooks.onStart();
      el("cut-hint").textContent = t("Drag a rectangle on the map.");
      panel.hidden = false;
    } else map.dragging.enable();
  }

  const clampLat = (v) => Math.max(-90, Math.min(90, v));
  const clampLon = (v) => Math.max(-180, Math.min(180, v));

  function setBox(s, w, n, e) {
    [s, n] = [Math.min(s, n), Math.max(s, n)].map(clampLat);
    [w, e] = [Math.min(w, e), Math.max(w, e)].map(clampLon);
    el("cut-n").value = n.toFixed(4);
    el("cut-s").value = s.toFixed(4);
    el("cut-w").value = w.toFixed(4);
    el("cut-e").value = e.toFixed(4);
    const b = [[s, w], [n, e]];
    if (rect) rect.setBounds(b);
    else rect = L.rectangle(b, { color: "#d9813f", weight: 2, dashArray: "6 4", fillOpacity: 0.08, interactive: false }).addTo(map);
    info();
  }

  function readBox() {
    const v = ["w", "s", "e", "n"].map((k) => parseFloat(el(`cut-${k}`).value));
    if (v.some((x) => !Number.isFinite(x)) || v[2] <= v[0] || v[3] <= v[1]) return null;
    return v;
  }

  let infoToken = 0;
  async function info() {
    const box = readBox();
    if (!box) return (el("cut-info").textContent = t("Enter valid corners (west < east, south < north)."));
    const [w, s, e, n] = box;
    const kmX = greatCircleKm((s + n) / 2, w, (s + n) / 2, e), kmY = greatCircleKm(s, w, n, w);
    const size = `${kmX < 1 ? (kmX * 1000).toFixed(0) + " m" : kmX.toFixed(kmX < 10 ? 2 : 1) + " km"} × ${kmY < 1 ? (kmY * 1000).toFixed(0) + " m" : kmY.toFixed(kmY < 10 ? 2 : 1) + " km"}`;
    el("cut-info").textContent = `${size} · ${t("checking elevation data …")}`;
    const tok = ++infoToken;
    const maxPx = parseInt(el("cut-res").value, 10);
    const mi = await demMosaicInfo(box, maxPx);
    if (tok !== infoToken) return;
    const fmtP = (v) => (v < 10 ? v.toFixed(1) : Math.round(v));
    const mix = Object.entries(mi.shares).filter(([, v]) => v > 0.005).map(([k, v]) => `${DEM_LABEL[k]} ${Math.round(v * 100)} %`).join(" · ");
    el("cut-info").textContent = Number.isFinite(mi.finest)
      ? `${size} · ${t("elevation ≈ {p} m per point", { p: fmtP(mi.res) })}` +
        (mi.res > mi.finest * 1.01 ? ` (${t("finest available: {g} m", { g: fmtP(mi.finest) })})` : ` (${t("full resolution")})`) +
        ` · ${mix} · ${t("plus CTX/HiRISE photo")}`
      : `${size} · ${t("no elevation data")}`;
  }

  map.on("mousedown", (e) => {
    if (!drawing) return;
    start = e.latlng;
    setBox(start.lat, start.lng, start.lat, start.lng);
  });
  map.on("mousemove", (e) => {
    if (!drawing || !start) return;
    setBox(start.lat, start.lng, e.latlng.lat, e.latlng.lng);
  });
  map.on("mouseup", (e) => {
    if (!drawing || !start) return;
    setBox(start.lat, start.lng, e.latlng.lat, e.latlng.lng);
    start = null;
    quietUntil = Date.now() + 400; // the click that follows mouseup must not select a point
    setDrawing(false);
    el("cut-hint").textContent = t("Fine-tune the corners if needed, then open the 3D view.");
  });

  ["n", "s", "w", "e"].forEach((k) =>
    el(`cut-${k}`).addEventListener("change", () => {
      const b = readBox();
      if (b) setBox(b[1], b[0], b[3], b[2]);
      else info();
    })
  );
  el("cut-res").addEventListener("change", info);
  el("cut-open").addEventListener("click", () => {
    const box = readBox();
    if (!box) return;
    terrain3d.open({
      box,
      maxPx: parseInt(el("cut-res").value, 10),
      route: hooks.route ? hooks.route() : null,
      title: t("3D cut-out {lat}, {lon}", { lat: formatLat((box[1] + box[3]) / 2), lon: formatLonEast((box[0] + box[2]) / 2) }),
    });
  });
  el("cut-redraw").addEventListener("click", () => setDrawing(true));
  el("cut-close").addEventListener("click", () => {
    setDrawing(false);
    panel.hidden = true;
    if (rect) map.removeLayer(rect);
    rect = null;
  });

  return { isDrawing: () => drawing || !!start || Date.now() < quietUntil };
}
