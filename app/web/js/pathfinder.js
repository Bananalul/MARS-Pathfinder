// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Automatic safest route A → (via points) → B.
//
// Two stages per pair of points:
//   1. coarse: one grid over the whole area (cells up to 120 m) finds a corridor,
//   2. fine:   the corridor is cut into legs of ≤ 1.8 km, each planned on its own grid (cells 4–12 m).
// Every grid cell aggregates ALL DTM pixels inside it (slope histogram, mean elevation) plus THEMIS night IR.
// Search: A* with 16 neighbours. Cost = travel time from the mobility model × hazard weights.
// Blocked: ≥ 15 % of a cell steeper than the critical slope, step grade ≥ critical, or speed below minimum.
// Each leg is re-sampled at full DTM resolution; critical hits are blocked and the leg is re-planned.

const PF = {
  LEG_MAX_M: 1800, // straight distance planned directly on a fine grid
  FINE_SIDE: 260, // max cells per side of a fine grid
  FINE_CELL_MIN: 4,
  FINE_CELL_MAX: 12,
  COARSE_SIDE: 250,
  COARSE_CELL_MAX: 120, // -> pairs up to ≈ 20 km
  PAD_FRAC: 0.25,
  PAD_MIN_M: 200,
  BLOCK_SHARE: 0.15, // cell blocked if this share of its pixels is at/above the critical slope
  CAUTION_SHARE: 0.3, // share above caution slope that counts as a full caution cell
  VERIFY_STEP_M: 4,
  MAX_ITER: 4,
};
// Hazard weights (planning assumptions, not measurements), scaled by the priority slider.
const PF_WEIGHT = { caution: 1.5, critical: 4, loose: 0.8, rock: 0.15, unknown: 3 };
const PF_PRIORITY = [0.2, 0.5, 1, 1.8, 3]; // slider 1 (fast) … 5 (safe)
const PF_M_PER_DEG = (MARS.RADIUS_KM * 1000 * Math.PI) / 180;

// ---------- Geometry ----------

const pfDist = (a, b) => greatCircleKm(a.lat, a.lon, b.lat, b.lon) * 1000;

function pfMakeGrid(points, cell, padM) {
  const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const cosl = Math.cos((lat0 * Math.PI) / 180);
  const dLat = cell / PF_M_PER_DEG, dLon = cell / (PF_M_PER_DEG * cosl);
  const south = Math.min(...lats) - padM / PF_M_PER_DEG;
  const west = Math.min(...lons) - padM / (PF_M_PER_DEG * cosl);
  const ny = Math.ceil((Math.max(...lats) + padM / PF_M_PER_DEG - south) / dLat) + 1;
  const nx = Math.ceil((Math.max(...lons) + padM / (PF_M_PER_DEG * cosl) - west) / dLon) + 1;
  return {
    south, west, dLat, dLon, nx, ny, cell,
    latlng: (i) => ({ lat: south + Math.floor(i / nx) * dLat, lon: west + (i % nx) * dLon }),
    toCell: (lat, lon) => {
      const r = Math.min(ny - 1, Math.max(0, Math.round((lat - south) / dLat)));
      const c = Math.min(nx - 1, Math.max(0, Math.round((lon - west) / dLon)));
      return r * nx + c;
    },
  };
}

// Cell size and padding for a set of points on a grid with at most `side` cells per side.
function pfSizeFor(points, side, minCell, maxCell) {
  const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const h = (Math.max(...lats) - Math.min(...lats)) * PF_M_PER_DEG;
  const w = (Math.max(...lons) - Math.min(...lons)) * PF_M_PER_DEG * Math.cos((lat0 * Math.PI) / 180);
  const pad = Math.max(PF.PAD_MIN_M, PF.PAD_FRAC * Math.hypot(w, h));
  const cell = Math.max(minCell, (Math.max(w, h) + 2 * pad) / side);
  return { cell, pad, tooBig: cell > maxCell };
}

// ---------- Sampling ----------

async function pfSampleGrid(grid, thr, onProgress) {
  const n = grid.nx * grid.ny;
  if (!grid.only || grid.only.includes("ctx")) {
    const sw = grid.latlng(0), ne = grid.latlng(n - 1);
    await ensureDemsFor([sw.lon, sw.lat, ne.lon, ne.lat]);
  }
  const pts = Array.from({ length: n }, (_, i) => grid.latlng(i));
  const [cells, ir] = await Promise.all([
    sampleGridCells(grid, onProgress),
    classifyNightIr(pts).catch(() => null),
  ]);
  grid.z = cells.z;
  grid.demOf = cells.demOf;
  grid.kindOf = cells.kindOf;
  grid.crit = new Float32Array(n);
  grid.caut = new Float32Array(n);
  grid.ir = new Array(n).fill(null);
  let known = 0;
  for (let i = 0; i < n; i++) {
    const c = cells.shareAbove(i, thr.critical);
    grid.crit[i] = Number.isFinite(c) ? c : 0;
    grid.caut[i] = Number.isFinite(c) ? cells.shareAbove(i, thr.caution) : 0;
    if (Number.isFinite(grid.z[i])) known++;
    if (ir && ir.values[i]) grid.ir[i] = ir.values[i].cls;
  }
  grid.known = known / n;
  grid.irAvailable = !!ir;
  // User zones marked "avoid" (zones.js) block their cells.
  grid.avoid = new Uint8Array(n);
  const rings = window.zoneAvoidRings ? window.zoneAvoidRings() : [];
  if (rings.length) {
    const sw = grid.latlng(0), ne = grid.latlng(n - 1);
    for (const ring of rings) {
      const lats = ring.map((q) => q[0]), lons = ring.map((q) => q[1]);
      if (Math.max(...lats) < sw.lat || Math.min(...lats) > ne.lat || Math.max(...lons) < sw.lon || Math.min(...lons) > ne.lon) continue;
      for (let i = 0; i < n; i++) {
        const q = pts[i];
        if (!grid.avoid[i] && ringContains(ring, q.lat, q.lon)) grid.avoid[i] = 1;
      }
    }
  }
  grid.pixelSize = cells.pixelSize;
  grid.dems = cells.dems;
}

