// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Elevation access, best source first:
//   HiRISE stereo DTMs (≈1 m/px) and CTX stereo DTMs (20 m/px), found on demand in the USGS STAC catalog,
//   MOLA global DEM (463 m/px) everywhere else. All are cloud-optimized GeoTIFFs on AWS, read with range requests.
// Catalog: USGS Astrogeology STAC, collection "mro_hirise_socet_dtms".
// DTM projection: Equirectangular, clon = 0, standard parallel 0, Mars sphere R = 3396190 m
// -> x = R * lon_rad, y = R * lat_rad. Values are metres relative to the Mars 2015 sphere datum.

const DEM_RADIUS_M = 3396190;
const DEM_BASE = "https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm";

// bbox: [west, south, east, north] from STAC item metadata.
const DEM_SOURCES = {
  jezero: [
    ["DTEEC_045994_1985_046060_1985_U01", "ESP_045994_1985_ESP_046060_1985", [77.3834, 18.3055, 77.5008, 18.548]],
    ["DTEEC_048842_1985_048908_1985_U01", "ESP_048842_1985_ESP_048908_1985", [77.4615, 18.3372, 77.5841, 18.5883]],
    ["DTEEC_002387_1985_003798_1985_A01", "PSP_002387_1985_PSP_003798_1985", [77.3441, 18.3923, 77.4661, 18.5886]],
    ["DTEEC_023524_1985_023379_1985_U01", "ESP_023524_1985_ESP_023379_1985", [77.453, 18.16, 77.5981, 18.521]],
    ["DTEEC_023247_1985_022957_1985_U01", "ESP_023247_1985_ESP_022957_1985", [77.5485, 18.18, 77.69, 18.5205]],
  ],
  gale: [
    ["DTEEC_018854_1755_018920_1755_U01", "ESP_018854_1755_ESP_018920_1755", [137.336, -4.7142, 137.457, -4.458]],
    ["DTEEC_040770_1755_039280_1755_A01", null, [137.3352, -4.7921, 137.4426, -4.5833]],
    ["DTEEC_023957_1755_024023_1755_U01", "ESP_023957_1755_ESP_024023_1755", [137.43, -4.7012, 137.544, -4.4128]],
    ["DTEEC_010573_1755_010639_1755_U01", "PSP_010573_1755_PSP_010639_1755", [137.345, -4.6344, 137.467, -4.3546]],
    ["DTEEC_009149_1750_009294_1750_U01", "PSP_009149_1750_PSP_009294_1750", [137.353, -4.923, 137.468, -4.6764]],
    ["DTEEC_009505_1755_009571_1755_U01", "PSP_009505_1755_PSP_009571_1755", [137.424, -4.6757, 137.566, -4.2514]],
    ["DTEEC_009650_1755_009716_1755_U01", "PSP_009650_1755_PSP_009716_1755", [137.235, -4.825, 137.378, -4.4019]],
    ["DTEEC_019698_1750_019988_1750_U01", "ESP_019698_1750_ESP_019988_1750", [137.312, -5.0398, 137.439, -4.7294]],
    ["DTEEC_001488_1750_001752_1750_U02", "PSP_001488_1750_PSP_001752_1750", [137.239, -4.9481, 137.354, -4.7207]],
  ],
};

// kind: hirise (≈1 m) > ctx (20 m) > mola (463 m). Preloaded HiRISE DTMs work without the catalog.
const DEM_RANK = { hirise: 0, ctx: 1, mola: 2 };
const DEM_LABEL = { hirise: "HiRISE ≈1 m", ctx: "CTX 20 m", mola: "MOLA 463 m" };
const DEM_LIST = Object.values(DEM_SOURCES)
  .flat()
  .map(([id, folder, bbox]) => ({
    id,
    bbox,
    kind: "hirise",
    gsd: 1,
    url: folder ? `${DEM_BASE}/${folder}/${id}.tif` : `${DEM_BASE}/${id}.tif`,
  }));
