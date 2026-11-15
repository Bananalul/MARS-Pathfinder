// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// User zones: coloured, named areas anywhere on Mars (ore/resources, water ice, hazards, targets …).
// Stored in this browser (localStorage), exportable as GeoJSON. Zones marked "avoid" are blocked for the route planner.

const ZONE_KEY = "mars-pathfinder-zones";
const ZONE_CATS = {
  resource: { label: "Ore / resource", color: "#e0a030" },
  water: { label: "Water / ice", color: "#4aa3df" },
  hazard: { label: "Hazard", color: "#c4473f" },
  science: { label: "Science target", color: "#9b6fd6" },
  base: { label: "Base / landing site", color: "#4f9d69" },
  other: { label: "Other", color: "#a0a4ab" },
};

// Area of a lat/lon ring on the Mars sphere (km²).
function marsRingAreaKm2(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [la1, lo1] = ring[i], [la2, lo2] = ring[(i + 1) % ring.length];
    s += (((lo2 - lo1 + 540) % 360) - 180) * (Math.PI / 180) * (2 + Math.sin((la1 * Math.PI) / 180) + Math.sin((la2 * Math.PI) / 180));
  }
  return Math.abs((s * MARS_R_KM * MARS_R_KM) / 2);
}

function ringContains(ring, lat, lon) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function initZones(map, hooks = {}) {
  const el = (id) => document.getElementById(id);
  const layer = L.layerGroup().addTo(map);
  const draft = L.layerGroup().addTo(map);
  let zones = load();
  let mode = null; // "polygon" | "circle" | null
  let pts = [];
  let editing = null; // zone id being edited, or "new"
  let pendingGeom = null;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(ZONE_KEY)) || [];
    } catch {
      return [];
    }
  }
  function save() {
    try {
      localStorage.setItem(ZONE_KEY, JSON.stringify(zones));
    } catch {
      // storage full or blocked: zones stay for this session
    }
  }
  const ringOf = (z) => (z.type === "circle" ? marsCircle(z.center[0], z.center[1], z.radiusKm) : z.coords);

  // ---------- Drawing ----------

  function setMode(m) {
    mode = m;
    pts = [];
    draft.clearLayers();
    el("zone-draw-poly").classList.toggle("active", m === "polygon");
    el("zone-draw-circle").classList.toggle("active", m === "circle");
    el("zone-finish").hidden = m !== "polygon";
    map.getContainer().classList.toggle("drawing", !!m);
    if (m && hooks.onStartDrawing) hooks.onStartDrawing();
    el("zone-hint").textContent = m === "polygon"
      ? t("Click the corners of the zone on the map, then “Finish” (or click the first corner).")
      : m === "circle"
        ? t("Click the centre of the zone on the map (radius from the field).")
        : "";
  }

  function redrawDraft() {
    draft.clearLayers();
    if (pts.length) L.polyline([...pts, pts[0]], { color: "#fff", weight: 2, dashArray: "4 4", interactive: false }).addTo(draft);
    pts.forEach((p, i) =>
      L.circleMarker(p, { radius: i ? 4 : 6, color: "#fff", weight: 2, fillColor: "#d9813f", fillOpacity: 1, bubblingMouseEvents: false })
        .on("click", () => i === 0 && pts.length >= 3 && finishPolygon())
        .addTo(draft)
    );
  }

  function finishPolygon() {
    if (pts.length < 3) {
      el("zone-hint").textContent = t("A zone needs at least 3 corners.");
      return;
    }
    const geom = { type: "polygon", coords: pts.map((p) => [+p[0].toFixed(5), +p[1].toFixed(5)]) };
    setMode(null);
    openForm(null, geom);
  }

  map.on("click", (e) => {
    if (!mode) return;
    const p = [e.latlng.lat, e.latlng.lng];
    if (Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180) return; // outside the planet map
    if (mode === "circle") {
      const r = parseFloat(el("zone-radius").value);
      if (!(r > 0)) return (el("zone-hint").textContent = t("Enter a radius in km first."));
      setMode(null);
      openForm(null, { type: "circle", center: [+p[0].toFixed(5), +p[1].toFixed(5)], radiusKm: r });
      return;
    }
    pts.push(p);
    redrawDraft();
  });

  // ---------- Form ----------

  function openForm(zone, geom) {
    editing = zone ? zone.id : "new";
    pendingGeom = geom || null;
    el("zone-form").hidden = false;
    el("zone-name").value = zone ? zone.name : "";
    el("zone-cat").value = zone ? zone.cat : "resource";
    el("zone-color").value = zone ? zone.color : ZONE_CATS.resource.color;
    el("zone-note").value = zone ? zone.note || "" : "";
    el("zone-avoid").checked = zone ? !!zone.avoid : false;
    if (geom) {
      const ring = geom.type === "circle" ? marsCircle(geom.center[0], geom.center[1], geom.radiusKm) : geom.coords;
      draft.clearLayers();
      L.polygon(ring, { color: el("zone-color").value, weight: 2, dashArray: "4 4", fillOpacity: 0.2, interactive: false }).addTo(draft);
    }
    if (hooks.onOpen) hooks.onOpen();
    el("zone-name").focus();
  }

  function closeForm() {
    el("zone-form").hidden = true;
    editing = null;
    pendingGeom = null;
    draft.clearLayers();
  }

  el("zone-cat").addEventListener("change", () => {
    const c = el("zone-cat").value;
    el("zone-color").value = ZONE_CATS[c].color;
    el("zone-avoid").checked = c === "hazard";
  });

  el("zone-save").addEventListener("click", () => {
    const name = el("zone-name").value.trim() || t(ZONE_CATS[el("zone-cat").value].label);
    const props = { name, cat: el("zone-cat").value, color: el("zone-color").value, note: el("zone-note").value.trim(), avoid: el("zone-avoid").checked };
    if (editing === "new") zones.push({ id: `z${Date.now().toString(36)}`, created: new Date().toISOString(), ...pendingGeom, ...props });
    else Object.assign(zones.find((z) => z.id === editing), props);
    save();
    closeForm();
    render();
  });
  el("zone-cancel").addEventListener("click", closeForm);

  // ---------- Map + list ----------

  function render() {
    layer.clearLayers();
    for (const z of zones) {
      const ring = ringOf(z);
      const area = marsRingAreaKm2(ring);
      const poly = L.polygon(ring, { color: z.color, weight: 2, fillColor: z.color, fillOpacity: 0.22, dashArray: z.avoid ? "6 4" : null }).addTo(layer);
      poly.bindTooltip(escHtml(z.name), { permanent: true, direction: "center", className: "zone-label" });
      poly.bindPopup(
        `<b>${escHtml(z.name)}</b><br>${t(ZONE_CATS[z.cat]?.label || "Other")}${z.avoid ? ` · <span class="warn">${t("route planner avoids it")}</span>` : ""}` +
          `<div class="small">${t("Area")}: ${area < 1 ? (area * 100).toFixed(1) + " ha" : area.toFixed(area < 100 ? 2 : 0) + " km²"}</div>` +
          (z.note ? `<div class="small">${escHtml(z.note)}</div>` : "") +
          `<div class="small muted">${t("Own entry – not NASA data")}</div>`
      );
    }
    const list = el("zone-list");
    list.innerHTML = zones.length ? "" : `<div class="muted small">${t("No zones yet.")}</div>`;
    for (const z of zones) {
      const area = marsRingAreaKm2(ringOf(z));
      const row = document.createElement("div");
      row.className = "zone-row";
      row.innerHTML = `<i style="background:${z.color}"></i><div class="zone-main"><b>${escHtml(z.name)}</b><div class="small muted">${t(ZONE_CATS[z.cat]?.label || "Other")} · ${
        area < 1 ? (area * 100).toFixed(1) + " ha" : area.toFixed(area < 100 ? 2 : 0) + " km²"
      }${z.avoid ? ` · ${t("avoided")}` : ""}</div></div>
        <button type="button" data-a="go" title="${t("Show on map")}">⌖</button>
        <button type="button" data-a="edit" title="${t("Edit")}">✎</button>
        <button type="button" data-a="del" title="${t("Delete")}">✕</button>`;
      row.querySelector('[data-a="go"]').addEventListener("click", () => map.fitBounds(L.latLngBounds(ringOf(z)), { maxZoom: 14 }));
      row.querySelector('[data-a="edit"]').addEventListener("click", () => openForm(z));
      const del = row.querySelector('[data-a="del"]');
      del.addEventListener("click", () => {
        if (del.dataset.armed) {
          zones = zones.filter((x) => x.id !== z.id);
          save();
          render();
        } else {
          del.dataset.armed = "1";
          del.textContent = t("Sure?");
          setTimeout(() => {
            if (del.isConnected) {
              delete del.dataset.armed;
              del.textContent = "✕";
            }
          }, 3000);
        }
      });
      list.appendChild(row);
    }
    if (hooks.onChange) hooks.onChange();
  }

  // ---------- Export / import ----------

  function toGeoJSON() {
    return {
      type: "FeatureCollection",
      features: zones.map((z) => ({
        type: "Feature",
        properties: { name: z.name, category: z.cat, color: z.color, note: z.note, avoid: z.avoid, shape: z.type, radius_km: z.radiusKm ?? null, created: z.created },
        geometry: { type: "Polygon", coordinates: [[...ringOf(z), ringOf(z)[0]].map(([la, lo]) => [lo, la])] },
      })),
    };
  }

  el("zone-export").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(toGeoJSON(), null, 1)], { type: "application/geo+json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "mars-pathfinder-zones.geojson" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
  el("zone-import").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const gj = JSON.parse(await f.text());
      for (const ft of gj.features || []) {
        if (ft.geometry?.type !== "Polygon") continue;
        const p = ft.properties || {};
        const ring = ft.geometry.coordinates[0].slice(0, -1).map(([lo, la]) => [la, lo]);
        zones.push({
          id: `z${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
          type: "polygon",
          coords: ring,
          name: p.name || t("Imported zone"),
          cat: ZONE_CATS[p.category] ? p.category : "other",
          color: p.color || ZONE_CATS.other.color,
          note: p.note || "",
          avoid: !!p.avoid,
          created: p.created || new Date().toISOString(),
        });
      }
      save();
      render();
    } catch (err) {
      el("zone-hint").textContent = t("Import failed: {msg}", { msg: err.message });
    }
  });

  el("zone-draw-poly").addEventListener("click", () => setMode(mode === "polygon" ? null : "polygon"));
  el("zone-draw-circle").addEventListener("click", () => setMode(mode === "circle" ? null : "circle"));
  el("zone-finish").addEventListener("click", finishPolygon);
  el("zone-cat").innerHTML = Object.entries(ZONE_CATS).map(([k, c]) => `<option value="${k}">${t(c.label)}</option>`).join("");

  render();

  return {
    isDrawing: () => !!mode,
    stopDrawing: () => setMode(null),
    // Zones the route planner must not enter.
    avoidRings: () => zones.filter((z) => z.avoid).map(ringOf),
    // Avoid zones a list of points runs through (route warnings).
    crossed: (points) =>
      zones.filter((z) => z.avoid).filter((z) => {
        const ring = ringOf(z);
        return points.some((p) => ringContains(ring, p.lat, p.lon));
      }).map((z) => z.name),
  };
}
