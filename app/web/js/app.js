// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// MARS Pathfinder – map client.
// M1: global map, coordinates. M2: exploration sites, local imagery, thermal overlay, landmarks.

const WORLD_BOUNDS = L.latLngBounds([-90, -180], [90, 180]);
const MAP_MAX_ZOOM = 18;

const map = L.map("map", {
  crs: L.CRS.EPSG4326, // equirectangular; matches Trek EQ tile matrix (2x1 tiles at z0)
  minZoom: 1,
  maxZoom: MAP_MAX_ZOOM,
  maxBounds: WORLD_BOUNDS.pad(0.05),
  maxBoundsViscosity: 1.0,
  attributionControl: false,
});
map.fitBounds(WORLD_BOUNDS);

map.createPane("sitePane").style.zIndex = 250; // above base map
map.createPane("overlayPane2").style.zIndex = 300; // science overlays above local imagery

let planner = null;
let autoRoute = null;
let zones = null;
let cut3d = null;
let bases = null; // also window.zones (route.js stops zone drawing)
const STATE_KEY = "mars-pathfinder-state";
let restoring = false;

// ---------- Tabs ----------

function showTab(name) {
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-pane").forEach((p) => p.classList.toggle("active", p.dataset.pane === name));
}
document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
// Links like "⚙ Settings" inside other tabs jump to that tab.
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-goto-tab]");
  if (!a) return;
  e.preventDefault();
  showTab(a.dataset.gotoTab);
});
// Clear in the A→B box removes A/B and the route it produced; Clear in the draw box only the drawn route.
document.getElementById("ab-clear").addEventListener("click", () => document.getElementById("route-clear").click());

// ---------- Saved state (site + route survive reloads and language switches) ----------

function loadSavedState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState(patch) {
  if (restoring) return;
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...loadSavedState(), ...patch }));
  } catch {
    // storage unavailable: nothing to persist
  }
}
let groundView = null;
let geology = null;
let environment = null;

const state = {
  basemap: null,
  site: null,
  tileErrors: 0,
  selection: null,
  infoLayerId: null,
};

const layerDefs = new Map();
const tileLayers = new Map();

// ---------- Tile layers ----------

function createTileLayer(def, pane) {
  const layer = L.tileLayer(def.tileUrl, {
    tileSize: 256,
    noWrap: true,
    maxNativeZoom: def.maxNativeZoom,
    maxZoom: MAP_MAX_ZOOM,
    bounds: def.bounds ? L.latLngBounds(def.bounds) : WORLD_BOUNDS,
    opacity: def.defaultOpacity ?? 1,
    pane,
  });
  layer.on("tileerror", () => {
    state.tileErrors += 1;
    updateTileStatus();
  });
  return layer;
}

function registerLayer(def, pane) {
  layerDefs.set(def.id, def);
  tileLayers.set(def.id, createTileLayer(def, pane));
}

BASEMAPS.forEach((d) => registerLayer(d, "tilePane"));
OVERLAYS.forEach((d) => registerLayer(d, "overlayPane2"));
SITES.forEach((s) => s.layers.forEach((d) => registerLayer(d, "sitePane")));

function setLayerVisible(id, visible) {
  const layer = tileLayers.get(id);
  if (visible && !map.hasLayer(layer)) layer.addTo(map);
  if (!visible && map.hasLayer(layer)) map.removeLayer(layer);
}

function setBasemap(id) {
  if (state.basemap) setLayerVisible(state.basemap, false);
  setLayerVisible(id, true);
  state.basemap = id;
  resetTileStatus();
  renderLayerLists();
  showSourceInfo(id);
}

// ---------- Layer panel ----------

function layerRow(def, { type, checked, group }) {
  const li = document.createElement("li");
  li.dataset.layer = def.id;
  if (checked) li.classList.add("active");
  const opacity = Math.round((tileLayers.get(def.id).options.opacity ?? 1) * 100);
  li.innerHTML = `
    <div class="layer-row">
      <label>
        <input type="${type}" ${group ? `name="${group}"` : ""} ${checked ? "checked" : ""}>
        <span>${t(def.name)}<span class="layer-sub">${t(def.dataType)} · ${t(def.resolution)}</span></span>
      </label>
      <button type="button" class="info-btn" title="Show data source">i</button>
    </div>
    ${type === "checkbox" ? `<input type="range" class="opacity" min="0" max="100" value="${opacity}" title="Deckkraft" ${checked ? "" : "hidden"}>` : ""}`;
  li.querySelector(".info-btn").addEventListener("click", () => {
    showSourceInfo(def.id);
    showTab("data");
  });
  return li;
}