// ---------- Search ----------

class PfHeap {
  constructor() {
    this.k = [];
    this.v = [];
  }
  get size() {
    return this.k.length;
  }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p];
      i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const top = v[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0;
      const n = k.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c];
        i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

// 16 neighbours: 8 adjacent + 8 knight moves (smoother, shorter paths). Knight moves check the two cells they cross.
const PF_MOVES = [
  [-1, -1, []], [-1, 0, []], [-1, 1, []], [0, -1, []], [0, 1, []], [1, -1, []], [1, 0, []], [1, 1, []],
  ...[[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].map(([a, b]) =>
    Math.abs(b) === 2 ? [a, b, [[0, b / 2], [a, b / 2]]] : [a, b, [[a / 2, 0], [a / 2, b]]]
  ),
];

// Hazard factor of entering cell i with a signed step grade (°). w = priority weight.
function pfHazard(grid, i, grade, thr, w) {
  const caut = Math.max(Math.abs(grade) >= thr.caution ? 1 : 0, Math.min(1, grid.caut[i] / PF.CAUTION_SHARE));
  let r = PF_WEIGHT.caution * caut + PF_WEIGHT.critical * Math.min(1, grid.crit[i] / PF.BLOCK_SHARE);
  if (grid.ir[i] === "low") r += PF_WEIGHT.loose;
  else if (grid.ir[i] === "high") r += PF_WEIGHT.rock;
  return 1 + w * r;
}

function pfSearch(grid, start, goal, profile, thr, blocked, w) {
  const { nx, ny, cell } = grid;
  const n = nx * ny;
  const g = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const vmax = profile.speed / 3.6;
  const gr = Math.floor(goal / nx), gc = goal % nx;
  const h = (i) => (Math.hypot(Math.floor(i / nx) - gr, (i % nx) - gc) * cell) / vmax; // admissible: factors ≥ 1
  const unknownFactor = 1 + Math.max(0.5, w) * PF_WEIGHT.unknown;
  const heap = new PfHeap();
  g[start] = 0;
  heap.push(h(start), start);

  while (heap.size) {
    const u = heap.pop();
    if (closed[u]) continue;
    if (u === goal) break;
    closed[u] = 1;
    const ur = Math.floor(u / nx), uc = u % nx;
    moves: for (const [dr, dc, mids] of PF_MOVES) {
      const r = ur + dr, c = uc + dc;
      if (r < 0 || c < 0 || r >= ny || c >= nx) continue;
      const v = r * nx + c;
      if (closed[v] || (blocked[v] && v !== goal)) continue;
      for (const [mr, mc] of mids) {
        if (blocked[(ur + mr) * nx + (uc + mc)]) continue moves;
      }
      const d = Math.hypot(dr, dc) * cell;
      let sec;
      let grade = 0;
      const zu = grid.z[u], zv = grid.z[v];
      if (Number.isFinite(zu) && Number.isFinite(zv)) {
        // Across a seam between two DTMs the elevation difference includes their datum offset: no grade there,
        // the slope histograms of both cells still apply.
        if (grid.demOf[u] === grid.demOf[v]) grade = (Math.atan((zv - zu) / d) * 180) / Math.PI;
        if (Math.abs(grade) >= thr.critical) continue;
        const speed = achievableSpeed(profile, grade);
        if (speed < profile.minSpeed) continue; // power limit
        sec = (d / (speed / 3.6)) * pfHazard(grid, v, grade, thr, w);
      } else {
        sec = (d / vmax) * unknownFactor;
      }
      const cost = g[u] + sec;
      if (cost < g[v]) {
        g[v] = cost;
        from[v] = u;
        heap.push(cost + h(v), v);
      }
    }
  }
  if (!Number.isFinite(g[goal])) return null;
  const path = [];
  for (let i = goal; i !== -1; i = from[i]) path.push(i);
  return { path: path.reverse(), seconds: g[goal] };
}

// Greedy line of sight: drop intermediate cells if the straight segment crosses no blocked cell
// and no cell riskier than the sub-path it replaces.
function pfSimplify(grid, path, blocked, thr, w) {
  const { nx } = grid;
  const risk = (i) => (Number.isFinite(grid.z[i]) ? pfHazard(grid, i, 0, thr, w) : 1e9);
  const lineOk = (a, b, maxRisk) => {
    const r0 = Math.floor(a / nx), c0 = a % nx, r1 = Math.floor(b / nx), c1 = b % nx;
    const steps = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) * 2;
    for (let s = 1; s < steps; s++) {
      const i = Math.round(r0 + ((r1 - r0) * s) / steps) * nx + Math.round(c0 + ((c1 - c0) * s) / steps);
      if (blocked[i] || risk(i) > maxRisk + 1e-9) return false;
    }
    return true;
  };
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let best = i + 1;
    let maxRisk = risk(path[i + 1]);
    for (let j = i + 2; j < path.length; j++) {
      maxRisk = Math.max(maxRisk, risk(path[j]));
      if (lineOk(path[i], path[j], maxRisk)) best = j;
      else if (j - best > 16) break;
    }
    out.push(path[best]);
    i = best;
  }
  return out;
}

function pfDensify(latlngs, step) {
  const pts = [];
  for (let i = 1; i < latlngs.length; i++) {
    const a = latlngs[i - 1], b = latlngs[i];
    const n = Math.max(1, Math.ceil(pfDist(a, b) / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) pts.push({ lat: a.lat + ((b.lat - a.lat) * k) / n, lon: a.lon + ((b.lon - a.lon) * k) / n });
  }
  return pts;
}

function pfBlockAround(grid, blocked, lat, lon) {
  const c = grid.toCell(lat, lon);
  const r0 = Math.floor(c / grid.nx), c0 = c % grid.nx;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const r = r0 + dr, cc = c0 + dc;
      if (r >= 0 && cc >= 0 && r < grid.ny && cc < grid.nx) blocked[r * grid.nx + cc] = 1;
    }
}

// ---------- Hazard map image ----------

