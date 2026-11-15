// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Mars geodesy helpers. Coordinates: planetocentric latitude, east-positive longitude.
// Trek EQ tiles use the IAU 2000 Mars sphere (EPSG:104905), R = 3396.19 km.

const MARS = {
  RADIUS_KM: 3396.19,
};
MARS.CIRCUMFERENCE_KM = 2 * Math.PI * MARS.RADIUS_KM;

function normalizeLon180(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

function lonTo360(lon) {
  return ((lon % 360) + 360) % 360;
}

function formatLat(lat, digits = 4) {
  return `${Math.abs(lat).toFixed(digits)}° ${lat >= 0 ? "N" : "S"}`;
}

function formatLonEast(lon, digits = 4) {
  return `${lonTo360(lon).toFixed(digits)}° E`;
}

function formatLon180(lon, digits = 4) {
  const l = normalizeLon180(lon);
  return `${Math.abs(l).toFixed(digits)}° ${l >= 0 ? "E" : "W"}`;
}

// Ground distance per screen pixel along a parallel, for Leaflet's EPSG:4326 CRS
// (world = 512 * 2^zoom px wide at zoom level).
function kmPerPixel(zoom, lat) {
  const worldPx = 512 * Math.pow(2, zoom);
  return (MARS.CIRCUMFERENCE_KM / worldPx) * Math.cos((lat * Math.PI) / 180);
}

// Great-circle distance on the Mars sphere (haversine).
function greatCircleKm(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS.RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Parses "18.44, 77.45" or "18.44N 77.45E" / "4.5S 137.4E" / "-4.5 222.6".
function parseCoordinates(text) {
  const m = text
    .trim()
    .toUpperCase()
    .match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?[\s,;]+(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?$/);
  if (!m) return null;
  let lat = parseFloat(m[1]);
  let lon = parseFloat(m[3]);
  if (m[2] === "S") lat = -Math.abs(lat);
  if (m[4] === "W") lon = -Math.abs(lon);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 360) return null;
  return { lat, lon: normalizeLon180(lon) };
}
