// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Geologic maps from the USGS-NASA Planetary Geologic Mapping Program (ArcGIS feature services).
// Geometry is requested in GCS_Mars_2000_Sphere (wkid 104905) = planetocentric degrees.

const GEOLOGY_MAPS = {
  sim3464: {
    title: "SIM 3464 – Jezero crater and Nili Planum (1:75,000)",
    url: "https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Jezero_FeatureServiceFromPro/FeatureServer/8",
    valueField: "unit",
    symbolField: "symbol",
    nameField: "name",
    descField: "Unit_Description",
    interpField: "Unit_Interpretation",
    simplify: 0.0002,
    citation: "Sun, V.Z., and Stack, K.M., 2020, Geologic map of Jezero crater and the Nili Planum region, Mars: USGS SIM 3464",
    doi: "https://doi.org/10.3133/sim3464",
  },
  sim3292: {
    title: "SIM 3292 – Geologic map of Mars (1:20M)",
    url: "https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Tanaka_et_al_2014_Mars_Global_Map_Features/FeatureServer/3",
    valueField: "Unit",
    symbolField: "Unit",
    nameField: "UnitDesc",
    descField: "PrimaryCharacteristics",
    interpField: "Interpretation",
    simplify: 0.02,
    citation: "Tanaka, K.L., and others, 2014, Geologic map of Mars: USGS SIM 3292, scale 1:20,000,000",
    doi: "https://doi.org/10.3133/sim3292",
  },
};

// Which map applies where: local map if available, otherwise the global map.
const SITE_GEOLOGY = { jezero: "sim3464", gale: "sim3292" };

const rendererCache = new Map();
const polygonCache = new Map();

async function geologyRenderer(key) {
  if (!rendererCache.has(key)) {
    rendererCache.set(
      key,
      fetchJson(`${GEOLOGY_MAPS[key].url}?f=json`).then((meta) => {
        const map = new Map();
        for (const v of meta.drawingInfo.renderer.uniqueValueInfos || []) {
          const [r, g, b] = v.symbol?.color || [128, 128, 128];
          map.set(String(v.value), { color: `rgb(${r},${g},${b})`, label: v.label });
        }
        return map;
      })
    );
  }
  return rendererCache.get(key);
}

async function geologyPolygons(key, bbox) {
  const cacheKey = `${key}:${bbox.join(",")}`;
  if (!polygonCache.has(cacheKey)) {
    const m = GEOLOGY_MAPS[key];
    const fields = [m.valueField, m.symbolField, m.nameField].join(",");
    const params =
      `f=json&where=1%3D1&outFields=${fields}&outSR=104905&inSR=104905` +
      `&geometry=${bbox.join(",")}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects` +
      `&maxAllowableOffset=${m.simplify}&geometryPrecision=6&resultRecordCount=2000`;
    polygonCache.set(cacheKey, fetchJson(`${m.url}/query?${params}`).then((r) => r.features || []));
  }
  try {
    return await polygonCache.get(cacheKey);
  } catch (err) {
    polygonCache.delete(cacheKey);
    throw err;
  }
}

async function geologyAt(key, lat, lon) {
  const m = GEOLOGY_MAPS[key];
  const fields = [m.symbolField, m.nameField, m.descField, m.interpField].join(",");
  const r = await fetchJson(
    `${m.url}/query?f=json&outFields=${fields}&returnGeometry=false&geometry=${lon},${lat}` +
      `&geometryType=esriGeometryPoint&inSR=104905&spatialRel=esriSpatialRelIntersects`
  );
  const a = r.features?.[0]?.attributes;
  if (!a) return null;
  return {
    symbol: a[m.symbolField],
    name: a[m.nameField],
    description: a[m.descField],
    interpretation: a[m.interpField],
    map: m,
  };
}

// Esri rings: clockwise = outer ring, counter-clockwise = hole. Leaflet needs [[outer, ...holes], ...].
function ringsToLatLngs(rings) {
  const area = (ring) => {
    let s = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
    return s; // > 0: clockwise in x/y
  };
  const polys = [];
  for (const ring of rings) {
    const ll = ring.map(([x, y]) => [y, x]);
    if (area(ring) > 0 || !polys.length) polys.push([ll]);
    else polys[polys.length - 1].push(ll);
  }
  return polys;
}

function initGeology(map) {
  const el = (id) => document.getElementById(id);
  const layer = L.layerGroup();
  let current = { key: null, site: null };
  let token = 0;
  let opacity = 0.45;

  function mapKeyFor(siteId) {
    return SITE_GEOLOGY[siteId] || "sim3292";
  }

  function bboxFor(siteId) {
    const site = SITES.find((s) => s.id === siteId);
    if (!site) return [-180, -90, 180, 90];
    const [[s, w], [n, e]] = site.region;
    return [w, s, e, n];
  }

  async function draw(siteId) {
    const tok = ++token;
    current = { key: mapKeyFor(siteId), site: siteId };
    layer.clearLayers();
    renderSource();
    if (!el("toggle-geology").checked) {
      el("geology-legend").innerHTML = "";
      return;
    }
    el("geology-legend").innerHTML = `<div class="muted small">Loading geologic map …</div>`;
    try {
      const [renderer, features] = await Promise.all([
        geologyRenderer(current.key),
        geologyPolygons(current.key, bboxFor(siteId)),
      ]);
      if (tok !== token) return;
      const m = GEOLOGY_MAPS[current.key];
      const present = new Map();
      for (const f of features) {
        const value = String(f.attributes[m.valueField]);
        const style = renderer.get(value) || { color: "#888" };
        present.set(value, { ...style, symbol: f.attributes[m.symbolField], name: f.attributes[m.nameField] });
        L.polygon(ringsToLatLngs(f.geometry.rings), {
          color: "#222",
          weight: 0.5,
          opacity: 0.6,
          fillColor: style.color,
          fillOpacity: opacity,
          interactive: false,
        }).addTo(layer);
      }
      renderLegend(present);
    } catch (err) {
      console.error("Geologic map could not be loaded:", err);
      if (tok === token) el("geology-legend").innerHTML = `<div class="warn">Geologic map could not be loaded.</div>`;
    }
  }

  function renderLegend(present) {
    const items = [...present.values()].sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)));
    el("geology-legend").innerHTML = items
      .map((u) => `<div class="legend-item"><i style="background:${u.color}"></i><b>${u.symbol}</b> ${u.name || ""}</div>`)
      .join("");
  }

  function renderSource() {
    const m = GEOLOGY_MAPS[current.key];
    el("geology-source").innerHTML = `${m.title}<br><a href="${m.doi}" target="_blank" rel="noopener">${m.doi.replace("https://", "")}</a>`;
  }

  el("toggle-geology").addEventListener("change", (e) => {
    if (e.target.checked) layer.addTo(map);
    else map.removeLayer(layer);
    el("geology-opacity").hidden = !e.target.checked;
    draw(current.site);
  });
  el("geology-opacity").addEventListener("input", (e) => {
    opacity = e.target.value / 100;
    layer.eachLayer((l) => l.setStyle({ fillOpacity: opacity }));
  });

  current = { key: "sim3292", site: null };
  renderSource();

  return {
    setSite: (siteId) => draw(siteId),
    unitAt: (siteId, lat, lon) => geologyAt(mapKeyFor(siteId), lat, lon),
  };
}