function pfHazardImage(grid, blocked) {
  const cv = document.createElement("canvas");
  cv.width = grid.nx;
  cv.height = grid.ny;
  const cx = cv.getContext("2d");
  const img = cx.createImageData(grid.nx, grid.ny);
  for (let i = 0; i < grid.nx * grid.ny; i++) {
    const r = Math.floor(i / grid.nx), c = i % grid.nx;
    const o = ((grid.ny - 1 - r) * grid.nx + c) * 4; // image row 0 = north
    let col = null;
    if (!Number.isFinite(grid.z[i])) col = [138, 145, 156, 110];
    else if (blocked[i]) col = [196, 71, 63, 170];
    else if (grid.crit[i] > 0) col = [224, 120, 60, 120];
    else if (grid.caut[i] >= PF.CAUTION_SHARE) col = [208, 160, 58, 110];
    else if (grid.ir[i] === "low") col = [150, 100, 200, 90];
    if (col) img.data.set(col, o);
  }
  cx.putImageData(img, 0, 0);
  // Hit test for clicks: red/orange cells (blocked or partly critical).
  const hazardAt = (lat, lon) => {
    const r = Math.round((lat - grid.south) / grid.dLat), c = Math.round((lon - grid.west) / grid.dLon);
    if (r < 0 || c < 0 || r >= grid.ny || c >= grid.nx) return false;
    const i = r * grid.nx + c;
    return Number.isFinite(grid.z[i]) && (blocked[i] || grid.crit[i] > 0);
  };
  return {
    hazardAt,
    cell: grid.cell,
    url: cv.toDataURL(),
    bounds: [
      [grid.south - grid.dLat / 2, grid.west - grid.dLon / 2],
      [grid.south + (grid.ny - 0.5) * grid.dLat, grid.west + (grid.nx - 0.5) * grid.dLon],
    ],
  };
}

// ---------- Planning ----------

// Fine legs per data class: HiRISE (≈1 m) allows 4–12 m cells, CTX (20 m) 30–60 m cells.
const PF_LEG = {
  hirise: { maxM: 1800, cellMin: 4, cellMax: 12 },
  ctx: { maxM: 5000, cellMin: 30, cellMax: 60 },
};
const PF_COARSE_MOLA_FROM = 80; // coarse cells larger than this use the global MOLA DEM only
const PF_COARSE_MOLA_CELL = 500; // MOLA pixels are 463 m
const PF_COARSE_CELL_LIMIT = 2000; // -> pairs up to ≈ 330 km
const PF_MIN_RUN_M = 300; // shorter data-class runs are merged into a neighbour

function pfBbox(pts, padDeg = 0) {
  const lats = pts.map((p) => p.lat), lons = pts.map((p) => p.lon);
  return [Math.min(...lons) - padDeg, Math.min(...lats) - padDeg, Math.max(...lons) + padDeg, Math.max(...lats) + padDeg];
}

