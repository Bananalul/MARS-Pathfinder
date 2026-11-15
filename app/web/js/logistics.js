// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Crew logistics for a planned route: metabolic load, oxygen, water, food, waste, exertion, return to the nearest base,
// vehicle need, radiation and weather. Every number is labelled as measured reference, model or assumption.

const LOG_KEY = "mars-pathfinder-crew";
const G_RATIO = 3.73 / 9.82; // Mars / Earth mean surface gravity (NASA NSSDCA fact sheets)
// Apollo lunar EVA: overall average 234 kcal/h (≈272 W) (NASA NTRS 19910001262, citing Waligora & Horrigan 1975,
// NASA SP-368); Skylab/Apollo range 100–500 kcal/h (Waligora & Horrigan, NTRS 19750006325).
const APOLLO_AVG_W = 272;
const O2_KJ_PER_L = 20.1; // energy per litre O2 (mixed diet)
const O2_G_PER_L = 1.429;
const SUSTAINED_W = 400; // ≈40 % VO2max of a 75 kg astronaut with 40 ml/kg/min (assumption)
const URINE_L_PER_H = 1.5 / 24; // ≈1.5 L/day
const DUST_SEASON = [180, 330]; // Ls range in which regional/global dust storms usually start

const BASE_STOP_KM = 0.3; // route point this close to a base = the crew can go in (assumption)

// Vehicle cabin needs per person and day: O₂ 0.84 kg and food ≈3000 kcal (NASA Human Integration Design Handbook,
// metabolic O₂ and food energy, rounded); drinking + food-prep water ≈3 L (assumption from the same source range).
const VEH_O2_KG_DAY = 0.84, VEH_WATER_L_DAY = 3, VEH_FOOD_KCAL_DAY = 3000;
const KCAL_RESERVE = 1500; // energy deficit tolerated for one EVA day without eating (assumption)

