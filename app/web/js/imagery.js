// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Surface imagery for the 3D view: composes map tiles over a lon/lat box into one canvas.
//   1. Global CTX mosaic (MRO CTX, Caltech Murray Lab, ≈5 m/px), listed in NASA Mars Trek, served by Esri.
//   2. NASA Mars Trek HiRISE mosaics (25–50 cm/px) on top where they exist.
// Tile grids were read from the services' WMTS / MapServer capabilities (equirectangular, Mars 2000 sphere).

const CTX_GLOBAL = {
  url: "https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{z}/{y}/{x}",
  tile: 512,
  res0: 0.3515625, // degrees per pixel at level 0
  maxZ: 12, // level 12 ≈ 5 m/px; level 13 is not served
  label: "MRO CTX global mosaic (Caltech Murray Lab, ≈5 m/px)",
};

// [Trek layer id, [west, south, east, north], max zoom, name] – NASA Mars Trek HiRISE mosaics.
const HIRISE_MOSAICS = [
  ["curiosity_hirise_mosaic", [137.12247, -4.92547, 137.72981, -4.24896], 16, "Curiosity roving site"],
  ["JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd", [77.22293, 18.3068, 77.58396, 18.66932], 17, "Jezero (controlled)"],
  ["ESP_042252_1930_RED_B_01_ORTHO", [-4.31892, 12.45094, -4.19368, 12.82865], 15, "Marth crater west rim"],
  ["HiRISE_ColumbiaHills", [175.31834, -14.84729, 175.79673, -14.2503], 16, "Columbia Hills"],
  ["ESP_040776_2115_RED_A_01_ORTHO", [-28.69299, 31.23919, -28.55297, 31.52623], 16, "Ares 3 site"],
  ["ESP_042647_1760_RED_B_01_ORTHO", [15.15147, -4.12122, 15.25978, -3.81315], 15, "Ares 4 site"],
  ["ESP_058005_1845_RED_spline_rect", [135.56877, 4.33049, 135.6963, 4.66801], 17, "InSight landing site"],
  ["opportunity_hirise_mosaic", [-5.59644, -2.75133, -4.99541, -1.89944], 17, "Opportunity roving site"],
  ["phoenix_hirise_mosaic", [-125.88982, 68.16598, -125.66079, 68.24994], 16, "Phoenix landing site"],
  ["sojourner_hirise_mosaic", [-33.28797, 19.02279, -33.20873, 19.15985], 16, "Sojourner roving site"],
  ["PSP_001918_1735_RED_A_01_ORTHO_longlat", [-76.98238, -6.56132, -76.87329, -6.37758], 16, "SW Candor Chasma"],
  ["spirit_hirise_mosaic", [175.42785, -14.6925, 175.5858, -14.53575], 17, "Spirit roving site"],
  ["PSP_001521_2025_RED", [-48.03151, 22.0912, -47.86277, 22.46086], 17, "Viking 1 landing site"],
  ["PSP_001501_2280_RED", [134.19901, 47.56335, 134.39963, 47.78363], 16, "Viking 2 landing site"],
];

function loadTileImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Draws one tile pyramid level over the canvas. tileDeg = degrees per tile, origin (-180, 90).
async function drawTileLayer(cx, box, W, H, tileDeg, urlOf, maxTiles, onTile, range = box) {
  const [w, s, e, n] = box;
  const [rw, rs, re, rn] = range; // tiles are requested only for this part of the box
  const c0 = Math.floor((rw + 180) / tileDeg), c1 = Math.floor((re + 180 - 1e-12) / tileDeg);
  const r0 = Math.floor((90 - rn) / tileDeg), r1 = Math.floor((90 - rs - 1e-12) / tileDeg);
  const jobs = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) jobs.push([r, c]);
  if (jobs.length > maxTiles) return { skipped: true, tiles: jobs.length };
  const pxX = W / (e - w), pxY = H / (n - s);
  let loaded = 0, i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const [r, c] = jobs[i++];
      const img = await loadTileImage(urlOf(r, c));
      if (img) {
        const lon0 = -180 + c * tileDeg, lat0 = 90 - r * tileDeg;
        cx.drawImage(img, (lon0 - w) * pxX, (n - lat0) * pxY, tileDeg * pxX + 0.5, tileDeg * pxY + 0.5);
        loaded++;
      }
      onTile(loaded, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: 12 }, worker));
  return { loaded, tiles: jobs.length };
}

// Returns { canvas, sources } with the imagery for the box at W×H pixels (row 0 = north).
async function composeImagery(box, W, H, onProgress = () => {}) {
  const [w, s, e, n] = box;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const cx = cv.getContext("2d");
  cx.fillStyle = "#6b5444";
  cx.fillRect(0, 0, W, H);
  const degPx = Math.min((e - w) / W, (n - s) / H);
  const sources = [];

  // 1) Global CTX: finest level not finer than the canvas needs, within a tile budget.
  let z = 0;
  while (z < CTX_GLOBAL.maxZ && CTX_GLOBAL.res0 / 2 ** z > degPx) z++;
  for (; z >= 0; z--) {
    const tileDeg = (CTX_GLOBAL.res0 / 2 ** z) * CTX_GLOBAL.tile;
    const r = await drawTileLayer(cx, box, W, H, tileDeg, (row, col) => CTX_GLOBAL.url.replace("{z}", z).replace("{y}", row).replace("{x}", col), 300, (a, b) => onProgress({ layer: "CTX", a, b }));
    if (!r.skipped) {
      if (r.loaded) sources.push({ name: CTX_GLOBAL.label, mPerPx: (CTX_GLOBAL.res0 / 2 ** z) * ((DEM_RADIUS_M * Math.PI) / 180) });
      break;
    }
  }

  // 2) HiRISE mosaics on top.
  for (const [id, [bw, bs, be, bn], maxZ, name] of HIRISE_MOSAICS) {
    if (be < w || bw > e || bn < s || bs > n) continue;
    let hz = 0;
    while (hz < maxZ && 180 / (256 * 2 ** hz) > degPx) hz++;
    for (; hz >= 0; hz--) {
      const tileDeg = 180 / 2 ** hz;
      const url = (row, col) => `${TREK_BASE}/${id}/1.0.0/default/default028mm/${hz}/${row}/${col}.png`;
      const sub = [Math.max(w, bw), Math.max(s, bs), Math.min(e, be), Math.min(n, bn)];
      const r = await drawTileLayer(cx, box, W, H, tileDeg, url, 400, (a, b) => onProgress({ layer: "HiRISE", a, b }), sub);
      if (!r.skipped) {
        if (r.loaded) sources.push({ name: `MRO HiRISE mosaic – ${name} (NASA Mars Trek)`, mPerPx: (180 / (256 * 2 ** hz)) * ((DEM_RADIUS_M * Math.PI) / 180) });
        break;
      }
    }
  }
  return { canvas: cv, sources };
}
