// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Thematic map views: geophysical, spectral, atmospheric, geochemical, magnetic, seismic, hydrological, volcanological,
// petrological, crystallographic, geomorphological, meteorological. Each layer names its source and data class.

const MAG_URL = "https://zenodo.org/api/records/3876714/files/Langlais2019.sh.gz/content";

function initThematic(map, hooks = {}) {
  const el = (id) => document.getElementById(id);
  const tr = (en, de) => (LANG === "de" ? de : en);

  // Colour ramps
  const SEQ = [[0, [48, 18, 59]], [0.15, [65, 105, 225]], [0.3, [30, 170, 230]], [0.45, [40, 210, 160]], [0.6, [170, 230, 60]], [0.75, [250, 200, 40]], [0.88, [240, 110, 30]], [1, [170, 20, 20]]];
  const DIV = [[0, [33, 70, 160]], [0.25, [90, 150, 220]], [0.5, [245, 245, 245]], [0.75, [235, 120, 90]], [1, [170, 20, 30]]];
  const ramp = (stops, f) => {
    f = Math.max(0, Math.min(1, f));
    let i = 0;
    while (i < stops.length - 2 && stops[i + 1][0] < f) i++;
    const [fa, ca] = stops[i], [fb, cb] = stops[i + 1];
    const u = (f - fa) / (fb - fa);
    return ca.map((c, k) => Math.round(c + (cb[k] - c) * u));
  };
  const rampCss = (stops) => `linear-gradient(90deg, ${stops.map(([f, c]) => `rgb(${c}) ${f * 100}%`).join(", ")})`;
  const RAINBOW_CSS = "linear-gradient(90deg, #5a1bd6, #2f5bff, #20c0e0, #4fd860, #f2e03a, #f08a2a, #d62020)";

  const B = { m: "measured", d: "derived", i: "illustrative" };
  // Some Trek layers are served by ArcGIS MapServer WMTS endpoints (same 2×1-at-z0 tile matrix as the map).
  const arcTile = (svc, name) => `https://trek.nasa.gov/mars/${svc}/rest/services/${name}/MapServer/WMTS/tile/1.0.0/${name}/default/default028mm/{z}/{y}/{x}.png`;
  const TREK_NOTE = tr("Colours as rendered by NASA Mars Trek (violet = low → red = high).", "Farben wie von NASA Mars Trek dargestellt (violett = niedrig → rot = hoch).");

  // ---------- Layer definitions ----------
  const L_ = {
    freeair: { type: "geo", key: "freeair", name: tr("Free-air gravity anomaly", "Freiluft-Schwereanomalie"), unit: "mGal", min: -600, max: 600, div: true, cls: B.m,
      note: tr("Gravity measured by tracking the MRO, Mars Odyssey and MGS spacecraft (NASA model GMM-3, Genova et al. 2016; map to degree 100 ≈ 100 km). Positive over the big volcanoes and mascons.", "Schwerefeld aus der Bahnverfolgung von MRO, Mars Odyssey und MGS (NASA-Modell GMM-3, Genova et al. 2016; Karte bis Grad 100 ≈ 100 km). Positiv über großen Vulkanen und Mascons.") },
    bouguer: { type: "geo", key: "bouguer", name: tr("Bouguer gravity anomaly", "Bouguer-Schwereanomalie"), unit: "mGal", min: -600, max: 600, div: true, cls: B.d,
      note: tr("Free-air anomaly minus the attraction of the topography: shows density differences below the surface.", "Freiluft-Anomalie minus Anziehung der Topographie: zeigt Dichteunterschiede unter der Oberfläche.") },
    crust: { type: "geo", key: "crust", name: tr("Crustal thickness", "Krustendicke"), unit: "km", min: 0, max: 100, cls: B.d,
      note: tr("Model from gravity + MOLA topography (assumed crust and mantle densities). Thick crust under Tharsis and the southern highlands, thin under Hellas and the northern plains.", "Modell aus Schwere + MOLA-Topographie (angenommene Dichten von Kruste und Mantel). Dicke Kruste unter Tharsis und dem Südhochland, dünn unter Hellas und den Nordebenen.") },
    roughness: { type: "trek", label: "mola_roughness", maxZ: 3, name: tr("Surface roughness (MOLA)", "Oberflächenrauigkeit (MOLA)"), cls: B.d, note: tr("Roughness from MOLA laser pulse spreading – rough terrain is harder to drive and land on. ", "Rauigkeit aus der Pulsverbreiterung des MOLA-Lasers – raues Gelände ist schwerer zu befahren und zu landen. ") + TREK_NOTE },
    clrshade: { type: "trek", label: "Mars_MGS_MOLA_ClrShade_merge_global_463m", ext: "jpg", maxZ: 9, opaque: true, name: tr("Elevation (MOLA colour hillshade)", "Höhe (MOLA-Farbrelief)"), cls: B.d, note: tr("Measured laser altimetry, coloured by height (blue low → white high).", "Gemessene Laseraltimetrie, nach Höhe gefärbt (blau tief → weiß hoch).") },
    albedo: { type: "trek", label: "Mars_MGS_TES_Albedo_mosaic_global_7410m", maxZ: 3, name: tr("Albedo (TES bolometric)", "Albedo (TES, bolometrisch)"), cls: B.m, note: tr("Brightness of the surface in visible + near-IR light. Bright = dust-covered, dark = rock and sand. ", "Helligkeit der Oberfläche im sichtbaren und nahen IR. Hell = staubbedeckt, dunkel = Fels und Sand. ") + TREK_NOTE },
    dustidx: { type: "trek", label: "tes_ruffdust", maxZ: 4, name: tr("Dust cover index (TES)", "Staubbedeckung (TES)"), cls: B.d, note: tr("Spectral index of how much fine dust covers the ground (Ruff & Christensen 2002). ", "Spektraler Index, wie viel Feinstaub den Boden bedeckt (Ruff & Christensen 2002). ") + TREK_NOTE },
    tesTI: { type: "trek", label: "TES_Thermal_Inertia", maxZ: 3, name: tr("Thermal inertia (TES)", "Wärmeträgheit (TES)"), cls: B.m, note: tr("How fast the ground heats and cools: low = dust/sand, high = rock. ", "Wie schnell der Boden sich erwärmt und abkühlt: niedrig = Staub/Sand, hoch = Fels. ") + TREK_NOTE },
    themisDay: { type: "trek", label: "THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018", maxZ: 11, opaque: true, name: tr("THEMIS daytime infrared (100 m)", "THEMIS-Tag-Infrarot (100 m)"), cls: B.m, note: tr("Thermal infrared images by day: shows morphology and sun-facing slopes (bright = warm).", "Thermalinfrarot-Bilder bei Tag: zeigt Formen und sonnenzugewandte Hänge (hell = warm).") },
    themisNight: { type: "trek", label: "THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018", maxZ: 11, opaque: true, name: tr("THEMIS night infrared (100 m)", "THEMIS-Nacht-Infrarot (100 m)"), cls: B.m, note: tr("Bright at night = rock or crust that stores heat; dark = dust and loose sand.", "Nachts hell = Fels oder Kruste, die Wärme speichert; dunkel = Staub und lockerer Sand.") },
    plag: { type: "trek", label: "TES_Plagioclase", maxZ: 3, name: tr("Plagioclase feldspar (TES)", "Plagioklas-Feldspat (TES)"), cls: B.d, note: tr("Abundance of plagioclase from TES spectra (Bandfield 2002) – the main light mineral of basalt. ", "Häufigkeit von Plagioklas aus TES-Spektren (Bandfield 2002) – das wichtigste helle Mineral im Basalt. ") + TREK_NOTE },
    cpx: { type: "trek", label: "TES_Clinopyroxene", maxZ: 3, name: tr("High-Ca pyroxene (TES)", "Ca-reicher Pyroxen (TES)"), cls: B.d, note: tr("Abundance of high-calcium pyroxene – a dark mineral of basaltic lava. ", "Häufigkeit von Ca-reichem Pyroxen – ein dunkles Mineral basaltischer Lava. ") + TREK_NOTE },
    glass: { type: "trek", label: "TES_Glass_Clay", maxZ: 3, name: tr("Sheet silicates / high-Si glass (TES)", "Schichtsilikate / Si-reiches Glas (TES)"), cls: B.d, note: tr("Spectrally similar phases: altered (weathered) material or volcanic glass – TES cannot tell them apart. ", "Spektral ähnliche Phasen: veränderte (verwitterte) Gesteine oder vulkanisches Glas – TES kann sie nicht unterscheiden. ") + TREK_NOTE },
    geology: { type: "trek", label: "SIM3292_Global_Geology", url: arcTile("trekarcgis", "SIM3292_Global_Geology"), maxZ: 11, name: tr("Geologic units (USGS SIM 3292)", "Geologische Einheiten (USGS SIM 3292)"), cls: B.d, note: tr("Mapped interpretation (Tanaka et al. 2014): red/pink = volcanic units of Tharsis and Elysium, browns = old highlands, blues = lowland units.", "Kartierte Interpretation (Tanaka et al. 2014): rot/rosa = vulkanische Einheiten von Tharsis und Elysium, braun = altes Hochland, blau = Tiefland-Einheiten.") },
    valleys: { type: "trek", label: "Hynek_Valley_Networks", url: arcTile("trekarcgis", "Hynek_Valley_Networks"), maxZ: 8, name: tr("Valley networks (Hynek et al. 2010)", "Talnetze (Hynek et al. 2010)"), cls: B.d, note: tr("Mapped ancient river valleys – evidence of rain or snowmelt more than 3.5 billion years ago.", "Kartierte alte Flusstäler – Hinweis auf Regen oder Schneeschmelze vor über 3,5 Milliarden Jahren.") },
    dunes: { type: "trek", label: "Dune_Field", url: arcTile("arcgis", "Dune_Field"), maxZ: 14, name: tr("Dune fields", "Dünenfelder"), cls: B.d, note: tr("Mapped dune fields – loose sand, hazard for wheels.", "Kartierte Dünenfelder – lockerer Sand, Gefahr für Räder.") },
    pressure: { type: "pressure", name: tr("Surface pressure (from elevation)", "Luftdruck am Boden (aus Höhe)"), unit: "Pa", min: 100, max: 1200, cls: B.d,
      note: tr("Annual mean estimate: 610 Pa at the MOLA datum, scale height 11.1 km. Seasonal CO₂ cycle changes it by about ±12 %.", "Jahresmittel-Schätzung: 610 Pa auf Nullniveau, Skalenhöhe 11,1 km. Der jahreszeitliche CO₂-Zyklus ändert ihn um etwa ±12 %.") },
    liquid: { type: "liquid", name: tr("Where liquid water is possible (pressure)", "Wo flüssiges Wasser möglich ist (Druck)"), cls: B.d,
      note: tr("Blue: mean pressure above water's triple point (611.66 Pa) – pure water could be liquid between 0 °C and its boiling point there. Elsewhere it boils or freezes at once. Temperature not included.", "Blau: mittlerer Druck über dem Tripelpunkt von Wasser (611,66 Pa) – reines Wasser könnte dort zwischen 0 °C und dem Siedepunkt flüssig sein. Sonst kocht oder gefriert es sofort. Temperatur nicht berücksichtigt.") },
    grs_k: { type: "grs", el: "k", name: tr("Potassium K (GRS)", "Kalium K (GRS)"), unit: "wt %", min: 0.15, max: 0.55, cls: B.m, note: tr("Gamma-ray spectrometer on Mars Odyssey, top tens of cm, 5° grid.", "Gammastrahlen-Spektrometer auf Mars Odyssey, oberste Dezimeter, 5°-Raster.") },
    grs_th: { type: "grs", el: "th", name: tr("Thorium Th (GRS)", "Thorium Th (GRS)"), unit: "ppm", min: 0.2, max: 0.9, cls: B.m, note: tr("Gamma-ray spectrometer on Mars Odyssey, 5° grid.", "Gammastrahlen-Spektrometer auf Mars Odyssey, 5°-Raster.") },
    grs_fe: { type: "grs", el: "fe", name: tr("Iron Fe (GRS)", "Eisen Fe (GRS)"), unit: "wt %", min: 10, max: 20, cls: B.m, note: tr("Gamma-ray spectrometer on Mars Odyssey, 5° grid.", "Gammastrahlen-Spektrometer auf Mars Odyssey, 5°-Raster.") },
    grs_si: { type: "grs", el: "si", name: tr("Silicon Si (GRS)", "Silizium Si (GRS)"), unit: "wt %", min: 18, max: 24, cls: B.m, note: tr("Gamma-ray spectrometer on Mars Odyssey, 5° grid.", "Gammastrahlen-Spektrometer auf Mars Odyssey, 5°-Raster.") },
    grs_cl: { type: "grs", el: "cl", name: tr("Chlorine Cl (GRS)", "Chlor Cl (GRS)"), unit: "wt %", min: 0.2, max: 0.8, cls: B.m, note: tr("Gamma-ray spectrometer on Mars Odyssey, 5° grid. Chlorine marks salts and volcanic gases.", "Gammastrahlen-Spektrometer auf Mars Odyssey, 5°-Raster. Chlor zeigt Salze und vulkanische Gase.") },
    grs_h2o: { type: "grs", el: "h2o", name: tr("Water-equivalent hydrogen (GRS)", "Wasseräquivalent aus Wasserstoff (GRS)"), unit: "wt % H₂O", min: 2, max: 8, cls: B.m, note: tr("Hydrogen in the top tens of cm, given as water. Only mid/low latitudes (poles saturated).", "Wasserstoff in den obersten Dezimetern, als Wasser angegeben. Nur mittlere/niedrige Breiten (Pole gesättigt).") },
    mag: { type: "mag", name: tr("Crustal magnetic field Br at the surface", "Krustenmagnetfeld Br an der Oberfläche"), unit: "nT", min: -2000, max: 2000, div: true, cls: B.d,
      note: tr("Radial field from the spherical-harmonic model of Langlais et al. (2019), degree 134, built from MGS and MAVEN magnetometer data. Mars has no global field today; these are magnetised rocks of the ancient crust (strongest in Terra Cimmeria/Sirenum).", "Radiales Feld aus dem Kugelfunktionsmodell von Langlais et al. (2019), Grad 134, aus Magnetometerdaten von MGS und MAVEN. Mars hat heute kein globales Feld; das sind magnetisierte Gesteine der alten Kruste (am stärksten in Terra Cimmeria/Sirenum).") },
    seismic: { type: "points", set: "seismic", name: tr("Seismic stations and sources (InSight)", "Seismische Station und Quellen (InSight)"), cls: B.m,
      note: tr("InSight recorded more than 1300 marsquakes (2018–2022). Most located quakes come from the Cerberus Fossae fault zone; two large meteorite impacts were also felt and their fresh craters found from orbit.", "InSight zeichnete über 1300 Marsbeben auf (2018–2022). Die meisten georteten Beben kommen aus der Störungszone Cerberus Fossae; zwei große Meteoriteneinschläge wurden ebenfalls gespürt und ihre frischen Krater aus dem Orbit gefunden.") },
    volcanoes: { type: "points", set: "volcanoes", name: tr("Major volcanoes", "Große Vulkane"), cls: B.d, note: tr("Main volcanic edifices at their IAU centre coordinates (USGS Gazetteer of Planetary Nomenclature). Combine with the geologic units or gravity.", "Wichtigste Vulkanbauten an ihren IAU-Mittelpunktskoordinaten (USGS Gazetteer of Planetary Nomenclature). Mit geologischen Einheiten oder Schwere kombinieren.") },
    crystal: { type: "points", set: "crystal", name: tr("Minerals by crystal structure", "Minerale nach Kristallstruktur"), cls: B.d,
      note: tr("Orbital mineral detections (CRISM/OMEGA, Ehlmann & Edwards 2014) grouped by structure: sheet silicates (layered), sulfates, carbonates (trigonal), chlorides (cubic), opaline silica (amorphous – no crystal lattice). Crystal structures on the ground were measured by X-ray diffraction with Curiosity's CheMin.", "Mineral-Nachweise aus dem Orbit (CRISM/OMEGA, Ehlmann & Edwards 2014), nach Struktur gruppiert: Schichtsilikate (geschichtet), Sulfate, Karbonate (trigonal), Chloride (kubisch), Opal-Silikat (amorph – kein Kristallgitter). Kristallstrukturen am Boden wurden mit Röntgenbeugung von Curiositys CheMin gemessen.") },
    env_temp: { type: "env", env: "temp", name: tr("Surface temperature (model, time-dependent)", "Oberflächentemperatur (Modell, zeitabhängig)"), cls: B.d, note: tr("Shown with the Environment layer controls below (time, dust, play one sol).", "Wird mit den Umwelt-Reglern darunter gesteuert (Zeit, Staub, Sol abspielen).") },
    env_uv: { type: "env", env: "uv", name: tr("UV irradiance (model, time-dependent)", "UV-Einstrahlung (Modell, zeitabhängig)"), cls: B.d, note: tr("Shown with the Environment layer controls below.", "Wird mit den Umwelt-Reglern darunter gesteuert.") },
    env_gcr: { type: "env", env: "gcr", name: tr("Cosmic radiation dose", "Kosmische Strahlendosis"), cls: B.d, note: tr("Shown with the Environment layer controls below.", "Wird mit den Umwelt-Reglern darunter gesteuert.") },
    env_soil: { type: "env", env: "soil", name: tr("Soil gamma dose (K, Th)", "Boden-Gammadosis (K, Th)"), cls: B.d, note: tr("Shown with the Environment layer controls below.", "Wird mit den Umwelt-Reglern darunter gesteuert.") },
  };

  const THEMES = [
    ["geophys", tr("Geophysical", "Geophysikalisch"), ["freeair", "bouguer", "crust", "roughness", "clrshade"]],
    ["spectral", tr("Spectral", "Spektral"), ["albedo", "dustidx", "tesTI", "themisDay", "themisNight"]],
    ["atmos", tr("Atmospheric", "Atmosphärisch"), ["pressure", "env_uv", "env_gcr", "dustidx"]],
    ["geochem", tr("Geochemical", "Geochemisch"), ["grs_k", "grs_th", "grs_fe", "grs_si", "grs_cl", "grs_h2o", "env_soil"]],
    ["magnetic", tr("Magnetic", "Magnetisch"), ["mag"]],
    ["seismic", tr("Seismic", "Seismisch"), ["seismic", "crust"]],
    ["hydro", tr("Hydrological", "Hydrologisch"), ["valleys", "liquid", "grs_h2o"]],
    ["volcano", tr("Volcanological", "Vulkanologisch"), ["volcanoes", "geology", "freeair"]],
    ["petro", tr("Petrological", "Petrologisch"), ["plag", "cpx", "glass", "geology"]],
    ["crystal", tr("Crystallographic", "Kristallografisch"), ["crystal"]],
    ["geomorph", tr("Geomorphological", "Geomorphologisch"), ["clrshade", "roughness", "themisDay", "dunes", "valleys"]],
    ["meteo", tr("Meteorological", "Meteorologisch"), ["env_temp", "env_uv", "pressure"]],
  ];

  // ---------- Data loading ----------
  let geo = null, geoPromise = null, magGrid = null, magPromise = null, poi = null;
  const loadGeo = () =>
    (geoPromise ||= fetch("data/geo-grids.json")
      .then(async (r) => {
        if (r.ok) return r.json();
        // Built earlier in this browser? (Cache Storage – survives reloads)
        try {
          const c = await caches.open("mars-pathfinder");
          const hit = await c.match("geo-grids-live.json");
          if (hit) return hit.json();
        } catch {}
        const meta = await buildGeoViaProxy();
        if (!meta.partial) try {
          const c = await caches.open("mars-pathfinder");
          await c.put("geo-grids-live.json", new Response(JSON.stringify(meta), { headers: { "content-type": "application/json" } }));
        } catch {}
        return meta;
      })
      .then((j) => (geo = j))
      .catch((e) => {
        geoPromise = null;
        throw e;
      }));

  // Fallback while web/data/geo-grids.json does not exist yet: read the same PDS rows through the local proxy
  // (works with app/main.py running; the server writes the file itself on its next start).
  async function buildGeoViaProxy() {
    const base = "https://pds-geosciences.wustl.edu/mro/mro-m-rss-5-sdp-v1/mrors_1xxx/data/rsdmap/";
    const maps = { freeair: "ggmro_120_anom_100.img", bouguer: "ggmro_120_bouguer_90.img", crust: "ggmro_120_crust.img" };
    const RB = 5760 * 8;
    const meta = { w: 360, h: 180, res: 1, west: -180, north: 90, layers: {}, grs: {} };
    const jobs = [];
    for (const [key, f] of Object.entries(maps)) {
      meta.layers[key] = { values: new Array(360 * 180).fill(NaN), source: `${key === "crust" ? "Crustal thickness from GMM-3 + MOLA (G. A. Neumann, NASA GSFC; crust 2900, mantle 3500 kg/m³)" : "NASA GMM-3 gravity field, PDS product GGMRO_120 (Genova et al. 2016)"} – PDS MRO-M-RSS-5-SDP-V1, 1° (read live)` };
      for (let j = 0; j < 180; j++) jobs.push([key, f, j]);
    }
    const total = jobs.length;
    let done = 0, failed = 0;
    const worker = async () => {
      while (jobs.length) {
        const [key, f, j] = jobs.shift();
        const row = 16 * j + 8;
        let v = null;
        for (let attempt = 0; attempt < 4 && !v; attempt++) {
          try {
            const r = await fetch(`/api/proxy?url=${encodeURIComponent(base + f)}`, { headers: { Range: `bytes=${row * RB}-${row * RB + RB - 1}` } });
            const buf = r.ok || r.status === 206 ? await r.arrayBuffer() : null;
            if (buf && buf.byteLength >= RB) v = new Float64Array(buf.slice(0, RB));
          } catch {}
          if (!v) await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
        }
        done++;
        if (!v) {
          failed++;
          continue; // row stays empty (NaN) – drawn transparent
        }
        for (let i = 0; i < 360; i++) meta.layers[key].values[j * 360 + i] = v[Math.min(5759, Math.floor((((-180 + i + 0.5) % 360) + 360) % 360 * 16))];
        if (done % 10 === 0) busyBar.set("thematic", tr("Reading gravity and crust maps from the PDS (one time) …", "Lese Schwere- und Krustenkarten aus dem PDS (einmalig) …"), (100 * done) / total);
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    if (failed > total * 0.2) throw new Error(`${failed} of ${total} PDS rows could not be read`);
    meta.partial = failed > 0;
    for (const el of ["fe", "si", "cl", "h2o", "k", "th"]) {
      const txt = await fetch(`/api/proxy?url=${encodeURIComponent(`https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/smoothed/${el}_sr_5x5.tab`)}`).then((r) => r.text());
      const grid = new Array(36 * 72).fill(null);
      for (const line of txt.split(/\r?\n/)) {
        const p = line.trim().split(/\s+/).map(Number);
        if (p.length < 3 || !Number.isFinite(p[0])) continue;
        const row = Math.floor((90 - p[0]) / 5), col = Math.floor((((p[1] + 180) % 360) + 360) % 360 / 5);
        grid[row * 72 + col] = p[2] > 9000 ? null : p[2];
      }
      meta.grs[el] = grid;
    }
    meta.grs_source = "Mars Odyssey GRS element concentrations, smoothed 5°×5° (PDS ODY-M-GRS-5-ELEMENTS-V1, Boynton et al. 2007)";
    return meta;
  }

  async function loadMag(onProgress) {
    if (magGrid) return magGrid;
    if (!magPromise)
      magPromise = (async () => {
        const res = await fetch(MAG_URL);
        if (!res.ok) throw new Error(`magnetic model HTTP ${res.status}`);
        const txt = await new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).text();
        const N = 134;
        const g = [], h = [];
        for (let n = 0; n <= N; n++) (g[n] = new Float64Array(n + 1)), (h[n] = new Float64Array(n + 1));
        for (const line of txt.split("\n")) {
          const p = line.trim().split(/\s+/);
          if (p.length < 3 || !/^\d+$/.test(p[0])) continue;
          const n = +p[0], m = +p[1];
          if (n > N || m > n) continue;
          g[n][m] = parseFloat(p[2]);
          h[n][m] = p.length > 3 ? parseFloat(p[3]) : 0;
        }
        // Br at the reference surface (r = a = 3393.5 km), Schmidt semi-normalised Legendre functions, 0.5° grid.
        const W = 720, H = 360, out = new Float32Array(W * H);
        const P = [];
        for (let n = 0; n <= N; n++) P[n] = new Float64Array(n + 1);
        const cosm = new Float64Array((N + 1) * W), sinm = new Float64Array((N + 1) * W);
        for (let i = 0; i < W; i++) {
          const phi = ((-180 + (i + 0.5) * 0.5) * Math.PI) / 180;
          for (let m = 0; m <= N; m++) (cosm[m * W + i] = Math.cos(m * phi)), (sinm[m * W + i] = Math.sin(m * phi));
        }
        const A = new Float64Array(N + 1), Bm = new Float64Array(N + 1);
        for (let j = 0; j < H; j++) {
          const lat = 90 - (j + 0.5) * 0.5, th = ((90 - lat) * Math.PI) / 180;
          const x = Math.cos(th), s = Math.sin(th);
          P[0][0] = 1;
          if (N >= 1) (P[1][0] = x), (P[1][1] = s);
          for (let n = 2; n <= N; n++) {
            P[n][n] = Math.sqrt((2 * n - 1) / (2 * n)) * s * P[n - 1][n - 1];
            for (let m = 0; m < n; m++) {
              const a2 = n - 2 >= m ? P[n - 2][m] : 0;
              P[n][m] = ((2 * n - 1) * x * P[n - 1][m] - Math.sqrt((n - 1) * (n - 1) - m * m) * a2) / Math.sqrt(n * n - m * m);
            }
          }
          A.fill(0);
          Bm.fill(0);
          for (let n = 1; n <= N; n++)
            for (let m = 0; m <= n; m++) {
              const f = (n + 1) * P[n][m];
              A[m] += f * g[n][m];
              Bm[m] += f * h[n][m];
            }
          for (let i = 0; i < W; i++) {
            let v = 0;
            for (let m = 0; m <= N; m++) v += A[m] * cosm[m * W + i] + Bm[m] * sinm[m * W + i];
            out[j * W + i] = v;
          }
          if (onProgress && j % 30 === 29) {
            onProgress((j + 1) / H);
            await new Promise((r) => setTimeout(r, 0));
          }
        }
        magGrid = { w: W, h: H, res: 0.5, values: out };
        return magGrid;
      })().catch((e) => {
        magPromise = null;
        throw e;
      });
    return magPromise;
  }

  // ---------- Point sets ----------
  const POINTS = {
    seismic: () => [
      { lat: 4.502, lon: 135.623, c: "#ffd23f", r: 7, t: tr("InSight seismometer SEIS (2018–2022)", "InSight-Seismometer SEIS (2018–2022)"), cls: "safe" },
      { lat: 9, lon: 165, c: "#e5483b", r: 9, circle: 350, t: tr("Cerberus Fossae – main source region of located marsquakes (approximate area)", "Cerberus Fossae – Hauptquellgebiet georteter Marsbeben (ungefähres Gebiet)"), cls: "maybe" },
      { lat: 34.9, lon: -170.1, c: "#6fd6ff", r: 7, t: tr("S1094b: meteorite impact felt by InSight, 24 Dec 2021; ≈150 m crater exposing ice, Amazonis Planitia ≈35° N (Posiolova et al. 2022; position approximate)", "S1094b: von InSight gespürter Meteoriteneinschlag, 24.12.2021; ≈150 m Krater mit Eis, Amazonis Planitia ≈35° N (Posiolova et al. 2022; Lage ungefähr)"), cls: "safe" },
      { lat: 38.1, lon: -80.0, c: "#6fd6ff", r: 7, t: tr("S1000a: meteorite impact felt by InSight, 18 Sep 2021, Tempe Terra (Posiolova et al. 2022; position approximate)", "S1000a: von InSight gespürter Meteoriteneinschlag, 18.09.2021, Tempe Terra (Posiolova et al. 2022; Lage ungefähr)"), cls: "safe" },
    ],
    volcanoes: () =>
      [
        // Centre coordinates from the USGS/IAU Gazetteer of Planetary Nomenclature (planetocentric, converted to −180…180° E).
        ["Olympus Mons", 18.65, -133.8], ["Arsia Mons", -8.26, -120.09], ["Pavonis Mons", 1.48, -112.96], ["Ascraeus Mons", 11.92, -104.08],
        ["Alba Mons", 41.08, -110.71], ["Elysium Mons", 25.02, 147.21], ["Hecates Tholus", 32.12, 150.24], ["Albor Tholus", 18.87, 150.47],
        ["Apollinaris Mons", -9.17, 174.79], ["Tyrrhenus Mons", -21.63, 105.88], ["Hadriacus Mons", -31.29, 91.86], ["Nili Patera (Syrtis Major)", 8.97, 67.17],
      ].map(([t, lat, lon]) => ({ lat, lon, t: `${t} (IAU)`, c: "#ff5a36", r: 7, tri: true, cls: "safe" })),
    crystal: () => {
      if (!poi) return [];
      const CR = {
        phyllosilicate: ["#3d8fe0", tr("sheet silicate (layered lattice, monoclinic)", "Schichtsilikat (geschichtetes Gitter, monoklin)")],
        sulfate: ["#f08c32", tr("sulfate (e.g. gypsum, monoclinic)", "Sulfat (z. B. Gips, monoklin)")],
        carbonate: ["#38b26a", tr("carbonate (trigonal)", "Karbonat (trigonal)")],
        chloride: ["#e8cf2c", tr("chloride (halite, cubic)", "Chlorid (Halit, kubisch)")],
        silica: ["#a64fd9", tr("opaline silica (amorphous)", "Opal-Silikat (amorph)")],
      };
      return poi.aqueous.map(([lat, lon, c]) => ({ lat, lon, c: CR[c]?.[0] || "#ccc", r: 3.5, t: CR[c]?.[1] || c, cls: "maybe" }));
    },
  };

  // ---------- Rendering ----------
  const state = { theme: null, layer: null, overlay: null, canvas: null };

  function gridCanvas(values, w, h, def, mapFn) {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext("2d");
    const img = cx.createImageData(w, h);
    for (let t = 0; t < w * h; t++) {
      const v = values[t];
      if (v == null || Number.isNaN(v)) continue;
      const c = mapFn ? mapFn(v) : def.div ? ramp(DIV, 0.5 + Math.sign(v) * Math.sqrt(Math.min(1, Math.abs(v) / def.max)) / 2) : ramp(SEQ, (v - def.min) / (def.max - def.min));
      img.data.set([c[0], c[1], c[2], c[3] ?? 225], t * 4);
    }
    cx.putImageData(img, 0, 0);
    return cv;
  }

  function legendHtml(def) {
    const badge =
      def.cls === B.m ? `<span class="badge badge-measured">${tr("Measured", "Gemessen")}</span>` : def.cls === B.i ? `<span class="badge">${tr("Illustrative", "Illustrativ")}</span>` : `<span class="badge badge-derived">${tr("Derived", "Abgeleitet")}</span>`;
    let scale = "";
    if (def.unit && def.min != null)
      scale = `<i class="th-ramp" style="background:${def.div ? rampCss(DIV) : rampCss(SEQ)}"></i><div class="env-legend-ticks"><span>${def.div ? "−" + def.max : def.min}</span><span>${def.unit}${def.div ? " (√ scale)" : ""}</span><span>${def.div ? "+" : ""}${def.max}</span></div>`;
    else if (def.type === "trek" && !def.opaque) scale = `<i class="th-ramp" style="background:${RAINBOW_CSS}"></i>`;
    else if (def.type === "liquid") scale = `<div class="small"><i class="lg-sw" style="background:#2f7fe0"></i> ${tr("above triple point", "über Tripelpunkt")} &nbsp; <i class="lg-sw" style="background:#555"></i> ${tr("below", "darunter")}</div>`;
    return `<div><b>${escHtml(def.name)}</b> ${badge}</div>${scale}<div class="small muted">${escHtml(def.note || "")}</div>`;
  }

  async function show(key) {
    const def = L_[key];
    if (state.overlay) {
      map.removeLayer(state.overlay);
      state.overlay = null;
    }
    state.layer = key;
    state.canvas = null;
    el("th-legend").innerHTML = def ? legendHtml(def) : "";
    el("th-status").textContent = "";
    if (!def) return;
    const op = parseFloat(el("th-opacity").value);
    const bounds = [[-90, -180], [90, 180]];
    try {
      if (def.type === "trek") {
        state.overlay = L.tileLayer(def.url || trekTileUrl(def.label, def.ext || "png"), {
          pane: "overlayPane2", opacity: op, maxNativeZoom: def.maxZ, maxZoom: MAP_MAX_ZOOM, tileSize: 256, noWrap: true, bounds,
          attribution: "NASA/JPL-Caltech Mars Trek",
        }).addTo(map);
      } else if (def.type === "env") {
        if (hooks.setEnvLayer) hooks.setEnvLayer(def.env);
        el("th-status").textContent = tr("Switched on in “Environment” below.", "Unten unter „Umwelt“ eingeschaltet.");
      } else if (def.type === "geo" || def.type === "grs") {
        busyBar.set("thematic", tr("Loading gravity / geochemistry grids …", "Lade Schwere-/Geochemie-Raster …"));
        await loadGeo();
        busyBar.done("thematic");
        if (state.layer !== key) return;
        let cv;
        if (def.type === "geo") cv = gridCanvas(geo.layers[def.key].values, geo.w, geo.h, def);
        else cv = gridCanvas(geo.grs[def.el], 72, 36, def);
        state.canvas = cv;
        state.overlay = L.imageOverlay(cv.toDataURL(), bounds, { pane: "overlayPane2", opacity: op, className: def.type === "grs" ? "env-smooth" : "" }).addTo(map);
        el("th-status").textContent = def.type === "geo" ? geo.layers[def.key].source : geo.grs_source;
      } else if (def.type === "mag") {
        const g = await loadMag((f) => busyBar.set("thematic", tr("Computing the magnetic field model (degree 134) …", "Berechne das Magnetfeldmodell (Grad 134) …"), f * 100));
        busyBar.done("thematic");
        if (state.layer !== key) return;
        const cv = gridCanvas(g.values, g.w, g.h, def);
        state.canvas = cv;
        state.overlay = L.imageOverlay(cv.toDataURL(), bounds, { pane: "overlayPane2", opacity: op }).addTo(map);
        el("th-status").textContent = "Langlais et al. (2019), JGR Planets 124 – Zenodo 3876714";
      } else if (def.type === "pressure" || def.type === "liquid") {
        const eg = await loadEnvGrids();
        if (state.layer !== key || !eg.elev) throw new Error("no elevation grid");
        const w = eg.meta.w / 2, h = eg.meta.h / 2, vals = new Float32Array(w * h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const e = eg.elev[(2 * j + 1) * eg.meta.w + 2 * i + 1];
          vals[j * w + i] = Number.isFinite(e) ? 610 * Math.exp(-e / 1000 / 11.1) : NaN;
        }
        const cv =
          def.type === "pressure"
            ? gridCanvas(vals, w, h, def, (p) => ramp(SEQ, (Math.log(p) - Math.log(def.min)) / (Math.log(def.max) - Math.log(def.min))))
            : gridCanvas(vals, w, h, def, (p) => (p > 611.657 ? [47, 127, 224, 220] : [60, 60, 60, 140]));
        state.canvas = cv;
        state.overlay = L.imageOverlay(cv.toDataURL(), bounds, { pane: "overlayPane2", opacity: op }).addTo(map);
        el("th-status").textContent = tr("From MOLA elevation (0.5°).", "Aus MOLA-Höhe (0,5°).");
      } else if (def.type === "points") {
        if (def.set === "crystal" && !poi) poi = await fetch("data/nasa-poi.json").then((r) => r.json());
        const grp = L.layerGroup();
        for (const p of POINTS[def.set]()) {
          const html = `<b>${escHtml(p.t)}</b><div class="small mono">${formatLat(p.lat, 2)}, ${formatLonEast(p.lon, 2)}</div>${p.cls ? kbLevelBadge(p.cls) : ""}`;
          if (p.circle) L.polygon(marsCircle(p.lat, p.lon, p.circle), { color: p.c, weight: 1.5, fillOpacity: 0.12, pane: "overlayPane2" }).bindPopup(html).addTo(grp);
          if (p.tri)
            L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "volc-icon", html: `<div title="${escHtml(p.t)}">▲</div>`, iconSize: null }) }).bindPopup(html).addTo(grp);
          else L.circleMarker([p.lat, p.lon], { radius: p.r, color: "#111", weight: 1, fillColor: p.c, fillOpacity: 0.9 }).bindPopup(html).addTo(grp);
        }
        state.overlay = grp.addTo(map);
      }
    } catch (err) {
      busyBar.done("thematic");
      console.warn(err);
      el("th-status").textContent =
        def.type === "geo" || def.type === "grs"
          ? tr("Gravity/geochemistry grids are built on the next start of app/main.py (≈20 MB of row reads from the PDS).", "Schwere-/Geochemie-Raster werden beim nächsten Start von app/main.py erzeugt (≈20 MB Zeilen aus dem PDS).")
          : tr("Could not load this layer: ", "Ebene konnte nicht geladen werden: ") + err.message;
    }
  }

  function renderList() {
    const theme = THEMES.find((t) => t[0] === state.theme);
    el("th-list").innerHTML = theme
      ? theme[2].map((k) => `<li><label class="check"><input type="radio" name="th-layer" value="${k}" ${state.layer === k ? "checked" : ""}> ${escHtml(L_[k].name)}</label></li>`).join("")
      : "";
  }

  el("th-theme").innerHTML = `<option value="">${tr("– choose a view –", "– Ansicht wählen –")}</option>` + THEMES.map(([id, n]) => `<option value="${id}">${n}</option>`).join("");
  el("th-theme").addEventListener("change", () => {
    state.theme = el("th-theme").value || null;
    renderList();
    const first = THEMES.find((t) => t[0] === state.theme)?.[2][0];
    show(first || null);
    renderList();
  });
  el("th-list").addEventListener("change", (e) => {
    if (e.target.name === "th-layer") show(e.target.value);
  });
  el("th-off").addEventListener("click", () => {
    el("th-theme").value = "";
    state.theme = null;
    renderList();
    show(null);
  });
  el("th-opacity").addEventListener("input", () => state.overlay && state.overlay.setOpacity && state.overlay.setOpacity(parseFloat(el("th-opacity").value)));

  return { currentCanvas: () => state.canvas, current: () => (state.layer ? L_[state.layer] : null) };
}
