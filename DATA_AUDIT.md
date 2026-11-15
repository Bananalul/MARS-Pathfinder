# MARS Pathfinder – Data audit

Date: 15 Nov 2026. This file lists **every data source, every numerical value and where it comes from, every model and every assumption** in the project. For each item it says whether it was checked against the original source during the audit.

**Legend**

- ✅ **checked**: compared against the original source (NASA/USGS page, PDS label or paper) during the audit.
- ✏️ **corrected**: a discrepancy was found and the code was fixed.
- 🔁 **live**: loaded at runtime directly from the NASA/USGS server, unchanged.
- ⚠️ **assumption**: not a measured value. The reasoning is given here; the app labels it *assumption*.
- ◻️ **not individually re-checked**: taken from the literature or textbook knowledge, not looked up again during the audit.

All DOIs in the reference list were resolved through the Crossref API. Title, first author and year matched.

---

## 1. Summary

**Found and corrected (✏️)**

| # | What | Before | Now | Evidence |
|---|---|---|---|---|
| 1 | Mars gravity (thermal and logistics models) | 3.71 m/s² (ratio 3.71/9.81) | **3.73 m/s²**, Earth 9.82 m/s² | NASA NSSDCA Mars Fact Sheet: surface gravity (mean) 3.73 / 9.82 |
| 2 | Atmospheric scale height | 11.1 km | **11.0 km** | NASA NSSDCA Mars Fact Sheet |
| 3 | Radiation shielding per g/cm² of atmosphere | 1.5 %/(g/cm²), "10–20 % between 15 and 25 g/cm²" | **2.2 %/(g/cm²) absorbed dose, 2.8 %/(g/cm²) dose equivalent**; valid range **18.9–25.7 g/cm²**; Gale **22.6 g/cm²** | Guo et al. 2017: 840 Pa ≙ 22.6 g/cm²; between 700 and 950 Pa (18.9–25.7 g/cm²) dose rates differ by ≈15 % (Gy) and ≈19 % (Sv) at Φ = 500 MV |
| 4 | Gravity model mislabelled | "MRO GGMRO-120" | **NASA GMM-3** (the PDS files are named GGMRO_120_…) | PDS labels: "derived from … the NASA GMM-3 gravity field", producer A. Genova (GSFC); crustal thickness by G. A. Neumann, crust 2900 and mantle 3500 kg/m³ |
| 5 | Volcano coordinates (volcanological view) | approximate values from memory (e.g. Alba Mons 40.47° N / −109.6°) | **IAU centre coordinates from the USGS Gazetteer** (Alba Mons 41.08° N / 249.29° E = −110.71°) | Gazetteer of Planetary Nomenclature, queried for all 12 volcanoes |
| 6 | Suit mass in crew logistics | 90 kg | **82 kg** (same as the mobility profile) | Apollo suit with backpack ≈ 180 lb |
| 7 | Impact sites S1000a / S1094b | shown as exact points | marked as **approximate position** (Tempe Terra and Amazonis Planitia ≈35° N) | Posiolova et al. 2022; exact coordinates not looked up |

After the correction, Gale still reproduces the RAD measurement exactly: 0.21 mGy/day and 0.64 mSv/day at 22.6 g/cm² (tested in the browser).

**Checked and correct (✅):**

- Apollo EVA metabolic rate of 234 kcal/h
- September 2017 SEP: 418 µGy
- RAD dose at Gale: 0.21 mGy and 0.64 ± 0.12 mSv per day
- xEVA requirements: 20° slope, 2 km radius, 8 h EVA
- NASA radiation limits: 600 mSv career, 250 mSv per SPE
- BVAD O₂ of 0.84 kg per person per day
- Curiosity and Perseverance specifications
- LRV specifications
- 30° friction angle for Martian sand
- TES thermal inertia (PDS label)
- GRS element maps (PDS label)
- Bradbury and Octavia E. Butler landing sites
- all literature DOIs

**What must not be misread:**

- Temperatures, UV, the dose map, soil radiation, pressure and crew consumption (metabolism, O₂, water) are **model values** computed from NASA measurements. They are not measurements, and the app labels them as models.
- The texts of the knowledge base (`findings-kb.json`) were drafted with AI assistance from the cited papers. The papers themselves were checked, but not every sentence was re-read against the paper.

