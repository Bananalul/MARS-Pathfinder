// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Relative ground character from the THEMIS nighttime IR mosaic (Mars Odyssey).
// Night brightness tracks thermal inertia: dark = fine dust / loose sand, bright = rock / indurated ground.
// Tile pixels are 8-bit display values, not calibrated temperatures, so classes are relative to the route's surroundings.

const NIGHT_IR_URL =
  "https://trek.nasa.gov/tiles/Mars/EQ/THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm";
const NIGHT_IR_ZOOM = 9; // native level, ~100 m/px source
const NIGHT_IR_LAT_LIMIT = 65; // mosaic coverage
const NIGHT_IR_REF_PAD_DEG = 0.035; // ~2 km around the route for the local reference distribution
const NIGHT_IR_LOW_PCT = 0.1;
const NIGHT_IR_HIGH_PCT = 0.9;

const irTileCache = new Map();

function irTileIndex(lat, lon) {
  const deg = 180 / 2 ** NIGHT_IR_ZOOM;
  const row = (90 - lat) / deg;
  const col = (lon + 180) / deg;
  return { row: Math.floor(row), col: Math.floor(col), px: Math.floor((col % 1) * 256), py: Math.floor((row % 1) * 256) };
}

function loadIrTile(row, col) {
  const key = `${row}/${col}`;
  if (!irTileCache.has(key)) {
    irTileCache.set(
      key,
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const cv = document.createElement("canvas");
          cv.width = cv.height = 256;
          const cx = cv.getContext("2d", { willReadFrequently: true });
          cx.drawImage(img, 0, 0);
          resolve(cx.getImageData(0, 0, 256, 256).data);
        };
        img.onerror = () => resolve(null);
        img.src = `${NIGHT_IR_URL}/${NIGHT_IR_ZOOM}/${row}/${col}.png`;
      })
    );
  }
  return irTileCache.get(key);
}

async function nightIrValues(points) {
  return Promise.all(
    points.map(async ({ lat, lon }) => {
      if (Math.abs(lat) > NIGHT_IR_LAT_LIMIT) return null;
      const ti = irTileIndex(lat, lon);
      const data = await loadIrTile(ti.row, ti.col);
      if (!data) return null;
      const i = (ti.py * 256 + ti.px) * 4;
      return data[i + 3] === 0 ? null : data[i];
    })
  );
}

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}

// Classifies route samples against a grid sampled around the route.
async function classifyNightIr(samples) {
  const lats = samples.map((s) => s.lat);
  const lons = samples.map((s) => s.lon);
  const s = Math.min(...lats) - NIGHT_IR_REF_PAD_DEG;
  const n = Math.max(...lats) + NIGHT_IR_REF_PAD_DEG;
  const w = Math.min(...lons) - NIGHT_IR_REF_PAD_DEG;
  const e = Math.max(...lons) + NIGHT_IR_REF_PAD_DEG;
  const grid = [];
  const N = 40;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) grid.push({ lat: s + ((n - s) * (i + 0.5)) / N, lon: w + ((e - w) * (j + 0.5)) / N });

  const [ref, vals] = await Promise.all([nightIrValues(grid), nightIrValues(samples)]);
  const sorted = ref.filter((v) => v != null).sort((a, b) => a - b);
  if (sorted.length < 100) return null;
  const low = percentile(sorted, NIGHT_IR_LOW_PCT);
  const high = percentile(sorted, NIGHT_IR_HIGH_PCT);
  return {
    low,
    high,
    values: vals.map((v) => (v == null ? null : { value: v, cls: v <= low ? "low" : v >= high ? "high" : "mid" })),
  };
}