// MOLA MEGDR 128/64 ppd merge, global COG (USGS Astrogeology), same projection as the DTMs.
DEM_LIST.push({
  id: "MOLA_MEGDR_128ppd_global",
  bbox: [-180, -90, 180, 90],
  kind: "mola",
  gsd: 463,
  url: "https://asc-pds-services.s3.us-west-2.amazonaws.com/wms_basemaps3/Mars/MOLA/mola128_mola64_merge_90Nto90S_SimpleC_clon0_cog.tif",
});

// ---------- STAC catalog: find HiRISE / CTX DTMs for an area on demand ----------
const STAC_SEARCH = "https://stac.astrogeology.usgs.gov/api/search";
const STAC_COLLECTIONS = { hirise: "mro_hirise_socet_dtms", ctx: "mro_ctx_controlled_usgs_dtms" };
const stacQueried = []; // bboxes already searched
const demListeners = [];

async function fetchJson(url) {
  try {
    const r = await fetch(url);
    if (r.ok) return await r.json();
  } catch {
    // fall through to the local proxy
  }
  const r = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error(`STAC ${r.status}`);
  return r.json();
}

// Adds every HiRISE and CTX DTM intersecting bbox [w, s, e, n] to DEM_LIST (once per area).
async function ensureDemsFor(bbox) {
  const [w, s, e, n] = bbox;
  if (stacQueried.some(([qw, qs, qe, qn]) => w >= qw && s >= qs && e <= qe && n <= qn)) return 0;
  const pad = 0.05;
  const box = [w - pad, s - pad, e + pad, n + pad].map((v) => +v.toFixed(4));
  let added = 0;
  await Promise.all(
    Object.entries(STAC_COLLECTIONS).map(async ([kind, coll]) => {
      try {
        const res = await fetchJson(`${STAC_SEARCH}?collections=${coll}&bbox=${box.join(",")}&limit=500`);
        for (const f of res.features || []) {
          const url = f.assets?.dtm?.href;
          if (!url || demBroken.has(f.id) || DEM_LIST.some((d) => d.id === f.id)) continue;
          const ring = f.geometry?.type === "MultiPolygon" ? f.geometry.coordinates[0][0] : f.geometry?.type === "Polygon" ? f.geometry.coordinates[0] : null;
          DEM_LIST.push({ id: f.id, bbox: f.bbox, kind, gsd: f.properties?.gsd || (kind === "ctx" ? 20 : 1), url, ring });
          added++;
        }
      } catch (err) {
        console.warn(`STAC search (${kind}) failed:`, err);
      }
    })
  );
  stacQueried.push(box);
  if (added) demListeners.forEach((fn) => fn());
  return added;
}

function pointInRing(ring, lat, lon) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function demCovers(d, lat, lon) {
  const [w, s, e, n] = d.bbox;
  if (lon < w || lon > e || lat < s || lat > n) return false;
  return !d.ring || pointInRing(d.ring, lat, lon);
}

// Link to the catalog entry of an elevation model, with its data class.
function demLink(id) {
  const d = DEM_LIST.find((x) => x.id === id);
  if (!d) return id;
  const url = d.kind === "mola" ? "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m" : `https://stac.astrogeology.usgs.gov/api/collections/${STAC_COLLECTIONS[d.kind]}/items/${id}`;
  return `<a href="${url}" target="_blank" rel="noopener">${id}</a> <span class="muted">(${DEM_LABEL[d.kind]})</span>`;
}

// Best data class available at a point ("hirise" | "ctx" | "mola").
function demKindAt(lat, lon) {
  return demsAt(lat, lon)[0]?.kind || null;
}

const DEM_MAX_WINDOW = 2048; // max pixels per side read at once
// DTMs listed in the STAC catalog whose file is missing (HTTP 404) or unreadable: dropped so they are not retried.
const demBroken = new Set();
const demCache = new Map();
let demUseProxy = false;

// HiRISE uses -3.4e38, CTX -32767, MOLA -32768 as no-data; real Mars elevations stay above -9 km.
function isNoData(v) {
  return !Number.isFinite(v) || v < -30000;
}