function renderLayerLists() {
  const basemapList = document.getElementById("basemap-list");
  basemapList.innerHTML = "";
  for (const def of BASEMAPS) {
    const li = layerRow(def, { type: "radio", checked: def.id === state.basemap, group: "basemap" });
    li.querySelector("input").addEventListener("change", () => setBasemap(def.id));
    basemapList.appendChild(li);
  }

  renderToggleList(document.getElementById("overlay-list"), OVERLAYS);

  const section = document.getElementById("site-section");
  const site = SITES.find((s) => s.id === state.site);
  section.hidden = !site;
  if (site) renderToggleList(document.getElementById("site-layer-list"), site.layers);
}

function renderToggleList(container, defs) {
  container.innerHTML = "";
  for (const def of defs) {
    const layer = tileLayers.get(def.id);
    const li = layerRow(def, { type: "checkbox", checked: map.hasLayer(layer) });
    const slider = li.querySelector(".opacity");
    li.querySelector("input[type=checkbox]").addEventListener("change", (e) => {
      setLayerVisible(def.id, e.target.checked);
      li.classList.toggle("active", e.target.checked);
      slider.hidden = !e.target.checked;
      if (e.target.checked) showSourceInfo(def.id);
    });
    slider.addEventListener("input", () => layer.setOpacity(slider.value / 100));
    container.appendChild(li);
  }
}

function showSourceInfo(id) {
  const def = layerDefs.get(id);
  if (!def) return;
  state.infoLayerId = id;
  const links = [["WMTS Capabilities", def.capabilitiesUrl], ...def.links]
    .map(([label, url]) => `<a href="${url}" target="_blank" rel="noopener">${label}</a>`)
    .join("<br>");
  document.getElementById("source-info").innerHTML = `
    <div class="source-title">${def.name}</div>
    <span class="badge badge-${def.dataClass}">${DATA_CLASS_LABELS[def.dataClass]}</span>
    ${typeof mediaFigure === "function" ? mediaFigure(mediaKeyForMission(def.mission)) : ""}
    <dl>
      <dt>Mission</dt><dd>${def.mission}</dd>
      <dt>Instrument</dt><dd>${def.instrument}</dd>
      <dt>Data type</dt><dd>${def.dataType}</dd>
      <dt>Resolution</dt><dd>${def.resolution}</dd>
      <dt>Coverage</dt><dd>${def.coverage}</dd>
      <dt>Layer-ID</dt><dd><code>${def.layerId}</code></dd>
      <dt>Sources</dt><dd>${links}</dd>
    </dl>
    <div class="source-note">${def.classNote}</div>`;
}

function resetTileStatus() {
  state.tileErrors = 0;
  updateTileStatus();
}

function updateTileStatus() {
  document.getElementById("status-tiles").textContent =
    state.tileErrors > 0 ? t("{n} tile(s) failed to load", { n: state.tileErrors }) : "";
}

// ---------- Sites ----------

const siteOutlines = L.layerGroup().addTo(map);
const landmarkLayer = L.layerGroup().addTo(map);

function renderSiteSwitch() {
  const el = document.getElementById("site-switch");
  el.innerHTML = "";
  const entries = [{ id: null, name: "Global" }, ...SITES];
  for (const s of entries) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = s.name;
    btn.className = s.id === state.site ? "active" : "";
    btn.addEventListener("click", () => setSite(s.id));
    el.appendChild(btn);
  }
}

