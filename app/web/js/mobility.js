// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Mobility model: slope limits and travel time/energy for a rover or a walking astronaut on Mars.
//
// Physics (rigid body on an inclined plane):
//   traction limit:  sliding/soil failure when tan(θ) > tan(φ)          -> independent of m and g
//   tip-over limit:  static stability angle of the vehicle              -> independent of m and g
//   power limit:     P = m·g·v·(sin θ + Crr·cos θ)                      -> depends on m, g, v, P
// The power limit decides how fast the vehicle can still climb. It becomes critical when the
// achievable speed drops below the minimum operating speed.

const MARS_G = 3.73; // m/s², mean surface gravity, NASA NSSDCA Mars Fact Sheet
const EARTH_G = 9.82; // m/s², same fact sheet (Earth column)
// Suited walking: "Walking up/down/across a slope of up to 20°" – NASA xEVA System Concept of
// Operations EVA-EXP-0042 (xEVA System Requirement Document, Attachment J-02). Apollo 15 crews walked ~17°.
const HUMAN_SUIT_SLOPE = 20;
// Same document: walking traverses "of up to 2 km away from the lander" (Apollo 14 walked ~1.45 km).
const EVA_WALK_RADIUS_KM = 2;

// Photos of the real vehicles: public-domain NASA images, served by Wikimedia Commons.
const WM = "https://upload.wikimedia.org/wikipedia/commons/thumb/";
const VEHICLE_PHOTOS = {
  lrv: {
    src: WM + "d/d4/Apollo_15_Lunar_Rover_final_resting_place.jpg/960px-Apollo_15_Lunar_Rover_final_resting_place.jpg",
    credit: "Apollo 15 Lunar Roving Vehicle on the Moon, 1971. Image: NASA (public domain)",
    page: "https://commons.wikimedia.org/wiki/File:Apollo_15_Lunar_Rover_final_resting_place.jpg",
  },
  curiosity: {
    src: WM + "d/dc/PIA16239_High-Resolution_Self-Portrait_by_Curiosity_Rover_Arm_Camera.jpg/960px-PIA16239_High-Resolution_Self-Portrait_by_Curiosity_Rover_Arm_Camera.jpg",
    credit: "Curiosity self-portrait at Rocknest, Gale crater, sol 84 (PIA16239). Image: NASA/JPL-Caltech/MSSS",
    page: "https://commons.wikimedia.org/wiki/File:PIA16239_High-Resolution_Self-Portrait_by_Curiosity_Rover_Arm_Camera.jpg",
  },
  perseverance: {
    src: WM + "0/01/PIA24836_Perseverance%27s_Selfie_at_Rochette.jpg/960px-PIA24836_Perseverance%27s_Selfie_at_Rochette.jpg",
    credit: "Perseverance selfie at Rochette, Jezero crater, sol 198 (PIA24836). Image: NASA/JPL-Caltech/MSSS",
    page: "https://commons.wikimedia.org/wiki/File:PIA24836_Perseverance%27s_Selfie_at_Rochette.jpg",
  },
  pressurized: {
    src: WM + "b/b9/Space_Exploration_Vehicle_in_field_%282010%29.jpg/960px-Space_Exploration_Vehicle_in_field_%282010%29.jpg",
    credit: "NASA Space Exploration Vehicle prototype in field tests (Desert RATS 2010) – the concept class of this profile; the profile values are assumptions. Image: NASA",
    page: "https://commons.wikimedia.org/wiki/File:Space_Exploration_Vehicle_in_field_(2010).jpg",
  },
};