async function openTiff(url) {
  if (!demUseProxy) {
    try {
      return await GeoTIFF.fromUrl(url, { allowFullFile: false });
    } catch (err) {
      console.warn("Direct DTM access failed, using local proxy:", err);
      demUseProxy = true;
    }
  }
  return GeoTIFF.fromUrl(`/api/proxy?url=${encodeURIComponent(url)}`, { allowFullFile: false });
}

async function openDem(src) {
  if (!demCache.has(src.id)) {
    demCache.set(
      src.id,
      (async () => {
        const tif = await openTiff(src.url);
        const count = await tif.getImageCount();
        const base = await tif.getImage(0);
        const [ox, oy] = base.getOrigin();
        const [rx, ry] = base.getResolution();
        const levels = [];
        for (let i = 0; i < count; i++) {
          const img = await tif.getImage(i);
          levels.push({ img, scale: base.getWidth() / img.getWidth(), w: img.getWidth(), h: img.getHeight() });
        }
        return { src, ox, oy, rx, ry, levels };
      })()
    );
  }
  try {
    return await demCache.get(src.id);
  } catch (err) {
    demCache.delete(src.id);
    if (src.kind !== "mola") {
      demBroken.add(src.id);
      const i = DEM_LIST.indexOf(src);
      if (i >= 0) DEM_LIST.splice(i, 1);
      console.warn(`DTM ${src.id} is listed in the USGS catalog but not readable – skipped from now on.`);
    }
    throw err;
  }
}

// DTMs covering a point, best resolution first, then closest to the DTM centre.
function demsAt(lat, lon) {
  return DEM_LIST.filter((d) => demCovers(d, lat, lon)).sort(
    (a, b) => DEM_RANK[a.kind] - DEM_RANK[b.kind] || centerDist(a, lat, lon) - centerDist(b, lat, lon)
  );
}

function centerDist({ bbox: [w, s, e, n] }, lat, lon) {
  return Math.hypot((w + e) / 2 - lon, (s + n) / 2 - lat);
}

// Fractional full-resolution pixel position of a lat/lon in a DTM.
function toPixel(dem, lat, lon) {
  const x = DEM_RADIUS_M * lon * (Math.PI / 180);
  const y = DEM_RADIUS_M * lat * (Math.PI / 180);
  return { col: (x - dem.ox) / dem.rx, row: (y - dem.oy) / dem.ry };
}

// Finest overview level whose window stays within DEM_MAX_WINDOW pixels per side.
function chooseLevel(dem, spanCols, spanRows) {
  for (let i = 0; i < dem.levels.length; i++) {
    const s = dem.levels[i].scale;
    if (spanCols / s <= DEM_MAX_WINDOW && spanRows / s <= DEM_MAX_WINDOW) return i;
  }
  return dem.levels.length - 1;
}