---

## 2. Measured NASA/USGS datasets

### 2.1 Map tiles (🔁 live from NASA Mars Trek, JPL)

Tile scheme: `https://trek.nasa.gov/tiles/Mars/EQ/{Layer}/1.0.0/default/default028mm/{z}/{y}/{x}.{jpg|png}`. Layer IDs, zoom levels and extents were read from each layer's WMTSCapabilities.xml.
Portal: https://trek.nasa.gov/mars/

| Layer in the app | Trek layer ID | Mission / instrument |
|---|---|---|
| Viking MDIM 2.1 colour mosaic, 232 m/px | `Mars_Viking_MDIM21_ClrMosaic_global_232m` | Viking Orbiter 1/2, VIS (https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m) |
| MOLA colour hillshade, 463 m/px | `Mars_MGS_MOLA_ClrShade_merge_global_463m` | Mars Global Surveyor, MOLA |
| MOLA + HRSC hillshade, 200 m/px | `Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw` | MGS MOLA + Mars Express HRSC (ESA) |
| THEMIS day IR, 100 m/px | `THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018` | Mars Odyssey, THEMIS |
| THEMIS night IR, 100 m/px | `THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018` | Mars Odyssey, THEMIS |
| CTX Jezero, 6 m/px | `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0` | MRO CTX |
| HiRISE Jezero, 25 cm/px | `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd` | MRO HiRISE |
| CTX Gale | `Gale_CTX_BlockAdj_dd` | MRO CTX |
| HiRISE Curiosity area | `curiosity_hirise_mosaic` | MRO HiRISE |
| HiRISE mosaics in 3D cut-outs | `HiRISE_ColumbiaHills`, `spirit_hirise_mosaic`, `opportunity_hirise_mosaic`, `phoenix_hirise_mosaic`, `sojourner_hirise_mosaic`, `ESP_058005_1845_RED_spline_rect` (InSight), `PSP_001521_2025_RED` (Viking 1), `PSP_001501_2280_RED` (Viking 2), `ESP_042252_1930_RED_B_01_ORTHO` (Marth), `PSP_001918_1735_RED_A_01_ORTHO_longlat` (Candor), `ESP_040776_2115_RED_A_01_ORTHO` (Ares 3), `ESP_042647_1760_RED_B_01_ORTHO` (Ares 4) | MRO HiRISE |
| Surface roughness | `mola_roughness` | MGS MOLA |
| Albedo (TES) | `Mars_MGS_TES_Albedo_mosaic_global_7410m` | MGS TES |
| Dust cover index | `tes_ruffdust` | MGS TES (Ruff & Christensen 2002) |
| Thermal inertia (TES) | `TES_Thermal_Inertia` | MGS TES |
| Plagioclase / high-Ca pyroxene / glass-clay | `TES_Plagioclase`, `TES_Clinopyroxene`, `TES_Glass_Clay` | MGS TES (Bandfield 2002) |
| Geologic units (tiles) | https://trek.nasa.gov/mars/trekarcgis/rest/services/SIM3292_Global_Geology/MapServer | USGS SIM 3292 (Tanaka et al. 2014) |
| Valley networks | https://trek.nasa.gov/mars/trekarcgis/rest/services/Hynek_Valley_Networks/MapServer | Hynek et al. 2010 |
| Dune fields | https://trek.nasa.gov/mars/arcgis/rest/services/Dune_Field/MapServer | Trek layer; author per Trek metadata, not separately checked ◻️ |

### 2.2 Elevation models (🔁 live)

| Data | Source / link |
|---|---|
| MOLA global 463 m (COG) | https://asc-pds-services.s3.us-west-2.amazonaws.com/wms_basemaps3/Mars/MOLA/mola128_mola64_merge_90Nto90S_SimpleC_clon0_cog.tif; product page https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m; Smith et al. 2001 |
| HiRISE DTMs (≈1 m) | USGS STAC collection `mro_hirise_socet_dtms`: https://stac.astrogeology.usgs.gov/api/collections/mro_hirise_socet_dtms; files under https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm |
| CTX DTMs (20 m) | USGS STAC collection `mro_ctx_controlled_usgs_dtms`: https://stac.astrogeology.usgs.gov/api/collections/mro_ctx_controlled_usgs_dtms |
| Global CTX image mosaic (3D texture) | https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer (Caltech Murray Lab, listed in Mars Trek) |
| Mars radius for projection | 3396.19 km (IAU 2000 Mars sphere, as used by the Trek/USGS products) ◻️ |