function setSite(id) {
  if (planner) planner.stopDrawing();
  if (autoRoute) autoRoute.clear();
  const previous = SITES.find((s) => s.id === state.site);
  if (previous) previous.layers.forEach((d) => setLayerVisible(d.id, false));

  state.site = id;
  saveState({ site: id });
  const site = SITES.find((s) => s.id === id);
  if (site) {
    site.layers.forEach((d) => setLayerVisible(d.id, true));
    map.flyToBounds(site.view, { duration: 1.2 });
    showSourceInfo(site.layers[site.layers.length - 1].id);
  } else {
    map.flyToBounds(WORLD_BOUNDS, { duration: 1.2 });
    showSourceInfo(state.basemap);
  }
  document.getElementById("route-example").hidden = !site?.exampleRoute;
  resetTileStatus();
  if (groundView) groundView.showTraverse(id);
  if (geology) geology.setSite(id);
  if (environment) environment.setSite(id);
  renderSiteSwitch();
  renderLayerLists();
  updateSelectionDistance();
}

function drawSiteOutlines() {
  siteOutlines.clearLayers();
  for (const site of SITES) {
    const rect = L.rectangle(site.region, {
      color: "#d9813f",
      weight: 1,
      dashArray: "4 3",
      fill: false,
    });
    rect.bindTooltip(site.name, { direction: "top", className: "map-tooltip" });
    rect.on("click", (e) => {
      if (state.site !== site.id) {
        L.DomEvent.stop(e);
        setSite(site.id);
      }
    });
    siteOutlines.addLayer(rect);
  }
}

function drawLandmarks() {
  landmarkLayer.clearLayers();
  if (!document.getElementById("toggle-landmarks").checked) return;
  const icon = L.divIcon({ className: "landmark-marker", iconSize: [12, 12], iconAnchor: [6, 6] });
  for (const site of SITES) {
    for (const lm of site.landmarks) {
      L.marker([lm.lat, lm.lon], { icon, keyboard: false })
        .bindTooltip(
          `<b>${lm.name}</b><br>${t(lm.detail)}<br>${formatLat(lm.lat)} ${formatLonEast(lm.lon)}<br><span class="tt-src">${t("Source")}: ${lm.source}</span>`,
          { direction: "right", offset: [8, 0], className: "map-tooltip" }
        )
        .addTo(landmarkLayer);
    }
  }
}

document.getElementById("toggle-landmarks").addEventListener("change", drawLandmarks);

const dtmLayer = L.layerGroup().addTo(map);

function drawDtmCoverage() {
  dtmLayer.clearLayers();
  if (!document.getElementById("toggle-dtm").checked) return;
  for (const dem of DEM_LIST) {
    if (dem.kind === "mola") continue; // global
    const style = { color: dem.kind === "ctx" ? "#a07cc9" : "#5fb3c9", weight: 1, opacity: 0.7, fill: false, interactive: false, dashArray: dem.kind === "ctx" ? "4 3" : null };
    const [w, s, e, n] = dem.bbox;
    (dem.ring ? L.polygon(dem.ring.map(([lo, la]) => [la, lo]), style) : L.rectangle([[s, w], [n, e]], style)).addTo(dtmLayer);
  }
}
demListeners.push(() => drawDtmCoverage());

document.getElementById("toggle-dtm").addEventListener("change", drawDtmCoverage);

// ---------- Graticule ----------

const graticule = L.layerGroup().addTo(map);
window.mapGraticule = graticule; // the globe draws its own full grid instead of this view-limited one
const GRID_STEPS = [30, 15, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001];

// Smallest step that keeps at most MAX_GRID_LINES lines in each direction.
const MAX_GRID_LINES = 12;
function graticuleStep(lonSpan, latSpan) {
  const span = Math.max(lonSpan, latSpan, 1e-6);
  for (let i = GRID_STEPS.length - 1; i >= 0; i--) {
    if (span / GRID_STEPS[i] <= MAX_GRID_LINES) return GRID_STEPS[i];
  }
  return GRID_STEPS[0];
}

function decimalsFor(step) {
  return Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
}