// Samples elevation (bilinear) and slope (Horn, 3x3) for points within one DTM.
// Returns Map(index -> result).
async function sampleInDem(dem, points) {
  const px = points.map((p) => ({ ...toPixel(dem, p.lat, p.lon), idx: p.idx, lat: p.lat }));
  const minC = Math.min(...px.map((p) => p.col)) - 3;
  const maxC = Math.max(...px.map((p) => p.col)) + 3;
  const minR = Math.min(...px.map((p) => p.row)) - 3;
  const maxR = Math.max(...px.map((p) => p.row)) + 3;

  const li = chooseLevel(dem, maxC - minC, maxR - minR);
  const lv = dem.levels[li];
  const c0 = Math.max(0, Math.floor(minC / lv.scale));
  const r0 = Math.max(0, Math.floor(minR / lv.scale));
  const c1 = Math.min(lv.w, Math.ceil(maxC / lv.scale) + 1);
  const r1 = Math.min(lv.h, Math.ceil(maxR / lv.scale) + 1);
  if (c1 <= c0 || r1 <= r0) return new Map();

  const [data] = await lv.img.readRasters({ window: [c0, r0, c1, r1] });
  const W = c1 - c0;
  const H = r1 - r0;
  const cell = dem.rx * lv.scale; // metres per pixel (north-south, and east-west at equator)
  const at = (c, r) => (c < 0 || r < 0 || c >= W || r >= H ? NaN : data[r * W + c]);

  const out = new Map();
  for (const p of px) {
    const c = p.col / lv.scale - c0 - 0.5;
    const r = p.row / lv.scale - r0 - 0.5;
    const ci = Math.floor(c);
    const ri = Math.floor(r);
    const fx = c - ci;
    const fy = r - ri;
    const z00 = at(ci, ri), z10 = at(ci + 1, ri), z01 = at(ci, ri + 1), z11 = at(ci + 1, ri + 1);
    if ([z00, z10, z01, z11].some(isNoData)) continue;
    const elev = z00 * (1 - fx) * (1 - fy) + z10 * fx * (1 - fy) + z01 * (1 - fx) * fy + z11 * fx * fy;

    let slope = null;
    const nc = Math.round(c);
    const nr = Math.round(r);
    const z = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) z.push(at(nc + dc, nr + dr));
    if (!z.some(isNoData)) {
      const dx = cell * Math.cos((p.lat * Math.PI) / 180); // equirectangular: E-W pixels shrink with cos(lat)
      const dy = cell;
      const dzdx = (z[2] + 2 * z[5] + z[8] - (z[0] + 2 * z[3] + z[6])) / (8 * dx);
      const dzdy = (z[6] + 2 * z[7] + z[8] - (z[0] + 2 * z[1] + z[2])) / (8 * dy);
      slope = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
    }
    out.set(p.idx, { elev, slope, demId: dem.src.id, kind: dem.src.kind, cellSize: cell, slopeBase: 2 * cell });
  }
  return out;
}

// points: [{lat, lon}] -> [{elev, slope, demId, cellSize, slopeBase} | null]
async function sampleElevation(points, onProgress) {
  const results = new Array(points.length).fill(null);
  const pending = new Set(points.map((_, i) => i));
  const tried = new Set();

  while (pending.size) {
    // Group unresolved points by their best untried DTM.
    const groups = new Map();
    for (const i of pending) {
      const src = demsAt(points[i].lat, points[i].lon).find((d) => !tried.has(`${d.id}:${i}`));
      if (!src) {
        pending.delete(i);
        continue;
      }
      tried.add(`${src.id}:${i}`);
      if (!groups.has(src)) groups.set(src, []);
      groups.get(src).push({ ...points[i], idx: i });
    }
    if (!groups.size) break;

    await Promise.all(
      [...groups].map(async ([src, pts]) => {
        try {
          const dem = await openDem(src);
          const res = await sampleInDem(dem, pts);
          for (const [i, r] of res) {
            results[i] = r;
            pending.delete(i);
          }
          if (onProgress) onProgress(1 - pending.size / points.length);
        } catch (err) {
          console.error(`DTM ${src.id} could not be read:`, err);
          sampleElevation.lastError = err;
        }
      })
    );
  }
  return results;
}

// ---------- Grid aggregation (automatic route planning) ----------
// Aggregates every DTM pixel into a regular lat/lon grid (cell centres at south + r·dLat, west + c·dLon).
// Per cell: mean elevation and a 1°-bin histogram of pixel slopes (Horn 3×3), so the planner can ask
// "which share of this cell is steeper than X?" instead of relying on one point sample.
const SLOPE_BINS = 61; // 0…59°, last bin = 60° and steeper
const GRID_PIXEL_BUDGET = 12e6; // max DTM pixels read per DTM and grid
const GRID_TILE = 1024;
const GRID_MAX_DEMS = 10; // per grid, best first
const GRID_FULL = 0.98; // filled share after which equal/worse DTMs are skipped