### 2.3 Science grids (built by `app/main.py` from PDS)

| Data | File / link | Checked |
|---|---|---|
| Night-time thermal inertia (TES), 20 px/° | https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data/global_ti_night_2007.img. PDS label: producer N. Putzig (SwRI), unit J m⁻² K⁻¹ s⁻½, 7200 × 3600, MSB int16 (Putzig & Mellon 2007) | ✅ label read |
| Albedo (TES), 7.4 km | https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars_MGS_TES_Albedo_mosaic_global_7410m.tif (Christensen et al. 2001) | 🔁 |
| GRS elements K, Th, Fe, Si, Cl, H₂O, 5° smoothed | https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/smoothed/ (e.g. `k_sr_5x5.tab`). Label: 2° raw data smoothed with a 5° boxcar, June 2002 – April 2005 (Boynton et al. 2007) | ✅ label read |
| Free-air gravity anomaly | https://pds-geosciences.wustl.edu/mro/mro-m-rss-5-sdp-v1/mrors_1xxx/data/rsdmap/ggmro_120_anom_100.img: GMM-3 to degree 100, mGal, 16 px/°, 5760 × 2880 float64 (Genova et al. 2016) | ✅ ✏️ name |
| Bouguer anomaly | …/rsdmap/ggmro_120_bouguer_90.img: GMM-3 to degree 90, crustal density 2900 kg/m³ | ✅ ✏️ |
| Crustal thickness | …/rsdmap/ggmro_120_crust.img: G. A. Neumann (GSFC), GMM-3 + MOLA, 2900/3500 kg/m³ | ✅ ✏️ |
| GMM-3 product page | https://pgda.gsfc.nasa.gov/products/57 | ✅ |
| Crustal magnetic field | Langlais et al. 2019 spherical-harmonic coefficients: https://zenodo.org/records/3876714 (`Langlais2019.sh.gz`). Br is computed in the browser at r = a. Check values during development: −4653 nT at (−45°, 180°), −10 nT at (50°, −120°) | ◻️ not re-run |

### 2.4 Vector data, rovers, weather

| Data | Link | Status |
|---|---|---|
| NASA findings: missions, major features, Exploration Zones, aqueous minerals, hydrous minerals, chlorides, RSL/gullies/new craters | Snapshot of 14 Nov 2026 of the Mars Trek vector layers: https://trek.nasa.gov/mars/trekarcgis/rest/services (sources per layer in `app/web/data/nasa-poi.json` → `meta`) | 🔁 snapshot |
| Human Exploration Zones 2015 | Abstracts of NASA's First Landing Site/Exploration Zone Workshop, LPI, 27–30 Oct 2015, e.g. https://www.hou.usra.edu/meetings/explorationzone2015/pdf/1045.pdf; LPI Contribution 1879 | 🔁 links from the Trek layer |
| Global geologic map (vector, query) | https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Tanaka_et_al_2014_Mars_Global_Map_Features/FeatureServer/3; USGS SIM 3292, https://doi.org/10.3133/sim3292 | ✅ DOI |
| Jezero geologic map | https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Jezero_FeatureServiceFromPro/FeatureServer/8; Sun & Stack 2020, USGS SIM 3464, https://doi.org/10.3133/sim3464 | ✅ DOI |
| Rover traverses | https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json, https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json | 🔁 |
| Raw rover images | Perseverance: https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json; Curiosity: https://mars.nasa.gov/api/v1/raw_image_items/ | 🔁 |
| Camera view direction | Computed from the raw-image metadata (CAHVOR camera model, rover attitude quaternion); rover tilt ignored | 🔁 derived |
| Rover weather (REMS, MEDA) | https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json, …&category=mars2020… | 🔁 |
| Landing sites | Bradbury Landing 4.5895° S 137.4417° E (Vasavada et al. 2014); Octavia E. Butler Landing 18.4447° N 77.4508° E (NASA/JPL) | ◻️ |
| InSight seismometer | 4.502° N 135.623° E (NASA/JPL) | ◻️ |
| Cerberus Fossae marsquake source region | Shown as an approximate circle (≈9° N 165° E, radius 350 km) | ⚠️ symbol, not an exact area |
| Impacts S1000a, S1094b | Posiolova et al. 2022: Tempe Terra and Amazonis Planitia (≈35° N), ≈150 m crater with ice | ✏️ marked approximate |
| Volcanoes | USGS Gazetteer of Planetary Nomenclature: https://planetarynames.wr.usgs.gov/ | ✅ ✏️ |
| Minerals by crystal structure | Points from Ehlmann & Edwards 2014 (Trek layer). Mapping to crystal structure: phyllosilicate = monoclinic, sulfate (gypsum) = monoclinic, carbonate = trigonal, halite = cubic, opal = amorphous | ◻️ textbook mineralogy |