function drawGraticule() {
  graticule.clearLayers();
  if (!document.getElementById("toggle-graticule").checked) return;

  const size = map.getSize();
  if (size.x < 50 || size.y < 50) return; // hidden or collapsed map: nothing sensible to draw
  const b = map.getBounds();
  const south = Math.max(-90, b.getSouth());
  const north = Math.min(90, b.getNorth());
  const west = Math.max(-180, b.getWest());
  const east = Math.min(180, b.getEast());
  if (!(north > south && east > west)) return;
  const step = graticuleStep(east - west, north - south);
  const digits = decimalsFor(step);
  const style = { color: "#ffffff", weight: 0.6, opacity: 0.35, interactive: false };

  const start = (v) => Math.ceil(v / step - 1e-9) * step;
  for (let lat = start(south); lat <= north + 1e-9; lat += step) {
    graticule.addLayer(L.polyline([[lat, west], [lat, east]], style));
    const hemi = lat > 1e-9 ? "N" : lat < -1e-9 ? "S" : "";
    graticule.addLayer(gridLabel([lat, west], `${Math.abs(lat).toFixed(digits)}°${hemi}`, "left"));
  }
  for (let lon = start(west); lon <= east + 1e-9; lon += step) {
    graticule.addLayer(L.polyline([[south, lon], [north, lon]], style));
    graticule.addLayer(gridLabel([north, lon], `${lonTo360(lon).toFixed(digits)}°E`, "top"));
  }
}

function gridLabel(latlng, text, edge) {
  const anchor = edge === "left" ? [-4, 12] : [-3, -4];
  return L.marker(latlng, {
    interactive: false,
    keyboard: false,
    icon: L.divIcon({ className: "graticule-label", html: text, iconSize: null, iconAnchor: anchor }),
  });
}

document.getElementById("toggle-graticule").addEventListener("change", drawGraticule);
map.on("moveend zoomend", drawGraticule);

// ---------- Scale bar (Mars radius, not Earth) ----------

const MarsScale = L.Control.extend({
  options: { position: "bottomleft", maxWidth: 140 },
  onAdd() {
    this._el = L.DomUtil.create("div", "mars-scale");
    this._label = L.DomUtil.create("div", "", this._el);
    this._bar = L.DomUtil.create("div", "mars-scale-bar", this._el);
    map.on("moveend zoomend", this._update, this);
    this._update();
    return this._el;
  },
  _update() {
    const lat = map.getCenter().lat;
    const kmPx = kmPerPixel(map.getZoom(), lat);
    const niceKm = niceNumber(kmPx * this.options.maxWidth);
    this._bar.style.width = `${Math.round(niceKm / kmPx)}px`;
    this._label.textContent = formatDistance(niceKm);
    this._label.title = t("East–west scale at {lat}° latitude", { lat: lat.toFixed(2) });
  },
});

function niceNumber(value) {
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * exp;
}

function formatDistance(km) {
  if (km >= 1) return `${+km.toFixed(km < 10 ? 2 : 1)} km`;
  return `${+(km * 1000).toFixed(km < 0.01 ? 1 : 0)} m`;
}

map.addControl(new MarsScale());

// ---------- Status bar ----------

function updateZoomStatus() {
  const z = map.getZoom();
  document.getElementById("status-zoom").textContent = z;
  document.getElementById("status-res").textContent = `${formatDistance(kmPerPixel(z, map.getCenter().lat))}/px`;
}

map.on("zoomend moveend", updateZoomStatus);

