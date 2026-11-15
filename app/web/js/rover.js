// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Rover traverses and raw ground images (NASA/JPL).
// Waypoints: MMGIS GeoJSON used by NASA's public "Where is the rover" maps.
// Images: raw image APIs behind mars.nasa.gov/mars2020/multimedia/raw-images and /msl/multimedia/raw-images.

const ROVERS = {
  jezero: {
    mission: "Perseverance (Mars 2020)",
    waypointsUrl: "https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json",
    galleryUrl: "https://mars.nasa.gov/mars2020/multimedia/raw-images/",
    cameras: ["NAVCAM_LEFT", "MCZ_LEFT", "FRONT_HAZCAM_LEFT_A", "REAR_HAZCAM_LEFT", "SUPERCAM_RMI", "NAVCAM_RIGHT"],
    async images(sol) {
      const images = [];
      for (let page = 0; page < 3; page++) {
        const url =
          `https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&num=100&page=${page}` +
          `&order=sol+desc&condition_2=${sol}:sol:gte&condition_3=${sol}:sol:lte&extended=sample_type::full,`;
        const data = await fetchJson(url);
        images.push(...data.images);
        if (data.images.length < 100) break;
      }
      return images.map((i) => ({
        camera: i.camera.instrument,
        cameraVector: i.camera.camera_vector,
        cameraModel: i.camera.camera_model_component_list,
        attitude: i.attitude,
        dimension: i.extended?.dimension,
        thumb: i.image_files.small,
        large: i.image_files.large || i.image_files.medium,
        link: i.link,
        date: i.date_taken_utc,
        title: i.title,
        credit: i.credit || "NASA/JPL-Caltech",
      }));
    },
  },
  gale: {
    mission: "Curiosity (MSL)",
    waypointsUrl: "https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json",
    galleryUrl: "https://mars.nasa.gov/msl/multimedia/raw-images/",
    cameras: ["NAV_LEFT_B", "NAV_LEFT_A", "MAST_LEFT", "FHAZ_LEFT_B", "FHAZ_LEFT_A", "MAST_RIGHT", "RHAZ_LEFT_A"],
    async images(sol) {
      const items = [];
      for (let page = 0; page < 3; page++) {
        const url =
          "https://mars.nasa.gov/api/v1/raw_image_items/?order=sol%20desc&per_page=100" +
          `&page=${page}&condition_1=msl:mission&condition_2=${sol}:sol:gte&condition_3=${sol}:sol:lte`;
        const data = await fetchJson(url);
        items.push(...data.items);
        if (items.length >= data.total || !data.items.length) break;
      }
      return items
        .filter((i) => !i.is_thumbnail)
        .map((i) => ({
          camera: i.instrument,
          cameraVector: i.camera_vector,
          cameraModel: i.camera_model_component_list,
          attitude: i.attitude,
          dimension: i.extended?.dimension || null,
          thumb: i.https_url,
          large: i.https_url,
          link: `https://mars.nasa.gov/raw_images/${i.id}`,
          date: i.date_taken,
          title: i.title,
          credit: i.image_credit || "NASA/JPL-Caltech",
        }));
    },
  },
};

const ROVER_MAX_DISTANCE_M = 500; // beyond this the rover images are not representative
const ROVER_IMAGE_LIMIT = 12;
const traverseCache = new Map();
const imageCache = new Map();

async function fetchJson(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (err) {
    const r = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
    if (!r.ok) throw new Error(`HTTP ${r.status} (proxy)`);
    return r.json();
  }
}

async function loadTraverse(siteId) {
  const rover = ROVERS[siteId];
  if (!rover) return null;
  if (!traverseCache.has(siteId)) {
    traverseCache.set(
      siteId,
      fetchJson(rover.waypointsUrl).then((gj) =>
        gj.features
          .map((f) => ({
            lat: f.properties.lat,
            lon: f.properties.lon,
            sol: f.properties.sol,
            site: f.properties.site,
            drive: f.properties.drive,
            elev: f.properties.elev_geoid,
            distTotal: f.properties.dist_total_m,
          }))
          .filter((w) => Number.isFinite(w.lat) && Number.isFinite(w.lon))
      )
    );
  }
  try {
    return await traverseCache.get(siteId);
  } catch (err) {
    traverseCache.delete(siteId);
    throw err;
  }
}

