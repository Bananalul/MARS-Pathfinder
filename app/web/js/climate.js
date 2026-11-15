// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Surface temperature and radiation environment.
// Inputs are measured NASA maps (TES thermal inertia + albedo, MOLA elevation, Odyssey GRS K/Th);
// temperatures, UV and the dose map are model results derived from them and labelled as such.

const CLIM = {
  S0: 1361, // W/m², total solar irradiance at 1 AU
  // UV at the top of the atmosphere, 1 AU. Approximate band shares of the solar spectrum (assumption, not integrated
  // from a reference table): 200–400 nm ≈ 8 % of 1361 W/m², 200–280 nm ≈ 0.5 %.
  UV_1AU: 109,
  UVC_1AU: 6.6,
  SIGMA: 5.670374e-8,
  EMIS: 0.95, // surface emissivity (assumption)
  RHO_C: 1.2e6, // J m-3 K-1, volumetric heat capacity of regolith (assumption)
  G: 3.73, // m/s², mean surface gravity (NASA NSSDCA Mars Fact Sheet)
  SCALE_H: 11.0, // km, atmospheric scale height (NASA NSSDCA Mars Fact Sheet)
  // Pa, mean surface pressure near the MOLA datum (assumption, ≈6.1 mbar; NSSDCA: 6.36 mbar at the mean radius,
  // varying 4.0–8.7 mbar). Gives ≈ 920 Pa at Gale (−4.5 km); REMS measured roughly 700–950 Pa over the year.
  P_DATUM: 610,
  TAU: 0.5, // dust optical depth (typical non-storm background; adjustable)
  // MSL RAD at Gale crater (Hassler et al. 2014, Science 343): 0.21 mGy/d absorbed, 0.64 ± 0.12 mSv/d dose equivalent.
  RAD_GY: 0.21,
  RAD_SV: 0.64,
  RAD_SV_SIGMA: 0.12,
  GALE_Z_KM: -4.5,
  // Guo et al. 2017 (JGR Planets 122, 329, doi:10.1002/2016JE005206): 840 Pa at Gale ≙ 22.6 g/cm²; between the
  // seasonal extremes 700–950 Pa (18.9–25.7 g/cm²) the modelled dose rate differs by ≈15 % (absorbed dose) and ≈19 %
  // (dose equivalent) at solar modulation Φ = 500 MV → ≈2.2 % and ≈2.8 % per g/cm² (our linearisation).
  GALE_COLUMN: 22.6,
  RAD_PER_GCM2_GY: 0.022,
  RAD_PER_GCM2_SV: 0.028,
  COLUMN_VALID: [18.9, 25.7],
  // Strongest SEP event seen on the surface so far, 10–12 Sept 2017: +418 µGy (Si) at Gale (Berger et al. 2018).
  SEP_2017_UGY: 418,
};

const LAT_STEP = 5;
const TI_NODES = [30, 50, 80, 120, 180, 250, 350, 500, 700, 1000, 1500, 2500];
const ALB_NODES = [0.08, 0.16, 0.24, 0.32, 0.4];
const PHASES = 48; // stored temperatures per sol

// ---------- Global grids ----------

let envGrids = null;
let envGridsPromise = null;

function loadEnvGrids() {
  if (!envGridsPromise) {
    envGridsPromise = (async () => {
      const [meta, bin] = await Promise.all([
        fetch("data/env-grids.json").then((r) => (r.ok ? r.json() : Promise.reject(new Error("env-grids.json missing")))),
        fetch("data/env-grids.bin").then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("env-grids.bin missing")))),
      ]);
      const n = meta.w * meta.h;
      const ti = new Uint16Array(bin, meta.layers.ti.offset, n);
      const alb = new Uint16Array(bin, meta.layers.albedo.offset, n);
      // MOLA elevation at the same 0.25° grid (COG overview read).
      let elev = null;
      try {
        const tif = await openTiff(DEM_LIST.find((d) => d.kind === "mola").url);
        const r = await tif.readRasters({ width: meta.w, height: meta.h, resampleMethod: "bilinear", samples: [0] });
        elev = Float32Array.from(r[0], (v) => (isNoData(v) ? NaN : v));
      } catch (err) {
        console.warn("MOLA overview for environment maps failed:", err);
      }
      envGrids = { meta, ti, alb, elev };
      return envGrids;
    })().catch((err) => {
      envGridsPromise = null;
      throw err;
    });
  }
  return envGridsPromise;
}

