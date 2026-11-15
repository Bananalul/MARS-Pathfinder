// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Small UI helpers: top loading bar, map legend, draggable panels.

// ---------- Loading bar at the top of the screen ----------
const busyBar = (() => {
  const jobs = new Map();
  let node = null;
  function ui() {
    if (!node) {
      node = document.createElement("div");
      node.id = "busy-bar";
      node.innerHTML = `<div class="busy-spin"></div><span class="busy-msg"></span><b class="busy-pct"></b><div class="busy-track"><i></i></div><div class="busy-fill"></div>`;
      document.body.appendChild(node);
    }
    return node;
  }
  function show() {
    const n = ui();
    if (!jobs.size) {
      n.classList.remove("on");
      n.style.display = "none"; // hard hide – does not depend on CSS transitions running
      return;
    }
    n.style.display = "";
    const job = [...jobs.values()].pop();
    n.querySelector(".busy-msg").innerHTML = job.msg;
    const known = Number.isFinite(job.pct);
    n.querySelector(".busy-pct").textContent = known ? `${Math.round(Math.min(100, Math.max(0, job.pct)))} %` : "";
    n.querySelector(".busy-fill").style.width = known ? `${Math.min(100, job.pct)}%` : "0";
    n.classList.toggle("has-pct", known);
    n.classList.add("on");
  }
  setInterval(() => {
    let changed = false;
    for (const [k, v] of jobs) if (Date.now() - v.t > 180000) jobs.delete(k), (changed = true);
    if (changed) show();
  }, 5000);
  return {
    // pct: 0–100, or omit for an indeterminate bar. A job not updated for 3 minutes is dropped (safety net).
    set(key, msg, pct) {
      const prev = jobs.get(key);
      jobs.set(key, { msg, pct: Number.isFinite(pct) ? pct : prev?.pct, t: Date.now() });
      show();
    },
    clear() {
      jobs.clear();
      show();
    },
    done(key) {
      jobs.delete(key);
      show();
    },
  };
})();