const MOBILITY_PRESETS = {
  lrv: {
    name: "Apollo LRV on Mars",
    mass: 700,
    speed: 10,
    minSpeed: 1,
    power: 746,
    crr: 0.1,
    friction: 30,
    tipAngle: 45,
    safety: 1.5,
    notes: {
      mass: "210 kg vehicle + 490 kg payload (NASA NSSDCA)",
      power: "4 wheel motors × 0.25 hp = 746 W (Apollo LRV)",
      speed: "Assumption; LRV design approx. 10–13 km/h",
      minSpeed: "Assumption",
      crr: "Assumption for loose regolith",
      friction: "typical friction angle of Martian surface material ≈ 30° (Golombek et al. 2008)",
      tipAngle: "pitch/roll stability ≥ 45° (LRV design)",
      safety: "Assumption",
    },
  },
  astronaut: {
    name: "Astronaut on foot (EVA)",
    mass: 182,
    speed: 2,
    minSpeed: 0.5,
    power: 100,
    crr: 0.1,
    friction: 30,
    tipAngle: null,
    safety: 1.5,
    suitLimit: HUMAN_SUIT_SLOPE,
    notes: {
      mass: "Assumption: 80 kg person + 82 kg spacesuit (Apollo) + 20 kg equipment",
      power: "Assumption: sustainable mechanical power",
      speed: "Assumption",
      minSpeed: "Assumption",
      crr: "Assumption (walking resistance simplified as rolling resistance)",
      friction: "typical friction angle of Martian surface material ≈ 30° (Golombek et al. 2008)",
      tipAngle: "not applicable",
      safety: "Assumption",
    },
  },
  curiosity: {
    name: "Curiosity rover (MSL)",
    mass: 899,
    speed: 0.14,
    minSpeed: 0.05,
    power: 110,
    crr: 0.1,
    friction: 30,
    tipAngle: 45,
    safety: 1.5,
    notes: {
      mass: "899 kg (NASA/JPL MSL fact sheet)",
      speed: "top speed ≈ 4 cm/s = 0.14 km/h on flat hard ground (NASA/JPL)",
      power: "MMRTG ≈ 110 W electrical at launch (NASA/JPL)",
      minSpeed: "Assumption",
      crr: "Assumption for loose regolith",
      friction: "typical friction angle of Martian surface material ≈ 30° (Golombek et al. 2008)",
      tipAngle: "designed to withstand 45° tilt (NASA/JPL)",
      safety: "Assumption",
    },
  },
  perseverance: {
    name: "Perseverance rover (Mars 2020)",
    mass: 1025,
    speed: 0.152,
    minSpeed: 0.05,
    power: 110,
    crr: 0.1,
    friction: 30,
    tipAngle: 45,
    safety: 1.5,
    notes: {
      mass: "1025 kg (NASA/JPL Mars 2020 fact sheet)",
      speed: "top speed 0.152 km/h (NASA/JPL)",
      power: "MMRTG ≈ 110 W electrical (NASA/JPL)",
      minSpeed: "Assumption",
      crr: "Assumption for loose regolith",
      friction: "typical friction angle of Martian surface material ≈ 30° (Golombek et al. 2008)",
      tipAngle: "designed to withstand 45° tilt (NASA/JPL)",
      safety: "Assumption",
    },
  },
  pressurized: {
    name: "Pressurised crew rover (concept)",
    mass: 4000,
    speed: 10,
    minSpeed: 1,
    power: 20000,
    crr: 0.1,
    friction: 30,
    tipAngle: 40,
    safety: 1.5,
    notes: {
      mass: "Assumption: concept class of NASA's Space Exploration Vehicle (several tonnes incl. crew)",
      speed: "Assumption: ≈10 km/h cruise (concept)",
      power: "Assumption",
      minSpeed: "Assumption",
      crr: "Assumption for loose regolith",
      friction: "typical friction angle of Martian surface material ≈ 30° (Golombek et al. 2008)",
      tipAngle: "Assumption",
      safety: "Assumption",
    },
  },
  custom: {
    name: "Custom vehicle",
    mass: 1000,
    speed: 8,
    minSpeed: 1,
    power: 2000,
    crr: 0.1,
    friction: 30,
    tipAngle: 35,
    safety: 1.5,
    notes: {},
  },
};

const MOBILITY_FIELDS = ["mass", "speed", "minSpeed", "power", "crr", "friction", "tipAngle", "safety"];
const STORAGE_KEY = "mars-pathfinder-mobility";