async function sampleGridCells(g, onProgress = () => {}) {
  const n = g.nx * g.ny;
  const z = new Float32Array(n).fill(NaN);
  const hist = new Uint16Array(n * SLOPE_BINS);
  const slopeCount = new Uint32Array(n);
  const demOf = new Uint16Array(n); // which DTM filled the cell (1-based); seams between DTMs carry datum offsets
  const kindOf = new Uint8Array(n); // 1 = HiRISE, 2 = CTX, 3 = MOLA, 0 = none
  const south = g.south - g.dLat / 2, north = g.south + (g.ny - 0.5) * g.dLat;
  const west = g.west - g.dLon / 2, east = g.west + (g.nx - 0.5) * g.dLon;
  const cLat = (south + north) / 2, cLon = (west + east) / 2;
  // DTMs too coarse for the cells (pixel > 1.5 cells) cannot fill them and are skipped.
  // Footprint test: CTX/HiRISE strips are narrow and diagonal, their bbox often overlaps while the strip does not.
  const probes = [];
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) probes.push([south + ((north - south) * i) / 4, west + ((east - west) * j) / 4]);
  const touches = (d) =>
    !d.ring || probes.some(([la, lo]) => pointInRing(d.ring, la, lo)) || d.ring.some(([lo, la]) => lo > west && lo < east && la > south && la < north);
  const dems = DEM_LIST.filter(
    (d) =>
      d.bbox[0] < east && d.bbox[2] > west && d.bbox[1] < north && d.bbox[3] > south && d.gsd <= g.cell * 1.5 && (!g.only || g.only.includes(d.kind)) && touches(d)
  )
    .sort((a, b) => DEM_RANK[a.kind] - DEM_RANK[b.kind] || centerDist(a, cLat, cLon) - centerDist(b, cLat, cLon))
    .slice(0, g.maxDems || GRID_MAX_DEMS);
  let doneRank = Infinity; // once the grid is (almost) full, DTMs of this or a worse rank are skipped
  const owner = new Uint32Array(n); // pixel count of the DTM that currently fills a cell
  const used = [];
  let pixelSize = null;

  for (const [di, src] of dems.entries()) {
    if (DEM_RANK[src.kind] >= doneRank) break;
    let dem;
    try {
      dem = await openDem(src);
    } catch (err) {
      console.error(`DTM ${src.id} could not be read:`, err);
      continue;
    }
    const pa = toPixel(dem, north, west), pb = toPixel(dem, south, east);
    const L0 = dem.levels[0];
    const minC = Math.max(0, Math.floor(Math.min(pa.col, pb.col))), maxC = Math.min(L0.w, Math.ceil(Math.max(pa.col, pb.col)));
    const minR = Math.max(0, Math.floor(Math.min(pa.row, pb.row))), maxR = Math.min(L0.h, Math.ceil(Math.max(pa.row, pb.row)));
    if (maxC <= minC || maxR <= minR) continue;

    // Coarsest level that still resolves a cell with ≥ 3 pixels per side, within the pixel budget.
    let li = 0;
    for (let i = 0; i < dem.levels.length; i++) if (dem.rx * dem.levels[i].scale <= g.cell / 3) li = i;
    while (li < dem.levels.length - 1 && ((maxC - minC) / dem.levels[li].scale) * ((maxR - minR) / dem.levels[li].scale) > GRID_PIXEL_BUDGET) li++;
    const lv = dem.levels[li];
    const s = lv.scale;
    const px = dem.rx * s;
    const lc0 = Math.floor(minC / s), lc1 = Math.min(lv.w, Math.ceil(maxC / s));
    const lr0 = Math.floor(minR / s), lr1 = Math.min(lv.h, Math.ceil(maxR / s));

    // Equirectangular DTM and grid share axes: grid column depends only on pixel column, grid row only on pixel row.
    const toDeg = 180 / (Math.PI * DEM_RADIUS_M);
    const gcOf = new Int32Array(lc1 - lc0), grOf = new Int32Array(lr1 - lr0), cosOf = new Float64Array(lr1 - lr0);
    for (let c = lc0; c < lc1; c++) {
      const lon = (dem.ox + (c + 0.5) * s * dem.rx) * toDeg;
      const gc = Math.round((lon - g.west) / g.dLon);
      gcOf[c - lc0] = gc >= 0 && gc < g.nx ? gc : -1;
    }
    for (let r = lr0; r < lr1; r++) {
      const lat = (dem.oy + (r + 0.5) * s * dem.ry) * toDeg;
      const gr = Math.round((lat - g.south) / g.dLat);
      grOf[r - lr0] = gr >= 0 && gr < g.ny ? gr : -1;
      cosOf[r - lr0] = Math.cos((lat * Math.PI) / 180);
    }

    const cnt = new Uint32Array(n), sum = new Float64Array(n), h = new Uint16Array(n * SLOPE_BINS), sc = new Uint32Array(n);
    for (let tr = lr0; tr < lr1; tr += GRID_TILE) {
      for (let tc = lc0; tc < lc1; tc += GRID_TILE) {
        const re = Math.min(tr + GRID_TILE, lr1), ce = Math.min(tc + GRID_TILE, lc1);
        const wc0 = Math.max(0, tc - 1), wr0 = Math.max(0, tr - 1);
        const wc1 = Math.min(lv.w, ce + 1), wr1 = Math.min(lv.h, re + 1);
        const [data] = await lv.img.readRasters({ window: [wc0, wr0, wc1, wr1] });
        const W = wc1 - wc0, H = wr1 - wr0;
        for (let r = tr; r < re; r++) {
          const gr = grOf[r - lr0];
          if (gr < 0) continue;
          const wr = r - wr0;
          const dx = px * cosOf[r - lr0], dy = px;
          for (let c = tc; c < ce; c++) {
            const gc = gcOf[c - lc0];
            if (gc < 0) continue;
            const wc = c - wc0;
            const zc = data[wr * W + wc];
            if (isNoData(zc)) continue;
            const k = gr * g.nx + gc;
            cnt[k]++;
            sum[k] += zc;
            if (wr < 1 || wc < 1 || wr >= H - 1 || wc >= W - 1) continue;
            const i0 = (wr - 1) * W + wc, i1 = wr * W + wc, i2 = (wr + 1) * W + wc;
            const a = data[i0 - 1], b = data[i0], cc = data[i0 + 1], d = data[i1 - 1], f = data[i1 + 1], gg = data[i2 - 1], hh = data[i2], ii = data[i2 + 1];
            if (isNoData(a) || isNoData(b) || isNoData(cc) || isNoData(d) || isNoData(f) || isNoData(gg) || isNoData(hh) || isNoData(ii)) continue;
            const dzdx = (cc + 2 * f + ii - (a + 2 * d + gg)) / (8 * dx);
            const dzdy = (gg + 2 * hh + ii - (a + 2 * b + cc)) / (8 * dy);
            const slope = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
            const bin = Math.min(SLOPE_BINS - 1, Math.floor(slope));
            if (h[k * SLOPE_BINS + bin] < 65535) h[k * SLOPE_BINS + bin]++;
            sc[k]++;
          }
        }
        onProgress({ dem: di + 1, dems: dems.length });
      }
    }
    // Merge: a cell keeps the DTM that covers most of it; on ties the better-ranked DTM (processed first) stays.
    let any = false;
    for (let k = 0; k < n; k++) {
      if (!cnt[k] || cnt[k] <= owner[k] * 1.2) continue;
      owner[k] = cnt[k];
      z[k] = sum[k] / cnt[k];
      slopeCount[k] = sc[k];
      demOf[k] = used.length + 1;
      kindOf[k] = DEM_RANK[src.kind] + 1;
      hist.set(h.subarray(k * SLOPE_BINS, (k + 1) * SLOPE_BINS), k * SLOPE_BINS);
      any = true;
    }
    if (any) {
      used.push(src.id);
      pixelSize = pixelSize == null ? px : Math.min(pixelSize, px);
    }
    let filled = 0;
    for (let k = 0; k < n; k++) if (owner[k]) filled++;
    if (filled / n >= GRID_FULL) doneRank = DEM_RANK[src.kind];
  }

  // Share of a cell's pixels at or steeper than deg (bin-rounded down: slightly conservative).
  const shareAbove = (k, deg) => {
    if (!slopeCount[k]) return NaN;
    let s = 0;
    for (let b = Math.min(SLOPE_BINS - 1, Math.floor(deg)); b < SLOPE_BINS; b++) s += hist[k * SLOPE_BINS + b];
    return s / slopeCount[k];
  };
  const maxSlope = (k) => {
    for (let b = SLOPE_BINS - 1; b >= 0; b--) if (hist[k * SLOPE_BINS + b]) return b + 1;
    return NaN;
  };
  return { z, demOf, kindOf, shareAbove, maxSlope, dems: used, pixelSize };
}