---

## 3. Models and derived values – how we arrived at them

### 3.1 Mars time, Sun position, season
- **Method:** NASA GISS Mars24 algorithm (Allison & McEwen 2000), https://www.giss.nasa.gov/tools/mars24/help/algorithm.html.
- **Implementation:** the formulas were taken one-to-one from the GISS page.
- **Validation:** during development the code was checked against the NASA worked example: Ls 277.1876°, equation of time −5.1878°, declination −25.2282°, distance 1.39358 AU. All values matched.
- **Status:** ◻️ not re-run during the audit. Sol numbering follows Clancy et al. 2000.

### 3.2 Surface temperature (model)
- **Inputs (measured):** TES thermal inertia, TES albedo, MOLA elevation.
- **Calculation:**
  - 1-D heat conduction in the ground, solved implicitly with the Thomas algorithm.
  - Surface energy balance: Sun × atmospheric transmission against εσT⁴.
  - 8 sols of spin-up, 96 steps per sol.
  - Temperatures are not allowed to fall below the CO₂ frost point at the local pressure.
  - The result is a table over latitude × thermal inertia × albedo.
- **Basis:** NASA's KRC model (Kieffer 2013), deliberately simplified: no slope or aspect, simplified atmospheric back-radiation.
- **Assumptions (⚠️):**
  - emissivity 0.95
  - volumetric heat capacity 1.2 × 10⁶ J m⁻³ K⁻¹
  - dust optical depth τ = 0.5 (typical background, adjustable)
- **Plausibility:** the model gives −73 … +4 °C at Gale. That is the range REMS measures there (see the rover weather feed).

### 3.3 Surface pressure (model)
- **Formula:** p = 610 Pa · exp(−h / 11.0 km).
- **Scale height:** 11.0 km ✅ (NSSDCA).
- **610 Pa ⚠️:** an assumption for the mean pressure near the MOLA datum. NSSDCA gives 6.36 mbar at the mean radius, varying 4.0–8.7 mbar.
- **Check:** the formula gives ≈920 Pa at Gale (−4.5 km). Measured values there range from ≈700 to 950 Pa over the year (Guo et al. 2017).

### 3.4 Galactic cosmic rays
- **Measurement ✅:** RAD at Gale, 0.21 ± 0.04 mGy/day and 0.64 ± 0.12 mSv/day (Hassler et al. 2014).
- **Scaling to other elevations ✏️:**
  - Atmospheric column depth scales as exp(−Δh/H), starting from 22.6 g/cm² at Gale.
  - Dose changes linearly by 2.2 %/(g/cm²) (absorbed) or 2.8 %/(g/cm²) (dose equivalent).
  - **Derivation:** Guo et al. 2017 give ≈15 % and ≈19 % difference between 18.9 and 25.7 g/cm² at Φ = 500 MV. Dividing by 6.8 g/cm² gives the slopes. The linearisation is ours.
  - Outside 18.9–25.7 g/cm² the app shows "extrapolated".
- **Limitation:** according to Guo et al., the shielding depends strongly on solar activity and vanishes near 900–1000 MV. The app uses a fixed mean.
- **Limits ✅:** NASA-STD-3001 Vol. 1 Rev. B, 600 mSv per career and 250 mSv per solar particle event.