function initLogistics(map, planner, bases, mobility, envApi) {
  let dangerMarker = null;

  // Red title on the map over the route when something is critical (amber when only cautions).
  function showDangerTitle(warn, smp) {
    if (dangerMarker) {
      map.removeLayer(dangerMarker);
      dangerMarker = null;
    }
    if (!warn.length || !smp.length) return;
    const crit = warn.filter((w) => w[0] === "crit");
    const lead = crit[0] || warn[0];
    const at = lead[3] || smp[Math.floor(smp.length / 2)];
    const cls = crit.length ? "danger-title" : "danger-title caution";
    const label = `${crit.length ? "⚠ " + tr("DANGER", "GEFAHR") : "△ " + tr("Caution", "Achtung")}: ${lead[1]}${warn.length > 1 ? ` (+${warn.length - 1})` : ""}`;
    dangerMarker = L.marker([at.lat, at.lon], {
      icon: L.divIcon({ className: cls, html: `<div>${escHtml(label)}<span class="dt-i">i</span></div>`, iconSize: null }),
      zIndexOffset: 900,
    })
      .bindPopup(
        `<div class="danger-pop"><b>${crit.length ? tr("Critical for this route", "Kritisch für diese Route") : tr("Cautions for this route", "Hinweise für diese Route")}</b><ul>${warn
          .map((w) => `<li class="${w[0] === "crit" ? "warn-crit-text" : ""}"><b>${escHtml(w[1])}:</b> ${escHtml(w[2])}</li>`)
          .join("")}</ul><div class="small muted">${tr("Details: Route tab → Astronaut / crew check", "Details: Tab Route → Astronauten-/Crew-Check")}</div></div>`,
        { maxWidth: 380 }
      )
      .addTo(map);
  }

  const el = (id) => document.getElementById(id);
  const tr = (en, de) => (LANG === "de" ? de : en);
  const EQ_PRESETS = [
    { name: "Geology hammer, scoop, tongs", kg: 2 },
    { name: "Sample bags and samples", kg: 3 },
    { name: "Camera and radio", kg: 1.5 },
    { name: "First-aid kit", kg: 1 },
    { name: "Spare O₂ bottle", kg: 4, o2: 0.5 },
    { name: "Drill / core sampler", kg: 6 },
    { name: "Emergency shelter (tarp, beacon)", kg: 3 },
    { name: "Extra water bag", kg: 1.2 },
  ];
  // suit 82 kg: Apollo suit incl. backpack ≈ 180 lb (same value as the astronaut mobility preset); body 75 kg assumption.
  const defaults = { crew: 2, body: 75, suit: 82, terrain: 1.5, o2kg: 0.6, evaH: 8, drinkL: 0.95, magL: 1.0, foodKcal: 500, vSeats: 2, vRange: 100, vPress: 1, vO2: 20, vWater: 40, vFood: 12000, vMed: 1, walkSpeed: 3, items: EQ_PRESETS.slice(0, 4) };
  let cfg = { ...defaults };
  try {
    cfg = { ...defaults, ...JSON.parse(localStorage.getItem(LOG_KEY) || "{}") };
  } catch {}

  const saveCfg = () => {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(cfg));
    } catch {}
  };
  const loadKg = () => cfg.items.reduce((s, it) => s + (Number(it.kg) || 0), 0);
  const spareO2 = () => cfg.items.reduce((s, it) => s + (Number(it.o2) || 0), 0);
  cfg.load = loadKg();

  // Equipment list: what each astronaut carries (mass counts in the metabolic model; spare O₂ adds to the suit supply).
  function renderItems() {
    const box = el("lg-items");
    box.innerHTML = `<table class="lg-eq">${cfg.items
      .map((it, i) => `<tr><td>${escHtml(it.name)}${it.o2 ? ` <span class="muted">(+${it.o2} kg O₂)</span>` : ""}</td><td class="num"><input type="number" min="0" step="0.1" value="${it.kg}" data-eq-kg="${i}"> kg</td><td><button type="button" data-eq-del="${i}">✕</button></td></tr>`)
      .join("")}<tr class="lg-eq-sum"><td>${tr("Total carried", "Summe getragen")}</td><td class="num"><b>${loadKg().toFixed(1)} kg</b></td><td></td></tr></table>
      <div class="lg-eq-add">
        <select data-eq-preset><option value="">${tr("+ add from list …", "+ aus Liste hinzufügen …")}</option>${EQ_PRESETS.map((p, i) => `<option value="${i}">${escHtml(p.name)} (${p.kg} kg)</option>`).join("")}</select>
        <input data-eq-name type="text" maxlength="60" placeholder="${tr("own item", "eigener Posten")}"><input data-eq-new-kg type="number" min="0" step="0.1" placeholder="kg"><button type="button" data-eq-add>+</button>
      </div>
      <div class="small muted">${tr("Weight on Mars", "Gewicht auf dem Mars")}: ${tr("suit + equipment", "Anzug + Ausrüstung")} ${(cfg.suit + loadKg()).toFixed(0)} kg × 0.38 g = ${((cfg.suit + loadKg()) * G_RATIO).toFixed(0)} ${tr("kg on Earth", "kg auf der Erde")}</div>`;
  }
  el("lg-items").addEventListener("change", (e) => {
    if (e.target.matches("[data-eq-kg]")) cfg.items[+e.target.dataset.eqKg].kg = parseFloat(e.target.value) || 0;
    else if (e.target.matches("[data-eq-preset]") && e.target.value !== "") cfg.items.push({ ...EQ_PRESETS[+e.target.value] });
    else return;
    cfg.load = loadKg();
    saveCfg();
    renderItems();
    render();
  });
  el("lg-items").addEventListener("click", (e) => {
    if (e.target.matches("[data-eq-del]")) cfg.items.splice(+e.target.dataset.eqDel, 1);
    else if (e.target.matches("[data-eq-add]")) {
      const name = el("lg-items").querySelector("[data-eq-name]").value.trim();
      const kg = parseFloat(el("lg-items").querySelector("[data-eq-new-kg]").value);
      if (!name || !Number.isFinite(kg)) return;
      cfg.items.push({ name, kg });
    } else return;
    cfg.load = loadKg();
    saveCfg();
    renderItems();
    render();
  });
  renderItems();

  const fields = ["crew", "body", "suit", "terrain", "o2kg", "evaH", "drinkL", "magL", "foodKcal", "vSeats", "vRange", "vPress", "vO2", "vWater", "vFood", "vMed"];
  for (const f of fields) {
    const inp = el(`lg-${f}`);
    if (!inp) continue;
    inp.value = cfg[f];
    inp.addEventListener("change", () => {
      const v = parseFloat(inp.value);
      cfg[f] = Number.isFinite(v) ? v : defaults[f];
      if (f === "crew" && el("lg-crew-v")) el("lg-crew-v").value = cfg.crew;
      saveCfg();
      renderItems();
      render();
    });
  }
  // Crew size is shared by astronaut and vehicle mode.
  const crewV = el("lg-crew-v");
  if (crewV) {
    crewV.value = cfg.crew;
    crewV.addEventListener("change", () => {
      cfg.crew = Math.max(1, parseInt(crewV.value) || defaults.crew);
      el("lg-crew").value = cfg.crew;
      saveCfg();
      render();
    });
  }

  // Pandolf et al. (1977) load-carriage equation, gravity-dependent terms scaled to Mars (assumption).
  // With lunar gravity it gives ≈280 W for a suited walker at 1 m/s – close to the Apollo average of 272 W.
  function pandolf(vMs, gradePct, gRatio = G_RATIO) {
    const W = cfg.body, Lk = cfg.suit + cfg.load, eta = cfg.terrain;
    const load = 2.0 * (W + Lk) * (Lk / W) ** 2;
    const move = Math.max(0, eta * (W + Lk) * (1.5 * vMs * vMs + 0.35 * vMs * gradePct));
    return 1.5 * W + gRatio * (load + move);
  }

  function walkStats(smp, onFoot) {
    let hours = 0, energyJ = 0, peak = 0, hardH = 0;
    for (let i = 1; i < smp.length; i++) {
      const ds = smp[i].dist - smp[i - 1].dist;
      const v = Math.max(0.05, smp[i].speed || 1) / 3.6;
      const dt = ds / v / 3600;
      const a = smp[i - 1], b = smp[i];
      const grade = a.elev != null && b.elev != null && ds > 0 ? ((b.elev - a.elev) / ds) * 100 : 0;
      const M = onFoot ? pandolf(v, grade) : 1.5 * cfg.body + 80; // riding: seated work in a suit (assumption)
      hours += dt;
      energyJ += M * dt * 3600;
      if (M > peak) peak = M;
      if (M > SUSTAINED_W) hardH += dt;
    }
    const avgW = hours ? energyJ / (hours * 3600) : 0;
    return { hours, energyJ, avgW, peak, hardH };
  }

  function consumables(hours, avgW) {
    const kcal = (avgW * hours * 3600) / 4184;
    const o2L = (avgW * hours * 3.6) / O2_KJ_PER_L;
    return { kcal, o2L, o2kg: (o2L * O2_G_PER_L) / 1000, waterL: kcal / 1000, urineL: URINE_L_PER_H * hours };
  }

  const ok = (b) => (b ? `<span class="lg-ok">✓</span>` : `<span class="lg-bad">✗</span>`);
  const badge = (k) =>
    k === "m"
      ? `<span class="badge badge-measured">${tr("Reference", "Referenz")}</span>`
      : k === "a"
        ? `<span class="badge badge-assumed">${tr("Assumption", "Annahme")}</span>`
        : `<span class="badge badge-derived">${tr("Model", "Modell")}</span>`;

  // Base visits along the route, in order: [{ i, iEnd, base }].
  function baseStops(smp) {
    const stops = [];
    let cur = null;
    const step = Math.max(1, Math.floor(smp.length / 600));
    const idx = [];
    for (let i = 0; i < smp.length; i += step) idx.push(i);
    if (idx[idx.length - 1] !== smp.length - 1) idx.push(smp.length - 1);
    for (const i of idx) {
      const n = bases.nearest(smp[i].lat, smp[i].lon);
      const at = n && n.km <= BASE_STOP_KM ? n.base : null;
      if (at && cur && cur.base === at) cur.iEnd = i;
      else if (at) stops.push((cur = { i, iEnd: i, base: at }));
      else cur = null;
    }
    return stops;
  }
  function splitLegs(smp, stops) {
    const last = smp.length - 1;
    const legs = [];
    let from = 0, fromBase = null, k = 0;
    if (stops.length && stops[0].i === 0) {
      from = stops[0].iEnd;
      fromBase = stops[0].base;
      k = 1;
    }
    for (; k < stops.length; k++) {
      if (stops[k].i > from) legs.push({ a: from, b: stops[k].i, fromBase, toBase: stops[k].base });
      from = stops[k].iEnd;
      fromBase = stops[k].base;
    }
    if (from < last || !legs.length) legs.push({ a: Math.min(from, Math.max(0, last - 1)), b: last, fromBase: from < last ? fromBase : null, toBase: null });
    return legs;
  }
  function cumulativeHours(smp) {
    const h = [0];
    for (let i = 1; i < smp.length; i++) h.push(h[i - 1] + (smp[i].dist - smp[i - 1].dist) / (Math.max(0.05, smp[i].speed || 1) * 1000));
    return h;
  }

  function render() {
    const box = el("lg-out");
    const smp = planner.samples();
    if (!smp.length || planner.travelHours() == null) {
      box.innerHTML = `<div class="muted small">${tr("Plan a route to see the crew logistics.", "Route planen, um die Crew-Logistik zu sehen.")}</div>`;
      showDangerTitle([], []);
      window.crewState = null;
      return;
    }
    const profile = mobility.profile();
    const onFoot = isOnFoot(profile);
    const w = walkStats(smp, onFoot);
    const out = consumables(w.hours, w.avgW);
    const start = smp[0], end = smp[smp.length - 1];

    // Return to the nearest base from the end point, and the worst point for an emergency return.
    const nEnd = bases.nearest(end.lat, end.lon);
    let worst = null;
    for (let i = 0; i < smp.length; i += Math.max(1, Math.floor(smp.length / 200))) {
      const n = bases.nearest(smp[i].lat, smp[i].lon);
      if (n && (!worst || n.km > worst.km)) worst = { ...n, i };
    }
    const detour = 1.3; // straight line → walkable path (assumption)
    const backKm = nEnd ? nEnd.km * detour : null;
    const routeKm = smp.length ? smp[smp.length - 1].dist / 1000 : 0;
    const vehKmh = !onFoot && w.hours > 0 ? routeKm / w.hours : null; // average speed over the route
    const backH = backKm != null ? backKm / (onFoot ? cfg.walkSpeed : vehKmh || cfg.walkSpeed) : null;
    const backOut = backH != null ? consumables(backH, pandolf(cfg.walkSpeed / 3.6, 0)) : null;
    const totalH = w.hours + (backH || 0);
    const totalO2 = out.o2kg + (backOut ? backOut.o2kg : 0);
    const totalWater = out.waterL + (backOut ? backOut.waterL : 0);
    const totalUrine = out.urineL + (backOut ? backOut.urineL : 0);

    // ---- Base stops: the route is split into legs wherever it passes a base. At a base the crew can
    // go inside (EVA clock and toilet reset) and refill O₂, water and food if the base lists them.
    const stops = baseStops(smp);
    const legs = splitLegs(smp, stops);
    const cumH = cumulativeHours(smp);
    const legInfo = [];
    const draws = new Map(); // base → { oxygen, water, food } taken by the whole crew
    const draw = (b, k, v) => {
      if (!draws.has(b)) draws.set(b, { oxygen: 0, water: 0, food: 0 });
      draws.get(b)[k] += v * cfg.crew;
    };
    let acc = { h: 0, o2: 0, water: 0, urine: 0, kcal: 0, km: 0, from: null };
    const refills = [];
    legs.forEach((lg, k) => {
      const part = smp.slice(lg.a, lg.b + 1);
      const ws = walkStats(part, onFoot);
      const c = consumables(ws.hours, ws.avgW);
      const last = k === legs.length - 1;
      let h = ws.hours, o2 = c.o2kg, water = c.waterL, urine = c.urineL, kcal = c.kcal;
      let km = (smp[lg.b].dist - smp[lg.a].dist) / 1000;
      if (last && !lg.toBase && backOut) {
        h += backH;
        o2 += backOut.o2kg;
        water += backOut.waterL;
        urine += backOut.urineL;
        kcal += backOut.kcal;
        km += backKm;
      }
      if (lg.fromBase) {
        const st = bases.totals(lg.fromBase);
        acc.h = 0;
        acc.urine = 0;
        acc.km = 0; // vehicle recharged/refuelled at the base (assumption)
        if (st.oxygen > 0) acc.o2 = 0;
        if (st.water > 0) acc.water = 0;
        if (st.food > 0) acc.kcal = 0;
        acc.from = lg.fromBase;
        refills.push({ h: cumH[lg.a], o2: st.oxygen > 0, water: st.water > 0 });
        if (onFoot) {
          draw(lg.fromBase, "oxygen", o2);
          draw(lg.fromBase, "water", water);
          draw(lg.fromBase, "food", kcal);
        }
      }
      acc.h += h;
      acc.o2 += o2;
      acc.water += water;
      acc.urine += urine;
      acc.kcal += kcal;
      acc.km += km;
      const label = `${lg.fromBase ? escHtml(lg.fromBase.name) : tr("Start", "Start")} → ${lg.toBase ? escHtml(lg.toBase.name) : last && nEnd ? `${tr("end", "Ziel")} + ${tr("back to", "zurück nach")} ${escHtml(nEnd.base.name)}` : tr("end", "Ziel")}`;
      legInfo.push({ label, h, km, acc: { ...acc }, n: k + 1 });
    });
    const legName = (L) => (legs.length > 1 ? `${tr("Leg", "Etappe")} ${L.n} (${L.label}): ` : "");
    const worstOf = (key) => legInfo.reduce((a, b) => (b.acc[key] > a.acc[key] ? b : a), legInfo[0]);
    const maxH = worstOf("h"), maxO2 = worstOf("o2"), maxWater = worstOf("water"), maxUrine = worstOf("urine"), maxKcal = worstOf("kcal"), maxKm = worstOf("km");

    // Vehicles at the nearest base that could carry the crew home / out.
    const needKm = worst ? worst.km * detour * 2 : null;
    let vehicles = [];
    // Vehicles at the end base and at every base the route passes.
    const vBases = new Set(baseStops(smp).map((x) => x.base));
    if (nEnd) vBases.add(nEnd.base);
    for (const vb of vBases) vehicles.push(...vb.items.filter((it) => it.cat === "vehicle" && it.qty > 0));
    const fitting = vehicles.filter((v) => (v.range || 0) >= (needKm || 0) && (v.seats || 0) >= cfg.crew);
    const walkBackOk = worst ? worst.km <= EVA_WALK_RADIUS_KM : false;

    // Radiation over the route (+ way back) from the GCR model at the route elevations.
    const elevs = smp.filter((p) => p.elev != null).map((p) => p.elev / 1000);
    const meanElev = elevs.length ? elevs.reduce((a, b) => a + b, 0) / elevs.length : 0;
    const gcr = gcrDose(meanElev);
    const doseMSv = (gcr.mSvDay / 24) * totalH;

    // Weather / season.
    const t0 = envApi && envApi.routeStart ? envApi.routeStart() : Date.now();
    const mt = marsTime(t0);
    const dustSeason = mt.ls >= DUST_SEASON[0] && mt.ls <= DUST_SEASON[1];
    const tl = envApi && envApi.timeline ? envApi.timeline() : null;
    const temps = tl ? tl.pts.map((p) => p.env.tempK - 273.15) : null;
    const sunStart = marsSun(mt, start.lat, start.lon);
    const sunEnd = marsSun(marsTime(t0 + totalH * 3600000), end.lat, end.lon);

    // Base stocks vs. this trip for the whole crew.
    const stock = nEnd ? bases.totals(nEnd.base) : {};

    const exertion = w.avgW > SUSTAINED_W ? tr("very hard – not sustainable for hours", "sehr hoch – nicht stundenlang durchhaltbar") : w.avgW > 300 ? tr("hard", "hoch") : tr("moderate", "moderat");
    const warn = [];
    if (onFoot && maxH.acc.h > cfg.evaH) warn.push(["crit", tr("EVA too long", "EVA zu lang"), legName(maxH) + tr(`EVA would last ${maxH.acc.h.toFixed(1)} h without entering a base – more than the ${cfg.evaH} h limit. Add a base stop, split the route or use a rover.`, `EVA dauert ${maxH.acc.h.toFixed(1)} h ohne Halt in einer Basis – mehr als das Limit von ${cfg.evaH} h. Basis-Stopp einplanen, Route teilen oder Rover nutzen.`)]);
    if (onFoot && maxO2.acc.o2 > cfg.o2kg + spareO2()) warn.push(["crit", tr("Not enough oxygen", "Sauerstoff reicht nicht"), legName(maxO2) + tr(`${maxO2.acc.o2.toFixed(2)} kg O₂ needed per person until the next refill, suit + spare hold ${(cfg.o2kg + spareO2()).toFixed(2)} kg.`, `${maxO2.acc.o2.toFixed(2)} kg O₂ pro Person bis zum nächsten Nachfüllen nötig, Anzug + Reserve fassen ${(cfg.o2kg + spareO2()).toFixed(2)} kg.`)]);
    if (onFoot && maxWater.acc.water > cfg.drinkL) warn.push(["warn", tr("Drinking water short", "Trinkwasser knapp"), legName(maxWater) + tr(`≈${maxWater.acc.water.toFixed(1)} L per person until the next refill, suit bag holds ${cfg.drinkL} L.`, `≈${maxWater.acc.water.toFixed(1)} L pro Person bis zum nächsten Nachfüllen, Trinkbeutel fasst ${cfg.drinkL} L.`)]);
    if (onFoot && maxUrine.acc.urine > cfg.magL) warn.push(["warn", tr("Toilet capacity", "Toilette/Windel voll"), legName(maxUrine) + tr(`Urine ≈${maxUrine.acc.urine.toFixed(1)} L before the next base exceeds the absorbent garment (${cfg.magL} L).`, `Urin ≈${maxUrine.acc.urine.toFixed(1)} L bis zur nächsten Basis übersteigt die Windel (${cfg.magL} L).`)]);
    for (const L of legs) {
      if (!L.fromBase) continue;
      const st = bases.totals(L.fromBase);
      if (!(st.oxygen > 0)) warn.push(["warn", tr("No O₂ refill", "Kein O₂ zum Nachfüllen"), tr(`${L.fromBase.name} lists no oxygen – the suit cannot be refilled there.`, `${L.fromBase.name} hat keinen Sauerstoff eingetragen – der Anzug kann dort nicht nachgefüllt werden.`)]);
    }
    if (onFoot && w.hardH > 0.5) warn.push(["warn", tr("Overexertion", "Überanstrengung"), tr(`${w.hardH.toFixed(1)} h above ${SUSTAINED_W} W (steep or loaded stretches) – plan rests.`, `${w.hardH.toFixed(1)} h über ${SUSTAINED_W} W (steile oder schwer beladene Abschnitte) – Pausen einplanen.`)]);
    if (!bases.list().length) warn.push(["warn", tr("No base", "Keine Basis"), tr("No base placed – return and supplies cannot be checked (tab “Bases”).", "Keine Basis gesetzt – Rückweg und Vorräte können nicht geprüft werden (Tab „Basen“).")]);
    else if (onFoot && !walkBackOk) warn.push([(fitting.length ? "warn" : "crit"), tr("No way back on foot", "Kein Rückweg zu Fuß"), fitting.length ? tr(`Farthest point is ${worst.km.toFixed(1)} km from base (walk-back limit ${EVA_WALK_RADIUS_KM} km): keep the ${fitting[0].name} on standby.`, `Weitester Punkt ${worst.km.toFixed(1)} km von der Basis (Rückweg-Limit zu Fuß ${EVA_WALK_RADIUS_KM} km): ${fitting[0].name} in Bereitschaft halten.`) : tr(`Farthest point is ${worst.km.toFixed(1)} km from base, beyond walk-back range, and no vehicle with ≥${needKm.toFixed(0)} km range and ${cfg.crew} seats is listed at the bases on the route.`, `Weitester Punkt ${worst.km.toFixed(1)} km von der Basis, außerhalb der Rückweg-Reichweite, und es ist kein Fahrzeug mit ≥${needKm.toFixed(0)} km Reichweite und ${cfg.crew} Sitzen an den Basen der Route eingetragen.`)]);
    for (const [b, d] of draws) {
      const st = bases.totals(b);
      for (const [k, unit, de] of [["oxygen", "kg O₂", "kg O₂"], ["water", "L water", "L Wasser"], ["food", "kcal food", "kcal Nahrung"]])
        if (st[k] > 0 && st[k] < d[k]) warn.push(["crit", tr("Base stock too low", "Basis-Vorrat zu knapp"), tr(`${b.name} has ${st[k]} ${unit}, the crew takes ${d[k].toFixed(k === "food" ? 0 : 1)} ${unit} there.`, `${b.name} hat ${st[k]} ${de}, die Crew entnimmt dort ${d[k].toFixed(k === "food" ? 0 : 1)} ${de}.`)]);
    }
    if (nEnd && !stock.medical) warn.push(["warn", tr("No medical kit", "Kein Medizin-Set"), tr(`No medical kit listed at ${nEnd.base.name}.`, `An ${nEnd.base.name} ist kein Medizin-Set eingetragen.`)]);
    if (dustSeason) warn.push(["warn", tr("Dust-storm season", "Staubsturm-Saison"), tr(`Dust-storm season (Ls ${mt.ls.toFixed(0)}°, storms usually start between Ls 180° and 330°): check forecasts, plan shelter.`, `Staubsturm-Saison (Ls ${mt.ls.toFixed(0)}°, Stürme beginnen meist zwischen Ls 180° und 330°): Vorhersage prüfen, Schutz einplanen.`)]);
    if (sunStart.elev < 5 || sunEnd.elev < 5) warn.push(["warn", tr("Darkness", "Dunkelheit"), tr("Start or arrival near or after sunset: cold, poor light, no solar power.", "Start oder Ankunft nahe/nach Sonnenuntergang: kalt, schlechte Sicht, kein Solarstrom.")]);
    if (temps && Math.min(...temps) < -80) warn.push(["warn", tr("Extreme cold", "Extreme Kälte"), tr(`Ground down to ${Math.min(...temps).toFixed(0)} °C on the way (model).`, `Boden bis ${Math.min(...temps).toFixed(0)} °C unterwegs (Modell).`)]);

    // Rations the walker carries (food is not needed for short EVAs, so this is only a warning).
    const tripKcal = maxKcal.acc.kcal;
    if (onFoot && tripKcal > cfg.foodKcal + KCAL_RESERVE)
      warn.push(["warn", tr("Rations short", "Rationen knapp"), legName(maxKcal) + tr(`≈${tripKcal.toFixed(0)} kcal burned per person, ${cfg.foodKcal} kcal rations carried – deficit above ${KCAL_RESERVE} kcal, pack more food.`, `≈${tripKcal.toFixed(0)} kcal Verbrauch pro Person, ${cfg.foodKcal} kcal Rationen dabei – Defizit über ${KCAL_RESERVE} kcal, mehr Essen einpacken.`)]);

    // Vehicle mode: cabin supplies and seats for the whole trip (route + way back).
    if (!onFoot) {
      const days = maxH.acc.h / 24; // supplies are restocked at bases on the way
      const needO2 = VEH_O2_KG_DAY * cfg.crew * days, needW = VEH_WATER_L_DAY * cfg.crew * days, needF = VEH_FOOD_KCAL_DAY * cfg.crew * days;
      const needRange = maxKm.acc.km; // recharged at bases on the way (assumption)
      if (cfg.vSeats < cfg.crew) warn.push(["crit", tr("Not enough seats", "Zu wenige Sitze"), tr(`${cfg.crew} crew, only ${cfg.vSeats} seats.`, `${cfg.crew} Crew, nur ${cfg.vSeats} Sitze.`)]);
      if (needRange > cfg.vRange) warn.push(["crit", tr("Range too short", "Reichweite zu gering"), tr(`Route + way back ≈${needRange.toFixed(0)} km, vehicle range ${cfg.vRange} km.`, `Route + Rückweg ≈${needRange.toFixed(0)} km, Reichweite ${cfg.vRange} km.`)]);
      if (cfg.vPress && needO2 > cfg.vO2) warn.push(["crit", tr("Cabin O₂ too low", "Kabinen-O₂ zu knapp"), tr(`${needO2.toFixed(1)} kg O₂ needed, ${cfg.vO2} kg on board.`, `${needO2.toFixed(1)} kg O₂ nötig, ${cfg.vO2} kg an Bord.`)]);
      if (!cfg.vPress && maxH.acc.h > cfg.evaH) warn.push(["crit", tr("Suit time too long", "Zu lange im Anzug"), legName(maxH) + tr(`Open vehicle: crew stays ${maxH.acc.h.toFixed(1)} h in suits (limit ${cfg.evaH} h).`, `Offenes Fahrzeug: Crew ${maxH.acc.h.toFixed(1)} h im Anzug (Limit ${cfg.evaH} h).`)]);
      if (needW > cfg.vWater) warn.push(["warn", tr("Water on board short", "Wasser an Bord knapp"), tr(`${needW.toFixed(1)} L needed, ${cfg.vWater} L on board.`, `${needW.toFixed(1)} L nötig, ${cfg.vWater} L an Bord.`)]);
      if (needF > cfg.vFood) warn.push(["warn", tr("Rations on board short", "Rationen an Bord knapp"), tr(`${needF.toFixed(0)} kcal needed, ${cfg.vFood} kcal on board.`, `${needF.toFixed(0)} kcal nötig, ${cfg.vFood} kcal an Bord.`)]);
      if (!cfg.vMed) warn.push(["warn", tr("No medical kit on board", "Kein Medizin-Set an Bord"), tr("Carry at least one medical kit.", "Mindestens ein Medizin-Set mitnehmen.")]);
    }

    // Steep stretches a person in a suit cannot walk.
    if (onFoot) {
      const lim = Math.min(HUMAN_SUIT_SLOPE, planner.criticalSlope ? planner.criticalSlope() : HUMAN_SUIT_SLOPE);
      const steep = smp.filter((p) => p.slope != null && p.slope >= lim);
      if (steep.length) {
        const top = steep.reduce((a, b) => (b.slope > a.slope ? b : a));
        warn.unshift(["crit", tr("Too steep to walk", "Zu steil zum Gehen"), tr(`${steep.length} route points steeper than ${lim.toFixed(0)}° (max ${top.slope.toFixed(0)}° at ${formatDistance(top.dist / 1000)}).`, `${steep.length} Routenpunkte steiler als ${lim.toFixed(0)}° (max. ${top.slope.toFixed(0)}° bei ${formatDistance(top.dist / 1000)}).`), top]);
      }
    }
    warn.sort((a, b) => (a[0] === b[0] ? 0 : a[0] === "crit" ? -1 : 1));
    // Shared with the route walk (status figure) and the travel-time card.
    window.crewState = {
      onFoot, routeH: w.hours, totalH, evaH: cfg.evaH, avgW: w.avgW, refills,
      o2PerH: w.hours ? out.o2kg / w.hours : 0, waterPerH: w.hours ? out.waterL / w.hours : 0, urinePerH: URINE_L_PER_H, kcalPerH: w.hours ? out.kcal / w.hours : 0,
      o2Cap: cfg.o2kg + spareO2(), waterCap: cfg.drinkL, magCap: cfg.magL, fatigueKcal: (SUSTAINED_W * cfg.evaH * 3600) / 4184,
    };
    const card = el("rs-time");
    if (card) {
      const lab = card.parentElement.querySelector(".card-label");
      if (lab) lab.textContent = onFoot ? tr("Walking time", "Gehzeit") : tr("Travel time", "Fahrzeit");
      card.parentElement.classList.toggle("card-bad", onFoot && maxH.acc.h > cfg.evaH);
      let sub2 = card.parentElement.querySelector(".card-sub");
      if (!sub2) {
        sub2 = document.createElement("span");
        sub2.className = "card-sub";
        card.parentElement.appendChild(sub2);
      }
      sub2.textContent = onFoot
        ? legs.length > 1
          ? `${tr("longest EVA leg", "längste EVA-Etappe")} ${maxH.acc.h.toFixed(1)} / ${cfg.evaH} h ${maxH.acc.h > cfg.evaH ? "✗" : "✓"}`
          : `${tr("EVA incl. way back", "EVA inkl. Rückweg")} ${totalH.toFixed(1)} / ${cfg.evaH} h ${totalH > cfg.evaH ? "✗" : "✓"}`
        : "";
    }
    showDangerTitle(warn, smp);

    box.innerHTML = `
      ${warn.length ? `<div class="warnings">${warn.map((x) => `<div class="warn ${x[0] === "crit" ? "warn-crit" : ""}"><b>${x[0] === "crit" ? "⚠ " : ""}${x[1]}:</b> ${x[2]}</div>`).join("")}</div>` : `<div class="ok-box small">${tr("No logistics conflict found for this route.", "Kein Logistik-Konflikt für diese Route gefunden.")}</div>`}
      <table class="kv small">
        <tr><th>${tr("Mode", "Art")}</th><td>${onFoot ? tr("on foot, in suit", "zu Fuß, im Anzug") : `${tr("riding (vehicle profile)", "fahrend (Fahrzeugprofil)")} <button type="button" class="lg-profile-btn">${tr("Switch to astronaut", "Auf Astronaut umstellen")}</button>`} · ${cfg.crew} ${tr("crew", "Personen")} · ${tr("carrying", "trägt")} ${loadKg().toFixed(1)} kg</td></tr>
        <tr><th>${tr("Metabolic rate avg / peak", "Stoffwechsel Mittel / Spitze")} ${badge("d")}</th><td>${w.avgW.toFixed(0)} / ${w.peak.toFixed(0)} W · ${exertion}<div class="muted">Apollo ${tr("lunar EVA average", "Mond-EVA Mittel")} ${APOLLO_AVG_W} W ${badge("m")}</div></td></tr>
        <tr><th>${tr("Energy (food) per person", "Energie (Nahrung) pro Person")}</th><td>${out.kcal.toFixed(0)} kcal ${tr("route", "Route")}${backOut ? ` + ${backOut.kcal.toFixed(0)} kcal ${tr("way back", "Rückweg")}` : ""} <span class="muted">(${tr("plus ≈3000 kcal/day base need", "plus ≈3000 kcal/Tag Grundbedarf")})</span></td></tr>
        <tr><th>${tr("Oxygen per person", "Sauerstoff pro Person")} ${badge("d")}</th><td>${ok(!onFoot || maxO2.acc.o2 <= cfg.o2kg + spareO2())} ${totalO2.toFixed(2)} kg ${legs.length > 1 ? `(${tr("max. between refills", "max. zwischen Nachfüllen")} ${maxO2.acc.o2.toFixed(2)} kg)` : ""} (${(out.o2L + (backOut ? backOut.o2L : 0)).toFixed(0)} L) · ${tr("suit", "Anzug")} ${cfg.o2kg} kg${spareO2() ? ` + ${spareO2()} kg ${tr("spare", "Reserve")}` : ""} ${badge("a")}</td></tr>
        <tr><th>${tr("Drinking water per person", "Trinkwasser pro Person")}</th><td>${ok(!onFoot || maxWater.acc.water <= cfg.drinkL)} ≈${totalWater.toFixed(1)} L${legs.length > 1 ? ` (max. ${maxWater.acc.water.toFixed(1)} L)` : ""} <span class="muted">(1 mL/kcal ${badge("a")})</span></td></tr>
        <tr><th>${tr("Toilet (urine)", "Toilette (Urin)")}</th><td>${ok(!onFoot || maxUrine.acc.urine <= cfg.magL)} ≈${totalUrine.toFixed(2)} L${legs.length > 1 ? ` (max. ${maxUrine.acc.urine.toFixed(2)} L)` : ""} · ${tr("absorbent garment", "Windel (MAG)")} ${cfg.magL} L</td></tr>
        <tr><th>${tr("EVA time incl. way back", "EVA-Zeit inkl. Rückweg")}</th><td>${ok(!onFoot || maxH.acc.h <= cfg.evaH)} ${w.hours.toFixed(1)} h ${tr("route (same as the time card)", "Route (wie in der Zeitkarte)")}${backH != null ? ` + ${backH.toFixed(1)} h ${tr("back to base", "zurück zur Basis")}` : ` <span class="muted">(${tr("no base – way back unknown", "keine Basis – Rückweg unbekannt")})</span>`} = <b>${totalH.toFixed(1)} h</b>${legs.length > 1 ? ` · ${tr("longest without base stop", "längste ohne Basis-Stopp")} <b>${maxH.acc.h.toFixed(1)} h</b>` : ""} (${tr("limit", "Limit")} ${cfg.evaH} h)</td></tr>
        <tr><th>${tr("Nearest base from the end", "Nächste Basis vom Ziel")}</th><td>${nEnd ? `${escHtml(nEnd.base.name)} · ${nEnd.km.toFixed(2)} km ${tr("straight", "Luftlinie")} → ≈${backH.toFixed(1)} h ${tr("on foot", "zu Fuß")}` : "–"}</td></tr>
        <tr><th>${tr("Farthest from any base", "Weitester Abstand zu einer Basis")}</th><td>${worst ? `${worst.km.toFixed(2)} km ${ok(walkBackOk)} ${tr("walk-back limit", "Rückweg-Limit")} ${EVA_WALK_RADIUS_KM} km` : "–"}</td></tr>
        <tr><th>${tr("Vehicles at that base", "Fahrzeuge an dieser Basis")}</th><td>${vehicles.length ? vehicles.map((v) => `${escHtml(v.name)} (${v.range ?? "?"} km, ${v.seats ?? "?"} ${tr("seats", "Sitze")})`).join(", ") : "–"}</td></tr>
        <tr><th>${tr("Cosmic radiation (trip)", "Kosmische Strahlung (Tour)")} ${badge("d")}</th><td>${(doseMSv * 1000).toFixed(0)} µSv ${tr("per person, no shielding", "pro Person, ohne Abschirmung")}${gcr.extrapolated ? ` <span class="warn-text">${tr("extrapolated", "extrapoliert")}</span>` : ""}</td></tr>
        <tr><th>${tr("Solar storm shelter", "Schutz bei Sonnensturm")}</th><td>${nEnd ? `${tr("worst case", "schlimmstenfalls")} ${((worst.km * detour) / cfg.walkSpeed).toFixed(1)} h ${tr("to the base on foot", "zu Fuß zur Basis")}` : "–"}</td></tr>
        <tr><th>${tr("Season / dust", "Jahreszeit / Staub")}</th><td>Ls ${mt.ls.toFixed(0)}° · ${dustSeason ? tr("dust-storm season", "Staubsturm-Saison") : tr("outside main dust-storm season", "außerhalb der Haupt-Staubsturmzeit")}${temps ? ` · ${tr("ground", "Boden")} ${Math.min(...temps).toFixed(0)} … ${Math.max(...temps).toFixed(0)} °C` : ` · <span class="muted">${tr("temperatures after “Walk the route”", "Temperaturen nach „Route abspielen“")}</span>`}</td></tr>
        <tr><th>${tr("Base stops / legs", "Basis-Stopps / Etappen")}</th><td>${
          stops.length
            ? legInfo.map((L) => `<div>${L.n}. ${L.label} · ${L.km.toFixed(1)} km · ${L.h.toFixed(1)} h${onFoot ? ` · O₂ ${L.acc.o2.toFixed(2)} kg ${ok(L.acc.o2 <= cfg.o2kg + spareO2())}` : ""}</div>`).join("") +
              `<div class="muted">${tr(`A route point within ${BASE_STOP_KM * 1000} m of a base counts as a stop: EVA clock and toilet reset, O₂/water/food are refilled if the base lists them (stop time not counted).`, `Ein Routenpunkt innerhalb ${BASE_STOP_KM * 1000} m einer Basis zählt als Stopp: EVA-Zeit und Toilette starten neu, O₂/Wasser/Essen werden nachgefüllt, wenn die Basis sie führt (Aufenthaltszeit nicht gerechnet).`)} ${badge("a")}</div>`
            : `<span class="muted">${tr("The route passes no base – draw it through a base to refill on the way.", "Die Route führt an keiner Basis vorbei – führe sie durch eine Basis, um unterwegs nachzufüllen.")}</span>`
        }</td></tr>
        ${draws.size ? `<tr><th>${tr("Taken from base stock (crew)", "Aus Basis-Vorrat entnommen (Crew)")}</th><td>${[...draws].map(([b, d]) => { const st = bases.totals(b); return `<div>${escHtml(b.name)}: O₂ ${d.oxygen.toFixed(1)} / ${st.oxygen ?? 0} kg · ${tr("water", "Wasser")} ${d.water.toFixed(1)} / ${st.water ?? 0} L · ${tr("food", "Nahrung")} ${d.food.toFixed(0)} / ${(st.food ?? 0).toLocaleString()} kcal</div>`; }).join("")}</td></tr>` : ""}
      </table>
      <div class="source-note small">${tr(
        "Metabolic rate: Pandolf et al. 1977 load-carriage equation with gravity-dependent terms scaled to Mars (0.38 g) – gives ≈280 W for lunar gravity, close to the measured Apollo average of 234 kcal/h (Waligora et al., NASA). O₂ from 20.1 kJ per litre. Sustained limit 400 W, way-back detour ×1.3, walking speed 3 km/h, suit O₂, drink bag and absorbent garment capacities are assumptions you can change.",
        "Stoffwechsel: Lasttrage-Gleichung nach Pandolf et al. 1977, schwerkraftabhängige Terme auf Mars (0,38 g) skaliert – ergibt für Mondschwerkraft ≈280 W, nahe am gemessenen Apollo-Mittel von 234 kcal/h (Waligora et al., NASA). O₂ aus 20,1 kJ pro Liter. Dauerlimit 400 W, Umwegfaktor ×1,3 für den Rückweg, Gehtempo 3 km/h, Anzug-O₂, Trinkbeutel und Windel sind änderbare Annahmen."
      )}</div>`;
  }

  el("lg-out").addEventListener("click", (e) => {
    if (e.target.matches(".lg-profile-btn")) el("mob-open").click();
  });
  window.logisticsHook = render;
  render();
  return { render };
}
