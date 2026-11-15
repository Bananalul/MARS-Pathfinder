// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// NASA findings on the map: mission sites, the 2015 human Exploration Zones and mineral / activity detections.
// Data: snapshot of NASA Mars Trek vector layers in data/nasa-poi.json (sources and citations in its "meta").

const MARS_R_KM = 3396.19;
const AQ_COLORS = { silica: "#a64fd9", phyllosilicate: "#3d8fe0", sulfate: "#f08c32", chloride: "#e8cf2c", carbonate: "#38b26a" };
const SURFACE_COLORS = { gully: "#d9d9d9", rsl: "#ff6f91", crater: "#6fd6ff" };

// Circle on the Mars sphere as a polygon (Leaflet's own circles assume Earth's radius).
function marsCircle(lat, lon, radiusKm, n = 72) {
  const d = radiusKm / MARS_R_KM, la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const b = (2 * Math.PI * i) / n;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    pts.push([(la2 * 180) / Math.PI, (((lo2 * 180) / Math.PI + 540) % 360) - 180]);
  }
  return pts;
}

const escHtml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function initNasaPoi(map) {
  const box = document.getElementById("poi-list");
  let data;
  try {
    data = await (await fetch("data/nasa-poi.json")).json();
  } catch (err) {
    box.innerHTML = `<div class="warn">${t("NASA findings could not be loaded.")}</div>`;
    return;
  }
  await loadKb().catch(() => null);
  // SVG renderer: the canvas renderer swallowed map clicks (route drawing, zones) in Leaflet 1.9.4.
  const dot = (lat, lon, color, r, html) =>
    L.circleMarker([lat, lon], { radius: r, color: "#111", weight: 1, fillColor: color, fillOpacity: 0.9 }).bindPopup(html);
  const src = (k) => `<div class="small muted">${t("Source")}: ${escHtml(data.meta.layers[k].source)}</div>`;
  const where = (lat, lon) => `<div class="small mono">${formatLat(lat)}, ${formatLonEast(lon)}</div>`;

  const layers = {
    missions: {
      name: "Mission sites & features (NASA)",
      on: true,
      build: () => {
        const g = L.layerGroup();
        for (const [mission, pts] of Object.entries(data.missions))
          for (const [lat, lon, name] of pts)
            dot(lat, lon, "#ffffff", 4, `<b>${escHtml(name)}</b><br>${escHtml(mission)}${where(lat, lon)}${kbButton("mission:" + mission)}${src("missions")}`).addTo(g);
        for (const [lat, lon, name] of data.major)
          L.marker([lat, lon], { icon: L.divIcon({ className: "poi-label", html: escHtml(name), iconSize: null }) })
            .bindPopup(`<b>${escHtml(name)}</b>${where(lat, lon)}${kbButton("major:" + name)}${src("major")}`)
            .addTo(g);
        return g;
      },
      count: () => Object.values(data.missions).reduce((s, p) => s + p.length, 0) + data.major.length,
    },
    ez: {
      name: "Human Exploration Zones (NASA 2015)",
      build: () => {
        const g = L.layerGroup();
        for (const [lat, lon, name, abs, url] of data.ez) {
          const html = `<b>${escHtml(name)}</b><br>${t("Proposed Exploration Zone, 100 km radius")}${where(lat, lon)}${
            url ? `<a href="${escHtml(url)}" target="_blank" rel="noopener">${t("Abstract")} ${escHtml(abs)} (LPI 2015)</a>` : ""
          }${kbButton("ez")}${src("ez")}`;
          L.polygon(marsCircle(lat, lon, 100), { color: "#6ec1ff", weight: 1.5, dashArray: "5 4", fillOpacity: 0.05 }).bindPopup(html).addTo(g);
          dot(lat, lon, "#6ec1ff", 4, html).addTo(g);
        }
        return g;
      },
      count: () => data.ez.length,
    },
    aqueous: {
      name: "Aqueous minerals (Ehlmann & Edwards 2014)",
      legend: Object.entries(AQ_COLORS),
      build: () => {
        const g = L.layerGroup();
        for (const [lat, lon, cls] of data.aqueous)
          dot(lat, lon, AQ_COLORS[cls] || "#ccc", 3.5, `<b>${escHtml(t(cls))}</b><br>${t("Aqueous mineral detection")}${where(lat, lon)}${kbButton("aq:" + cls)}${src("aqueous")}`).addTo(g);
        return g;
      },
      count: () => data.aqueous.length,
    },
    hydrous: {
      name: "Hydrous minerals (Carter et al. 2013)",
      build: () => {
        const g = L.layerGroup();
        for (const [lat, lon, , inst] of data.hydrous)
          dot(lat, lon, inst === "OMEGA" ? "#1e6fd0" : "#4fd2ff", 3, `<b>${t("Hydrous mineral detection")}</b> (${escHtml(inst)})${where(lat, lon)}${kbButton("hydrous")}${src("hydrous")}`).addTo(g);
        return g;
      },
      count: () => data.hydrous.length,
    },
    chloride: {
      name: "Chloride salt deposits (Osterloo et al. 2010)",
      build: () => {
        const g = L.layerGroup();
        for (const [lat, lon, id] of data.chloride)
          dot(lat, lon, AQ_COLORS.chloride, 4, `<b>${t("Chloride-bearing deposit")}</b> ${escHtml(id)}${where(lat, lon)}${kbButton("chloride")}${src("chloride")}`).addTo(g);
        return g;
      },
      count: () => data.chloride.length,
    },
    surface: {
      name: "Active surface: RSL, gullies, new/icy craters",
      build: () => {
        const g = L.layerGroup();
        for (const [lat, lon, type, ref, obs] of data.surface) {
          const c = /RSL/.test(type) ? SURFACE_COLORS.rsl : /crater|icy/.test(type) ? SURFACE_COLORS.crater : SURFACE_COLORS.gully;
          dot(lat, lon, c, 3.5, `<b>${escHtml(t(type))}</b>${where(lat, lon)}<div class="small">${escHtml(ref)}${obs ? ` · HiRISE ${escHtml(obs)}` : ""}</div>${kbButton("surface:" + type)}${src("surface")}`).addTo(g);
        }
        return g;
      },
      count: () => data.surface.length,
    },
  };

  box.innerHTML = "";
  for (const [key, def] of Object.entries(layers)) {
    const li = document.createElement("li");
    li.innerHTML = `<label class="check"><input type="checkbox" ${def.on ? "checked" : ""}> <span>${t(def.name)}</span> <span class="muted small">(${def.count()})</span></label>${
      def.legend ? `<div class="poi-legend">${def.legend.map(([k, c]) => `<span><i style="background:${c}"></i>${t(k)}</span>`).join("")}</div>` : ""
    }`;
    const cb = li.querySelector("input");
    const toggle = () => {
      if (cb.checked) {
        def.layer = def.layer || def.build();
        def.layer.addTo(map);
      } else if (def.layer) map.removeLayer(def.layer);
    };
    cb.addEventListener("change", toggle);
    toggle();
    box.appendChild(li);
  }
  return { layers };
}
