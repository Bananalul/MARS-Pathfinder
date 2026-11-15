// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Mars clock, environment map layers (temperature, cosmic radiation, UV, soil radioactivity, thermal inertia),
// route start time and the animated walk along a planned route.

function initEnvUI(map, planner, mobility) {
  const el = (id) => document.getElementById(id);
  const tr = (en, de) => (LANG === "de" ? de : en);
  const degC = (k) => `${(k - 273.15).toFixed(0)} °C`;
  const fmtUtc = (ms) => new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const toInput = (ms) => new Date(ms).toISOString().slice(0, 16);
  const fromInput = (v) => (v ? Date.parse(v + ":00Z") : NaN);
  const seasonName = (s) => tr(s, { spring: "Frühling", summer: "Sommer", autumn: "Herbst", winter: "Winter" }[s]);

  const state = { utc: Date.now(), tau: CLIM.TAU, layer: "none", overlay: null, playing: null, renderToken: 0 };

  // ---------- Colour scales ----------
  const STOPS = [
    [0, [48, 18, 59]], [0.15, [65, 105, 225]], [0.3, [30, 170, 230]], [0.45, [40, 210, 160]],
    [0.6, [170, 230, 60]], [0.75, [250, 200, 40]], [0.88, [240, 110, 30]], [1, [170, 20, 20]],
  ];
  function color(f) {
    f = Math.max(0, Math.min(1, f));
    let i = 0;
    while (i < STOPS.length - 2 && STOPS[i + 1][0] < f) i++;
    const [fa, ca] = STOPS[i], [fb, cb] = STOPS[i + 1];
    const u = (f - fa) / (fb - fa);
    return ca.map((c, k) => Math.round(c + (cb[k] - c) * u));
  }

  const LAYERS = {
    temp: {
      label: tr("Surface temperature", "Oberflächentemperatur"), badge: "derived", unit: "°C", min: -130, max: 30, timed: true,
      note: tr(
        "1-D heat-conduction model per 0.25° cell, driven by measured TES thermal inertia and albedo, Mars24 Sun position and the selected dust optical depth. Typical uncertainty ±10–15 K; no slopes or shadows.",
        "1-D-Wärmeleitungsmodell je 0,25°-Zelle, angetrieben von gemessener TES-Wärmeträgheit und -Albedo, Sonnenstand nach Mars24 und der gewählten Staub-Trübung. Typische Unsicherheit ±10–15 K; ohne Hangneigung und Schatten."
      ),
    },
    gcr: {
      label: tr("Cosmic radiation (GCR)", "Kosmische Strahlung (GCR)"), badge: "derived", unit: "mSv/sol", min: 0.6, max: 0.85, timed: false,
      note: tr(
        "MSL RAD dose equivalent at Gale (0.64 ± 0.12 mSv/day, Hassler et al. 2014) scaled by the atmospheric column above each place (MOLA elevation, scale height 11.1 km; ≈1.5 % per g/cm², Guo et al. 2017). Model checked only between 15 and 25 g/cm²; higher terrain is extrapolated (hatched in the readout). Solar cycle and season not included.",
        "MSL-RAD-Äquivalentdosis in Gale (0,64 ± 0,12 mSv/Tag, Hassler et al. 2014), skaliert mit der Luftsäule über jedem Ort (MOLA-Höhe, Skalenhöhe 11,1 km; ≈1,5 % je g/cm², Guo et al. 2017). Nur zwischen 15 und 25 g/cm² geprüft; höheres Gelände ist extrapoliert. Sonnenzyklus und Jahreszeit nicht berücksichtigt."
      ),
    },
    uv: {
      label: tr("UV irradiance (200–400 nm)", "UV-Einstrahlung (200–400 nm)"), badge: "derived", unit: "W/m²", min: 0, max: 45, timed: true,
      note: tr(
        "Solar UV at the top of the atmosphere (≈109 W/m² at 1 AU), Sun position and distance (Mars24), dust transmission for the selected optical depth. No ozone layer: UVC reaches the ground. Order of magnitude as measured by Curiosity REMS-UV; ±30 %.",
        "Solares UV am Oberrand der Atmosphäre (≈109 W/m² bei 1 AE), Sonnenstand und -abstand (Mars24), Staubdurchlässigkeit für die gewählte Trübung. Keine Ozonschicht: UVC erreicht den Boden. Größenordnung wie von Curiosity REMS-UV gemessen; ±30 %."
      ),
    },
    soil: {
      label: tr("Soil radioactivity (K, Th)", "Boden-Radioaktivität (K, Th)"), badge: "derived", unit: "nGy/h", min: 2, max: 9, timed: false,
      note: tr(
        "Gamma dose rate from potassium and thorium measured by Mars Odyssey GRS (5° grid, 2002–2005), UNSCEAR 2000 conversion; uranium assumed at Th/U = 3.8. About 1/1000 of the cosmic-ray dose.",
        "Gamma-Dosisleistung aus Kalium und Thorium, gemessen von Mars Odyssey GRS (5°-Raster, 2002–2005), Umrechnung nach UNSCEAR 2000; Uran angenommen mit Th/U = 3,8. Etwa 1/1000 der kosmischen Dosis."
      ),
    },
    ti: {
      label: tr("Thermal inertia (TES)", "Wärmeträgheit (TES)"), badge: "measured", unit: "J m⁻² K⁻¹ s⁻½", min: 30, max: 800, timed: false, log: true,
      note: tr(
        "Measured: MGS TES nighttime thermal inertia (Putzig & Mellon 2007). Low = dust/sand, high = rock or crusted ground.",
        "Gemessen: MGS-TES-Wärmeträgheit aus Nachtmessungen (Putzig & Mellon 2007). Niedrig = Staub/Sand, hoch = Fels oder verkrusteter Boden."
      ),
    },
  };

  // ---------- Mars clock ----------
  function renderClock() {
    const mt = marsTime(state.utc);
    const c = map.getCenter();
    const sun = marsSun(mt, c.lat, c.lng);
    el("env-marsclock").innerHTML = `
      <table class="kv small">
        <tr><th>${tr("Mars year / sol date", "Marsjahr / Sol")}</th><td>MY ${mt.marsYear} · MSD ${Math.floor(mt.msd)}</td></tr>
        <tr><th>${tr("Season (Ls)", "Jahreszeit (Ls)")}</th><td>${mt.ls.toFixed(1)}° · ${tr("north", "Nord")}: ${seasonName(marsSeason(mt.ls, 1))}, ${tr("south", "Süd")}: ${seasonName(marsSeason(mt.ls, -1))}</td></tr>
        <tr><th>${tr("Local solar time at map centre", "Ortszeit (Sonne) in Kartenmitte")}</th><td>${fmtHours(sun.ltst)} · ${tr("Sun", "Sonne")} ${sun.elev.toFixed(0)}°</td></tr>
        <tr><th>${tr("Sun distance", "Sonnenabstand")}</th><td>${mt.rAu.toFixed(3)} AU</td></tr>
      </table>`;
  }

  // ---------- Map layer ----------
  function legend(def) {
    if (!def) return "";
    const cv = document.createElement("canvas");
    cv.width = 200;
    cv.height = 10;
    const cx = cv.getContext("2d");
    for (let x = 0; x < 200; x++) {
      const [r, g, b] = color(x / 199);
      cx.fillStyle = `rgb(${r},${g},${b})`;
      cx.fillRect(x, 0, 1, 10);
    }
    const badge = def.badge === "measured" ? `<span class="badge badge-measured">${tr("Measured", "Gemessen")}</span>` : `<span class="badge badge-derived">${tr("Derived", "Abgeleitet")}</span>`;
    return `<div class="env-legend"><div><b>${def.label}</b> ${badge}</div><img src="${cv.toDataURL()}" alt=""><div class="env-legend-ticks"><span>${def.min}</span><span>${def.unit}</span><span>${def.max}</span></div><div class="small muted">${def.note}</div></div>`;
  }

  async function renderLayer() {
    const tok = ++state.renderToken;
    const def = LAYERS[state.layer];
    el("env-legend").innerHTML = legend(def);
    if (!def) {
      if (state.overlay) map.removeLayer(state.overlay);
      state.overlay = null;
      el("env-status").textContent = "";
      return;
    }
    el("env-status").textContent = tr("Loading NASA maps …", "Lade NASA-Karten …");
    let g;
    try {
      g = await loadEnvGrids();
    } catch (err) {
      el("env-status").textContent = tr(
        "Environment grids not found. They are built automatically on the first start of app/main.py (≈70 MB download, then web/data/env-grids.*).",
        "Umwelt-Raster fehlen. Sie werden beim ersten Start von app/main.py automatisch erzeugt (≈70 MB Download, danach web/data/env-grids.*)."
      );
      return;
    }
    const mt = marsTime(state.utc);
    let tbl = null;
    if (state.layer === "temp") {
      tbl = await temperatureTable(state.utc, state.tau, (f) => {
        if (tok === state.renderToken) el("env-status").textContent = `${tr("Thermal model", "Wärmemodell")} ${Math.round(f * 100)} %`;
      });
    }
    if (tok !== state.renderToken) return;
    const { meta, ti, alb, elev } = g;
    const step = 2;
    const W = meta.w / step, H = meta.h / step;
    const cv = document.createElement("canvas");
    let img;
    if (state.layer === "soil") {
      // 5° GRS grid, drawn small and smoothed by the browser.
      cv.width = 72;
      cv.height = 36;
      img = cv.getContext("2d").createImageData(72, 36);
      for (let i = 0; i < 72 * 36; i++) {
        const d = soilDose(meta.grs.k_wtpct[i], meta.grs.th_ppm[i]);
        if (!d) continue;
        const [r, gg, b] = color((d.nGyH - def.min) / (def.max - def.min));
        img.data.set([r, gg, b, 255], i * 4);
      }
      cv.getContext("2d").putImageData(img, 0, 0);
    } else {
      cv.width = W;
      cv.height = H;
      img = cv.getContext("2d").createImageData(W, H);
      for (let y = 0; y < H; y++) {
        const lat = meta.north - (y * step + 1) * meta.res;
        for (let x = 0; x < W; x++) {
          const lon = meta.west + (x * step + 1) * meta.res;
          const i = (y * step + 1) * meta.w + x * step + 1;
          const eKm = elev && Number.isFinite(elev[i]) ? elev[i] / 1000 : 0;
          let v = null;
          if (state.layer === "temp") {
            const ltst = ((mt.mtc + lon / 15 + mt.eotDeg / 15) % 24 + 24) % 24;
            v = tableTemp(tbl, lat, ti[i] || 250, alb[i] ? alb[i] * 1e-4 : 0.22, ltst, eKm) - 273.15;
          } else if (state.layer === "gcr") {
            v = gcrDose(eKm).mSvDay * 1.0275; // per sol
          } else if (state.layer === "uv") {
            v = uvIrradiance(mt, marsSun(mt, lat, lon), state.tau).total;
          } else if (state.layer === "ti") {
            v = ti[i] ? (Math.log(ti[i]) - Math.log(def.min)) / (Math.log(def.max) - Math.log(def.min)) * (def.max - def.min) + def.min : null;
          }
          if (v == null) continue;
          const [r, gg, b] = color((v - def.min) / (def.max - def.min));
          img.data.set([r, gg, b, 235], (y * W + x) * 4);
        }
      }
      cv.getContext("2d").putImageData(img, 0, 0);
    }
    const url = cv.toDataURL();
    const bounds = [[-90, -180], [90, 180]];
    const opacity = parseFloat(el("env-opacity").value);
    if (state.overlay) state.overlay.setUrl(url);
    else state.overlay = L.imageOverlay(url, bounds, { opacity, pane: "overlayPane2", interactive: false, className: state.layer === "soil" ? "env-smooth" : "env-pixel" }).addTo(map);
    state.overlay.getElement()?.classList.toggle("env-smooth", state.layer === "soil");
    el("env-status").textContent = def.timed ? `${tr("Shown for", "Stand")} ${fmtUtc(state.utc)} · Ls ${mt.ls.toFixed(1)}°` : "";
  }

  // ---------- Point readout ----------
  function envTable(e) {
    const s = e.surface;
    const flag = (b, txt) => (b ? ` <span class="muted">(${txt})</span>` : "");
    const soil = e.soil;
    return `<table class="kv small">
      <tr><th>${tr("Local solar time", "Ortszeit (Sonne)")}</th><td>${fmtHours(e.sun.ltst)} · ${tr("Sun", "Sonne")} ${e.sun.elev.toFixed(0)}°</td></tr>
      <tr><th>${tr("Surface temperature", "Bodentemperatur")} <span class="badge badge-derived">${tr("Model", "Modell")}</span></th><td><b>${degC(e.tempK)}</b> (${e.tempK.toFixed(0)} K) ±15 K</td></tr>
      <tr><th>${tr("Thermal inertia / albedo", "Wärmeträgheit / Albedo")} <span class="badge badge-measured">TES</span></th><td>${s.ti}${flag(s.tiMissing, tr("no data, assumed", "keine Daten, angenommen"))} / ${s.albedo.toFixed(2)}${flag(s.albMissing, tr("assumed", "angenommen"))}</td></tr>
      <tr><th>${tr("Pressure (estimate)", "Luftdruck (Schätzung)")}</th><td>${e.pressure.toFixed(0)} Pa · ${tr("column", "Luftsäule")} ${e.gcr.column.toFixed(1)} g/cm²</td></tr>
      <tr><th>${tr("Cosmic radiation", "Kosmische Strahlung")} <span class="badge badge-derived">RAD ${tr("scaled", "skaliert")}</span></th><td><b>${(e.gcr.mSvDay * 1.0275).toFixed(2)} mSv/sol</b> (${(e.gcr.mSvDay / 24).toFixed(3)} mSv/h)${e.gcr.extrapolated ? ` <span class="warn-text">${tr("extrapolated", "extrapoliert")}</span>` : ""}</td></tr>
      <tr><th>UV 200–400 nm <span class="badge badge-derived">${tr("Model", "Modell")}</span></th><td>${e.uv.total.toFixed(1)} W/m², ${tr("of which UVC", "davon UVC")} ${e.uv.uvc.toFixed(1)} W/m²</td></tr>
      <tr><th>${tr("Soil radioactivity", "Boden-Radioaktivität")} <span class="badge badge-measured">GRS</span></th><td>${soil ? `${soil.nGyH.toFixed(1)} nGy/h (K ${s.k.toFixed(2)} %, Th ${s.th.toFixed(2)} ppm)` : "–"}</td></tr>
      <tr><th>${tr("Solar particle storm", "Sonnensturm (SEP)")}</th><td>${tr("not predictable; largest so far on the surface (Sept 2017): +", "nicht vorhersagbar; stärkstes bisher am Boden (Sept. 2017): +")}${(CLIM.SEP_2017_UGY / 1000).toFixed(2)} mGy ${tr("in ≈2 days at Gale", "in ≈2 Tagen in Gale")}</td></tr>
    </table>`;
  }

  async function showPoint(latlng) {
    if (state.layer === "none") return;
    const lat = latlng.lat, lon = normalizeLon180(latlng.lng);
    const pop = L.popup({ maxWidth: 360 }).setLatLng(latlng).setContent(tr("Computing …", "Berechne …")).openOn(map);
    try {
      const e = await environmentAt(lat, lon, state.utc, null, state.tau);
      pop.setContent(`<div class="env-pop"><b>${formatLat(lat, 2)}, ${formatLon180(lon, 2)}</b> · ${fmtUtc(state.utc)}${envTable(e)}</div>`);
    } catch (err) {
      pop.setContent(tr("Environment grids not available yet.", "Umwelt-Raster noch nicht verfügbar."));
    }
  }

  // ---------- Time controls ----------
  function setTime(ms, rerender = true) {
    state.utc = ms;
    el("env-utc").value = toInput(ms);
    renderClock();
    if (rerender && LAYERS[state.layer]?.timed) renderLayer();
  }

  el("env-utc").addEventListener("change", () => {
    const v = fromInput(el("env-utc").value);
    if (Number.isFinite(v)) setTime(v);
  });
  el("env-now").addEventListener("click", () => setTime(Date.now()));
  const layerRadios = document.querySelectorAll('input[name="env-layer"]');
  const setLayerRadio = (v) => layerRadios.forEach((r) => (r.checked = r.value === v));
  layerRadios.forEach((r) => r.addEventListener("change", () => {
    if (!r.checked) return;
    state.layer = r.value;
    if (state.overlay) {
      map.removeLayer(state.overlay);
      state.overlay = null;
    }
    renderLayer();
  }));
  el("env-tau").addEventListener("change", () => {
    state.tau = parseFloat(el("env-tau").value);
    renderLayer();
  });
  el("env-opacity").addEventListener("input", () => state.overlay && state.overlay.setOpacity(parseFloat(el("env-opacity").value)));
  el("env-play").addEventListener("click", async () => {
    if (state.playing) {
      state.playing = null;
      el("env-play").textContent = tr("▶ Play one sol", "▶ Einen Sol abspielen");
      return;
    }
    if (!LAYERS[state.layer]?.timed) {
      state.layer = "temp";
      setLayerRadio("temp");
    }
    const run = (state.playing = {});
    el("env-play").textContent = "⏸";
    const start = state.utc;
    for (let k = 1; k <= 48 && state.playing === run; k++) {
      setTime(start + (k * MT_SOL_S * 1000) / 48, false);
      await renderLayer();
      await new Promise((r) => setTimeout(r, 120));
    }
    if (state.playing === run) {
      state.playing = null;
      el("env-play").textContent = tr("▶ Play one sol", "▶ Einen Sol abspielen");
    }
  });
  map.on("moveend", renderClock);
  map.on("click", (e) => showPoint(e.latlng));

  // ---------- Route start time and walk animation ----------
  const routeState = { start: null, timeline: null, building: null };

  function routeStart() {
    return routeState.start ?? state.utc;
  }

  function refreshRouteTime() {
    const box = el("rt-summary");
    if (!box) return;
    const smp = planner.samples();
    const hours = planner.travelHours();
    el("rt-start").value = toInput(routeStart());
    if (!smp.length || hours == null) {
      box.textContent = tr("Plan a route to see start and arrival times.", "Route planen, um Start- und Ankunftszeit zu sehen.");
      el("rt-play").disabled = true;
      routeState.timeline = null;
      if (!el("anim-panel").hidden) el("anim-close").click();
      return;
    }
    const a = smp[0], b = smp[smp.length - 1];
    const t0 = routeStart(), t1 = t0 + hours * 3600000;
    const s0 = marsSun(marsTime(t0), a.lat, a.lon), s1 = marsSun(marsTime(t1), b.lat, b.lon);
    const sols = (hours * 3600) / MT_SOL_S;
    box.innerHTML = `<table class="kv small">
      <tr><th>${tr("Start", "Start")}</th><td>${fmtUtc(t0)} · ${tr("local", "Ortszeit")} ${fmtHours(s0.ltst)} (${tr("Sun", "Sonne")} ${s0.elev.toFixed(0)}°)</td></tr>
      <tr><th>${tr("Arrival", "Ankunft")}</th><td>${fmtUtc(t1)} · ${tr("local", "Ortszeit")} ${fmtHours(s1.ltst)} (${tr("Sun", "Sonne")} ${s1.elev.toFixed(0)}°)</td></tr>
      <tr><th>${tr("Duration", "Dauer")}</th><td>${hours.toFixed(1)} h = ${sols.toFixed(2)} sol</td></tr>
    </table>${s1.elev < 0 || s0.elev < 0 ? `<div class="warn-text small">${tr("Part of the route is walked in darkness.", "Ein Teil der Route liegt in der Dunkelheit.")}</div>` : ""}`;
    el("rt-play").disabled = false;
    routeState.timeline = null;
    if (window.logisticsHook) window.logisticsHook();
  }

  el("rt-start").addEventListener("change", () => {
    const v = fromInput(el("rt-start").value);
    if (Number.isFinite(v)) {
      routeState.start = v;
      el("rt-local").value = "";
      refreshRouteTime();
    }
  });
  el("rt-local").addEventListener("change", () => {
    const h = parseFloat(el("rt-local").value);
    const smp = planner.samples();
    if (!Number.isFinite(h) || !smp.length) return;
    routeState.start = nextLocalTime(Date.now(), smp[0].lon, h);
    refreshRouteTime();
  });

  async function buildTimeline() {
    const smp = planner.samples();
    const t0 = routeStart();
    const times = [0];
    for (let i = 1; i < smp.length; i++) {
      const ds = (smp[i].dist - smp[i - 1].dist) / 1000;
      times.push(times[i - 1] + ds / Math.max(0.05, smp[i].speed || 1));
    }
    await loadEnvGrids();
    const n = Math.min(smp.length, 300);
    const pts = [];
    let dose = 0, prevT = 0, prevRate = null;
    for (let k = 0; k < n; k++) {
      const i = Math.round((k * (smp.length - 1)) / Math.max(1, n - 1));
      const p = smp[i];
      const e = await environmentAt(p.lat, p.lon, t0 + times[i] * 3600000, p.elev ?? null, state.tau);
      const rate = e.gcr.mSvDay / 24; // mSv/h
      if (prevRate != null) dose += ((rate + prevRate) / 2) * (times[i] - prevT);
      prevRate = rate;
      prevT = times[i];
      pts.push({ i, lat: p.lat, lon: p.lon, dist: p.dist, elev: p.elev, h: times[i], env: e, dose });
      if (k % 25 === 24) {
        busyBar.set("walk", tr("Route walk: computing temperature and dose along the route …", "Routen-Animation: berechne Temperatur und Dosis entlang der Route …"), (100 * (k + 1)) / n);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    return { t0, pts, hours: times[times.length - 1] };
  }

  const anim = { marker: null, raf: null, playing: false, h: 0, last: 0 };

  function drawChart(tl) {
    const cv = el("anim-chart");
    const W = (cv.width = cv.clientWidth * devicePixelRatio), H = (cv.height = 110 * devicePixelRatio);
    const cx = cv.getContext("2d");
    cx.scale(devicePixelRatio, devicePixelRatio);
    const w = W / devicePixelRatio, hgt = 110, pad = { l: 34, r: 34, t: 8, b: 16 };
    const temps = tl.pts.map((p) => p.env.tempK - 273.15);
    const tMin = Math.floor(Math.min(...temps) / 10) * 10, tMax = Math.ceil(Math.max(...temps) / 10) * 10 || 10;
    const X = (h) => pad.l + (h / Math.max(tl.hours, 1e-6)) * (w - pad.l - pad.r);
    const Y = (v) => pad.t + (1 - (v - tMin) / Math.max(1, tMax - tMin)) * (hgt - pad.t - pad.b);
    cx.fillStyle = "rgba(0,0,0,0.25)";
    tl.pts.forEach((p, k) => {
      if (k && p.env.sun.elev < 0) cx.fillRect(X(tl.pts[k - 1].h), pad.t, X(p.h) - X(tl.pts[k - 1].h) + 0.5, hgt - pad.t - pad.b);
    });
    cx.strokeStyle = "#f08a3a";
    cx.lineWidth = 2;
    cx.beginPath();
    tl.pts.forEach((p, k) => (k ? cx.lineTo(X(p.h), Y(temps[k])) : cx.moveTo(X(p.h), Y(temps[k]))));
    cx.stroke();
    const dMax = tl.pts[tl.pts.length - 1].dose || 1e-6;
    cx.strokeStyle = "#7fd0ff";
    cx.lineWidth = 1.5;
    cx.beginPath();
    tl.pts.forEach((p, k) => {
      const y = pad.t + (1 - p.dose / dMax) * (hgt - pad.t - pad.b);
      k ? cx.lineTo(X(p.h), y) : cx.moveTo(X(p.h), y);
    });
    cx.stroke();
    cx.fillStyle = "#ccc";
    cx.font = "10px sans-serif";
    cx.fillText(`${tMax}°`, 4, pad.t + 8);
    cx.fillText(`${tMin}°`, 4, hgt - pad.b);
    cx.fillText(`${dMax.toFixed(3)}`, w - pad.r + 3, pad.t + 8);
    cx.fillText("mSv", w - pad.r + 3, pad.t + 20);
    cx.fillText("0 h", pad.l, hgt - 3);
    cx.fillText(`${tl.hours.toFixed(1)} h`, w - pad.r - 30, hgt - 3);
    anim.chart = { X, pad, hgt };
  }

  function frameAt(h) {
    const tl = routeState.timeline;
    const pts = tl.pts;
    let k = 0;
    while (k < pts.length - 2 && pts[k + 1].h < h) k++;
    const a = pts[k], b = pts[Math.min(k + 1, pts.length - 1)];
    const f = b.h > a.h ? Math.max(0, Math.min(1, (h - a.h) / (b.h - a.h))) : 0;
    const lat = a.lat + (b.lat - a.lat) * f, lon = a.lon + (b.lon - a.lon) * f;
    const e = f < 0.5 ? a.env : b.env;
    const dose = a.dose + (b.dose - a.dose) * f;
    const tempK = a.env.tempK + (b.env.tempK - a.env.tempK) * f;
    const utc = tl.t0 + h * 3600000;
    const sun = marsSun(marsTime(utc), lat, lon);
    anim.marker.setLatLng([lat, lon]);
    el("anim-slider").value = String(h / tl.hours);
    const dist = a.dist + (b.dist - a.dist) * f;
    if (planner.setWalkCursor) planner.setWalkCursor(dist);
    renderCrewFigure(h, dose, tempK);
    el("anim-read").innerHTML = `<table class="kv small">
      <tr><th>${tr("Elapsed", "Verstrichen")}</th><td><b>${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, "0")} min</b> · ${formatDistance(dist / 1000)}</td></tr>
      <tr><th>${tr("Earth time", "Erdzeit")}</th><td>${fmtUtc(utc)}</td></tr>
      <tr><th>${tr("Mars local time", "Mars-Ortszeit")}</th><td><b>${fmtHours(sun.ltst)}</b> · ${tr("Sun", "Sonne")} ${sun.elev.toFixed(0)}°${sun.elev < 0 ? ` (${tr("night", "Nacht")})` : ""}</td></tr>
      <tr><th>${tr("Ground temperature", "Bodentemperatur")}</th><td><b>${degC(tempK)}</b> <span class="muted">${tr("model ±15 K", "Modell ±15 K")}</span></td></tr>
      <tr><th>${tr("Elevation", "Höhe")}</th><td>${(a.elev ?? b.elev) != null ? `${Math.round(a.elev ?? b.elev)} m` : "–"}</td></tr>
      <tr><th>UV</th><td>${e.uv.total.toFixed(1)} W/m² (UVC ${e.uv.uvc.toFixed(1)})</td></tr>
      <tr><th>${tr("Cosmic dose rate", "Kosmische Dosisleistung")}</th><td>${(e.gcr.mSvDay / 24 * 1000).toFixed(1)} µSv/h${e.gcr.extrapolated ? ` <span class="warn-text">${tr("extrapolated", "extrapoliert")}</span>` : ""}</td></tr>
      <tr><th>${tr("Dose so far (no shielding)", "Dosis bisher (ohne Abschirmung)")}</th><td><b>${(dose * 1000).toFixed(0)} µSv</b></td></tr>
    </table>`;
    const cv = el("anim-cursor");
    if (anim.chart) {
      cv.style.left = `${anim.chart.X(h)}px`;
    }
  }

  // Astronaut status figure: consumables and strain over the walk, green → amber → red.
  function renderCrewFigure(h, doseMSv, tempK) {
    const box = el("anim-crew");
    const cs = window.crewState;
    if (!box || !cs) return;
    const col = (f) => (f < 0.6 ? "#4caf50" : f < 0.85 ? "#e0a92e" : "#e5483b");
    // Base stops on the way reset the counters (refill, toilet, rest inside).
    const since = (key) => {
      let t0 = 0;
      for (const r of cs.refills || []) if (r.h <= h && (!key || r[key])) t0 = r.h;
      return h - t0;
    };
    const o2 = (cs.o2PerH * since("o2")) / cs.o2Cap;
    const water = (cs.waterPerH * since("water")) / Math.max(0.01, cs.waterCap);
    const bladder = (cs.urinePerH * since()) / Math.max(0.01, cs.magCap);
    const fatigue = (cs.kcalPerH * since()) / cs.fatigueKcal;
    const eva = since() / cs.evaH;
    const strain = cs.avgW / SUSTAINED_W;
    const cold = tempK < 273.15 - 80 ? 1 : tempK < 273.15 - 50 ? 0.7 : 0.3;
    const rad = doseMSv / 1.0; // reference 1 mSv per EVA (illustrative scale)
    const pct = (f) => `${Math.round(Math.min(9.99, f) * 100)} %`;
    const bars = [
      [tr("O₂ used", "O₂ verbraucht"), o2],
      [tr("Water used", "Wasser verbraucht"), water],
      [tr("Bladder / garment", "Blase / Windel"), bladder],
      [tr("Exhaustion", "Erschöpfung"), fatigue],
      [tr("Strain (avg power)", "Belastung (Ø Leistung)"), strain],
      [tr("EVA time", "EVA-Zeit"), eva],
      [tr("Radiation (1 mSv ref.)", "Strahlung (Ref. 1 mSv)"), rad],
    ];
    box.innerHTML = `
      <svg viewBox="0 0 60 120" class="crew-fig" aria-label="astronaut status">
        <circle cx="30" cy="14" r="11" fill="${col(o2)}" stroke="#111" stroke-width="1.5"/>
        <rect x="22" y="9" width="16" height="8" rx="3" fill="#1d2633" opacity="0.8"/>
        <rect x="16" y="27" width="28" height="30" rx="6" fill="${col(Math.max(water, strain))}" stroke="#111" stroke-width="1.5"/>
        <rect x="40" y="29" width="10" height="22" rx="3" fill="${col(o2)}" stroke="#111" stroke-width="1"/>
        <rect x="18" y="57" width="24" height="12" rx="4" fill="${col(bladder)}" stroke="#111" stroke-width="1.5"/>
        <rect x="6" y="29" width="9" height="28" rx="4" fill="${col(Math.max(fatigue, cold))}" stroke="#111" stroke-width="1.2"/>
        <rect x="45" y="52" width="9" height="20" rx="4" fill="${col(Math.max(fatigue, cold))}" stroke="#111" stroke-width="1.2"/>
        <rect x="18" y="69" width="11" height="42" rx="4" fill="${col(fatigue)}" stroke="#111" stroke-width="1.5"/>
        <rect x="31" y="69" width="11" height="42" rx="4" fill="${col(fatigue)}" stroke="#111" stroke-width="1.5"/>
      </svg>
      <div class="crew-bars">${bars
        .map(([n, f]) => `<div class="cb"><span>${n}</span><b style="color:${col(f)}">${pct(f)}</b><i><u style="width:${Math.min(100, f * 100)}%;background:${col(f)}"></u></i></div>`)
        .join("")}<div class="small muted">${cs.onFoot ? tr("on foot", "zu Fuß") : tr("riding", "fahrend")} · ${tr("model, see crew check", "Modell, siehe Crew-Check")}</div></div>`;
  }

  function tick(now) {
    if (!anim.playing) return;
    const dtS = Math.min(0.1, (now - anim.last) / 1000);
    anim.last = now;
    anim.h += dtS * parseFloat(el("anim-speed").value); // simulated hours per real second
    const tl = routeState.timeline;
    if (anim.h >= tl.hours) {
      anim.h = tl.hours;
      anim.playing = false;
      el("anim-toggle").textContent = "▶";
    }
    frameAt(anim.h);
    if (anim.playing) anim.raf = requestAnimationFrame(tick);
  }

  function play(on) {
    anim.playing = on;
    el("anim-toggle").textContent = on ? "⏸" : "▶";
    if (on) {
      if (anim.h >= routeState.timeline.hours) anim.h = 0;
      anim.last = performance.now();
      anim.raf = requestAnimationFrame(tick);
    }
  }

  el("rt-play").addEventListener("click", async () => {
    const btn = el("rt-play");
    btn.disabled = true;
    btn.textContent = tr("Computing temperatures and dose …", "Berechne Temperatur und Dosis …");
    busyBar.set("walk", tr("Route walk: computing temperature and dose along the route …", "Routen-Animation: berechne Temperatur und Dosis entlang der Route …"));
    try {
      routeState.timeline = await buildTimeline();
    } catch (err) {
      busyBar.done("walk");
      console.error(err);
      btn.textContent = tr("Environment grids missing – restart app/main.py", "Umwelt-Raster fehlen – app/main.py neu starten");
      btn.disabled = false;
      return;
    }
    busyBar.done("walk");
    btn.disabled = false;
    btn.textContent = tr("▶ Walk the route", "▶ Route abspielen");
    if (window.logisticsHook) window.logisticsHook();
    el("anim-panel").hidden = false;
    if (!anim.marker) {
      anim.marker = L.marker([0, 0], {
        icon: L.divIcon({ className: "anim-walker", html: "<div></div>", iconSize: [18, 18] }),
        interactive: false,
        zIndexOffset: 1000,
      });
    }
    anim.marker.addTo(map);
    drawChart(routeState.timeline);
    anim.h = 0;
    frameAt(0);
    play(true);
  });
  el("anim-toggle").addEventListener("click", () => play(!anim.playing));
  el("anim-slider").addEventListener("input", () => {
    if (!routeState.timeline) return;
    play(false);
    anim.h = parseFloat(el("anim-slider").value) * routeState.timeline.hours;
    frameAt(anim.h);
  });
  el("anim-close").addEventListener("click", () => {
    play(false);
    el("anim-panel").hidden = true;
    if (anim.marker) map.removeLayer(anim.marker);
    if (planner.setWalkCursor) planner.setWalkCursor(null);
  });

  setTime(state.utc, false);
  el("env-tau").value = String(state.tau);
  refreshRouteTime();
  window.routeTimeHook = refreshRouteTime;
  function setLayer(v) {
    setLayerRadio(v);
    state.layer = v;
    if (state.overlay) {
      map.removeLayer(state.overlay);
      state.overlay = null;
    }
    renderLayer();
  }
  return { refreshRouteTime, time: () => state.utc, routeStart, timeline: () => routeState.timeline, setLayer };
}
