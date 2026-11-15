// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Dataset catalog. Layer IDs, formats, bounding boxes and native zoom levels were
// read from the NASA Trek WMTS GetCapabilities documents (trek.nasa.gov/tiles/Mars/EQ/...).
// dataClass: "measured" | "derived" | "illustrative"

const TREK_BASE = "https://trek.nasa.gov/tiles/Mars/EQ";

function trekTileUrl(layerId, ext) {
  return `${TREK_BASE}/${layerId}/1.0.0/default/default028mm/{z}/{y}/{x}.${ext}`;
}

function trekCapabilitiesUrl(layerId) {
  return `${TREK_BASE}/${layerId}/1.0.0/WMTSCapabilities.xml`;
}

// Global base maps (exactly one active).
const BASEMAPS = [
  {
    id: "viking-mdim21",
    name: "Viking MDIM 2.1 color mosaic",
    layerId: "Mars_Viking_MDIM21_ClrMosaic_global_232m",
    ext: "jpg",
    maxNativeZoom: 7,
    mission: "Viking Orbiter 1 & 2 (NASA, 1976–1980)",
    instrument: "Visual Imaging Subsystem (VIS)",
    resolution: "232 m/px",
    coverage: "global",
    dataType: "optical",
    dataClass: "measured",
    classNote: "Orbital images, controlled and colorized (USGS / NASA Ames).",
    links: [["USGS Astrogeology", "https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m"]],
  },
  {
    id: "mola-clrshade",
    name: "MOLA elevation (color hillshade)",
    layerId: "Mars_MGS_MOLA_ClrShade_merge_global_463m",
    ext: "jpg",
    maxNativeZoom: 7,
    mission: "Mars Global Surveyor (NASA, 1996–2006)",
    instrument: "Mars Orbiter Laser Altimeter (MOLA)",
    resolution: "463 m/px",
    coverage: "global",
    dataType: "topographic",
    dataClass: "derived",
    classNote: "Visualization of measured laser altimetry. Colors show elevation qualitatively – no queryable values in this layer.",
    links: [],
  },
  {
    id: "mola-hrsc-blend",
    name: "MOLA + HRSC elevation (color hillshade)",
    layerId: "Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw",
    ext: "jpg",
    maxNativeZoom: 8,
    mission: "Mars Global Surveyor + Mars Express (ESA)",
    instrument: "MOLA + High Resolution Stereo Camera (HRSC)",
    resolution: "200 m/px",
    coverage: "global",
    dataType: "topographic",
    dataClass: "derived",
    classNote: "Visualization of a blended elevation model. Colors are qualitative, no queryable values.",
    links: [],
  },
  {
    id: "themis-day-ir",
    name: "THEMIS daytime infrared",
    layerId: "THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018",
    ext: "png",
    maxNativeZoom: 9,
    bounds: [[-65, -180], [65, 180]],
    mission: "Mars Odyssey (NASA, since 2001)",
    instrument: "Thermal Emission Imaging System (THEMIS)",
    resolution: "100 m/px",
    coverage: "65° S – 65° N",
    dataType: "thermal",
    dataClass: "measured",
    classNote: "Controlled IR mosaic. Brightness shows daytime surface heating, strongly affected by slope and aspect. No calibrated temperatures.",
    links: [],
  },
];

// Global science overlays (toggle + opacity).
const OVERLAYS = [
  {
    id: "themis-night-ir",
    name: "THEMIS nighttime infrared",
    layerId: "THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018",
    ext: "png",
    maxNativeZoom: 9,
    bounds: [[-65, -180], [65, 180]],
    defaultOpacity: 0.6,
    mission: "Mars Odyssey (NASA, since 2001)",
    instrument: "Thermal Emission Imaging System (THEMIS)",
    resolution: "100 m/px",
    coverage: "65° S – 65° N",
    dataType: "thermal",
    dataClass: "measured",
    classNote: "Bright at night = surface keeps heat = high thermal inertia (rock, indurated material). Dark = dust, fine sand. Relative, no calibrated temperatures.",
    links: [],
  },
];