// ---------- Draggable panel (drag by its header) ----------
function makeDraggable(panel, handle) {
  let start = null;
  handle.style.cursor = "move";
  handle.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, select, input")) return;
    const r = panel.getBoundingClientRect(), pr = panel.offsetParent.getBoundingClientRect();
    start = { x: e.clientX, y: e.clientY, left: r.left - pr.left, top: r.top - pr.top, pw: pr.width, ph: pr.height, w: r.width, h: r.height };
    panel.style.left = `${start.left}px`;
    panel.style.top = `${start.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  handle.addEventListener("pointermove", (e) => {
    if (!start) return;
    const left = Math.min(start.pw - 60, Math.max(-start.w + 80, start.left + e.clientX - start.x));
    const top = Math.min(start.ph - 40, Math.max(0, start.top + e.clientY - start.y));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  });
  handle.addEventListener("pointerup", () => (start = null));
}

// ---------- Legend of everything drawn on the map ----------
function initLegend(map) {
  const tr = (en, de) => (LANG === "de" ? de : en);
  const sw = (c, extra = "") => `<i class="lg-sw" style="background:${c};${extra}"></i>`;
  const line = (c, dash) => `<i class="lg-line" style="border-top:3px ${dash ? "dashed" : "solid"} ${c}"></i>`;
  const dot = (c) => `<i class="lg-dot" style="background:${c}"></i>`;
  const row = (icon, text) => `<div class="lg-row">${icon}<span>${text}</span></div>`;
  const html = `
    <div class="lg-head"><b>${tr("Legend", "Legende")}</b><button type="button" class="lg-x">✕</button></div>
    <div class="lg-body">
      <h4>${tr("Route and profile", "Route und Höhenprofil")}</h4>
      ${row(line("#4f9d69"), tr("below caution slope", "unter Vorsichtsgrenze"))}
      ${row(line("#d0a03a"), tr("caution slope", "Vorsicht (Hang)"))}
      ${row(line("#c4473f"), tr("critical slope – click for 3D", "kritisch – Klick für 3D"))}
      ${row(line("#8a919c"), tr("no elevation data", "keine Höhendaten"))}
      ${row(line("#ffffff", true), tr("drawn route line", "gezeichnete Routenlinie"))}
      ${row(sw("#a0703c", "height:4px"), tr("profile strip: loose ground (night IR low)", "Profilstreifen: lockerer Boden (Nacht-IR niedrig)"))}
      ${row(sw("#8fc1dc", "height:4px"), tr("profile strip: rock (night IR high)", "Profilstreifen: Fels (Nacht-IR hoch)"))}
      ${row(dot("#ffd23f"), tr("route walk position (map and profile)", "Position der Routen-Animation (Karte und Profil)"))}
      ${row(`<i class="lg-badge lg-red">⚠</i>`, tr("red title: danger on this route (click for details)", "roter Titel: Gefahr auf dieser Route (Klick für Details)"))}
      ${row(`<i class="lg-badge lg-amber">△</i>`, tr("amber title: cautions only", "gelber Titel: nur Hinweise"))}
      <h4>${tr("Automatic route search", "Automatische Routensuche")}</h4>
      ${row(`<i class="lg-badge">A</i>`, tr("start / destination B / via points", "Start / Ziel B / Zwischenziele"))}
      ${row(sw("#c4473f"), tr("hazard map: blocked cell", "Gefahrenkarte: gesperrte Zelle"))}
      ${row(sw("#e0783c"), tr("hazard map: partly critical", "Gefahrenkarte: teilweise kritisch"))}
      ${row(sw("#d0a03a"), tr("hazard map: caution slope", "Gefahrenkarte: Vorsichts-Hang"))}
      ${row(sw("#9664c8"), tr("hazard map: loose ground (IR)", "Gefahrenkarte: lockerer Boden (IR)"))}
      ${row(sw("#8a919c"), tr("hazard map: no DTM", "Gefahrenkarte: kein DTM"))}
      <h4>${tr("Elevation data coverage", "Abdeckung Höhendaten")}</h4>
      ${row(line("#5fb3c9"), tr("HiRISE DTM (≈1 m) – best 3D and slopes", "HiRISE-DTM (≈1 m) – beste 3D-Ansicht und Hänge"))}
      ${row(line("#a07cc9", true), tr("CTX DTM (20 m)", "CTX-DTM (20 m)"))}
      ${row(sw("transparent", "border:1px solid #888"), tr("elsewhere: MOLA (463 m), not safety-checked", "sonst: MOLA (463 m), nicht sicherheitsgeprüft"))}
      <h4>${tr("NASA findings", "NASA-Erkenntnisse")}</h4>
      ${row(dot("#ffffff"), tr("mission site / hardware", "Missionsort / Hardware"))}
      ${row(line("#6ec1ff", true), tr("human Exploration Zone (100 km)", "Erkundungszone für Menschen (100 km)"))}
      ${row(dot("#a64fd9"), tr("silica", "Silikat"))}${row(dot("#3d8fe0"), tr("clays (phyllosilicates)", "Tonminerale"))}
      ${row(dot("#f08c32"), tr("sulfates", "Sulfate"))}${row(dot("#e8cf2c"), tr("chlorides", "Chloride"))}${row(dot("#38b26a"), tr("carbonates", "Karbonate"))}
      ${row(dot("#4fd2ff"), tr("hydrous minerals (CRISM; dark blue: OMEGA)", "wasserhaltige Minerale (CRISM; dunkelblau: OMEGA)"))}
      ${row(dot("#ff6f91"), tr("recurring slope lineae (RSL)", "wiederkehrende Hangstreifen (RSL)"))}
      ${row(dot("#6fd6ff"), tr("new / icy impact crater", "neuer / eisiger Krater"))}${row(dot("#d9d9d9"), tr("active gully", "aktive Rinne"))}
      ${row(`<i class="lg-level kb-safe">✓</i>`, tr("Safe – measured, confirmed", "Sicher – gemessen, bestätigt"))}
      ${row(`<i class="lg-level kb-maybe">≈</i>`, tr("Maybe safe – orbital or debated", "Wahrscheinlich – Orbit oder diskutiert"))}
      ${row(`<i class="lg-level kb-not">✗</i>`, tr("Not safe – contested", "Unsicher – umstritten"))}
      <h4>${tr("Your objects", "Eigene Objekte")}</h4>
      ${row(`<i class="lg-badge lg-base">⌂</i>`, tr("base (supplies in the Bases tab)", "Basis (Vorräte im Tab Basen)"))}
      ${row(sw("rgba(255,160,60,0.4)", "border:1px solid #f0a040"), tr("your zones (colour by category)", "eigene Zonen (Farbe nach Kategorie)"))}
      <h4>${tr("Environment layers", "Umweltebenen")}</h4>
      ${row(`<i class="lg-ramp"></i>`, tr("low → high (scale shown under Science overlays)", "niedrig → hoch (Skala unter Wissenschaftliche Overlays)"))}
    </div>`;
  const panel = document.createElement("div");
  panel.id = "map-legend";
  panel.className = "map-legend";
  panel.hidden = true;
  panel.innerHTML = html;
  map.getContainer().parentElement.appendChild(panel);
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);
  makeDraggable(panel, panel.querySelector(".lg-head"));
  const Btn = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const b = L.DomUtil.create("button", "leaflet-bar cut-btn legend-btn");
      b.type = "button";
      b.textContent = tr("☰ Legend", "☰ Legende");
      b.title = tr("Show or hide the legend", "Legende ein-/ausblenden");
      L.DomEvent.disableClickPropagation(b);
      L.DomEvent.on(b, "click", () => (panel.hidden = !panel.hidden));
      return b;
    },
  });
  new Btn().addTo(map);
  panel.querySelector(".lg-x").addEventListener("click", () => (panel.hidden = true));
}