### 3.5 Solar particle event September 2017 ✅
+418 µGy (Si) at the Martian surface (MSL-RAD), as reported in Berger et al. 2018 (Space Weather). Further details are in Ehresmann et al. 2018 and Hassler et al. 2018.

### 3.6 UV irradiance (model)
- **Assumption ⚠️:** UV (200–400 nm) ≈ 8 % of 1361 W/m², i.e. 109 W/m² at 1 AU; UVC (200–280 nm) ≈ 0.5 %, i.e. 6.6 W/m². These are rounded band shares, **not** integrated from the ASTM E490 spectral table.
- **Physics ◻️:** CO₂ absorbs only below ≈200 nm, so UVC reaches the ground (Cockell et al. 2000; Patel et al. 2002).
- **Calculation:** scaled with 1/r² (Mars24) and the cosine of the zenith angle. Dust attenuation is a simple transmission factor ⚠️.

### 3.7 Soil gamma dose from K and Th (model)
- **Formula:** UNSCEAR 2000 conversion for extended ground, 0.0417 / 0.604 / 0.462 nGy/h per Bq/kg for K-40 / Th-232 / U-238 ◻️.
- **Specific activities ◻️:** 1 % K = 313 Bq/kg K-40, 1 ppm Th = 4.06 Bq/kg, 1 ppm U = 12.35 Bq/kg.
- **Uranium:** not measured; estimated from a chondritic Th/U ratio of 3.8 ⚠️.
- **K and Th:** measured by Mars Odyssey GRS ✅.

### 3.8 Loose ground from THEMIS night IR
- **Calculation:** uncalibrated 8-bit tile brightness is ranked relative to the route surroundings. Below the 10th percentile counts as "loose", above the 90th as "rock".
- **Basis ◻️:** dark at night means low thermal inertia, i.e. dust or sand. This is the physical principle behind THEMIS night images.
- **Thresholds ⚠️:** assumption.

### 3.9 Slope, trafficability, route planner
- **Slope:** measured or derived from the DTMs (HiRISE, CTX, MOLA).
- **Vehicle limits (model):**
  - Traction limit tan θ > tan φ with friction angle φ = 30° for Martian sand ✅. Golombek et al. 2008 give 30° for sand and 30–40° for crusty soil (table reproduced in Delage et al. 2017).
  - Tip-over angle from manufacturer specifications (see 3.11).
  - Power limit P = m·g·v·(sin θ + C_rr·cos θ).
  - Rolling resistance C_rr = 0.1 ⚠️, safety factor 1.5 ⚠️.
- **Astronaut on foot ✅:** at most 20° slope and at most 2 km for a walk-back, from NASA xEVA Concept of Operations EVA-EXP-0042. Apollo 14 walked ≈1.45 km; Apollo 15 walked on ≈17° slopes.
- **Planner weights ⚠️:** e.g. caution 1.5×, critical 4×, loose ground 0.8×, no data 3×, 14 feedback rounds. These are design parameters of the algorithm, not measurements.

### 3.10 Crew logistics (model)