function inWorld(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

map.on("mousemove", (e) => {
  const { lat, lng } = e.latlng;
  document.getElementById("status-cursor").textContent = inWorld(lat, lng)
    ? `${formatLat(lat, 4)}  ${formatLonEast(lng, 4)}`
    : "outside";
});
map.on("mouseout", () => {
  document.getElementById("status-cursor").textContent = "–";
});

// ---------- Point selection ----------

const pinIcon = L.divIcon({ className: "pin-marker", iconSize: [14, 14], iconAnchor: [7, 7] });

function selectPoint(lat, lon) {
  lon = normalizeLon180(lon);
  if (state.selection) {
    state.selection.marker.setLatLng([lat, lon]);
  } else {
    state.selection = { marker: L.marker([lat, lon], { icon: pinIcon, keyboard: false }).addTo(map) };
  }
  state.selection.lat = lat;
  state.selection.lon = lon;

  document.getElementById("sel-lat").textContent = formatLat(lat);
  document.getElementById("sel-lon360").textContent = formatLonEast(lon);
  document.getElementById("sel-lon180").textContent = formatLon180(lon);
  document.getElementById("sel-decimal").textContent = `${lat.toFixed(5)}, ${lonTo360(lon).toFixed(5)}`;
  updateSelectionDistance();
  toggleSelectionUi(true);
  queryPointElevation(lat, lon);
  if (groundView) groundView.showFor(siteAt(lat, lon), lat, lon);
  queryGeology(lat, lon);
}

async function queryGeology(lat, lon) {
  const cell = document.getElementById("sel-geo");
  const details = document.getElementById("sel-geo-details");
  details.hidden = true;
  if (!geology) return;
  cell.textContent = "loading …";
  try {
    const unit = await geology.unitAt(siteAt(lat, lon), lat, lon);
    if (!state.selection || state.selection.lat !== lat || state.selection.lon !== lon) return;
    if (!unit) {
      cell.textContent = "–";
      return;
    }
    cell.textContent = unit.symbol;
    document.getElementById("sel-geo-name").textContent = unit.name;
    document.getElementById("sel-geo-text").innerHTML = `
      ${unit.description ? `<p>${unit.description}</p>` : ""}
      ${unit.interpretation ? `<p><b>${t("Interpretation:")}</b> ${unit.interpretation}</p>` : ""}
      <p class="muted">${unit.map.title} · <a href="${unit.map.doi}" target="_blank" rel="noopener">Source</a></p>`;
    details.hidden = false;
  } catch (err) {
    console.error(err);
    cell.textContent = "not available";
  }
}

function siteAt(lat, lon) {
  const site = SITES.find((s) => L.latLngBounds(s.region).contains([lat, lon]));
  return site ? site.id : null;
}

async function queryPointElevation(lat, lon) {
  const elevEl = document.getElementById("sel-elev");
  const slopeEl = document.getElementById("sel-slope");
  elevEl.textContent = "loading …";
  slopeEl.textContent = "…";
  await ensureDemsFor([lon - 0.02, lat - 0.02, lon + 0.02, lat + 0.02]);
  if (!state.selection || state.selection.lat !== lat || state.selection.lon !== lon) return;
  const [r] = await sampleElevation([{ lat, lon }]);
  if (!state.selection || state.selection.lat !== lat || state.selection.lon !== lon) return;
  if (!r) {
    elevEl.textContent = "no data";
    slopeEl.textContent = "–";
    return;
  }
  elevEl.textContent = `${r.elev.toFixed(1)} m · ${DEM_LABEL[r.kind] || ""}`;
  elevEl.title = t("{dem}, cell {cell} m. Elevation relative to the Mars 2015 sphere (R = 3396.19 km).", { dem: r.demId, cell: r.cellSize.toFixed(2) });
  slopeEl.textContent = r.slope == null ? "–" : `${r.slope.toFixed(1)}°${r.kind === "mola" ? ` (${t("over {b} km, smoothed", { b: (r.slopeBase / 1000).toFixed(1) })})` : ""}`;
  slopeEl.title = t("Horn method over 3×3 cells (baseline ≈ {b} m), derived", { b: r.slopeBase.toFixed(1) });
}

function nearestLandmark(lat, lon) {
  let best = null;
  for (const site of SITES) {
    for (const lm of site.landmarks) {
      const d = greatCircleKm(lat, lon, lm.lat, lm.lon);
      if (!best || d < best.d) best = { lm, d };
    }
  }
  return best;
}

function updateSelectionDistance() {
  if (!state.selection) return;
  const near = nearestLandmark(state.selection.lat, state.selection.lon);
  document.getElementById("sel-dist").textContent = near ? formatDistance(near.d) : "–";
  document.getElementById("sel-dist-label").textContent = near ? t("Distance to {name}", { name: near.lm.name }) : t("Distance to landing site");
  document.getElementById("sel-dist").title = "Great-circle distance on the Mars sphere, R = 3396.19 km (derived)";
}

function clearSelection() {
  if (state.selection) map.removeLayer(state.selection.marker);
  state.selection = null;
  toggleSelectionUi(false);
}

function toggleSelectionUi(visible) {
  document.getElementById("selection-empty").hidden = visible;
  document.getElementById("selection-table").hidden = !visible;
  document.getElementById("selection-actions").hidden = !visible;
}

map.on("click", (e) => {
  if ((planner && planner.isDrawing()) || (autoRoute && autoRoute.isPicking()) || (zones && zones.isDrawing()) || (cut3d && cut3d.isDrawing()) || (bases && bases.isDrawing())) return;
  const { lat, lng } = e.latlng;
  if (inWorld(lat, lng)) {
    selectPoint(lat, lng);
    showTab("point");
  }
});

document.getElementById("clear-selection").addEventListener("click", clearSelection);

document.getElementById("copy-coords").addEventListener("click", async (e) => {
  if (!state.selection) return;
  const { lat, lon } = state.selection;
  const text = `${lat.toFixed(5)}, ${lonTo360(lon).toFixed(5)} (planetocentric, °E)`;
  try {
    await navigator.clipboard.writeText(text);
    e.target.textContent = "Copied";
  } catch {
    e.target.textContent = "Copy failed";
  }
  setTimeout(() => (e.target.textContent = "Copy coordinates"), 1200);
});

// ---------- Go to coordinate ----------

document.getElementById("goto-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("goto-input");
  const coords = parseCoordinates(input.value);
  input.classList.toggle("invalid", !coords);
  if (!coords) return;
  map.setView([coords.lat, coords.lon], Math.max(map.getZoom(), 12));
  selectPoint(coords.lat, coords.lon);
  showTab("point");
});

