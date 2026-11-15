// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Camera geometry for rover raw images (view cone on the map).

// ---------- Camera geometry ----------
// Raw image metadata carries the CAHVOR(E) camera model and the pointing vector in the ROVER frame
// (x forward, y right, z down): the front Hazcam points to ~349° and the rear Hazcam to ~179° on every sol.
// The rover attitude quaternion (w, x, y, z) gives the rover's yaw in the local site frame (x north, y east).
// Compass azimuth of the view = rover yaw + camera azimuth in the rover frame (rover tilt ignored).

const parseVec = (s) => (typeof s === "string" ? s.replace(/[()]/g, "").split(",").map(Number) : null);
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (v) => Math.hypot(v[0], v[1], v[2]);
const toDeg = (r) => (r * 180) / Math.PI;

function quaternionYaw(att) {
  const q = parseVec(att);
  if (!q || q.length !== 4 || q.some((v) => !Number.isFinite(v))) return null;
  const [w, x, y, z] = q;
  return (toDeg(Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))) + 360) % 360;
}

// Returns { azimuth, elevation, hfov } in degrees or null when the metadata is incomplete.
function viewGeometry(img) {
  const v = parseVec(img.cameraVector);
  const yaw = quaternionYaw(img.attitude);
  if (!v || v.length !== 3 || v.some((x) => !Number.isFinite(x)) || yaw == null) return null;
  const camAz = toDeg(Math.atan2(v[1], v[0]));
  const elevation = -toDeg(Math.asin(Math.max(-1, Math.min(1, v[2] / norm3(v)))));
  let hfov = null;
  const parts = (img.cameraModel || "").split(";").map(parseVec);
  const dim = parseVec(img.dimension);
  if (parts.length >= 4 && parts[1] && parts[2] && dim) {
    const fx = norm3(cross3(parts[1], parts[2])); // focal length in pixels (pinhole part of the model)
    if (fx > 0) hfov = 2 * toDeg(Math.atan(dim[0] / 2 / fx));
  }
  return { azimuth: (yaw + camAz + 360) % 360, elevation, hfov };
}

// Sector polygon on the map (flat-earth approximation over tens of metres).
function viewConeLatLngs(lat, lon, azimuth, hfov, radiusM) {
  const R = MARS.RADIUS_KM * 1000;
  const half = Math.min(Math.max(hfov || 30, 5), 170) / 2;
  const pts = [[lat, lon]];
  for (let a = azimuth - half; a <= azimuth + half + 0.01; a += Math.max(2, half / 10)) {
    const b = (a * Math.PI) / 180;
    pts.push([lat + toDeg((radiusM * Math.cos(b)) / R), lon + toDeg((radiusM * Math.sin(b)) / (R * Math.cos((lat * Math.PI) / 180)))]);
  }
  pts.push([lat, lon]);
  return pts;
}

function compassLabel(az) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(az / 45) % 8];
}