function gridIndex(meta, lat, lon) {
  const x = Math.floor((normalizeLon180(lon) - meta.west) / meta.res);
  const y = Math.floor((meta.north - lat) / meta.res);
  return Math.min(meta.h - 1, Math.max(0, y)) * meta.w + Math.min(meta.w - 1, Math.max(0, x));
}

// Surface properties at a point (nearest 0.25° cell). Missing TES cells fall back to typical values (flagged).
function surfaceAt(lat, lon, elevOverride = null) {
  const g = envGrids;
  if (!g) return null;
  const i = gridIndex(g.meta, lat, lon);
  const ti = g.ti[i] || null;
  const alb = g.alb[i] ? g.alb[i] * g.meta.layers.albedo.scale : null;
  const elevKm = elevOverride != null ? elevOverride / 1000 : g.elev && Number.isFinite(g.elev[i]) ? g.elev[i] / 1000 : 0;
  const gx = Math.floor((normalizeLon180(lon) + 180) / 5), gy = Math.floor((90 - lat) / 5);
  const gi = Math.min(35, Math.max(0, gy)) * 72 + Math.min(71, Math.max(0, gx));
  return {
    ti: ti ?? 250,
    albedo: alb ?? 0.22,
    tiMissing: !ti,
    albMissing: alb == null,
    elevKm,
    k: g.meta.grs.k_wtpct[gi],
    th: g.meta.grs.th_ppm[gi],
  };
}

// ---------- Atmosphere ----------

function pressureAt(elevKm) {
  return CLIM.P_DATUM * Math.exp(-elevKm / CLIM.SCALE_H);
}

function frostPoint(pPa) {
  // CO2 frost point (Kieffer 2013 fit used in KRC): T = 3148 / (23.102 − ln(0.01 P))
  return 3148 / (23.102 - Math.log(0.01 * pPa));
}

// Fraction of top-of-atmosphere sunlight reaching the ground (direct + forward-scattered diffuse).
function transmission(cosZ, tau, diffuse = 0.7) {
  const mu = Math.max(cosZ, 0.04);
  const direct = Math.exp(-tau / mu);
  return direct + diffuse * (1 - direct);
}

// ---------- 1-D heat conduction model (KRC-like, simplified) ----------