// ---------- Init ----------

setBasemap(BASEMAPS[0].id);
renderSiteSwitch();
drawSiteOutlines();
drawDtmCoverage();
const mobility = initMobilityPanel(() => planner && planner.refresh());
geology = initGeology(map);
environment = initEnvironment(() => (planner ? planner.travelHours() : null));
planner = initRoutePlanner(map, mobility, {
  onWaypointClick: (lat, lon) => {
    selectPoint(lat, lon);
    showTab("point");
  },
  onWaypointsChanged: (waypoints) => saveState({ waypoints }),
  onRouteActivity: () => showTab("route"),
  geologyAt: (lat, lon) => geology.unitAt(siteAt(lat, lon), lat, lon),
  onStats: () => {
    environment.refreshDose();
    if (window.routeTimeHook) window.routeTimeHook();
    else if (window.logisticsHook) window.logisticsHook();
  },
  environmentSummary: () => environment.summary(),
  open3D: (opts) => terrain3d && terrain3d.open(opts),
});
autoRoute = initAutoRoute(map, planner, mobility);
const terrain3d = initTerrain3D(mobility);
zones = initZones(map, {
  onStartDrawing: () => planner.stopDrawing(),
  onOpen: () => showTab("zones"),
  onChange: () => planner && planner.refresh(),
});
window.zones = zones;
window.zoneAvoidRings = () => zones.avoidRings();
window.zonesCrossed = (pts) => zones.crossed(pts);
initKb();
initNasaPoi(map);
cut3d = initCut3D(map, terrain3d, {
  onStart: () => {
    planner.stopDrawing();
    zones.stopDrawing();
  },
  route: () => (planner.routeLatLngs ? planner.routeLatLngs() : null),
});
const envApi = initEnvUI(map, planner, mobility);
bases = initBases(map, {
  onStartPlacing: () => {
    planner.stopDrawing();
    zones.stopDrawing();
  },
  onOpen: () => showTab("bases"),
  onChange: () => window.logisticsHook && window.logisticsHook(),
  routeBetween: (a, b, safest) => {
    showTab("route");
    if (safest) autoRoute.planBetween(a, b);
    else planner.loadWaypoints([[a.lat, a.lon], [b.lat, b.lon]]);
  },
});
initLogistics(map, planner, bases, mobility, envApi);
initLegend(map);
const thematic = initThematic(map, { setEnvLayer: (v) => envApi.setLayer(v) });
initGlobe(map, () => thematic.currentCanvas(), () => envApi.time());