function nearestRoverStop(stops, lat, lon) {
  let best = null;
  for (const s of stops) {
    const d = greatCircleKm(lat, lon, s.lat, s.lon) * 1000;
    if (!best || d < best.dist) best = { stop: s, dist: d };
  }
  return best;
}

async function roverImages(siteId, sol) {
  const key = `${siteId}:${sol}`;
  if (!imageCache.has(key)) {
    const rover = ROVERS[siteId];
    imageCache.set(
      key,
      rover.images(sol).then((list) => {
        const rank = (cam) => {
          const i = rover.cameras.indexOf(cam);
          return i < 0 ? 99 : i;
        };
        // Round-robin over the preferred cameras so the gallery mixes viewpoints.
        const byCam = rover.cameras.map((cam) => list.filter((img) => img.camera === cam));
        const picked = [];
        for (let i = 0; picked.length < ROVER_IMAGE_LIMIT && byCam.some((g) => i < g.length); i++) {
          for (const g of byCam) if (g[i] && picked.length < ROVER_IMAGE_LIMIT) picked.push(g[i]);
        }
        return picked;
      })
    );
  }
  try {
    return await imageCache.get(key);
  } catch (err) {
    imageCache.delete(key);
    throw err;
  }
}

// ---------- UI ----------

function initGroundView(map, onSelectStop) {
  const el = (id) => document.getElementById(id);
  const traverseLayer = L.layerGroup().addTo(map);
  const coneLayer = L.layerGroup().addTo(map);
  let pinnedCone = null;
  let currentStop = null;
  let currentImg = null;

  function drawCone(img, pinned) {
    coneLayer.clearLayers();
    const g = img && currentStop ? viewGeometry(img) : null;
    if (!g) return;
    const radius = /MCZ|MAST/.test(img.camera) ? 80 : 35;
    L.polygon(viewConeLatLngs(currentStop.lat, currentStop.lon, g.azimuth, g.hfov, radius), {
      color: "#d9813f",
      weight: 1.5,
      fillColor: "#d9813f",
      fillOpacity: pinned ? 0.35 : 0.2,
      interactive: false,
    }).addTo(coneLayer);
  }

  function clearCone() {
    if (pinnedCone) drawCone(pinnedCone, true);
    else coneLayer.clearLayers();
  }
  let activeSite = null;
  let requestToken = 0;

  async function showTraverse(siteId) {
    traverseLayer.clearLayers();
    activeSite = siteId;
    if (!ROVERS[siteId] || !el("toggle-traverse").checked) return;
    try {
      const stops = await loadTraverse(siteId);
      if (activeSite !== siteId) return;
      L.polyline(stops.map((s) => [s.lat, s.lon]), {
        color: "#e8e1d0",
        weight: 1.5,
        opacity: 0.8,
        interactive: false,
      }).addTo(traverseLayer);
      for (const s of stops) {
        L.circleMarker([s.lat, s.lon], { radius: 2.5, weight: 0, fillColor: "#e8e1d0", fillOpacity: 0.9 })
          .bindTooltip(`${ROVERS[siteId].mission}<br>Sol ${s.sol} · Site ${s.site}, Drive ${s.drive}`, { className: "map-tooltip" })
          .on("click", (e) => {
            L.DomEvent.stop(e);
            onSelectStop(s.lat, s.lon);
          })
          .addTo(traverseLayer);
      }
    } catch (err) {
      console.error("Traverse could not be loaded:", err);
    }
  }

  el("toggle-traverse").addEventListener("change", () => showTraverse(activeSite));

  async function showFor(siteId, lat, lon) {
    const token = ++requestToken;
    pinnedCone = null;
    coneLayer.clearLayers();
    const box = el("ground-view");
    const rover = ROVERS[siteId];
    if (!rover) {
      box.innerHTML = `<div class="muted">Ground images are available for the Jezero and Gale sites.</div>`;
      return;
    }
    box.innerHTML = `<div class="muted">Finding nearest rover stop …</div>`;
    try {
      const stops = await loadTraverse(siteId);
      const near = nearestRoverStop(stops, lat, lon);
      if (token !== requestToken) return;
      if (!near || near.dist > ROVER_MAX_DISTANCE_M) {
        box.innerHTML = `<div class="muted">${t("No {mission} stop within {max} m (nearest: {d}).", {
          mission: rover.mission,
          max: ROVER_MAX_DISTANCE_M,
          d: near ? formatDistance(near.dist / 1000) : "–",
        })}</div>`;
        return;
      }
      box.innerHTML = `
        <div class="ground-head">${rover.mission} · Sol ${near.stop.sol}<br>
          <span class="muted">${t("Stop {d} from the point", { d: formatDistance(near.dist / 1000) })} · Site ${near.stop.site}, Drive ${near.stop.drive}</span></div>
        <div class="muted small">Loading raw images …</div>`;
      const imgs = await roverImages(siteId, near.stop.sol);
      if (token !== requestToken) return;
      currentStop = near.stop;
      renderGallery(box, rover, near, imgs);
    } catch (err) {
      console.error(err);
      if (token === requestToken) box.innerHTML = `<div class="warn">NASA raw images could not be loaded.</div>`;
    }
  }

  function renderGallery(box, rover, near, imgs) {
    const head = box.querySelector(".ground-head").outerHTML;
    if (!imgs.length) {
      box.innerHTML = `${head}<div class="muted small">${t("No navigation or mast camera images for sol {sol}.", { sol: near.stop.sol })}</div>`;
      return;
    }
    box.innerHTML = `${head}
      <div class="gallery"></div>
      <div class="muted small">Raw images from the rover position on this sol. Viewing direction varies per image.
        <span class="badge badge-measured">Measured</span> <a href="${rover.galleryUrl}" target="_blank" rel="noopener">Gallery</a></div>`;
    const gallery = box.querySelector(".gallery");
    for (const img of imgs) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "thumb";
      b.title = `${img.camera} · ${img.date || ""}`;
      const g = viewGeometry(img);
      b.innerHTML = `<img src="${img.thumb}" alt="${img.title}" loading="lazy"><span>${img.camera}</span>${
        g ? `<em class="dir" style="--az:${g.azimuth.toFixed(0)}deg" title="${t("View direction")}">${g.azimuth.toFixed(0)}° ${compassLabel(g.azimuth)}</em>` : ""
      }`;
      b.addEventListener("mouseenter", () => drawCone(img, false));
      b.addEventListener("mouseleave", clearCone);
      b.addEventListener("click", () => openLightbox(img));
      b.dataset.large = img.large;
      gallery.appendChild(b);
    }
    window.markSketchThumbs?.();
  }

  function openLightbox(img) {
    currentImg = img;
    pinnedCone = img;
    drawCone(img, true);
    const g = viewGeometry(img);
    el("lightbox-geom").textContent = g
      ? t("View direction {az}° ({dir}), elevation {el}°, field of view ≈ {fov}° – from the camera model in the NASA metadata.", {
          az: g.azimuth.toFixed(0),
          dir: compassLabel(g.azimuth),
          el: g.elevation.toFixed(0),
          fov: g.hfov ? g.hfov.toFixed(0) : "?",
        })
      : t("View direction not available in the metadata of this image.");
    el("lightbox-img").src = img.large;
    el("lightbox-caption").innerHTML = `${img.title}<br><span class="muted">${img.date || ""} · ${t("Image")}: ${img.credit}</span>
      · <a href="${img.link}" target="_blank" rel="noopener">open at NASA</a>`;
    el("lightbox").showModal();
  }

  el("lightbox-close").addEventListener("click", () => el("lightbox").close());
  el("lightbox").addEventListener("click", (e) => {
    if (e.target === el("lightbox")) el("lightbox").close();
  });

  return { showTraverse, showFor };
}