// ---------- Elevation mosaic (3D view) ----------
// Resamples every available DTM into one regular lon/lat grid over the box, best data first:
// HiRISE where it exists, CTX in the gaps, MOLA last. Resolution = finest DTM present, but at most
// maxPx points per side (larger areas get coarser). Returns heights row by row (row 0 = north), ground
// spacing dx/dy in metres, the box centre in pixels, toLocal(lat, lon) and per-source shares.
const MOSAIC_MAX_WINDOW = 6000; // DTM pixels per side read at once

async function readDemMosaic(box, maxPx = 2048, onProgress = () => {}) {
  const [w, s, e, n] = box;
  await ensureDemsFor(box);
  const latC = (s + n) / 2, lonC = (w + e) / 2;
  const cosl = Math.cos((latC * Math.PI) / 180);
  const mPerDeg = (DEM_RADIUS_M * Math.PI) / 180;
  const extX = (e - w) * mPerDeg * cosl, extY = (n - s) * mPerDeg;
  const probes = [];
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) probes.push([s + ((n - s) * (i + 0.5)) / 9, w + ((e - w) * (j + 0.5)) / 9]);
  const cover = (d) => probes.filter(([la, lo]) => demCovers(d, la, lo)).length / probes.length;
  const cands = DEM_LIST.map((d) => ({ d, c: cover(d) }))
    .filter((x) => x.c > 0)
    .sort((a, b) => DEM_RANK[a.d.kind] - DEM_RANK[b.d.kind] || a.d.gsd - b.d.gsd || b.c - a.c);
  if (!cands.length) return null;
  const finest = Math.min(...cands.filter((x) => x.c >= 0.05 || x.d.kind === "mola").map((x) => x.d.gsd));
  const res = Math.max(finest, Math.max(extX, extY) / maxPx);
  const W = Math.max(4, Math.round(extX / res)), H = Math.max(4, Math.round(extY / res));
  const dLon = (e - w) / W, dLat = (n - s) / H;
  const z = new Float32Array(W * H).fill(NaN);
  const srcOf = new Uint8Array(W * H);
  const used = [];
  let filled = 0;

  for (const [k, { d: src }] of cands.entries()) {
    if (filled >= W * H) break;
    onProgress({ i: k + 1, n: cands.length, kind: src.kind });
    let dem;
    try {
      dem = await openDem(src);
    } catch (err) {
      console.warn(`DTM ${src.id} could not be read:`, err);
      continue;
    }
    const nw = toPixel(dem, n, w), se = toPixel(dem, s, e);
    // Level closest to the target resolution, within the window limit.
    let li = 0, bestDiff = Infinity;
    dem.levels.forEach((lv, i) => {
      const diff = Math.abs(Math.log((dem.rx * lv.scale) / res));
      if (diff < bestDiff) (bestDiff = diff), (li = i);
    });
    const span = () => Math.max(Math.abs(se.col - nw.col), Math.abs(se.row - nw.row)) / dem.levels[li].scale;
    while (li < dem.levels.length - 1 && span() > MOSAIC_MAX_WINDOW) li++;
    const lv = dem.levels[li], sc = lv.scale;
    const c0 = Math.max(0, Math.floor(Math.min(nw.col, se.col) / sc) - 1), c1 = Math.min(lv.w, Math.ceil(Math.max(nw.col, se.col) / sc) + 1);
    const r0 = Math.max(0, Math.floor(Math.min(nw.row, se.row) / sc) - 1), r1 = Math.min(lv.h, Math.ceil(Math.max(nw.row, se.row) / sc) + 1);
    if (c1 - c0 < 2 || r1 - r0 < 2) continue;
    let data;
    try {
      [data] = await lv.img.readRasters({ window: [c0, r0, c1, r1] });
    } catch (err) {
      console.warn(`DTM ${src.id} window failed:`, err);
      continue;
    }
    const ww = c1 - c0, hh = r1 - r0;
    // Separable mapping: target column -> DTM column, target row -> DTM row (same equirectangular projection).
    const colF = new Float64Array(W), rowF = new Float64Array(H);
    for (let i = 0; i < W; i++) colF[i] = toPixel(dem, latC, w + (i + 0.5) * dLon).col / sc - c0 - 0.5;
    for (let j = 0; j < H; j++) rowF[j] = toPixel(dem, n - (j + 0.5) * dLat, lonC).row / sc - r0 - 0.5;
    // Interpolate this DTM onto the grid, then shift it to match what is already filled (different DTMs have
    // datum offsets of metres to tens of metres – without this, seams show up as steps or walls).
    const vals = new Float32Array(W * H).fill(NaN);
    const diffs = [];
    for (let j = 0; j < H; j++) {
      const r = rowF[j], ri = Math.floor(r), fy = r - ri;
      if (ri < 0 || ri >= hh - 1) continue;
      for (let i = 0; i < W; i++) {
        const t = j * W + i;
        const c = colF[i], ci = Math.floor(c), fx = c - ci;
        if (ci < 0 || ci >= ww - 1) continue;
        const o = ri * ww + ci;
        const a = data[o], b = data[o + 1], cc = data[o + ww], dd = data[o + ww + 1];
        if (isNoData(a) || isNoData(b) || isNoData(cc) || isNoData(dd)) continue;
        const v = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + cc * (1 - fx) * fy + dd * fx * fy;
        vals[t] = v;
        if (!Number.isNaN(z[t]) && diffs.length < 200000) diffs.push(v - z[t]);
      }
    }
    let shift = 0;
    if (diffs.length >= 30) {
      diffs.sort((x, y) => x - y);
      shift = diffs[Math.floor(diffs.length / 2)];
    }
    let added = 0;
    for (let t = 0; t < W * H; t++) {
      if (!Number.isNaN(z[t]) || Number.isNaN(vals[t])) continue;
      z[t] = vals[t] - shift;
      srcOf[t] = used.length + 1;
      added++;
    }
    if (added) {
      used.push({ id: src.id, kind: src.kind, pixel: dem.rx * sc, share: 0, shift });
      filled += added;
    }
  }
  if (!used.length) return null;
  const counts = new Array(used.length + 1).fill(0);
  for (let t = 0; t < W * H; t++) counts[srcOf[t]]++;
  used.forEach((u, i) => (u.share = counts[i + 1] / (W * H)));
  const main = used.reduce((a, b) => (b.share > a.share ? b : a));
  return {
    w: W, h: H, z, srcOf,
    dx: extX / W,
    dy: extY / H,
    cx: W / 2 - 0.5,
    cy: H / 2 - 0.5,
    halfX: extX / 2,
    halfY: extY / 2,
    box,
    pixel: Math.max(res, Math.min(...used.map((u) => u.pixel))),
    sources: used,
    demId: main.id,
    kind: main.kind,
    toLocal: (la, lo) => ({ x: (lo - lonC) * mPerDeg * cosl, y: (la - latC) * mPerDeg }),
  };
}

// Quick estimate for the cut-out panel: grid resolution and the share each data class would get.
async function demMosaicInfo(box, maxPx = 2048) {
  const [w, s, e, n] = box;
  await ensureDemsFor(box);
  const mPerDeg = (DEM_RADIUS_M * Math.PI) / 180;
  const ext = Math.max((e - w) * mPerDeg * Math.cos((((s + n) / 2) * Math.PI) / 180), (n - s) * mPerDeg);
  const shares = { hirise: 0, ctx: 0, mola: 0 };
  let finest = Infinity;
  const N = 9;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const d = demsAt(s + ((n - s) * (i + 0.5)) / N, w + ((e - w) * (j + 0.5)) / N)[0];
      if (!d) continue;
      shares[d.kind] += 1 / (N * N);
      finest = Math.min(finest, d.gsd);
    }
  return { res: Math.max(finest, ext / maxPx), finest, shares };
}