// Exploration sites with local high-resolution imagery.
const SITES = [
  {
    id: "jezero",
    name: "Jezero crater",
    view: [[18.36, 77.30], [18.52, 77.58]],
    region: [[18.211, 77.160], [18.721, 77.699]],
    layers: [
      {
        id: "jez-ctx",
        name: "CTX Jezero, controlled",
        layerId: "JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0",
        ext: "png",
        maxNativeZoom: 13,
        bounds: [[18.2110274, 77.1604655], [18.7211945, 77.6991776]],
        mission: "Mars Reconnaissance Orbiter (NASA, since 2006)",
        instrument: "Context Camera (CTX)",
        resolution: "6 m/px",
        coverage: "Jezero crater",
        dataType: "optical",
        dataClass: "measured",
        classNote: "Controlled orthomosaic (Mars 2020 landing site mapping).",
        links: [],
      },
      {
        id: "jez-hirise",
        name: "HiRISE Jezero, controlled",
        layerId: "JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd",
        ext: "png",
        maxNativeZoom: 17,
        bounds: [[18.3067994, 77.2229331], [18.669315, 77.583964]],
        mission: "Mars Reconnaissance Orbiter (NASA, since 2006)",
        instrument: "High Resolution Imaging Science Experiment (HiRISE)",
        resolution: "25 cm/px",
        coverage: "Jezero crater, delta and crater floor",
        dataType: "optical",
        dataClass: "measured",
        classNote: "Controlled orthomosaic. Individual boulders from about 1 m are visible.",
        links: [],
      },
    ],
    // Example Marswalk: landing site west across the crater floor to the delta front (illustrative route).
    exampleRoute: [[18.4447, 77.4508], [18.45, 77.42], [18.456, 77.4], [18.462, 77.392]],
    landmarks: [
      {
        name: "Octavia E. Butler Landing",
        detail: "Perseverance landing site, 18 Feb 2021",
        lat: 18.4447,
        lon: 77.4508,
        source: "NASA/JPL (Mars 2020)",
      },
    ],
  },
  {
    id: "gale",
    name: "Gale crater / Mount Sharp",
    view: [[-4.93, 137.12], [-4.25, 137.73]],
    region: [[-6.573, 135.184], [-2.808, 139.241]],
    layers: [
      {
        id: "gale-ctx",
        name: "CTX Gale crater",
        layerId: "Gale_CTX_BlockAdj_dd",
        ext: "png",
        maxNativeZoom: 12,
        bounds: [[-6.5732988, 135.1842593], [-2.8077809, 139.2413012]],
        mission: "Mars Reconnaissance Orbiter (NASA, since 2006)",
        instrument: "Context Camera (CTX)",
        resolution: "approx. 6 m/px",
        coverage: "Gale crater",
        dataType: "optical",
        dataClass: "measured",
        classNote: "Block-adjusted CTX mosaic.",
        links: [],
      },
      {
        id: "gale-hirise",
        name: "HiRISE Curiosity traverse area",
        layerId: "curiosity_hirise_mosaic",
        ext: "png",
        maxNativeZoom: 16,
        bounds: [[-4.9254743, 137.1224669], [-4.2489588, 137.7298129]],
        mission: "Mars Reconnaissance Orbiter (NASA, since 2006)",
        instrument: "High Resolution Imaging Science Experiment (HiRISE)",
        resolution: "tiles up to approx. 0.6 m/px",
        coverage: "Aeolis Palus to lower Mount Sharp",
        dataType: "optical",
        dataClass: "measured",
        classNote: "HiRISE mosaic along the Curiosity route.",
        links: [],
      },
    ],
    // Example Marswalk: Bradbury Landing east across Aeolis Palus (illustrative route).
    exampleRoute: [[-4.5895, 137.4417], [-4.588, 137.45], [-4.587, 137.457]],
    landmarks: [
      {
        name: "Bradbury Landing",
        detail: "Curiosity landing site, 6 Aug 2012",
        lat: -4.5895,
        lon: 137.4417,
        source: "Vasavada et al. 2014, JGR Planets",
      },
    ],
  },
];

for (const layer of [...BASEMAPS, ...OVERLAYS, ...SITES.flatMap((s) => s.layers)]) {
  layer.tileUrl = trekTileUrl(layer.layerId, layer.ext);
  layer.capabilitiesUrl = trekCapabilitiesUrl(layer.layerId);
}

const DATA_CLASS_LABELS = {
  measured: "Measured",
  derived: "Derived",
  illustrative: "Illustrative",
};