const deg = (rad) => (rad * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;

// Steepest grade (°) at which power P still sustains speed v (km/h). 90 = never limiting, 0 = not even on flat ground.
function powerLimitedSlope(p, speedKmh) {
  const v = speedKmh / 3.6;
  const k = p.power / (p.mass * MARS_G * v);
  const a = Math.hypot(1, p.crr);
  if (k >= a) return 90;
  return Math.max(0, deg(Math.asin(k / a) - Math.atan(p.crr)));
}

// Achievable speed (km/h) on a signed along-track grade, capped at cruise speed.
function achievableSpeed(p, gradeDeg) {
  const resist = Math.sin(rad(gradeDeg)) + p.crr * Math.cos(rad(gradeDeg));
  if (resist <= 0) return p.speed; // downhill: braking not modelled, cruise speed assumed
  const v = (p.power / (p.mass * MARS_G * resist)) * 3.6;
  return Math.min(p.speed, v);
}

// Mechanical power (W) needed at a given speed and grade (no regeneration downhill).
function requiredPower(p, gradeDeg, speedKmh) {
  const resist = Math.sin(rad(gradeDeg)) + p.crr * Math.cos(rad(gradeDeg));
  return Math.max(0, p.mass * MARS_G * (speedKmh / 3.6) * resist);
}

// True for the walking-astronaut profile (also for profiles saved before suitLimit existed).
function isOnFoot(p) {
  return !!(p && (p.suitLimit || p.name === MOBILITY_PRESETS.astronaut.name));
}

// Critical slope of a vehicle to compare a walking plan with: the confirmed profile if it is a vehicle, else the LRV preset.
function machineCriticalSlope(p) {
  return computeLimits(p && !isOnFoot(p) ? p : MOBILITY_PRESETS.lrv).critical;
}

function computeLimits(p) {
  const limits = [
    { key: "traction", label: t("traction (sliding)"), angle: p.friction, massIndependent: true },
    { key: "power", label: t("power (below {v} km/h)", { v: p.minSpeed }), angle: powerLimitedSlope(p, p.minSpeed), massIndependent: false },
  ];
  if (p.tipAngle) limits.push({ key: "tip", label: t("tip-over stability"), angle: p.tipAngle, massIndependent: true });
  if (isOnFoot(p)) limits.push({ key: "suit", label: t("suited walking (NASA xEVA requirement)"), angle: HUMAN_SUIT_SLOPE, massIndependent: true });

  const crit = limits.reduce((a, b) => (b.angle < a.angle ? b : a));
  const cruiseLimit = powerLimitedSlope(p, p.speed);
  const caution = deg(Math.atan(Math.tan(rad(crit.angle)) / p.safety));

  return {
    limits,
    critical: crit.angle,
    criticalReason: crit.label,
    caution,
    cautionReason: t("safety factor {f} on tan θ of the critical limit", { f: p.safety }),
    cruiseLimit,
    weightMars: p.mass * MARS_G,
    weightEarth: p.mass * EARTH_G,
    flatPower: requiredPower(p, 0, p.speed),
  };
}

function initMobilityPanel(onApply) {
  const el = (id) => document.getElementById(id);
  const dialog = null; // the profile is edited in the Settings tab (formerly a dialog)
  const sel = el("mob-preset");
  sel.innerHTML = Object.entries(MOBILITY_PRESETS)
    .map(([k, p]) => `<option value="${k}">${t(p.name)}</option>`)
    .join("");
  const modeRadios = document.querySelectorAll('input[name="travel-mode"]');
  let lastVehicle = "lrv";
  function showMode(astro) {
    modeRadios.forEach((r) => (r.checked = r.value === (astro ? "astronaut" : "vehicle")));
    el("set-vehicle-pick").hidden = astro;
    document.querySelectorAll(".set-astro").forEach((n) => (n.hidden = !astro));
    document.querySelectorAll(".set-vehicle").forEach((n) => (n.hidden = astro));
    sel.querySelector('option[value="astronaut"]').hidden = true;
    showPhoto(astro ? null : sel.value);
  }
  function showPhoto(key) {
    const fig = el("veh-photo");
    const ph = VEHICLE_PHOTOS[key];
    fig.hidden = !ph;
    if (!ph) return;
    const img = fig.querySelector("img");
    if (img.getAttribute("src") !== ph.src) img.src = ph.src;
    img.alt = t(MOBILITY_PRESETS[key].name);
    fig.querySelector("figcaption").innerHTML = `${ph.credit} · <a href="${ph.page}" target="_blank" rel="noopener">Wikimedia Commons</a>`;
  }

  let profile = loadProfile();
  let applied = profile.applied || null;

  function loadProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.values) return saved;
    } catch {
      // storage unavailable or corrupt: fall back to preset
    }
    return { preset: "lrv", values: { ...MOBILITY_PRESETS.lrv }, applied: null };
  }

  function saveProfile() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...profile, applied }));
    } catch {
      // ignore
    }
  }

  function readForm() {
    const preset = MOBILITY_PRESETS[el("mob-preset").value];
    const v = { name: preset.name, suitLimit: preset.suitLimit || null };
    for (const f of MOBILITY_FIELDS) {
      const n = parseFloat(el(`mob-${f}`).value);
      v[f] = Number.isFinite(n) && n > 0 ? n : f === "tipAngle" ? null : MOBILITY_PRESETS.lrv[f];
    }
    return v;
  }

  function fillForm(values, presetKey) {
    el("mob-preset").value = presetKey;
    const notes = MOBILITY_PRESETS[presetKey].notes;
    for (const f of MOBILITY_FIELDS) {
      el(`mob-${f}`).value = values[f] ?? "";
      el(`note-${f}`).textContent = notes[f] || "";
    }
  }

  function renderCalc() {
    const p = readForm();
    const r = computeLimits(p);
    el("mob-calc").innerHTML = `
      <table class="kv">
        <tr><th>${t("Weight on Mars (g = {g} m/s²)", { g: MARS_G })}</th><td>${(r.weightMars / 1000).toFixed(2)} kN</td></tr>
        <tr><th>for comparison, Earth</th><td>${(r.weightEarth / 1000).toFixed(2)} kN</td></tr>
        <tr><th>${t("Power needed on flat ground at {v} km/h", { v: p.speed })}</th><td>${r.flatPower.toFixed(0)} W</td></tr>
        <tr><th>Cruise speed sustained up to (grade)</th><td>${fmtAngle(r.cruiseLimit)}</td></tr>
        ${r.limits
          .map((l) => `<tr><th>${t("Limit: {label}", { label: l.label })}${l.massIndependent ? " <span class='muted'>(mass-independent)</span>" : ""}</th><td>${fmtAngle(l.angle)}</td></tr>`)
          .join("")}
      </table>
      ${r.flatPower > p.power ? `<div class="warn">${t("Power is not enough for {v} km/h even on flat ground.", { v: p.speed })}</div>` : ""}
      <div class="proposal">
        <div>${t("Proposal:")} <b>${t("caution from {a}", { a: fmtAngle(r.caution) })}</b>, <b>${t("critical from {a}", { a: fmtAngle(r.critical) })}</b></div>
        <div class="muted small">${t("Critical: {a}. Caution: {b}.", { a: r.criticalReason, b: r.cautionReason })}</div>
      </div>`;
    el("mob-manual-caution").value = r.caution.toFixed(1);
    el("mob-manual-critical").value = r.critical.toFixed(1);
    return { p, r };
  }

  function fmtAngle(a) {
    return a >= 90 ? "not limiting" : `${a.toFixed(1)}°`;
  }

  function apply(caution, critical, mode) {
    const { p } = renderCalc();
    profile = { preset: el("mob-preset").value, values: p };
    applied = { caution, critical: Math.max(caution, critical), mode };
    saveProfile();
    renderSummary();
    const st = el("mob-applied");
    if (st) {
      st.textContent = t("Applied – the route is re-checked with this profile.");
      setTimeout(() => (st.textContent = ""), 4000);
    }
    onApply();
  }

  function renderSummary() {
    const p = profile.values;
    el("mob-summary").innerHTML = applied
      ? `<b>${t(p.name)}</b> · ${p.mass} kg · ${p.speed} km/h · ${p.power} W<br>
         ${t("caution from {a}°, critical from {b}°", { a: applied.caution.toFixed(1), b: applied.critical.toFixed(1) })}
         <span class="badge ${applied.mode === "manual" ? "badge-illustrative" : "badge-derived"}">${t(applied.mode)}</span>`
      : `<span class="warn">No profile confirmed yet.</span>`;
  }

  // Events
  el("mob-preset").addEventListener("change", () => {
    const key = el("mob-preset").value;
    if (key !== "astronaut") lastVehicle = key;
    fillForm(MOBILITY_PRESETS[key], key);
    showMode(key === "astronaut");
    renderCalc();
  });
  modeRadios.forEach((r) =>
    r.addEventListener("change", () => {
      if (!r.checked) return;
      sel.value = r.value === "astronaut" ? "astronaut" : lastVehicle;
      sel.dispatchEvent(new Event("change"));
    })
  );
  MOBILITY_FIELDS.forEach((f) => el(`mob-${f}`).addEventListener("input", renderCalc));
  el("mob-open").addEventListener("click", () => {
    fillForm(profile.values, profile.preset);
    el("mob-manual").hidden = true;
    renderCalc();
    document.querySelector('#tabs button[data-tab="settings"]')?.click();
  });
  el("mob-accept").addEventListener("click", () => {
    const { r } = renderCalc();
    apply(r.caution, r.critical, "computed");
  });
  el("mob-adjust").addEventListener("click", () => {
    el("mob-manual").hidden = false;
    el("mob-manual-caution").focus();
  });
  el("mob-manual-apply").addEventListener("click", () => {
    const c = parseFloat(el("mob-manual-caution").value);
    const k = parseFloat(el("mob-manual-critical").value);
    if (!(c > 0 && k > 0 && c <= k && k < 90)) {
      el("mob-manual-error").textContent = "Values between 0 and 90°, caution ≤ critical.";
      return;
    }
    el("mob-manual-error").textContent = "";
    apply(c, k, "manual");
  });
  renderSummary();
  if (profile.preset !== "astronaut" && MOBILITY_PRESETS[profile.preset]) lastVehicle = profile.preset;
  fillForm(profile.values, MOBILITY_PRESETS[profile.preset] ? profile.preset : "lrv");
  showMode(profile.preset === "astronaut");
  renderCalc();

  return {
    profile: () => profile.values,
    thresholds: () => applied,
  };
}