function simulateSol(lat, ti, alb, mt, tau, pPa) {
  const P = 88775.244;
  const steps = 96;
  const dt = P / steps;
  const k = (ti * ti) / CLIM.RHO_C;
  const skin = (ti / CLIM.RHO_C) * Math.sqrt(P / Math.PI);
  // Layers: thin top layer, geometric growth to > 6 diurnal skin depths.
  const h = [];
  let d = skin / 16, depth = 0;
  while (depth < 6 * skin && h.length < 40) {
    h.push(d);
    depth += d;
    d *= 1.25;
  }
  const n = h.length;
  const C = h.map((x) => CLIM.RHO_C * x);
  const Gc = [];
  for (let i = 0; i < n - 1; i++) Gc.push(k / ((h[i] + h[i + 1]) / 2));
  const S = CLIM.S0 / (mt.rAu * mt.rAu);
  const phi = lat * D2R, dec = mt.decl * D2R;
  const insol = (ltst) => {
    const cosZ = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos((ltst - 12) * 15 * D2R);
    return cosZ > 0 ? S * cosZ * transmission(cosZ, tau) : 0;
  };
  let mean = 0;
  for (let s = 0; s < steps; s++) mean += insol((24 * s) / steps) / steps;
  const noon = Math.max(0, Math.cos(phi - dec)) * S;
  const down = (0.04 + 0.05 * tau) * Math.max(noon, 0.1 * S); // atmospheric IR to the surface
  const tFrost = frostPoint(pPa);
  const tEq = Math.max(tFrost, Math.pow(((1 - alb) * mean + CLIM.EMIS * down) / (CLIM.EMIS * CLIM.SIGMA), 0.25));
  const T = new Array(n).fill(tEq);
  const a = new Float64Array(n), b = new Float64Array(n), c = new Float64Array(n), r = new Float64Array(n);
  const out = new Float32Array(PHASES);
  const SOLS = 8;
  for (let sol = 0; sol < SOLS; sol++) {
    for (let s = 0; s < steps; s++) {
      const ltst = (24 * s) / steps;
      const t0 = T[0];
      const rad4 = CLIM.EMIS * CLIM.SIGMA * t0 ** 4;
      const dRad = 4 * CLIM.EMIS * CLIM.SIGMA * t0 ** 3;
      for (let i = 0; i < n; i++) {
        const gl = i > 0 ? Gc[i - 1] : 0, gr = i < n - 1 ? Gc[i] : 0;
        a[i] = -gl * dt;
        c[i] = -gr * dt;
        b[i] = C[i] + (gl + gr) * dt;
        r[i] = C[i] * T[i];
      }
      const qIn = (1 - alb) * insol(ltst) + CLIM.EMIS * down - rad4 + dRad * t0;
      b[0] += dRad * dt;
      r[0] += qIn * dt;
      // Thomas algorithm
      for (let i = 1; i < n; i++) {
        const m = a[i] / b[i - 1];
        b[i] -= m * c[i - 1];
        r[i] -= m * r[i - 1];
      }
      T[n - 1] = r[n - 1] / b[n - 1];
      for (let i = n - 2; i >= 0; i--) T[i] = (r[i] - c[i] * T[i + 1]) / b[i];
      if (T[0] < tFrost) T[0] = tFrost; // CO2 frost buffers the surface at the frost point
      if (sol === SOLS - 1 && s % (steps / PHASES) === 0) out[s / (steps / PHASES)] = T[0];
    }
  }
  return out;
}

const tempTables = new Map();