// No planning before the traveller is chosen in Settings.
const PLAN_BUTTONS = ["route-draw", "route-improve", "ab-set-a", "ab-set-b", "ab-set-via", "ab-plan", "base-route-safe", "base-route-direct"];
document.addEventListener(
  "click",
  (e) => {
    const b = e.target.closest("button");
    if (!b || !PLAN_BUTTONS.includes(b.id)) return;
    if (mobility.thresholds()) {
      document.getElementById("gate-warn")?.remove();
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    const msg = document.getElementById("route-msg");
    msg.innerHTML = `<div id="gate-warn" class="warn warn-crit"><b>⚠ ${t("Choose who travels first")}</b><br>${t("Select astronaut or vehicle in Settings and click “Yes, apply” – the slope limits and the crew check depend on it.")}<br><button type="button" data-goto-tab="settings">⚙ ${t("Open Settings")}</button></div>`;
    showTab("route");
    msg.scrollIntoView({ block: "center", behavior: "smooth" });
  },
  true
);

// The four route cards (length, ascent, time, max. slope) float at the top right of the map.
const routeStats = document.getElementById("route-stats");
const routeCards = document.getElementById("route-cards");
new MutationObserver(() => (routeCards.hidden = routeStats.hidden)).observe(routeStats, { attributes: true, attributeFilter: ["hidden"] });
routeCards.hidden = routeStats.hidden;

// "Start time and route walk" sits to the right of the elevation profile whenever a route exists
// (fixed in place, not draggable).
const routeDock = document.getElementById("route-dock");
const profilePanel = document.getElementById("profile-panel");
function syncDock() {
  const show = !profilePanel.hidden;
  if (show && routeDock.hidden) {
    delete routeDock.dataset.moved;
    routeDock.style.left = routeDock.style.top = routeDock.style.right = routeDock.style.bottom = "";
  }
  routeDock.hidden = !show;
  document.body.classList.toggle("dock-open", show && !routeDock.dataset.moved);
  window.dispatchEvent(new Event("resize"));
}
new MutationObserver(syncDock).observe(profilePanel, { attributes: true, attributeFilter: ["hidden"] });
syncDock();
document.getElementById("route-improve").addEventListener("click", () => {
  const w = planner.waypoints();
  if (w.length < 2) return;
  // Keep the drawn shape: inner waypoints become via points (very close ones are merged).
  const vias = [];
  for (const p of w.slice(1, -1)) {
    const prev = vias.length ? vias[vias.length - 1] : w[0];
    if (greatCircleKm(prev.lat, prev.lon, p.lat, p.lon) > 0.03) vias.push(p);
  }
  // At most 12 via points (evenly spread) so long drawn lines stay fast to plan; the shape is kept.
  const MAX_VIAS = 12;
  const picked = vias.length > MAX_VIAS ? Array.from({ length: MAX_VIAS }, (_, i) => vias[Math.round(((i + 1) * (vias.length + 1)) / (MAX_VIAS + 1)) - 1]) : vias;
  autoRoute.planBetween(w[0], w[w.length - 1], picked);
});

groundView = initGroundView(map, (lat, lon) => {
  selectPoint(lat, lon);
  showTab("point");
});

document.getElementById("route-example").addEventListener("click", () => {
  const site = SITES.find((s) => s.id === state.site);
  if (!site?.exampleRoute) return;
  if (!mobility.thresholds()) {
    document.getElementById("mob-open").click(); // confirm the mobility profile first
    return;
  }
  planner.loadWaypoints(site.exampleRoute);
  showTab("route");
});

// Language switch: the choice is stored and the page reloads with the saved site and route.
document.querySelectorAll("#lang-switch button").forEach((b) => {
  b.classList.toggle("active", b.dataset.lang === LANG);
  b.addEventListener("click", () => setLang(b.dataset.lang));
});

// Restore the last site and route.
(function restoreState() {
  const saved = loadSavedState();
  if (!saved.site || !SITES.some((s) => s.id === saved.site)) return;
  restoring = true;
  setSite(saved.site);
  restoring = false;
  if (Array.isArray(saved.waypoints) && saved.waypoints.length >= 2) {
    planner.loadWaypoints(saved.waypoints);
  }
})();
drawLandmarks();
updateZoomStatus();
drawGraticule();
