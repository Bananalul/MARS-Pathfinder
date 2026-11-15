// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Mars time and Sun position from an Earth UTC time.
// Algorithm: NASA GISS Mars24 (Allison & McEwen 2000, Planet. Space Sci. 48, 215; updated constants from
// https://www.giss.nasa.gov/tools/mars24/help/algorithm.html). Longitudes east-positive.

const MT_TT_UTC_S = 69.184; // 37 leap seconds + 32.184 s (valid since 2017)
const MT_SOL_S = 88775.244; // one mean solar day on Mars in seconds
const MT_PBS = [
  [0.0071, 2.2353, 49.409],
  [0.0057, 2.7543, 168.173],
  [0.0039, 1.1177, 191.837],
  [0.0037, 15.7866, 21.736],
  [0.0021, 2.1354, 15.704],
  [0.002, 2.4694, 95.528],
  [0.0018, 32.8493, 49.095],
];
const D2R = Math.PI / 180;
const mod = (a, n) => ((a % n) + n) % n;

// Everything that depends only on time (not on place).
function marsTime(utcMs) {
  const jdUt = 2440587.5 + utcMs / 86400000;
  const jdTt = jdUt + MT_TT_UTC_S / 86400;
  const dt = jdTt - 2451545.0;
  const M = mod(19.3871 + 0.52402073 * dt, 360);
  const alphaFms = mod(270.3871 + 0.524038496 * dt, 360);
  let pbs = 0;
  for (const [A, tau, phi] of MT_PBS) pbs += A * Math.cos(D2R * ((0.985626 * dt) / tau + phi));
  const s = (k) => Math.sin(k * M * D2R);
  const eoc = (10.691 + 3.0e-7 * dt) * s(1) + 0.623 * s(2) + 0.05 * s(3) + 0.005 * s(4) + 0.0005 * s(5) + pbs; // ν − M
  const ls = mod(alphaFms + eoc, 360);
  const L = ls * D2R;
  const eotDeg = 2.861 * Math.sin(2 * L) - 0.071 * Math.sin(4 * L) + 0.002 * Math.sin(6 * L) - eoc;
  const msd = (dt - 4.5) / 1.0274912517 + 44796.0 - 0.0009626;
  const mtc = mod(24 * msd, 24);
  const decl = Math.asin(0.42565 * Math.sin(L)) / D2R + 0.25 * Math.sin(L);
  const c = (k) => Math.cos(k * M * D2R);
  const rAu = 1.523679 * (1.00436 - 0.09309 * c(1) - 0.004336 * c(2) - 0.00031 * c(3) - 0.00003 * c(4));
  // Mars year numbering after Clancy et al. (2000): MY 1 began 11 April 1955 (Ls 0).
  const myStart = Date.UTC(1955, 3, 11, 0, 0, 0);
  const marsYear = 1 + Math.floor((utcMs - myStart) / (686.9726 * 86400000) + 1e-9);
  return { utcMs, msd, mtc, ls, eotDeg, decl, rAu, marsYear };
}

// Local true solar time (hours) and Sun position at a place.
function marsSun(mt, lat, lonEast) {
  const lmst = mod(mt.mtc + lonEast / 15, 24);
  const ltst = mod(lmst + mt.eotDeg / 15, 24);
  const H = (ltst - 12) * 15 * D2R;
  const phi = lat * D2R, d = mt.decl * D2R;
  const cosZ = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H);
  const elev = Math.asin(Math.max(-1, Math.min(1, cosZ))) / D2R;
  return { lmst, ltst, cosZ, elev };
}

function marsSeason(ls, lat) {
  const north = ["spring", "summer", "autumn", "winter"][Math.floor(mod(ls, 360) / 90)];
  if (lat >= 0) return north;
  return { spring: "autumn", summer: "winter", autumn: "spring", winter: "summer" }[north];
}

function fmtHours(h) {
  const m = Math.round(mod(h, 24) * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Earth time at which the next local true solar time `ltstTarget` occurs at lonEast, after utcMs.
function nextLocalTime(utcMs, lonEast, ltstTarget) {
  let t = utcMs;
  for (let i = 0; i < 4; i++) {
    const now = marsSun(marsTime(t), 0, lonEast).ltst;
    const dh = i === 0 ? mod(ltstTarget - now, 24) : ((ltstTarget - now + 36) % 24) - 12;
    t += (dh / 24) * MT_SOL_S * 1000;
  }
  return t;
}