// Douglas–Peucker in local metres (for long MOLA-only stretches: few, editable waypoints).
function pfSimplifyDP(pts, tolM) {
  if (pts.length < 3) return pts;
  const lat0 = pts[0].lat, cosl = Math.cos((lat0 * Math.PI) / 180);
  const xy = pts.map((p) => [p.lon * PF_M_PER_DEG * cosl, p.lat * PF_M_PER_DEG]);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    const [x1, y1] = xy[i], [x2, y2] = xy[j];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    let best = -1, bd = tolM;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((x2 - x1) * (y1 - xy[k][1]) - (x1 - xy[k][0]) * (y2 - y1)) / len;
      if (d > bd) (bd = d), (best = k);
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([i, best], [best, j]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

// Adaptive search window: grow the area with elevation data until the best path no longer runs along
// the window edge and stops improving. The planner cannot see a better way around a steep zone that lies
// outside the data it has loaded, so the window keeps doubling (up to PF_WIN.MAX_CELLS) where it is too tight.
const PF_WIN = {
  MAX_EXPAND: 7, // doublings of the margin around the leg
  MAX_CELLS: 250000, // per grid; beyond this the cells get coarser (up to 1.5 × the class maximum)
  EDGE_CELLS: 3, // path this close to the window edge -> the window is too small
  DETOUR: 1.3, // path / straight line above this (with blocked cells nearby) -> look wider at least once
  GAIN: 0.01, // stop once a wider window improves the travel cost by less than 1 %
};

function pfPathStats(grid, path, a, b) {
  const { nx, ny } = grid;
  const k = PF_WIN.EDGE_CELLS;
  let edge = false, len = 0;
  for (let i = 0; i < path.length; i++) {
    const r = Math.floor(path[i] / nx), c = path[i] % nx;
    if (r < k || c < k || r >= ny - k || c >= nx - k) edge = true;
    if (i) {
      const r0 = Math.floor(path[i - 1] / nx), c0 = path[i - 1] % nx;
      len += Math.hypot(r - r0, c - c0) * grid.cell;
    }
  }
  return { edge, detour: len / Math.max(1, pfDist(a, b)) };
}

// One planning attempt for a leg on a given window.
async function pfLegAttempt(a, b, kind, cell, pad, profile, thr, w, report, extraBlocked) {
  const grid = pfMakeGrid([a, b], cell, pad);
  report("sampling", { cells: grid.nx * grid.ny, cell, kind });
  await pfSampleGrid(grid, thr, (p) => report("sampling", { cells: grid.nx * grid.ny, cell, kind, ...p }));
  if (grid.known === 0) return { fail: "no-dtm", grid };

  const start = grid.toCell(a.lat, a.lon), goal = grid.toCell(b.lat, b.lon);
  const blocked = new Uint8Array(grid.nx * grid.ny);
  let anyBlocked = false;
  for (let i = 0; i < blocked.length; i++) if (grid.crit[i] >= PF.BLOCK_SHARE || grid.avoid[i]) (blocked[i] = 1), (anyBlocked = true);
  for (const p of extraBlocked) pfBlockAround(grid, blocked, p.lat, p.lon); // critical points found earlier
  blocked[start] = 0;
  blocked[goal] = 0;

  let res = null, latlngs = null, residual = [], iter = 0;
  const found = [];
  for (; iter < PF.MAX_ITER; iter++) {
    report("searching", { iter: iter + 1, kind });
    await new Promise((r) => setTimeout(r));
    res = pfSearch(grid, start, goal, profile, thr, blocked, w);
    if (!res) return { fail: iter ? "no-path-after-check" : "no-path", grid, found };
    latlngs = pfSimplify(grid, res.path, blocked, thr, w).map((i) => grid.latlng(i));
    latlngs[0] = { ...a };
    latlngs[latlngs.length - 1] = { ...b };

    report("checking", { iter: iter + 1, kind });
    const dense = pfDensify(latlngs, Math.max(PF.VERIFY_STEP_M, cell / 3));
    const smp = await sampleElevation(dense);
    residual = dense.filter((p, k) => smp[k] && smp[k].slope != null && smp[k].slope >= thr.critical);
    if (!residual.length) break;
    found.push(...residual);
    for (const p of residual) pfBlockAround(grid, blocked, p.lat, p.lon);
    blocked[start] = 0;
    blocked[goal] = 0;
  }
  const st = pfPathStats(grid, res.path, a, b);
  return {
    kind, latlngs, seconds: res.seconds, residual: residual.length, iterations: Math.min(iter + 1, PF.MAX_ITER),
    grid, blocked, found, edge: st.edge, detour: st.detour, anyBlocked,
  };
}

// One fine leg a → b on HiRISE or CTX data, with an adaptively growing search window.
async function pfPlanLeg(a, b, kind, profile, thr, w, report, padScale = 1, avoidPts = []) {
  const spec = PF_LEG[kind];
  const size = pfSizeFor([a, b], PF.FINE_SIDE, spec.cellMin, Infinity);
  let cell = Math.min(spec.cellMax, size.cell);
  let pad = size.pad * padScale;
  let best = null, last = null;
  const known = [...avoidPts]; // critical points found by detailed checks (also in earlier rounds), kept for wider windows
  for (let exp = 0; exp <= PF_WIN.MAX_EXPAND; exp++) {
    if (exp) report("expand", { exp, pad, kind });
    const r = await pfLegAttempt(a, b, kind, cell, pad, profile, thr, w, report, known);
    known.push(...(r.found || []));
    last = r;
    if (!r.fail) {
      const gain = best ? (best.seconds - r.seconds) / best.seconds : 1;
      if (!best || r.seconds < best.seconds) best = r;
      const tight = r.edge || (r.anyBlocked && r.detour > PF_WIN.DETOUR && exp === 0);
      if (!tight || (exp > 0 && gain < PF_WIN.GAIN && !r.edge)) break; // window wide enough / converged
    } else if (r.fail === "no-dtm") {
      return r;
    }
    // Grow the margin; coarsen cells if the grid would get too large.
    pad *= 2;
    const lats = [a.lat, b.lat], lons = [a.lon, b.lon];
    const hM = (Math.max(...lats) - Math.min(...lats)) * PF_M_PER_DEG + 2 * pad;
    const wM = (Math.max(...lons) - Math.min(...lons)) * PF_M_PER_DEG * Math.cos((a.lat * Math.PI) / 180) + 2 * pad;
    const needCell = Math.sqrt((hM * wM) / PF_WIN.MAX_CELLS);
    if (needCell > spec.cellMax * 1.5) break;
    cell = Math.max(cell, needCell);
  }
  if (!best) return last;
  best.expansions = Math.round(Math.log2(pad / (size.pad * padScale)));
  best.windowM = pad;
  return best;
}

// Coarse corridor a → b over the whole area. Long distances use the global MOLA DEM only.
// MOLA slopes over 463 m pixels hide cliffs, so the coarse corridor uses halved slope limits there
// (planning assumption). Points the detailed planning found unsafe (avoidPts) are blocked with a margin.
const PF_MOLA_SLOPE_FACTOR = 0.5;
const PF_COARSE_CTX_UPTO = 1000; // coarse cells up to this size also read CTX DTMs (pairs up to ≈ 150 km)
const PF_FEEDBACK = { ROUNDS: 14, MARGIN_M: 600, SAMPLE_M: 200 };

async function pfCorridor(a, b, profile, thr, w, report, opts = {}) {
  const padScale = opts.padScale || 1;
  const size = pfSizeFor([a, b], PF.COARSE_SIDE, PF.FINE_CELL_MIN, Infinity);
  const pad = size.pad * padScale;
  // Same number of cells per side when the margin grows: cells get coarser instead.
  let cell = Math.max(PF.FINE_CELL_MIN, (size.cell * PF.COARSE_SIDE - 2 * size.pad + 2 * pad) / PF.COARSE_SIDE);
  let only = null;
  if (cell > PF_COARSE_MOLA_FROM) {
    cell = Math.max(cell, PF_COARSE_MOLA_CELL);
    // CTX (20 m) read at an overview level still shows cliff bands that MOLA (463 m) smooths away.
    only = cell <= PF_COARSE_CTX_UPTO ? ["ctx", "mola"] : ["mola"];
  }
  if (cell > PF_COARSE_CELL_LIMIT) return { fail: "too-far" };
  const cthr = only ? { ...thr, caution: thr.caution * PF_MOLA_SLOPE_FACTOR, critical: thr.critical * PF_MOLA_SLOPE_FACTOR } : thr;
  const grid = pfMakeGrid([a, b], cell, pad);
  grid.only = only;
  grid.maxDems = 40;
  report("coarse", { cells: grid.nx * grid.ny, cell, mola: !!only, round: opts.round || 0 });
  await pfSampleGrid(grid, cthr, () => {});
  if (grid.known === 0) return { fail: "no-dtm" };
  const start = grid.toCell(a.lat, a.lon), goal = grid.toCell(b.lat, b.lon);
  // Feedback from the detailed planning: block cells around unsafe points.
  const rCells = Math.max(1, Math.ceil(PF_FEEDBACK.MARGIN_M / cell));
  for (const q of opts.avoidPts || []) {
    const c = grid.toCell(q.lat, q.lon), r0 = Math.floor(c / grid.nx), c0 = c % grid.nx;
    for (let dr = -rCells; dr <= rCells; dr++)
      for (let dc = -rCells; dc <= rCells; dc++) {
        const r = r0 + dr, cc = c0 + dc;
        if (r >= 0 && cc >= 0 && r < grid.ny && cc < grid.nx && dr * dr + dc * dc <= rCells * rCells) grid.avoid[r * grid.nx + cc] = 1;
      }
  }

  // Large cells mix cliffs and passes: block strictly first, then softly if no corridor exists.
  for (const share of [PF.BLOCK_SHARE, 0.5, 1.01]) {
    const blocked = new Uint8Array(grid.nx * grid.ny);
    for (let i = 0; i < blocked.length; i++) if (grid.crit[i] >= share || grid.avoid[i]) blocked[i] = 1;
    blocked[start] = 0;
    blocked[goal] = 0;
    const res = pfSearch(grid, start, goal, profile, cthr, blocked, w);
    if (!res) continue;
    const pts = res.path.map((i) => grid.latlng(i));
    pts[0] = { ...a };
    pts[pts.length - 1] = { ...b };
    return { pts, grid, blocked, edge: pfPathStats(grid, res.path, a, b).edge };
  }
  return { fail: "no-path", grid };
}

// Cuts a corridor into legs by the best elevation data along it (HiRISE / CTX / MOLA only).
async function pfLegsFromCorridor(pts, report) {
  report("catalog", {});
  await ensureDemsFor(pfBbox(pts, 0.02));
  const dense = pfDensify(pts, 100);
  const kindOf = (p) => demKindAt(p.lat, p.lon) || "mola";
  let runs = [];
  for (const p of dense) {
    const k = kindOf(p);
    const last = runs[runs.length - 1];
    if (last && last.kind === k) last.pts.push(p);
    else runs.push({ kind: k, pts: last ? [last.pts[last.pts.length - 1], p] : [p] });
  }
  const runLen = (r) => r.pts.reduce((s, p, i) => (i ? s + pfDist(r.pts[i - 1], p) : 0), 0);
  // Merge short runs into the neighbour with the coarser data (its grid still contains the better data).
  for (let changed = true; changed && runs.length > 1; ) {
    changed = false;
    for (let i = 0; i < runs.length; i++) {
      if (runLen(runs[i]) >= PF_MIN_RUN_M) continue;
      const prev = runs[i - 1], next = runs[i + 1];
      const into = !prev ? next : !next ? prev : DEM_RANK[prev.kind] >= DEM_RANK[next.kind] ? prev : next;
      if (into === prev) prev.pts.push(...runs[i].pts.slice(1));
      else next.pts.unshift(...runs[i].pts.slice(0, -1));
      if (DEM_RANK[runs[i].kind] > DEM_RANK[into.kind]) into.kind = runs[i].kind;
      runs.splice(i, 1);
      changed = true;
      break;
    }
  }
  // Re-join neighbours of the same class created by merging.
  runs = runs.reduce((out, r) => {
    const last = out[out.length - 1];
    if (last && last.kind === r.kind) last.pts.push(...r.pts.slice(1));
    else out.push(r);
    return out;
  }, []);
  // Split HiRISE/CTX runs into legs of ≤ maxM.
  const legs = [];
  for (const r of runs) {
    if (r.kind === "mola") {
      legs.push({ kind: "mola", path: r.pts });
      continue;
    }
    const maxM = PF_LEG[r.kind].maxM * 0.9;
    let cur = [r.pts[0]], acc = 0;
    for (let i = 1; i < r.pts.length; i++) {
      acc += pfDist(r.pts[i - 1], r.pts[i]);
      cur.push(r.pts[i]);
      if (acc >= maxM && i < r.pts.length - 1) {
        legs.push({ kind: r.kind, path: cur });
        cur = [r.pts[i]];
        acc = 0;
      }
    }
    legs.push({ kind: r.kind, path: cur });
  }
  return legs.map((l) => ({ ...l, from: l.path[0], to: l.path[l.path.length - 1] }));
}

// Plans the legs along one list of segments. Returns legs, maps and the unsafe points it found.
async function pfPlanSegments(segs, viaCorridor, profile, thr, w, report, legOffset, avoidPts) {
  const legs = [], maps = [], bad = [];
  const blockedFail = (l) => l.fail === "no-path" || l.fail === "no-path-after-check";
  for (let j = 0; j < segs.length; j++) {
    const seg = segs[j];
    const legNo = legOffset + legs.length + 1;
    if (seg.kind === "mola") {
      legs.push({ kind: "mola", latlngs: pfSimplifyDP(seg.path, 150), residual: 0, iterations: 0 });
      continue;
    }
    const step = (s, info) => report(s, { ...info, leg: legNo, of: legOffset + segs.length });
    let leg = await pfPlanLeg(seg.from, seg.to, seg.kind, profile, thr, w, step, 1, avoidPts);
    const next = segs[j + 1];
    // Still a big detour: the fixed leg end may be the problem. Plan this leg and the next one together,
    // so the junction can move; keep it if it beats this leg plus an optimistic estimate of the next.
    if (!leg.fail && next && next.kind !== "mola" && leg.detour > PF_WIN.DETOUR) {
      report("junction", { leg: legNo });
      const kind = DEM_RANK[next.kind] > DEM_RANK[seg.kind] ? next.kind : seg.kind;
      const merged = await pfPlanLeg(seg.from, next.to, kind, profile, thr, w, step, 1, avoidPts);
      const nextBound = pfDist(next.from, next.to) / (profile.speed / 3.6);
      if (!merged.fail && merged.seconds < leg.seconds + nextBound) {
        leg = merged;
        j++;
      }
    }
    if (blockedFail(leg) && next && next.kind !== "mola") {
      // The leg end may sit in a trap the coarse grid could not see: join it with the next leg.
      const kind = DEM_RANK[next.kind] > DEM_RANK[seg.kind] ? next.kind : seg.kind;
      const merged = await pfPlanLeg(seg.from, next.to, kind, profile, thr, w, step, 1.5, avoidPts);
      if (!merged.fail) {
        leg = merged;
        j++;
      }
    }
    if (leg.fail) {
      if (leg.grid) maps.push(pfHazardImage(leg.grid, new Uint8Array(leg.grid.nx * leg.grid.ny)));
      if (!viaCorridor) return { fail: leg.fail, leg: legNo, maps };
      // Keep the corridor here, clearly flagged; its points go back to the coarse planning as unsafe.
      legs.push({ kind: seg.kind, fallback: true, latlngs: pfSimplifyDP(seg.path, 30), residual: 0, iterations: 0 });
      // Feed back what the detailed grid actually saw: its blocked cells (the cliff), thinned to ≈ SAMPLE_M.
      if (leg.grid && leg.grid.crit) {
        const g = leg.grid, stepC = Math.max(1, Math.round(PF_FEEDBACK.SAMPLE_M / g.cell));
        for (let r = 0; r < g.ny; r += stepC)
          for (let c = 0; c < g.nx; c += stepC) {
            let hit = false;
            for (let dr = 0; dr < stepC && !hit; dr++)
              for (let dc = 0; dc < stepC && !hit; dc++) {
                const i = (r + dr) * g.nx + (c + dc);
                if (r + dr < g.ny && c + dc < g.nx && (g.crit[i] >= PF.BLOCK_SHARE || g.avoid[i])) hit = true;
              }
            if (hit) bad.push(g.latlng(r * g.nx + c));
          }
      } else bad.push(...pfDensify(seg.path, PF_FEEDBACK.SAMPLE_M));
      continue;
    }
    if (leg.residual) bad.push(...leg.found.slice(-leg.residual));
    legs.push(leg);
    maps.push(pfHazardImage(leg.grid, leg.blocked));
  }
  return { legs, maps, bad };
}

const pfLegsKm = (legs, pred) =>
  legs.filter(pred).reduce((s, l) => s + l.latlngs.reduce((t, q, i) => (i ? t + pfDist(l.latlngs[i - 1], q) : 0), 0), 0) / 1000;

// points: [A, via…, B]. Fine legs on HiRISE/CTX; MOLA-only stretches stay at corridor level and are flagged.
// Long pairs run feedback rounds: unsafe spots found in detail are blocked in the corridor, which is re-planned.
async function planSafestRoute(points, profile, thr, opts = {}) {
  const w = opts.weight ?? 1;
  const report = opts.onStep || (() => {});
  const legs = [];
  const maps = [];
  let rounds = 0;
  for (let p = 1; p < points.length; p++) {
    const a = points[p - 1], b = points[p];
    report("catalog", {});
    await ensureDemsFor(pfBbox([a, b], 0.05));
    if (pfDist(a, b) <= PF_LEG.hirise.maxM) {
      const mid = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
      const kind = [a, mid, b].map((q) => demKindAt(q.lat, q.lon) || "mola").reduce((x, y) => (DEM_RANK[y] > DEM_RANK[x] ? y : x));
      const r = await pfPlanSegments([{ kind, from: a, to: b, path: [a, b] }], false, profile, thr, w, report, legs.length, []);
      if (r.fail) return { ok: false, reason: r.fail, pair: p, leg: r.leg, maps: [...maps, ...r.maps] };
      legs.push(...r.legs);
      maps.push(...r.maps);
      continue;
    }

    const avoidPts = [];
    let padScale = 2; // start with a wide corridor so detours around ridges are found
    let best = null;
    for (let round = 0; round < PF_FEEDBACK.ROUNDS; round++) {
      if (round) report("feedback", { round, n: avoidPts.length });
      const cor = await pfCorridor(a, b, profile, thr, w, report, { avoidPts, padScale, round });
      if (cor.fail) {
        if (best) break; // keep the best earlier round
        if (cor.grid) maps.push({ ...pfHazardImage(cor.grid, new Uint8Array(cor.grid.nx * cor.grid.ny)), coarse: true });
        return { ok: false, reason: cor.fail, pair: p, maps, maxKm: (PF_COARSE_CELL_LIMIT * PF.COARSE_SIDE) / 1000 / (1 + 2 * PF.PAD_FRAC) };
      }
      const segs = await pfLegsFromCorridor(cor.pts, report);
      const r = await pfPlanSegments(segs, true, profile, thr, w, report, legs.length, avoidPts);
      const unsafeKm = pfLegsKm(r.legs, (l) => l.fallback) + 0.02 * r.legs.reduce((s, l) => s + (l.residual || 0), 0);
      const seconds = r.legs.reduce((s, l) => s + (l.seconds || 0), 0);
      rounds = Math.max(rounds, round + 1);
      if (!best || unsafeKm < best.unsafeKm - 1e-6 || (Math.abs(unsafeKm - best.unsafeKm) < 1e-6 && seconds < best.seconds)) {
        best = { ...r, unsafeKm, seconds, coarseMap: { ...pfHazardImage(cor.grid, cor.blocked), coarse: true } };
      }
      if (!r.bad.length) break; // everything verified in detail
      avoidPts.push(...r.bad);
      if (cor.edge || round >= 1) padScale *= 2; // let the corridor go wider around the obstacle
    }
    legs.push(...best.legs);
    maps.push(best.coarseMap, ...best.maps);
  }

  const latlngs = [];
  legs.forEach((l, i) => latlngs.push(...(i ? l.latlngs.slice(1) : l.latlngs)));
  const fine = legs.filter((l) => l.grid);
  const lenKm = (l) => l.latlngs.reduce((s, q, i) => (i ? s + pfDist(l.latlngs[i - 1], q) : 0), 0) / 1000;
  const km = { hirise: 0, ctx: 0, mola: 0, fallback: 0 };
  for (const l of legs) km[l.fallback ? "fallback" : l.kind] += lenKm(l);
  const cells = fine.reduce((s, l) => s + l.grid.nx * l.grid.ny, 0);
  return {
    ok: true,
    latlngs: latlngs.map((q) => [q.lat, q.lon]),
    legs: legs.length,
    km,
    cell: fine.length ? Math.max(...fine.map((l) => l.grid.cell)) : null,
    pixel: fine.length ? Math.min(...fine.map((l) => l.grid.pixelSize || Infinity)) : null,
    cells,
    known: cells ? fine.reduce((s, l) => s + l.grid.known * l.grid.nx * l.grid.ny, 0) / cells : 0,
    residual: legs.reduce((s, l) => s + l.residual, 0),
    expansions: legs.reduce((s, l) => s + (l.expansions || 0), 0),
    rounds,
    iterations: fine.length ? Math.max(...fine.map((l) => l.iterations)) : 0,
    irAvailable: fine.every((l) => l.grid.irAvailable),
    dems: [...new Set(fine.flatMap((l) => l.grid.dems))],
    maps,
  };
}

// ---------- UI ----------

function initAutoRoute(map, planner, mobility) {
  const el = (id) => document.getElementById(id);
  const state = { picking: null, a: null, b: null, vias: [], busy: false };
  const markerLayer = L.layerGroup().addTo(map);
  const hazardLayer = L.layerGroup();
  const markers = { a: null, b: null, vias: [] };
  const icon = (label, cls = "") => L.divIcon({ className: `ab-marker ${cls}`, html: `<span>${label}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] });

  function makeMarker(latlng, label, cls, onMove) {
    const m = L.marker(latlng, { icon: icon(label, cls), draggable: true, keyboard: false, zIndexOffset: 500 }).addTo(markerLayer);
    m.on("dragend", (e) => onMove(e.target.getLatLng()));
    return m;
  }

  function setEnd(key, latlng) {
    state[key] = latlng;
    if (markers[key]) markers[key].setLatLng(latlng);
    else markers[key] = makeMarker(latlng, key.toUpperCase(), "", (ll) => (state[key] = ll));
    updateButtons();
  }

  function addVia(latlng) {
    const idx = state.vias.length;
    state.vias.push(latlng);
    markers.vias.push(makeMarker(latlng, `${idx + 1}`, "via", (ll) => (state.vias[idx] = ll)));
    updateButtons();
  }

  function setPicking(key) {
    state.picking = key;
    for (const k of ["a", "b", "via"]) el(`ab-set-${k}`).classList.toggle("active", key === k);
    map.getContainer().classList.toggle("drawing", !!key);
    if (key) {
      planner.stopDrawing();
      status(
        { a: t("Click the start point A on the map."), b: t("Click the destination B on the map."), via: t("Click via points on the map in travel order; click “Via point” again to stop.") }[key]
      );
    }
  }

  function updateButtons() {
    el("ab-plan").disabled = !(state.a && state.b) || state.busy;
  }

  function status(html, cls = "muted") {
    el("ab-status").className = `small ${cls}`;
    el("ab-status").innerHTML = html;
    if (state.busy) busyBar.set("auto", `${t("Safest route")}: ${html}`, state.pct);
  }

  function showMaps(maps) {
    hazardLayer.clearLayers();
    // Fine maps first in the hit order (coarse maps cover the whole area at low detail).
    for (const m of maps || []) {
      const ov = L.imageOverlay(m.url, m.bounds, { opacity: m.coarse ? 0.5 : 0.85, className: "hazard-map", interactive: !m.coarse }).addTo(hazardLayer);
      if (m.coarse) continue;
      ov.on("click", (e) => {
        if (state.picking || !m.hazardAt(e.latlng.lat, e.latlng.lng)) return; // let the map handle it
        L.DomEvent.stopPropagation(e);
        planner.inspect3D(e.latlng.lat, e.latlng.lng, { title: t("Hazard cell"), focusRadius: Math.max(8, m.cell * 1.5) });
      });
      ov.on("mousemove", (e) => {
        const hot = m.hazardAt(e.latlng.lat, e.latlng.lng);
        ov.getElement().style.cursor = hot ? "pointer" : "";
        if (hot) ov.bindTooltip(t("Hazard – click for 3D view"), { sticky: true }).openTooltip(e.latlng);
        else ov.unbindTooltip();
      });
    }
  }

  el("ab-set-a").addEventListener("click", () => setPicking(state.picking === "a" ? null : "a"));
  el("ab-set-b").addEventListener("click", () => setPicking(state.picking === "b" ? null : "b"));
  el("ab-set-via").addEventListener("click", () => setPicking(state.picking === "via" ? null : "via"));
  el("ab-hazard").addEventListener("change", (e) => (e.target.checked ? hazardLayer.addTo(map) : hazardLayer.remove()));
  el("ab-priority").addEventListener("input", (e) => (el("ab-priority-label").textContent = t(["fastest", "fast", "balanced", "safe", "safest"][e.target.value - 1])));

  map.on("click", (e) => {
    if (!state.picking) return;
    const key = state.picking;
    if (key === "via") return addVia(e.latlng);
    setEnd(key, e.latlng);
    setPicking(key === "a" && !state.b ? "b" : null);
    if (!state.picking) status(t("A and B set. Start the search."));
  });

  el("ab-plan").addEventListener("click", async () => {
    if (!mobility.thresholds()) {
      el("mob-open").click(); // confirm the mobility profile first
      return;
    }
    setPicking(null);
    state.busy = true;
    state.pct = 0;
    updateButtons();
    const thr = mobility.thresholds();
    const t0 = performance.now();
    const pts = [state.a, ...state.vias, state.b].map((p) => ({ lat: p.lat, lon: p.lng }));
    try {
      const progress = { pct: 0, round: 0 };
      const res = await planSafestRoute(pts, mobility.profile(), thr, {
        weight: PF_PRIORITY[el("ab-priority").value - 1],
        onStep: (step, i) => {
          // Rough progress: catalog 5 %, corridor 15 %, then legs; feedback rounds restart the leg share.
          const round = i.round != null ? i.round : progress.round;
          progress.round = round;
          let pct = step === "catalog" ? 4 : step === "coarse" ? 12 : progress.pct;
          if (i.leg && i.of) pct = 15 + (80 * (i.leg - 1 + (step === "checking" ? 0.8 : step === "searching" ? 0.5 : 0.2))) / i.of;
          if (step === "feedback") pct = Math.min(90, 15 + round * 5);
          progress.pct = pct;
          state.pct = progress.pct;
          const leg = i.leg ? `${t("Leg {n}", { n: i.leg })}${i.kind ? ` (${DEM_LABEL[i.kind]})` : ""} · ` : "";
          status(
            step === "feedback"
              ? t("Round {r}: the detailed check found {n} unsafe spots – blocking them and re-planning the corridor around them …", { r: i.round + 1, n: i.n })
              : step === "expand"
              ? leg + t("Path is tight against the loaded area or detours a lot – loading elevation data wider around it (±{m} m, step {e}) …", { m: Math.round(i.pad), e: i.exp })
              : step === "junction"
              ? leg + t("Big detour – re-planning together with the next leg so the waypoint between them can move …")
              : step === "catalog"
              ? t("Asking the USGS catalog for HiRISE and CTX elevation models …")
              : step === "coarse"
              ? t(i.mola ? "Finding a corridor on the global MOLA DEM ({n} cells of {c} m) …" : "Finding a corridor over the whole area ({n} cells of {c} m) …", { n: i.cells.toLocaleString(), c: i.cell.toFixed(0) })
              : step === "sampling"
                ? leg + t("Loading DTM pixels and night IR for {n} grid cells ({c} m) …", { n: i.cells.toLocaleString(), c: i.cell.toFixed(1) })
                : step === "searching"
                  ? leg + t("Searching safest path (pass {i}) …", { i: i.iter })
                  : leg + t("Checking the path at full DTM resolution (pass {i}) …", { i: i.iter })
          );
        },
      });
      showMaps(res.maps);
      if (!res.ok) {
        const where = res.leg ? ` (${t("Leg {n}", { n: res.leg })})` : "";
        const msg = {
          "too-far": t("These points are too far apart for one planning area (max. ≈ {km} km). Add via points.", { km: res.maxKm?.toFixed(0) }),
          "no-dtm": t("No HiRISE elevation data in this area – automatic planning needs a DTM (see “DTM coverage” on the map)."),
          "no-path": t("No safe path found: slopes at or above {c}° block every connection inside the planning area.", { c: thr.critical.toFixed(1) }),
          "no-path-after-check": t("No safe path left after the detailed check – the only connections cross slopes at or above {c}°.", { c: thr.critical.toFixed(1) }),
        }[res.reason];
        status(msg + where + (res.maps?.length ? " " + t("The hazard map shows why.") : ""), "warn");
        return;
      }
      planner.loadWaypoints(res.latlngs);
      const fmtKm = (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1));
      const parts = [
        res.km.hirise > 0.05 && `${fmtKm(res.km.hirise)} km ${DEM_LABEL.hirise}`,
        res.km.ctx > 0.05 && `${fmtKm(res.km.ctx)} km ${DEM_LABEL.ctx}`,
      ].filter(Boolean);
      const notes = [
        t("{l} legs in {s} s.", { l: res.legs, s: ((performance.now() - t0) / 1000).toFixed(0) }),
        parts.length ? t("Checked in detail: {list}.", { list: parts.join(", ") }) : "",
        res.expansions ? t("Search area widened {n}× where the path was boxed in.", { n: res.expansions }) : "",
        res.rounds > 1 ? t("Corridor re-planned in {n} rounds around spots the detailed check found unsafe.", { n: res.rounds }) : "",
      ];
      let warn = false;
      if (res.km.mola > 0.05) {
        warn = true;
        notes.push(`<b>${t("{d} km only with the global MOLA DEM (463 m) – corridor level, slopes NOT safety-checked.", { d: fmtKm(res.km.mola) })}</b>`);
      }
      if (res.km.fallback > 0.05) {
        warn = true;
        notes.push(`<b>${t("{d} km: no safe detailed path found – corridor kept, check the critical sections.", { d: fmtKm(res.km.fallback) })}</b>`);
      }
      if (!res.irAvailable) notes.push(t("Night IR not available – loose ground not considered."));
      if (res.residual) notes.push(t("{n} points remain at or above the critical slope after {i} passes – see “Critical sections”.", { n: res.residual, i: res.iterations }));
      status(`<span class="ok-note">${t("Safest route found ({n} waypoints).", { n: res.latlngs.length })}</span> ${notes.join(" ")}`, res.residual || warn ? "warn" : "muted");
    } catch (err) {
      console.error(err);
      status(t("Planning failed: {msg}", { msg: err.message }), "warn");
    } finally {
      state.busy = false;
      busyBar.done("auto");
      updateButtons();
    }
  });

  function clear() {
    markerLayer.clearLayers();
    hazardLayer.clearLayers();
    Object.assign(markers, { a: null, b: null, vias: [] });
    Object.assign(state, { a: null, b: null, vias: [] });
    setPicking(null);
    status("");
    updateButtons();
  }
  el("ab-clear").addEventListener("click", clear);
  el("ab-undo").addEventListener("click", () => {
    if (state.busy) return;
    if (markers.vias.length) {
      markerLayer.removeLayer(markers.vias.pop());
      state.vias.pop();
    } else if (markers.b) {
      markerLayer.removeLayer(markers.b);
      markers.b = state.b = null;
    } else if (markers.a) {
      markerLayer.removeLayer(markers.a);
      markers.a = state.a = null;
    }
    updateButtons();
  });
  el("ab-reverse").addEventListener("click", () => {
    if (state.busy || !(state.a || state.b)) return;
    const a = state.a, b = state.b, vias = state.vias.slice().reverse();
    markerLayer.clearLayers();
    Object.assign(markers, { a: null, b: null, vias: [] });
    Object.assign(state, { a: null, b: null, vias: [] });
    if (b) setEnd("a", b);
    if (a) setEnd("b", a);
    for (const v of vias) addVia(v);
    status(t("A and B swapped – click “Find safest route” to re-plan."));
  });
  updateButtons();

  // Used by "route between bases": set A and B and start the search.
  function planBetween(a, b, vias = []) {
    setPicking(null);
    for (const m of markers.vias) markerLayer.removeLayer(m);
    markers.vias = [];
    state.vias = [];
    setEnd("a", L.latLng(a.lat, a.lon));
    setEnd("b", L.latLng(b.lat, b.lon));
    for (const v of vias) addVia(L.latLng(v.lat, v.lon));
    el("ab-plan").click();
  }

  return { isPicking: () => !!state.picking, clear, planBetween };
}
