// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Marswalk route planner: waypoints, DTM elevation profile, slope classes, route statistics.

const SLOPE_COLORS = { ok: "#4f9d69", caution: "#d0a03a", critical: "#c4473f", nodata: "#8a919c" };
const GRADE_WINDOW_M = 10; // along-track grade is computed over at least this distance

function initRoutePlanner(map, mobility, hooks = {}) {
  const el = (id) => document.getElementById(id);

  const route = {
    drawing: false,
    waypoints: [],
    samples: [],
    token: 0,
    hoverMarker: null,
    walkDist: null,
  };

  const baseLine = L.polyline([], { color: "#ffffff", weight: 2, opacity: 0.9, dashArray: "5 4", interactive: false }).addTo(map);
  const classLayer = L.layerGroup().addTo(map);
  const waypointLayer = L.layerGroup().addTo(map);

  // ---------- Settings ----------

  function settings() {
    const profile = mobility.profile();
    const thr = mobility.thresholds() || computeLimits(profile);
    return { caution: thr.caution, critical: thr.critical, profile, confirmed: !!mobility.thresholds() };
  }

  function slopeClass(slope, s) {
    if (slope == null) return "nodata";
    if (slope >= s.critical) return "critical";
    if (slope >= s.caution) return "caution";
    return "ok";
  }


  // ---------- Waypoints ----------

  function waypointIcon(n) {
    return L.divIcon({ className: "waypoint-marker", html: String(n), iconSize: [20, 20], iconAnchor: [10, 10] });
  }

  function addWaypoint(lat, lon, recompute = true) {
    const marker = L.marker([lat, lon], { icon: waypointIcon(route.waypoints.length + 1), draggable: true, keyboard: false });
    marker.on("drag", updateLine);
    marker.on("dragend", analyze);
    marker.on("click", (e) => {
      L.DomEvent.stop(e);
      const p = marker.getLatLng();
      if (hooks.onWaypointClick) hooks.onWaypointClick(p.lat, p.lng);
    });
    marker.addTo(waypointLayer);
    route.waypoints.push(marker);
    if (!recompute) return;
    updateLine();
    analyze();
  }

  function renumber() {
    route.waypoints.forEach((m, i) => m.setIcon(waypointIcon(i + 1)));
  }

  function updateLine() {
    baseLine.setLatLngs(route.waypoints.map((m) => m.getLatLng()));
    if (hooks.onWaypointsChanged) hooks.onWaypointsChanged(route.waypoints.map((m) => [m.getLatLng().lat, m.getLatLng().lng]));
  }

  function setDrawing(on) {
    route.drawing = on;
    el("route-draw").classList.toggle("active", on);
    el("route-draw").textContent = on ? "Stop drawing" : "Draw route";
    map.getContainer().classList.toggle("drawing", on);
  }

  el("route-draw").addEventListener("click", () => {
    if (hooks.onRouteActivity) hooks.onRouteActivity();
    if (window.zones && window.zones.stopDrawing) window.zones.stopDrawing();
    if (!route.drawing && !mobility.thresholds()) {
      document.getElementById("mob-open").click(); // confirm the mobility profile first
      return;
    }
    setDrawing(!route.drawing);
  });
  el("route-undo").addEventListener("click", () => {
    const m = route.waypoints.pop();
    if (m) waypointLayer.removeLayer(m);
    updateLine();
    analyze();
  });
  el("route-clear").addEventListener("click", () => {
    waypointLayer.clearLayers();
    route.waypoints = [];
    updateLine();
    analyze();
  });
  el("route-reverse").addEventListener("click", () => {
    route.waypoints.reverse();
    renumber();
    updateLine();
    analyze();
  });

  map.on("click", (e) => {
    if (route.drawing) addWaypoint(e.latlng.lat, e.latlng.lng);
  });

  // ---------- Sampling ----------

  function buildSamples() {
    const pts = route.waypoints.map((m) => m.getLatLng());
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += greatCircleKm(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng) * 1000;
    const step = Math.min(50, Math.max(2, total / 600));

    const samples = [];
    let dist = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const leg = greatCircleKm(a.lat, a.lng, b.lat, b.lng) * 1000;
      const n = Math.max(1, Math.ceil(leg / step));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) {
        const f = k / n;
        samples.push({
          lat: a.lat + (b.lat - a.lat) * f,
          lon: a.lng + (b.lng - a.lng) * f,
          dist: dist + leg * f,
          waypoint: k === 0 ? 0 : k === n ? i : null,
        });
      }
      dist += leg;
    }
    return { samples, total, step };
  }

  async function analyze() {
    const token = ++route.token;
    if (route.waypoints.length < 2) {
      route.samples = [];
      route.walkDist = null;
      busyBar.done("route");
      render();
      // Route removed: clear the danger title, crew check and start/arrival times too.
      if (window.routeTimeHook) window.routeTimeHook();
      if (window.logisticsHook) window.logisticsHook();
      return;
    }
    const { samples, total, step } = buildSamples();
    route.samples = samples;
    route.total = total;
    route.step = step;
    el("route-msg").textContent = t("Asking the USGS catalog for HiRISE and CTX elevation models …");
    busyBar.set("route", t("Asking the USGS catalog for HiRISE and CTX elevation models …"), 3);
    render();
    try {
      await analyzeLoad(token, samples);
    } finally {
      // Done when this is still the newest run (a newer run reports itself).
      if (token === route.token) busyBar.done("route");
    }
  }

  async function analyzeLoad(token, samples) {
    // Fetch the best elevation models for this route from the cloud catalog (cached per area).
    const lats = samples.map((p) => p.lat), lons = samples.map((p) => p.lon);
    await ensureDemsFor([Math.min(...lons) - 0.01, Math.min(...lats) - 0.01, Math.max(...lons) + 0.01, Math.max(...lats) + 0.01]);
    if (token !== route.token) return;
    el("route-msg").textContent = t("Loading elevation data …");
    busyBar.set("route", t("Loading elevation data along the route …"), 10);

    const [results, ir] = await Promise.all([
      sampleElevation(samples, (f) => token === route.token && busyBar.set("route", t("Loading elevation data along the route …"), 10 + 88 * f)),
      classifyNightIr(samples).catch((err) => {
        console.warn("Night IR classification failed:", err);
        return null;
      }),
    ]);
    if (token !== route.token) return; // a newer edit superseded this run
    samples.forEach((s, i) => Object.assign(s, results[i] || { elev: null, slope: null }, { ir: ir ? ir.values[i] : null }));
    route.irRef = ir ? { low: ir.low, high: ir.high } : null;
    el("route-msg").textContent = sampleElevation.lastError && results.every((r) => !r)
      ? "DTM could not be loaded (see console)."
      : "";
    render();
  }

  // ---------- Statistics ----------

  function computeStats(s) {
    const smp = route.samples;
    const valid = smp.filter((p) => p.elev != null);
    const withSlope = smp.filter((p) => p.slope != null);
    let ascent = 0;
    let descent = 0;
    for (let i = 1; i < smp.length; i++) {
      if (smp[i].elev == null || smp[i - 1].elev == null) continue;
      const d = smp[i].elev - smp[i - 1].elev;
      if (d > 0) ascent += d;
      else descent -= d;
    }
    // Along-track grade over >= GRADE_WINDOW_M.
    const k = Math.max(1, Math.ceil(GRADE_WINDOW_M / (route.step || GRADE_WINDOW_M)));
    let maxGrade = null;
    for (let i = k; i < smp.length; i++) {
      const a = smp[i - k];
      const b = smp[i];
      if (a.elev == null || b.elev == null) continue;
      const g = (Math.atan(Math.abs(b.elev - a.elev) / (b.dist - a.dist)) * 180) / Math.PI;
      if (maxGrade == null || g > maxGrade) maxGrade = g;
    }
    const count = (cls) => withSlope.filter((p) => slopeClass(p.slope, s) === cls).length;

    // Signed along-track grade per sample -> achievable speed, time and energy (mobility model).
    const prof = s.profile;
    let hours = 0;
    let energyWh = 0;
    let slowDist = 0;
    for (let i = 1; i < smp.length; i++) {
      const ds = smp[i].dist - smp[i - 1].dist;
      const a = smp[Math.max(0, i - k)];
      const b = smp[i];
      let grade = 0;
      if (a.elev != null && b.elev != null && b.dist > a.dist) {
        grade = (Math.atan((b.elev - a.elev) / (b.dist - a.dist)) * 180) / Math.PI;
      }
      const v = Math.max(0.05, achievableSpeed(prof, grade));
      if (v < prof.speed - 1e-6) slowDist += ds;
      const dt = ds / 1000 / v;
      hours += dt;
      energyWh += requiredPower(prof, grade, v) * dt;
      smp[i].speed = v;
    }
    return {
      length: route.total || 0,
      coverage: smp.length ? valid.length / smp.length : 0,
      elevMin: valid.length ? Math.min(...valid.map((p) => p.elev)) : null,
      elevMax: valid.length ? Math.max(...valid.map((p) => p.elev)) : null,
      ascent,
      descent,
      slopeMax: withSlope.length ? Math.max(...withSlope.map((p) => p.slope)) : null,
      slopeMean: withSlope.length ? withSlope.reduce((t, p) => t + p.slope, 0) / withSlope.length : null,
      maxGrade,
      shareCaution: withSlope.length ? count("caution") / withSlope.length : 0,
      shareCritical: withSlope.length ? count("critical") / withSlope.length : 0,
      slopeBase: withSlope[0]?.slopeBase ?? null,
      dems: [...new Set(valid.map((p) => p.demId))],
      hours,
      energyWh,
      slowShare: route.total ? slowDist / route.total : 0,
      warnings: findWarnings(s),
      irLowShare: shareOf((p) => p.ir?.cls === "low", (p) => p.ir),
      irHighShare: shareOf((p) => p.ir?.cls === "high", (p) => p.ir),
      irLowRuns: findRuns((p) => p.ir?.cls === "low"),
      crew: crewCheck(s),
    };
  }

  function shareOf(match, has) {
    const pts = route.samples.filter(has);
    return pts.length ? pts.filter(match).length / pts.length : null;
  }

  // Human vs. machine: stretches steeper than suited walking allows (NASA xEVA 20°) that a vehicle could still drive.
  function crewCheck(s) {
    const machine = machineCriticalSlope(s.profile);
    const onFoot = isOnFoot(s.profile);
    const human = onFoot ? Math.min(HUMAN_SUIT_SLOPE, s.critical) : HUMAN_SUIT_SLOPE;
    const runs = findRuns((p) => p.slope != null && p.slope >= human && p.slope < machine);
    const start = route.samples[0];
    const farthest = start ? Math.max(...route.samples.map((p) => greatCircleKm(start.lat, start.lon, p.lat, p.lon))) : 0;
    return { onFoot, farthest, human, machine, runs, both: findRuns((p) => p.slope != null && p.slope >= Math.max(human, machine)) };
  }

  function renderCrew(c, loaded) {
    const box = el("route-crew");
    box.innerHTML = "";
    if (!loaded) return;
    if (c.onFoot && c.farthest > EVA_WALK_RADIUS_KM) {
      const far = document.createElement("div");
      far.className = "warn crew-lead";
      far.textContent = t("On foot, the route goes {d} km from the start – beyond the {r} km walking radius of the NASA xEVA concept.", { d: c.farthest.toFixed(1), r: EVA_WALK_RADIUS_KM });
      box.appendChild(far);
    }
    if (!c.runs.length && !c.both.length) {
      box.insertAdjacentHTML("beforeend", `<div class="ok-note">${t("Walkable in a suit: no slope at or above {h}°.", { h: c.human.toFixed(0) })}</div>`);
      return;
    }
    const lead = document.createElement("div");
    lead.className = "warn crew-lead";
    if (c.runs.length) {
      lead.textContent = c.onFoot
        ? t("Too steep on foot, but possible for a vehicle (critical {m}°): use a rover for these stretches.", { m: c.machine.toFixed(0) })
        : t("Dangerous for crew on foot: if they must leave or walk back from the vehicle here, the slope exceeds {h}°. The vehicle itself can drive it (critical {m}°).", { h: c.human.toFixed(0), m: c.machine.toFixed(0) });
    } else {
      lead.textContent = t("Too steep for crew on foot and for the vehicle.");
    }
    box.appendChild(lead);
    renderRunList(box, [...c.runs, ...c.both].sort((a, b) => a.from - b.from), "", true);
  }

  // Contiguous stretches where a predicate holds.
  function findRuns(match) {
    const out = [];
    let run = null;
    for (const p of route.samples) {
      if (match(p)) {
        if (!run) run = { from: p.dist, to: p.dist, lat: p.lat, lon: p.lon };
        run.to = p.dist;
      } else if (run) {
        out.push(run);
        run = null;
      }
    }
    if (run) out.push(run);
    return out;
  }

  // Contiguous stretches at or above the critical slope.
  function findWarnings(s) {
    const out = [];
    let run = null;
    for (const p of route.samples) {
      const crit = p.slope != null && p.slope >= s.critical;
      if (crit) {
        if (!run) run = { from: p.dist, to: p.dist, max: p.slope, lat: p.lat, lon: p.lon };
        run.to = p.dist;
        if (p.slope > run.max) Object.assign(run, { max: p.slope, lat: p.lat, lon: p.lon });
      } else if (run) {
        out.push(run);
        run = null;
      }
    }
    if (run) out.push(run);
    return out;
  }

  // ---------- Rendering ----------

  function fmtM(v, digits = 0) {
    return v == null ? "–" : `${v.toFixed(digits)} m`;
  }

  function fmtDeg(v) {
    return v == null ? "–" : `${v.toFixed(1)}°`;
  }

  function fmtPct(v) {
    return `${Math.round(v * 100)} %`;
  }

  function fmtDuration(h) {
    const total = Math.round(h * 60);
    return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")} min`;
  }

  function render() {
    const s = settings();
    const has = route.waypoints.length >= 2;
    el("route-empty").hidden = has;
    el("route-stats").hidden = !has;
    el("profile-panel").hidden = !has;
    map.invalidateSize();
    drawClassSegments(s);
    if (!has) {
      route.lastHours = null;
      if (hooks.onStats) hooks.onStats();
      return;
    }

    const st = computeStats(s);
    const loaded = route.samples.some((p) => "elev" in p);
    route.lastHours = loaded ? st.hours : null;
    if (hooks.onStats) hooks.onStats();
    const v = (x) => (loaded ? x : "…");
    el("rs-length").textContent = formatDistance(st.length / 1000);
    el("rs-waypoints").textContent = route.waypoints.length;
    el("rs-coverage").textContent = v(fmtPct(st.coverage));
    el("rs-elev").textContent = v(`${fmtM(st.elevMin)} … ${fmtM(st.elevMax)}`);
    el("rs-updown").textContent = v(`+${Math.round(st.ascent)} m / ${Math.round(st.descent) ? "−" + Math.round(st.descent) : "0"} m`);
    el("rs-grade").textContent = v(fmtDeg(st.maxGrade));
    el("rs-slope").textContent = v(`${fmtDeg(st.slopeMax)} (Ø ${fmtDeg(st.slopeMean)})`);
    el("rs-slope-max").textContent = v(fmtDeg(st.slopeMax));
    el("rs-classes").textContent = v(`${fmtPct(st.shareCaution)} / ${fmtPct(st.shareCritical)}`);
    el("rs-time").textContent = v(fmtDuration(st.hours));
    el("rs-energy").textContent = v(`${(st.energyWh / 1000).toFixed(2)} kWh`);
    el("rs-slow").textContent = v(fmtPct(st.slowShare));
    el("rs-threshold").textContent = `${s.caution.toFixed(1)}° / ${s.critical.toFixed(1)}°${s.confirmed ? "" : ` (${t("unconfirmed")})`}`;
    renderWarnings(st.warnings, loaded);
    renderDataQuality(loaded);
    el("rs-ir").textContent = loaded
      ? st.irLowShare == null
        ? "no THEMIS coverage"
        : `${fmtPct(st.irLowShare)} / ${fmtPct(st.irHighShare)}`
      : "…";
    renderCrew(st.crew, loaded);
    renderRunList(el("route-ir-runs"), loaded ? st.irLowRuns : null, "No stretches with very low thermal inertia.");
    el("rs-base").textContent = st.slopeBase ? t("Slope baseline ≈ {b} m, elevation bilinear from DTM cells of {c} m", { b: st.slopeBase.toFixed(0), c: (st.slopeBase / 2).toFixed(1) }) : "";
    el("rs-dems").innerHTML = st.dems
      .map((id) => demLink(id))
      .join("<br>") || "–";
    drawProfile(s);
  }

  function renderRunList(box, runs, emptyText, append = false) {
    if (!append) box.innerHTML = "";
    if (!runs) return;
    if (!runs.length) {
      box.innerHTML = `<div class="ok-note">${emptyText}</div>`;
      return;
    }
    for (const r of runs) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "warning-item soft";
      const len = r.to - r.from;
      item.textContent = `${formatDistance(r.from / 1000)}–${formatDistance(r.to / 1000)} (${len < 1 ? t("single point") : formatDistance(len / 1000)})`;
      item.title = "Show on map";
      item.addEventListener("click", () => map.setView([r.lat, r.lon], Math.max(map.getZoom(), 15)));
      box.appendChild(item);
    }
  }

  // Which elevation data each part of the route rests on; MOLA-only parts are not safety-checked.
  function renderDataQuality(loaded) {
    const box = el("route-dataq");
    box.innerHTML = "";
    if (!loaded) return;
    const n = route.samples.length;
    const share = (k) => route.samples.filter((p) => p.kind === k).length / n;
    const none = route.samples.filter((p) => p.elev == null).length / n;
    const parts = ["hirise", "ctx", "mola"].filter((k) => share(k) > 0).map((k) => `${DEM_LABEL[k]} ${fmtPct(share(k))}`);
    if (none > 0) parts.push(`${t("no data")} ${fmtPct(none)}`);
    box.innerHTML = `<div class="small muted">${t("Elevation data along the route")}: ${parts.join(" · ")}</div>`;
    const crossed = window.zonesCrossed ? window.zonesCrossed(route.samples) : [];
    if (crossed.length) {
      box.insertAdjacentHTML("beforeend", `<div class="warn">${t("The route crosses zones marked “avoid”: {z}", { z: crossed.map((n) => `„${n}“`).join(", ") })}</div>`);
    }
    if (share("mola") > 0) {
      box.insertAdjacentHTML("beforeend", `<div class="warn">${t("{p} of the route only has the global MOLA DEM (463 m): slopes there are smoothed and NOT safety-checked.", { p: fmtPct(share("mola")) })}</div>`);
    }
  }

  function renderWarnings(warnings, loaded) {
    const box = el("route-warnings");
    box.innerHTML = "";
    if (!loaded) return;
    if (!warnings.length) {
      box.innerHTML = `<div class="ok-note">No sections above the critical slope.</div>`;
      return;
    }
    for (const w of warnings) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "warning-item";
      const len = w.to - w.from;
      item.textContent = `${formatDistance(w.from / 1000)}–${formatDistance(w.to / 1000)}: ${t("up to")} ${w.max.toFixed(1)}° (${len < 1 ? t("single point") : formatDistance(len / 1000)})`;
      item.title = "Show on map";
      item.addEventListener("click", () => map.setView([w.lat, w.lon], Math.max(map.getZoom(), 16)));
      const row = document.createElement("div");
      row.className = "warning-row";
      row.appendChild(item);
      if (hooks.open3D) {
        const b3 = document.createElement("button");
        b3.type = "button";
        b3.className = "btn-3d";
        b3.textContent = "3D";
        b3.title = t("Show this section in 3D");
        b3.addEventListener("click", () => open3D({ lat: w.lat, lon: w.lon, dist: w.from }, w));
        row.appendChild(b3);
      }
      box.appendChild(row);
    }
  }

  function drawClassSegments(s) {
    classLayer.clearLayers();
    const smp = route.samples;
    if (smp.length < 2 || !("elev" in smp[0])) return;
    let run = [smp[0]];
    let cls = slopeClass(smp[0].slope, s);
    const flush = () => {
      if (run.length < 2) return;
      const hot = cls === "critical" && hooks.open3D;
      const line = L.polyline(run.map((p) => [p.lat, p.lon]), {
        color: SLOPE_COLORS[cls],
        weight: hot ? 7 : 5,
        opacity: 0.9,
        interactive: !!hot,
        bubblingMouseEvents: false,
      }).addTo(classLayer);
      if (hot) {
        line.bindTooltip(t("Click for 3D view"), { sticky: true });
        line.on("click", (e) => inspect3D(e.latlng.lat, e.latlng.lng));
      }
    };
    for (let i = 1; i < smp.length; i++) {
      const c = slopeClass(smp[i].slope, s);
      run.push(smp[i]);
      if (c !== cls) {
        flush();
        run = [smp[i]];
        cls = c;
      }
    }
    flush();
    // Clickable red markers at the steepest point of every critical section (single points are too short to hit).
    if (hooks.open3D) {
      for (const w of findWarnings(s)) {
        L.circleMarker([w.lat, w.lon], { radius: 7, color: "#fff", weight: 2, fillColor: SLOPE_COLORS.critical, fillOpacity: 0.95, bubblingMouseEvents: false })
          .bindTooltip(t("{m}° – click for 3D view", { m: w.max.toFixed(1) }), { direction: "top" })
          .on("click", () => open3D({ lat: w.lat, lon: w.lon, dist: w.from }, w))
          .addTo(classLayer);
      }
    }
  }

  // 3D view at any map position: centred on the critical section nearby, if there is one.
  function inspect3D(lat, lon, opts = {}) {
    if (!hooks.open3D) return;
    const near = (a) => greatCircleKm(a.lat, a.lon, lat, lon) * 1000;
    let nearest = null;
    for (const p of route.samples) if (p.elev != null && (!nearest || near(p) < near(nearest))) nearest = p;
    const onRoute = nearest && near(nearest) < 25;
    const run = onRoute ? findWarnings(settings()).find((w) => nearest.dist >= w.from - 10 && nearest.dist <= w.to + 10) : null;
    if (run && !opts.title) return open3D({ lat: run.lat, lon: run.lon, dist: run.from }, run);
    hooks.open3D({
      lat,
      lon,
      route: route.samples.map((q) => [q.lat, q.lon]),
      focusRadius: opts.focusRadius || 0,
      title: opts.title || (onRoute ? t("Route at {d}", { d: formatDistance(nearest.dist / 1000) }) : t("3D view")),
    });
  }

  // ---------- Elevation profile ----------

  const canvas = el("profile-canvas");
  const PAD = { l: 58, r: 14, t: 12, b: 26 };

  function profileGeometry() {
    const smp = route.samples.filter((p) => p.elev != null);
    if (!smp.length) return null;
    let zMin = Math.min(...smp.map((p) => p.elev));
    let zMax = Math.max(...smp.map((p) => p.elev));
    const pad = Math.max(2, (zMax - zMin) * 0.1);
    zMin -= pad;
    zMax += pad;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    return {
      W,
      H,
      zMin,
      zMax,
      x: (d) => PAD.l + (d / route.total) * (W - PAD.l - PAD.r),
      y: (z) => PAD.t + (1 - (z - zMin) / (zMax - zMin)) * (H - PAD.t - PAD.b),
      d: (px) => ((px - PAD.l) / (W - PAD.l - PAD.r)) * route.total,
    };
  }

  function drawProfile(s, hoverIdx = null) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    const g = profileGeometry();
    ctx.font = "11px Consolas, monospace";
    ctx.fillStyle = "#8a919c";
    if (!g) {
      ctx.fillText(route.samples.some((p) => "elev" in p) ? t("No DTM coverage along the route.") : t("Loading elevation data …"), PAD.l, 30);
      return;
    }

    // Grid + axes labels
    ctx.strokeStyle = "#2b2f36";
    ctx.lineWidth = 1;
    const zTicks = niceTicks(g.zMin, g.zMax, 4);
    for (const z of zTicks) {
      const y = g.y(z);
      ctx.beginPath();
      ctx.moveTo(PAD.l, y);
      ctx.lineTo(g.W - PAD.r, y);
      ctx.stroke();
      ctx.fillText(`${z.toFixed(0)} m`, 4, y + 4);
    }
    for (const d of niceTicks(0, route.total, 6)) {
      const x = g.x(d);
      ctx.fillText(formatDistance(d / 1000), x - 12, g.H - 8);
    }

    // Waypoint markers
    ctx.strokeStyle = "#555b65";
    ctx.setLineDash([3, 3]);
    route.samples.filter((p) => p.waypoint != null).forEach((p) => {
      const x = g.x(p.dist);
      ctx.beginPath();
      ctx.moveTo(x, PAD.t);
      ctx.lineTo(x, g.H - PAD.b);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Profile line coloured by slope class
    ctx.lineWidth = 2;
    const smp = route.samples;
    for (let i = 1; i < smp.length; i++) {
      const a = smp[i - 1];
      const b = smp[i];
      if (a.elev == null || b.elev == null) continue;
      ctx.strokeStyle = SLOPE_COLORS[slopeClass(b.slope, s)];
      ctx.beginPath();
      ctx.moveTo(g.x(a.dist), g.y(a.elev));
      ctx.lineTo(g.x(b.dist), g.y(b.elev));
      ctx.stroke();
    }

    // Night-IR strip under the plot: brown = low thermal inertia, light blue = high.
    for (let i = 1; i < smp.length; i++) {
      const cls = smp[i].ir?.cls;
      if (cls !== "low" && cls !== "high") continue;
      ctx.fillStyle = cls === "low" ? "#a0703c" : "#8fc1dc";
      const x0 = g.x(smp[i - 1].dist);
      ctx.fillRect(x0, g.H - PAD.b + 1, Math.max(1, g.x(smp[i].dist) - x0), 4);
    }

    if (route.walkDist != null) {
      // Position of the animated walker (route walk), interpolated along the profile.
      let k = 1;
      while (k < smp.length - 1 && smp[k].dist < route.walkDist) k++;
      const a = smp[k - 1], b = smp[k];
      if (a && b && a.elev != null && b.elev != null) {
        const f = b.dist > a.dist ? Math.min(1, Math.max(0, (route.walkDist - a.dist) / (b.dist - a.dist))) : 0;
        const x = g.x(route.walkDist), y = g.y(a.elev + (b.elev - a.elev) * f);
        ctx.strokeStyle = "#ffd23f";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, PAD.t);
        ctx.lineTo(x, g.H - PAD.b);
        ctx.stroke();
        ctx.fillStyle = "#ffd23f";
        ctx.strokeStyle = "#222";
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    if (hoverIdx != null && smp[hoverIdx]?.elev != null) {
      const p = smp[hoverIdx];
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g.x(p.dist), PAD.t);
      ctx.lineTo(g.x(p.dist), g.H - PAD.b);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(g.x(p.dist), g.y(p.elev), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function niceTicks(min, max, count) {
    const span = max - min;
    if (span <= 0) return [min];
    const step = niceNumber(span / count);
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(v);
    return ticks;
  }

  canvas.addEventListener("mousemove", (e) => {
    const g = profileGeometry();
    if (!g) return;
    const d = g.d(e.offsetX);
    let best = 0;
    route.samples.forEach((p, i) => {
      if (Math.abs(p.dist - d) < Math.abs(route.samples[best].dist - d)) best = i;
    });
    const p = route.samples[best];
    drawProfile(settings(), best);
    el("profile-readout").textContent =
      p.elev == null
        ? `${formatDistance(p.dist / 1000)} · ${t("no DTM data")}`
        : `${formatDistance(p.dist / 1000)} · ${p.elev.toFixed(1)} m · ${t("slope")} ${fmtDeg(p.slope)}${p.speed != null ? ` · ${p.speed.toFixed(1)} km/h` : ""}${p.ir ? ` · ${t("night IR")} ${p.ir.value} (${t(p.ir.cls)})` : ""}`;
    if (!route.hoverMarker) {
      route.hoverMarker = L.circleMarker([p.lat, p.lon], { radius: 6, color: "#fff", weight: 2, fillOpacity: 0, interactive: false }).addTo(map);
    } else {
      route.hoverMarker.setLatLng([p.lat, p.lon]);
    }
  });

  // Click on the profile: 3D view of that spot; on a critical (red) stretch centred on its steepest point.
  canvas.addEventListener("click", (e) => {
    const g = profileGeometry();
    if (!g || !hooks.open3D) return;
    const d = g.d(e.offsetX);
    let best = 0;
    route.samples.forEach((p, i) => {
      if (Math.abs(p.dist - d) < Math.abs(route.samples[best].dist - d)) best = i;
    });
    const p = route.samples[best];
    if (p.elev == null) return;
    const tol = Math.max(5, route.step || 5);
    const run = findWarnings(settings()).find((w) => d >= w.from - tol && d <= w.to + tol);
    open3D(run ? { lat: run.lat, lon: run.lon, dist: p.dist } : p, run);
  });

  function open3D(p, run) {
    hooks.open3D({
      lat: p.lat,
      lon: p.lon,
      route: route.samples.map((q) => [q.lat, q.lon]),
      focusRadius: run ? Math.max(12, (run.to - run.from) / 2 + 10) : 0,
      title: run
        ? t("Critical section {a}–{b}: up to {m}°", { a: formatDistance(run.from / 1000), b: formatDistance(run.to / 1000), m: run.max.toFixed(1) })
        : t("Route at {d}", { d: formatDistance(p.dist / 1000) }),
    });
  }

  canvas.addEventListener("mouseleave", () => {
    if (route.hoverMarker) map.removeLayer(route.hoverMarker);
    route.hoverMarker = null;
    el("profile-readout").textContent = "";
    drawProfile(settings());
  });

  window.addEventListener("resize", () => route.waypoints.length >= 2 && drawProfile(settings()));

  // ---------- Export / import ----------

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function stamp() {
    return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  }

  function exportGeoJSON() {
    const s = settings();
    const st = computeStats(s);
    const wps = route.waypoints.map((m) => m.getLatLng());
    const at = (lat, lon) => route.samples.find((p) => Math.abs(p.lat - lat) < 1e-9 && Math.abs(p.lon - lon) < 1e-9);
    const geojson = {
      type: "FeatureCollection",
      properties: {
        generator: "MARS Pathfinder",
        crs: "Mars 2000 sphere, planetocentric latitude, east longitude (degrees)",
        created: new Date().toISOString(),
        mobilityProfile: s.profile,
        thresholdsDeg: { caution: s.caution, critical: s.critical, source: mobility.thresholds()?.mode || "unconfirmed" },
        stats: { ...st, warnings: undefined },
        dataSources: {
          elevation: "USGS Astrogeology HiRISE DTMs (mro_hirise_socet_dtms)",
          dtms: st.dems,
        },
      },
      features: [
        {
          type: "Feature",
          properties: { kind: "route", length_m: st.length },
          geometry: { type: "LineString", coordinates: wps.map((p) => [p.lng, p.lat]) },
        },
        ...wps.map((p, i) => {
          const smp = at(p.lat, p.lng);
          return {
            type: "Feature",
            properties: { kind: "waypoint", index: i + 1, elev_m: smp?.elev ?? null, slope_deg: smp?.slope ?? null },
            geometry: { type: "Point", coordinates: [p.lng, p.lat] },
          };
        }),
        ...st.warnings.map((w) => ({
          type: "Feature",
          properties: { kind: "critical_section", from_m: w.from, to_m: w.to, max_slope_deg: w.max },
          geometry: { type: "Point", coordinates: [w.lon, w.lat] },
        })),
      ],
    };
    download(`marswalk_${stamp()}.geojson`, JSON.stringify(geojson, null, 2), "application/geo+json");
  }

  function exportCSV() {
    const s = settings();
    const rows = [["dist_m", "lat", "lon_east", "elev_m", "slope_deg", "class", "speed_kmh", "night_ir_dn", "night_ir_class", "dtm"]];
    for (const p of route.samples) {
      rows.push([
        p.dist.toFixed(1),
        p.lat.toFixed(7),
        lonTo360(p.lon).toFixed(7),
        p.elev == null ? "" : p.elev.toFixed(2),
        p.slope == null ? "" : p.slope.toFixed(2),
        slopeClass(p.slope, s),
        p.speed == null ? "" : p.speed.toFixed(2),
        p.ir ? p.ir.value : "",
        p.ir ? p.ir.cls : "",
        p.demId || "",
      ]);
    }
    download(`marswalk_profile_${stamp()}.csv`, rows.map((r) => r.join(",")).join("\n"), "text/csv");
  }

  function importGeoJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const gj = JSON.parse(reader.result);
        const line = (gj.features || [gj]).find((f) => f.geometry && f.geometry.type === "LineString");
        if (!line) throw new Error("No LineString route found");
        loadWaypoints(line.geometry.coordinates.map(([lon, lat]) => [lat, normalizeLon180(lon)]));
        el("route-msg").textContent = "";
      } catch (err) {
        el("route-msg").textContent = t("Import failed: {msg}", { msg: err.message });
      }
    };
    reader.readAsText(file);
  }

  el("export-geojson").addEventListener("click", exportGeoJSON);
  el("export-csv").addEventListener("click", exportCSV);
  el("export-report").addEventListener("click", () => openReport());
  function loadWaypoints(latlngs) {
    waypointLayer.clearLayers();
    route.waypoints = [];
    for (const [lat, lon] of latlngs) addWaypoint(lat, lon, false);
    updateLine();
    analyze();
    map.fitBounds(baseLine.getBounds(), { padding: [60, 60], maxZoom: 16 });
  }

  el("import-route").addEventListener("change", (e) => {
    if (e.target.files[0]) importGeoJSON(e.target.files[0]);
    e.target.value = "";
  });

  // ---------- Mission report (printable) ----------

  function envSection() {
    const env = hooks.environmentSummary ? hooks.environmentSummary() : null;
    if (!env || (!env.weather && !env.dose)) return "";
    const w = env.weather;
    const d = env.dose;
    const fmtC = (v) => (v == null ? "–" : `${Math.round(v)} °C`);
    return `<h2>Environment</h2><table>
      ${w ? `<tr><th>Latest weather (${w.station}, sol ${w.sol}, ${w.date})</th><td>air ${fmtC(w.airMin)} / ${fmtC(w.airMax)}, ground ${fmtC(w.groundMin)} / ${fmtC(w.groundMax)}, ${w.pressure == null ? "–" : Math.round(w.pressure) + " Pa"}, UV ${w.uv || "–"}</td></tr>` : ""}
      ${d ? `<tr><th>EVA radiation dose (${d.hours.toFixed(1)} h)</th><td>${d.value.toFixed(3)} mSv (${d.low.toFixed(3)}–${d.high.toFixed(3)}), from ${d.rate.value} ± ${d.rate.sigma} mSv/day (MSL RAD, Hassler et al. 2014); no suit shielding, no solar particle events</td></tr>` : ""}
    </table>`;
  }

  async function openReport() {
    const w = window.open("", "_blank");
    if (!w) {
      el("route-msg").textContent = "Pop-up blocked – please allow pop-ups for this page.";
      return;
    }
    w.document.write("<p style='font-family:sans-serif'>Creating report …</p>");
    const geoUnits = hooks.geologyAt
      ? await Promise.all(route.waypoints.map((m) => hooks.geologyAt(m.getLatLng().lat, m.getLatLng().lng).catch(() => null)))
      : [];
    const s = settings();
    const st = computeStats(s);
    const thr = mobility.thresholds();
    const p = s.profile;
    const wps = route.waypoints.map((m) => m.getLatLng());
    const profileImg = canvas.toDataURL("image/png");
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    const wpRows = wps
      .map((w, i) => {
        const smp = route.samples.find((q) => Math.abs(q.lat - w.lat) < 1e-9 && Math.abs(q.lon - w.lng) < 1e-9);
        const g = geoUnits[i];
        return `<tr><td>${i + 1}</td><td>${formatLat(w.lat, 5)}</td><td>${formatLonEast(w.lng, 5)}</td>
          <td>${smp?.elev != null ? smp.elev.toFixed(1) + " m" : "–"}</td><td>${smp?.slope != null ? smp.slope.toFixed(1) + "°" : "–"}</td>
          <td>${g ? esc(g.symbol) + " – " + esc(g.name) : "–"}</td></tr>`;
      })
      .join("");
    const warnRows = st.warnings.length
      ? st.warnings
          .map((w) => `<li>${formatDistance(w.from / 1000)} – ${formatDistance(w.to / 1000)}: slope up to ${w.max.toFixed(1)}° (${formatLat(w.lat, 5)}, ${formatLonEast(w.lon, 5)})</li>`)
          .join("")
      : "<li>No sections above the critical slope.</li>";

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Marswalk report</title>
<style>
  body { font: 12px/1.5 "Segoe UI", system-ui, sans-serif; color: #111; max-width: 820px; margin: 24px auto; padding: 0 16px; }
  h1 { font-size: 20px; margin: 0; } h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin-top: 22px; }
  table { border-collapse: collapse; width: 100%; } td, th { text-align: left; padding: 3px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
  th { color: #555; font-weight: normal; width: 45%; } .mono { font-family: Consolas, monospace; }
  .tag { display: inline-block; border: 1px solid; padding: 0 5px; font-size: 10px; text-transform: uppercase; }
  .m { color: #2e7d4a; } .d { color: #2f5f9e; } .i { color: #9a6b12; }
  img { width: 100%; background: #1c1f24; } .muted { color: #666; } @media print { .noprint { display: none; } }
</style></head><body>
<button class="noprint" onclick="print()">Print / save as PDF</button>
<h1>Marswalk report – MARS Pathfinder</h1>
<div class="muted">Created ${new Date().toLocaleString("en-GB")} · planetocentric coordinates, east longitude, Mars 2000 sphere</div>

<h2>Mobility profile</h2>
<table>
  <tr><th>Profile</th><td>${esc(p.name)}</td></tr>
  <tr><th>Mass / power</th><td>${p.mass} kg / ${p.power} W</td></tr>
  <tr><th>Cruise / minimum speed</th><td>${p.speed} / ${p.minSpeed} km/h</td></tr>
  <tr><th>Rolling resistance / friction angle / tip-over angle</th><td>${p.crr} / ${p.friction}° / ${p.tipAngle ? p.tipAngle + "°" : "–"}</td></tr>
  <tr><th>Slope limit caution / critical</th><td>${s.caution.toFixed(1)}° / ${s.critical.toFixed(1)}° <span class="tag ${thr?.mode === "manual" ? "i" : "d"}">${thr?.mode || "unconfirmed"}</span></td></tr>
  <tr><th>Gravity</th><td>${MARS_G} m/s² (NASA NSSDCA Mars Fact Sheet)</td></tr>
</table>

<h2>Route</h2>
<table>
  <tr><th>Length</th><td>${formatDistance(st.length / 1000)}</td></tr>
  <tr><th>Elevation min … max</th><td>${st.elevMin?.toFixed(0)} m … ${st.elevMax?.toFixed(0)} m</td></tr>
  <tr><th>Ascent / descent</th><td>+${Math.round(st.ascent)} m / −${Math.round(st.descent) || 0} m</td></tr>
  <tr><th>Max. grade along route / max. terrain slope</th><td>${st.maxGrade?.toFixed(1)}° / ${st.slopeMax?.toFixed(1)}°</td></tr>
  <tr><th>Share caution / critical</th><td>${Math.round(st.shareCaution * 100)} % / ${Math.round(st.shareCritical * 100)} %</td></tr>
  <tr><th>Travel time, energy (model)</th><td>${(st.hours).toFixed(2)} h, ${(st.energyWh / 1000).toFixed(2)} kWh mechanical</td></tr>
  <tr><th>DTM coverage</th><td>${Math.round(st.coverage * 100)} %</td></tr>
  <tr><th>Night IR low / high share (relative)</th><td>${st.irLowShare == null ? "no THEMIS coverage" : `${Math.round(st.irLowShare * 100)} % / ${Math.round(st.irHighShare * 100)} %`}</td></tr>
</table>

<h2>Elevation profile</h2>
<img src="${profileImg}" alt="Elevation profile">
<div class="muted">Color: green below caution limit, yellow caution, red critical, grey no DTM data.</div>

<h2>Waypoints</h2>
<table class="mono"><tr><th>#</th><th>Latitude</th><th>Longitude</th><th>Elevation</th><th>Slope</th><th>Geologic unit</th></tr>${wpRows}</table>

${envSection()}

<h2>Critical sections</h2>
<ul>${warnRows}</ul>
<h2>Possible loose ground</h2>
<ul>${st.irLowRuns.length ? st.irLowRuns.map((r) => `<li>${formatDistance(r.from / 1000)} – ${formatDistance(r.to / 1000)} (${formatLat(r.lat, 5)}, ${formatLonEast(r.lon, 5)})</li>`).join("") : "<li>No stretches with very low thermal inertia.</li>"}</ul>
<div class="muted">THEMIS night IR brightness in the lowest 10 % of the surroundings (±2 km): likely dust or loose sand, risk of wheel sinkage. Relative classes from 8-bit mosaic values, not calibrated thermal inertia.</div>

<h2>Data and methods</h2>
<table>
  <tr><th><span class="tag m">Measured</span></th><td>Elevation: USGS Astrogeology elevation models – HiRISE stereo DTMs (≈1 m/px) and CTX stereo DTMs (20 m/px) found in the USGS STAC catalog, global MOLA DEM (463 m/px) elsewhere (${st.dems.map(esc).join(", ") || "–"}). Image maps: NASA/JPL-Caltech Mars Trek (HiRISE, CTX, THEMIS, Viking, MOLA). Rover traverses and raw images: NASA/JPL.</td></tr>
  <tr><th><span class="tag d">Interpretation</span></th><td>Geologic units: ${[...new Set(geoUnits.filter(Boolean).map((g) => esc(g.map.citation)))].join("; ") || "–"}.</td></tr>
  <tr><th><span class="tag d">Derived</span></th><td>Night-IR classes: THEMIS night IR mosaic values along the route ranked against the surrounding ±2 km (lowest / highest 10 %). Distance as great circle on the Mars sphere (R = 3396.19 km); elevation bilinear; terrain slope by Horn (3×3 cells); grade along route over ≥ ${GRADE_WINDOW_M} m; speed, time and energy from P = m·g·v·(sin θ + Crr·cos θ).</td></tr>
  <tr><th><span class="tag i">Assumptions</span></th><td>Rolling resistance, safety factor, minimum speed and all profile values marked as assumptions. No downhill braking or energy recovery modelled. Sliding and tip-over limits are mass-independent (m·g cancels out).</td></tr>
</table>
</body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  render();

  return {
    refresh: () => render(),
    loadWaypoints,
    inspect3D,
    routeLatLngs: () => (route.samples.length ? route.samples.map((q) => [q.lat, q.lon]) : null),
    travelHours: () => route.lastHours,
    samples: () => route.samples,
    waypoints: () => route.waypoints.map((w) => {
      const ll = w.getLatLng ? w.getLatLng() : w;
      return { lat: ll.lat, lon: ll.lng ?? ll.lon };
    }),
    setWalkCursor: (dist) => {
      route.walkDist = dist;
      if (route.samples.length) drawProfile(settings());
    },
    criticalSlope: () => settings().critical,
    isDrawing: () => route.drawing,
    stopDrawing: () => setDrawing(false),
  };
}