// Lookup table over latitude × thermal inertia × albedo for one season (Ls) and dust load.
async function temperatureTable(utcMs, tau = CLIM.TAU, onProgress) {
  const mt = marsTime(utcMs);
  const lsKey = Math.round(mt.ls / 2) * 2;
  const key = `${lsKey}|${tau}`;
  if (tempTables.has(key)) return tempTables.get(key);
  const lats = [];
  for (let la = -90; la <= 90; la += LAT_STEP) lats.push(la);
  const tbl = { lsKey, tau, lats, data: [] };
  for (let li = 0; li < lats.length; li++) {
    const row = [];
    for (const ti of TI_NODES) for (const al of ALB_NODES) row.push(simulateSol(lats[li], ti, al, mt, tau, CLIM.P_DATUM));
    tbl.data.push(row);
    if (onProgress) onProgress((li + 1) / lats.length);
    if (li % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }
  tempTables.set(key, tbl);
  return tbl;
}

function bracket(nodes, v, log = false) {
  const f = log ? Math.log : (x) => x;
  if (v <= nodes[0]) return [0, 0, 0];
  if (v >= nodes[nodes.length - 1]) return [nodes.length - 1, nodes.length - 1, 0];
  let i = 0;
  while (nodes[i + 1] < v) i++;
  return [i, i + 1, (f(v) - f(nodes[i])) / (f(nodes[i + 1]) - f(nodes[i]))];
}

// Surface temperature (K) from a table at lat, TI, albedo and local true solar time; frost point from elevation.
function tableTemp(tbl, lat, ti, alb, ltst, elevKm = 0) {
  const [l0, l1, lf] = bracket(tbl.lats, lat);
  const [t0, t1, tf] = bracket(TI_NODES, ti, true);
  const [a0, a1, af] = bracket(ALB_NODES, alb);
  const ph = (((ltst / 24) * PHASES) % PHASES + PHASES) % PHASES;
  const p0 = Math.floor(ph), p1 = (p0 + 1) % PHASES, pf = ph - p0;
  const nA = ALB_NODES.length;
  const at = (l, t, a) => {
    const arr = tbl.data[l][t * nA + a];
    return arr[p0] * (1 - pf) + arr[p1] * pf;
  };
  const lerp = (x, y, f) => x + (y - x) * f;
  const v = (l) => lerp(lerp(at(l, t0, a0), at(l, t0, a1), af), lerp(at(l, t1, a0), at(l, t1, a1), af), tf);
  const T = lerp(v(l0), v(l1), lf);
  return Math.max(T, frostPoint(pressureAt(elevKm)));
}

async function surfaceTemperature(lat, lon, utcMs, elevM = null, tau = CLIM.TAU) {
  await loadEnvGrids();
  const s = surfaceAt(lat, lon, elevM);
  const tbl = await temperatureTable(utcMs, tau);
  const sun = marsSun(marsTime(utcMs), lat, lon);
  return { K: tableTemp(tbl, lat, s.ti, s.albedo, sun.ltst, s.elevKm), sun, surface: s };
}

// ---------- Radiation ----------

function columnDepth(elevKm) {
  return CLIM.GALE_COLUMN * Math.exp(-(elevKm - CLIM.GALE_Z_KM) / CLIM.SCALE_H);
}

// Galactic cosmic ray dose rate, scaled from the RAD measurement at Gale by atmospheric shielding.
function gcrDose(elevKm) {
  const x = columnDepth(elevKm);
  const fGy = Math.max(0.5, 1 + CLIM.RAD_PER_GCM2_GY * (CLIM.GALE_COLUMN - x));
  const f = Math.max(0.5, 1 + CLIM.RAD_PER_GCM2_SV * (CLIM.GALE_COLUMN - x));
  return {
    column: x,
    factor: f,
    mGyDay: CLIM.RAD_GY * fGy,
    mSvDay: CLIM.RAD_SV * f,
    sigma: CLIM.RAD_SV_SIGMA * f,
    extrapolated: x < CLIM.COLUMN_VALID[0] || x > CLIM.COLUMN_VALID[1],
  };
}

// UV irradiance (W/m²) on a horizontal surface; CO2 absorbs only below ≈ 200 nm, so UVC reaches the ground.
function uvIrradiance(mt, sun, tau = CLIM.TAU) {
  if (sun.cosZ <= 0) return { total: 0, uvc: 0 };
  const f = (sun.cosZ * transmission(sun.cosZ, tau, 0.6)) / (mt.rAu * mt.rAu);
  return { total: CLIM.UV_1AU * f, uvc: CLIM.UVC_1AU * f };
}

// Gamma dose rate from K, Th (and U assumed at the chondritic Th/U = 3.8) in the soil, UNSCEAR 2000 conversion
// for a semi-infinite ground: 0.0417 / 0.604 / 0.462 nGy/h per Bq/kg of K-40 / Th-232 / U-238.
function soilDose(kWt, thPpm) {
  if (kWt == null || thPpm == null) return null;
  const u = thPpm / 3.8;
  const nGyH = kWt * 313 * 0.0417 + thPpm * 4.06 * 0.604 + u * 12.35 * 0.462;
  return { nGyH, uGyDay: (nGyH * 24) / 1000, u };
}

// Everything at one place and time.
async function environmentAt(lat, lon, utcMs, elevM = null, tau = CLIM.TAU) {
  const tmp = await surfaceTemperature(lat, lon, utcMs, elevM, tau);
  const mt = marsTime(utcMs);
  const s = tmp.surface;
  return {
    mt,
    sun: tmp.sun,
    tempK: tmp.K,
    surface: s,
    pressure: pressureAt(s.elevKm),
    gcr: gcrDose(s.elevKm),
    uv: uvIrradiance(mt, tmp.sun, tau),
    soil: soilDose(s.k, s.th),
  };
}