| Quantity | Value | Origin | Status |
|---|---|---|---|
| Walking metabolism | Pandolf equation (Pandolf et al. 1977), gravity-dependent terms scaled by g_Mars/g_Earth = 3.73/9.82 | Scaling is our assumption. Check: with lunar gravity it gives ≈280 W; measured on the Moon was 234 kcal/h ≈ 272 W on average | ⚠️ / ✅ check |
| Apollo mean | 234 kcal/h (overall lunar EVA mean); Apollo/Skylab range 100–500 kcal/h | NASA NTRS 19910001262 (citing Waligora & Horrigan 1975, NASA SP-368); NTRS 19750006325; Apollo Experience Report TN D-7883 | ✅ |
| Energy per litre O₂ | 20.1 kJ/L | oxycaloric equivalent for a mixed diet (physiology textbook value) | ◻️ |
| Sustained power limit | 400 W | ≈40 % VO₂max for 75 kg at 40 ml/kg/min | ⚠️ |
| Water | 1 mL per kcal | rule of thumb | ⚠️ |
| Urine | 1.5 L/day | NASA RP-1324 (Wieland 1994), needs & effluents table: urine 1.50 kg/day | ✅ |
| Vehicle O₂, water, food | O₂ 0.84 kg/person/day ✅; drinking water 2.0 + rehydration 0.5 kg ✅, rounded up to 3 L in the app ⚠️; food ≈3000 kcal ⚠️ (rounded; 82 kg reference astronaut with exercise ≈3054 kcal/day) | NASA BVAD (Ewert, Chen, Powell, NASA/TP-2015-218570 Rev. 2, 2022), cited in NTRS 20230013896 and 20220002294 | ✅ / ⚠️ |
| EVA duration | 8 h | xEVA ConOps: "EVAs of up to 8 hours (6 ± 2 h)" | ✅ |
| Suit mass | 82 kg | Apollo suit with backpack ≈ 180 lb | ✅ ✏️ |
| Body mass | 75 kg | assumption | ⚠️ |
| Suit O₂ | 0.6 kg | assumption, order of magnitude of portable life support | ⚠️ |
| Drink bag | 0.95 L | assumption (≈ 32 oz like the Apollo drink bag; not re-checked) | ⚠️ |
| Absorbent garment | 1.0 L | assumption | ⚠️ |
| Walking speed | 3 km/h, detour factor 1.3 | assumptions | ⚠️ |
| Energy deficit without food | 1500 kcal | assumption | ⚠️ |
| Base stop | route point ≤ 300 m from a base | assumption | ⚠️ |
| Equipment masses | hammer 2 kg, sample bags 3 kg, etc. | assumptions | ⚠️ |
| Dust-storm season | Ls 180–330° | well-known season of large storms | ◻️ |

### 3.11 Vehicle profiles

| Vehicle | Values | Source | Status |
|---|---|---|---|
| Curiosity | 899 kg; 4 cm/s = 0.144 km/h; tip-over 45° (software limit 30°); MMRTG ≈110 W | NASA/JPL MSL pages | ✅ |
| Perseverance | 1025 kg; 152 m/h = 0.152 km/h; MMRTG ≈110 W | NASA Mars 2020 rover components; JPL press kit quick facts | ✅ |
| Apollo LRV | 210 kg empty + 490 kg payload; 4 × 0.25 hp = 746 W; ≈13 km/h top speed (10 km/h in the app ⚠️) | NASA/NSSDCA, several sources agree | ✅ |
| LRV 3D dimensions | 3.1 × 1.83 × 1.14 m, wheelbase 2.3 m, wheels 0.818 m | NASA SP-4029 / NSSDCA | ◻️ |
| Pressurised crew rover | 4000 kg, 10 km/h, 20 kW | concept class, freely assumed | ⚠️ all values |
| Minimum speed, C_rr, safety factor | all vehicles | assumptions | ⚠️ |

### 3.12 Globe and Sun
- **Texture:** Viking MDIM 2.1 (see 2.1).
- **Sun direction:** from Mars24. Subsolar latitude = declination; subsolar longitude where local true solar time is 12 h.
- **Display:** the stars and the Sun sprite are illustrative.

---

## 4. References

The complete reference list with resolved DOIs (data products, models, radiation, human factors, vehicles and the 50 papers behind the knowledge base) is in [SUBMISSION.md](SUBMISSION.md), sections 3, 4 and 8.

## 5. Software

- Leaflet 1.9.4 (map) – https://leafletjs.com/
- three.js r181 (3D, globe) – https://threejs.org/
- geotiff.js (Cloud-Optimized GeoTIFF reading) – https://geotiffjs.github.io/
- Python standard library (server and proxy in `app/main.py`)
- Playwright (automated tests only, not part of the app) – https://playwright.dev/

## 6. Open points

1. **UV:** 109 W/m² and 6.6 W/m² are rounded band shares, not integrated from the ASTM E490 table.
2. **Radiation:** shielding per g/cm² is linearised for mean solar activity (Φ = 500 MV). The real dependence on solar activity is not modelled.
3. **Impact sites:** exact coordinates of S1000a and S1094b were not looked up and are marked approximate.
4. **Knowledge base:** sentences were drafted with AI assistance from the sources. Not all were re-checked against the original text during the audit.
5. **Suit and EVA consumption values:** suit O₂, drink bag, absorbent garment, walking speed and equipment masses are assumptions. All can be changed in Settings.
6. **Dune fields:** the author of the Trek layer `Dune_Field` was not checked separately.
