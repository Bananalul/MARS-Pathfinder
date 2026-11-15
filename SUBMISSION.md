# MARS Pathfinder – Marswalk Planner
NASA Space Apps Challenge 2026 · Challenge: *Martian Map*

---

## 1. Project summary

MARS Pathfinder is a browser-based map and expedition planner for Mars. It turns NASA's open Mars data into one tool that can answer a practical question: **"Can a crew get from A to B on Mars safely, and what will they need?"**

- **Map.** It combines NASA Mars Trek imagery (Viking, MOLA, THEMIS, CTX, HiRISE) with USGS high-resolution elevation models.
- **Science views.** It adds 12 thematic views: geophysical, spectral, atmospheric, geochemical, magnetic, seismic, hydrological, volcanological, petrological, crystallographic, geomorphological and meteorological.
- **Route planning.** A route can be drawn by hand or found automatically between A and B. Every stretch is checked for slope, loose ground and missing data.
- **Crew or vehicle.** The planner computes oxygen, water, food, toilet capacity, EVA time, exertion and the way back to the nearest base for an astronaut on foot or for a rover. It recognises bases along the route as resupply stops.
- **Time and environment.** A Mars clock (NASA GISS Mars24 algorithm) drives modelled surface temperature, UV and cosmic-radiation dose. These can be played along the route as a "route walk".
- **Knowledge.** A built-in knowledge base explains NASA findings (missions, minerals, active surface features) with history, interpretation and instruments. Each statement is rated *safe / maybe / not safe* by how well it is established.
- **Globe and rover images.** A 3D globe and 3D terrain cut-outs from HiRISE elevation models are included. Raw rover images can be opened and annotated.

**Data honesty is a core feature.** Every value in the app is labelled as one of three kinds:

- **measured** – a NASA or USGS dataset;
- **derived / model** – computed from measured data with a documented model;
- **assumption** – a planning value we chose, with the reason given.

Nothing is invented. The app does not use AI at runtime and needs no API keys.

---

## 2. How it works (short)

| Part | What it does | Data class |
|---|---|---|
| Base maps and imagery | NASA Mars Trek WMTS tiles, loaded live | measured |
| Elevation and slope | USGS HiRISE DTMs (≈1 m) and CTX DTMs (20 m) found through the USGS STAC catalogue; MOLA 463 m as global fallback; read directly as Cloud-Optimized GeoTIFFs | measured / derived |
| Route planner | Coarse corridor on MOLA, then a fine grid checked against every DTM pixel. Avoids slopes above the profile limit, loose ground (THEMIS night IR) and areas without data. Re-plans up to 14 rounds around unsafe spots | derived |
| Mobility limits | Traction (soil friction angle), tip-over angle and power limit from mass, Mars gravity and speed | model |
| Crew logistics | Pandolf walking-energy equation with gravity terms scaled to Mars. Gives O₂, water, food, urine and EVA time per leg between bases | model + assumptions |
| Temperature | 1-D heat-conduction model (simplified, after NASA's KRC model) driven by TES thermal inertia, TES albedo, MOLA elevation and Mars24 sun position | model |
| Radiation | Cosmic-ray dose scaled from the Curiosity RAD measurement at Gale by atmospheric column depth; soil gamma dose from Odyssey GRS potassium and thorium | model |
| Thematic maps | MRO gravity (GMM-3), crustal thickness, crustal magnetic field (Langlais 2019 model), GRS elements, TES mineral maps, USGS geologic maps, valley networks, InSight seismic sources | measured / derived |

---

## 3. NASA data used

### Map tiles – NASA Solar System Treks (Mars Trek), JPL
Portal: https://trek.nasa.gov/mars/ · Tile service: https://trek.nasa.gov/tiles/Mars/EQ/

- Viking MDIM 2.1 color mosaic, 232 m/px – `Mars_Viking_MDIM21_ClrMosaic_global_232m` (Viking Orbiters, VIS)
- MOLA color hillshade, 463 m/px – `Mars_MGS_MOLA_ClrShade_merge_global_463m` (Mars Global Surveyor, MOLA)
- THEMIS day IR and night IR controlled mosaics, 100 m/px – `THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018`, `THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018` (Mars Odyssey, THEMIS)
- CTX and HiRISE orthomosaics (MRO):
  - Jezero: `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0`, `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd`
  - Gale: `Gale_CTX_BlockAdj_dd`, `curiosity_hirise_mosaic`
  - Other landing-site and rover-traverse HiRISE mosaics: Spirit, Opportunity, Phoenix, Sojourner, InSight, Viking 1/2, Columbia Hills, Marth crater, Candor Chasma, Ares 3/4 sites
- MOLA surface roughness – `mola_roughness`
- TES layers: albedo, thermal inertia, dust cover index, plagioclase, clinopyroxene, glass/clay – `Mars_MGS_TES_Albedo_mosaic_global_7410m`, `TES_Thermal_Inertia`, `tes_ruffdust`, `TES_Plagioclase`, `TES_Clinopyroxene`, `TES_Glass_Clay`
- USGS global geologic map tiles – https://trek.nasa.gov/mars/trekarcgis/rest/services/SIM3292_Global_Geology/MapServer
- Valley networks – https://trek.nasa.gov/mars/trekarcgis/rest/services/Hynek_Valley_Networks/MapServer
- Dune fields – https://trek.nasa.gov/mars/arcgis/rest/services/Dune_Field/MapServer
- **Vector layers**, snapshot from 14 Nov 2026 (https://trek.nasa.gov/mars/trekarcgis/rest/services):
  - mission landing sites and traverses
  - major features
  - the 2015 Human Exploration Zones (EZMars)
  - aqueous minerals (Ehlmann & Edwards 2014)
  - hydrous minerals (Carter et al. 2013)
  - chloride deposits (Osterloo et al. 2010)
  - RSL, gullies and new icy craters

### NASA Planetary Data System (PDS) – Geosciences Node
- **MGS TES nighttime thermal inertia** (Putzig & Mellon 2007): https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data/global_ti_night_2007.img
- **Mars Odyssey GRS element maps** (K, Th, Fe, Si, Cl, water-equivalent hydrogen; 5° smoothed; Boynton et al. 2007): https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/smoothed/
- **MRO Radio Science, NASA GMM-3 gravity field** (Genova et al. 2016): https://pds-geosciences.wustl.edu/mro/mro-m-rss-5-sdp-v1/mrors_1xxx/data/rsdmap/
  - free-air anomaly: `ggmro_120_anom_100.img`
  - Bouguer anomaly: `ggmro_120_bouguer_90.img`
  - crustal thickness by G. A. Neumann (GSFC): `ggmro_120_crust.img`
  - product page: https://pgda.gsfc.nasa.gov/products/57

### NASA mission data – mars.nasa.gov
- **Rover traverses** (MMGIS):
  - https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json
  - https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json
- **Raw rover images:**
  - Perseverance: https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json
  - Curiosity: https://mars.nasa.gov/api/v1/raw_image_items/
- **Rover weather** (REMS, MEDA):
  - https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json
  - https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json

### NASA reference values, standards and documents
- NASA NSSDCA Mars Fact Sheet (gravity 3.73 m/s², scale height 11.0 km, pressure): https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
- NASA GISS Mars24 sunclock algorithm (Allison & McEwen 2000): https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
- NASA-STD-3001 Vol. 1 Rev. B, radiation limits of 600 mSv per career and 250 mSv per solar particle event: https://www.nasa.gov/wp-content/uploads/2020/10/2022-01-05_nasa-std-3001_vol.1_rev._b_final_draft_with_signature_010522.pdf
- NASA OCHMO radiation protection technical brief: https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf
- NASA Exploration EVA System Concept of Operations EVA-EXP-0042 Rev. B (walking slopes up to 20°, traverses up to 2 km, EVAs up to 8 h): https://www.nasa.gov/wp-content/uploads/2017/02/eva-exp-0042_xeva_system_con_ops_rev_b_final_dtd_10192020_ref_doc.pdf
- Apollo lunar EVA metabolic rate, average 234 kcal/h: https://ntrs.nasa.gov/api/citations/19910001262/downloads/19910001262.pdf and NASA TN D-7883, https://www.nasa.gov/wp-content/uploads/static/history/alsj/tnD7883Metabolic.pdf
- Waligora & Horrigan, *Metabolic cost of extravehicular activities*: https://ntrs.nasa.gov/citations/19750006325
- NASA Life Support Baseline Values and Assumptions Document (BVAD, NASA/TP-2015-218570 Rev. 2), with O₂ at 0.84 kg per crew member per day plus drinking water and food values, as cited in:
  - https://ntrs.nasa.gov/api/citations/20230013896/downloads/Logistics_BeyondLEO-ASCEND2023-Pres.pdf
  - https://ntrs.nasa.gov/api/citations/20220002294/downloads/ICES-2022-388%20final%20for%20Strives.pdf
- NASA RP-1324 (Wieland 1994), metabolic needs and effluents (urine 1.5 kg/day)
- First Landing Site / Exploration Zone Workshop for Human Missions to Mars, LPI 2015 (LPI Contribution 1879): https://www.hou.usra.edu/meetings/explorationzone2015/
- Rover specifications:
  - Perseverance: https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/ and https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/quick_facts
  - Curiosity: NASA/JPL MSL mission pages
  - Apollo LRV: NASA NSSDCA

---

## 4. Space agency partner data and other data

- **ESA Mars Express HRSC**, in the MOLA + HRSC blended elevation hillshade served by NASA Mars Trek: `Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw`
- **USGS Astrogeology Science Center:**
  - MOLA global DEM, Cloud-Optimized GeoTIFF: https://asc-pds-services.s3.us-west-2.amazonaws.com/wms_basemaps3/Mars/MOLA/mola128_mola64_merge_90Nto90S_SimpleC_clon0_cog.tif
  - TES albedo mosaic: https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars_MGS_TES_Albedo_mosaic_global_7410m.tif
  - HiRISE and CTX DTM catalogue (STAC): https://stac.astrogeology.usgs.gov/api/collections/mro_hirise_socet_dtms and https://stac.astrogeology.usgs.gov/api/collections/mro_ctx_controlled_usgs_dtms
  - Viking product page: https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m
  - MOLA product page: https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m
- **USGS geologic maps** (ArcGIS feature services):
  - Tanaka et al. 2014, SIM 3292: https://doi.org/10.3133/sim3292
  - Sun & Stack 2020, SIM 3464 (Jezero): https://doi.org/10.3133/sim3464
- **USGS/IAU Gazetteer of Planetary Nomenclature** (volcano centre coordinates): https://planetarynames.wr.usgs.gov/
- **Global CTX mosaic** (Caltech Murray Lab, listed in Mars Trek): https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer
- **Mars crustal magnetic field model**, Langlais et al. 2019, coefficients on Zenodo: https://zenodo.org/records/3876714
- **UNSCEAR 2000 Report, Annex B**, dose conversion for natural soil radioactivity: https://www.unscear.org/unscear/en/publications/2000_1.html
- **Vehicle photos in Settings** (public domain, NASA; served by Wikimedia Commons):
  - Curiosity self-portrait PIA16239: https://commons.wikimedia.org/wiki/File:PIA16239_High-Resolution_Self-Portrait_by_Curiosity_Rover_Arm_Camera.jpg
  - Perseverance selfie PIA24836: https://commons.wikimedia.org/wiki/File:PIA24836_Perseverance%27s_Selfie_at_Rochette.jpg
  - Apollo 15 Lunar Roving Vehicle: https://commons.wikimedia.org/wiki/File:Apollo_15_Lunar_Rover_final_resting_place.jpg
  - NASA Space Exploration Vehicle prototype (2010): https://commons.wikimedia.org/wiki/File:Space_Exploration_Vehicle_in_field_(2010).jpg
- **Photos on the info pages** (data-layer spacecraft and NASA findings: Viking, MGS, Odyssey, MRO, Mars Express, all landers and rovers, major features, minerals, RSL, gullies, new craters): 31 public-domain NASA/JPL/USGS images served by Wikimedia Commons, each captioned with its credit and PIA number where available; full list with file names in `app/web/js/media.js`. Items without a real image of the subject (e.g. the Exploration Zones) have none.
- **Software:**
  - Leaflet 1.9.4: https://leafletjs.com/
  - three.js r181: https://threejs.org/
  - geotiff.js: https://geotiffjs.github.io/
  - Python standard library (local server and proxy)

---

## 5. Models and assumptions (transparency statement)

**Validated against NASA values**

- **Mars24 clock.** Reproduces the NASA GISS worked example: Ls 277.1876°, equation of time −5.1878°, declination −25.2282°, distance 1.39358 AU.
- **Cosmic radiation.** At Gale the model returns exactly the RAD measurement: 0.21 mGy/day and 0.64 ± 0.12 mSv/day (Hassler et al. 2014).
  - Other elevations are scaled by atmospheric column depth with 2.2 %/(g/cm²) for absorbed dose and 2.8 %/(g/cm²) for dose equivalent.
  - We derived these slopes from Guo et al. 2017: ≈15 % and ≈19 % difference between 18.9 and 25.7 g/cm² at solar modulation 500 MV.
  - Outside that range the app flags the value as extrapolated.
- **Solar particle events.** The September 2017 event is used as reference: +418 µGy at the surface, measured by MSL-RAD (Berger et al. 2018).
- **Walking energy.** Pandolf's equation with gravity scaled to the Moon gives ≈280 W. Apollo crews averaged 272 W (234 kcal/h).
- **Surface pressure.** The model gives ≈920 Pa at Gale (−4.5 km). Gale is measured at ≈700–950 Pa over the year.

**Model simplifications**

- **Surface temperature.** 1-D conduction, no slope or aspect, simplified atmosphere, fixed emissivity of 0.95 and dust optical depth of 0.5 (adjustable).
- **UV.** Uses rounded spectral shares: 200–400 nm ≈ 8 % and 200–280 nm ≈ 0.5 % of 1361 W/m², scaled by Mars distance and sun angle. These shares are not integrated from a reference spectrum.
- **Soil gamma dose.** Uranium is estimated from thorium with a chondritic Th/U ratio of 3.8.
- **Loose ground.** Classified relative to the surroundings from uncalibrated THEMIS night-IR brightness: bottom 10 % = loose, top 10 % = rock.

**Planning assumptions** (all editable in the app's Settings and labelled "assumption")

- body mass 75 kg, suit mass 82 kg (Apollo suit with backpack)
- 0.6 kg O₂ per suit, 0.95 L drink bag, 1 L absorbent garment
- walking speed 3 km/h, detour factor 1.3, sustainable limit 400 W
- a route point within 300 m of a base counts as a resupply stop
- all values of the pressurised crew-rover concept

---

## 6. Use of Artificial Intelligence

- **Code.** We wrote the code with the help of an AI coding assistant (Anthropic Claude). The team reviewed, tested and directed all of it.
- **Knowledge base.** The explanatory texts were drafted with AI from the scientific papers listed below. Every source exists and every DOI was resolved and checked. Not every sentence was re-read against the original paper.
- **No AI at runtime.** The app contains no AI service, sends no data to AI providers and uses no API keys. All values come from NASA/USGS data or the documented models above.
- **No AI-generated images.** All images and maps are NASA/USGS data products. Rover photos are NASA/JPL raw images.

---

## 7. Known limitations

- The temperature, UV and radiation maps are planning models, not measurements.
- The radiation shielding factor is a linearisation for mean solar activity.
- Positions of the InSight-detected impacts S1000a and S1094b are approximate.
- High-resolution slopes exist only where HiRISE or CTX DTMs exist. Elsewhere the planner falls back to MOLA (463 m) and marks those stretches.
- Without the local Python server, the gravity, crustal-thickness and element grids are read live, which is slow.

---

## 8. References

**Data products and models**

- Allison, M., McEwen, M. (2000). Planet. Space Sci. 48. https://doi.org/10.1016/S0032-0633(99)00092-6
- Bandfield, J. L. (2002). Global mineral distributions on Mars. JGR 107. https://doi.org/10.1029/2001JE001510
- Boynton, W. V. et al. (2007). Concentration of H, Si, Cl, K, Fe, and Th in the low- and mid-latitude regions of Mars. JGR 112. https://doi.org/10.1029/2007JE002887
- Christensen, P. R. et al. (2001). MGS Thermal Emission Spectrometer experiment. JGR 106. https://doi.org/10.1029/2000JE001370
- Clancy, R. T. et al. (2000). JGR 105. https://doi.org/10.1029/1999JE001089
- Genova, A. et al. (2016). Seasonal and static gravity field of Mars from MGS, Mars Odyssey and MRO radio science. Icarus 272. https://doi.org/10.1016/j.icarus.2016.02.050
- Hynek, B. M. et al. (2010). Updated global map of Martian valley networks. JGR 115. https://doi.org/10.1029/2009JE003548
- Kieffer, H. H. (2013). Thermal model for analysis of Mars infrared mapping. JGR Planets 118. https://doi.org/10.1029/2012JE004164
- Langlais, B. et al. (2019). A new model of the crustal magnetic field of Mars using MGS and MAVEN. JGR Planets 124. https://doi.org/10.1029/2018JE005854
- Neumann, G. A. et al. (2004). Crustal structure of Mars from gravity and topography. JGR 109. https://doi.org/10.1029/2004JE002262
- Putzig, N. E., Mellon, M. T. (2007). Apparent thermal inertia and the surface heterogeneity of Mars. Icarus 191. https://doi.org/10.1016/j.icarus.2007.05.013
- Ruff, S. W., Christensen, P. R. (2002). JGR 107. https://doi.org/10.1029/2001JE001580
- Smith, D. E. et al. (2001). Mars Orbiter Laser Altimeter. JGR 106. https://doi.org/10.1029/2000JE001364
- Sun, V. Z., Stack, K. M. (2020). USGS SIM 3464. https://doi.org/10.3133/sim3464
- Tanaka, K. L. et al. (2014). Geologic map of Mars, USGS SIM 3292. https://doi.org/10.3133/sim3292
- Vasavada, A. R. et al. (2014). JGR Planets 119. https://doi.org/10.1002/2014JE004622

**Radiation and UV**

- Berger, T. et al. (2018). The solar particle event on 10 September 2017… Space Weather 16. https://doi.org/10.1029/2018SW001920
- Cockell, C. S. et al. (2000). The ultraviolet environment of Mars. Icarus 146. https://doi.org/10.1006/icar.2000.6393
- Ehresmann, B. et al. (2018). GRL 45. https://doi.org/10.1029/2018GL077801
- Guo, J. et al. (2017). Dependence of the Martian radiation environment on atmospheric depth. JGR Planets 122, 329–341. https://doi.org/10.1002/2016JE005206
- Hassler, D. M. et al. (2014). Mars' surface radiation environment measured with the MSL Curiosity rover. Science 343. https://doi.org/10.1126/science.1244797
- Hassler, D. M. et al. (2018). Space Weather 16. https://doi.org/10.1029/2018SW001959
- Rafkin, S. C. R. et al. (2014). JGR Planets 119. https://doi.org/10.1002/2013JE004525
- Zeitlin, C. et al. (2013). Science 340. https://doi.org/10.1126/science.1235989

**Surface mechanics and human factors**

- Delage, P. et al. (2017). Space Sci. Rev. 211. https://doi.org/10.1007/s11214-017-0339-7
- Golombek, M. P. et al. (2008). In *The Martian Surface*, Cambridge Univ. Press. https://doi.org/10.1017/CBO9780511536076.022
- Pandolf, K. B. et al. (1977). Predicting energy expenditure with loads while standing or walking very slowly. J. Appl. Physiol. 43. https://doi.org/10.1152/jappl.1977.43.4.577

**Knowledge base (missions, features, minerals, active surface)**

- Anderson et al. (1977) JGR 82 – https://doi.org/10.1029/JS082i028p04524
- Baker & Milton (1974) Icarus 23 – https://doi.org/10.1016/0019-1035(74)90101-8
- Banerdt et al. (2020) Nat. Geosci. 13 – https://doi.org/10.1038/s41561-020-0544-y
- Bibring et al. (2006) Science 312 – https://doi.org/10.1126/science.1122659
- Bouley et al. (2016) Nature 531 – https://doi.org/10.1038/nature17171
- Byrne et al. (2009) Science 325 – https://doi.org/10.1126/science.1175307
- Carter et al. (2013) JGR Planets 118 – https://doi.org/10.1029/2012JE004145
- Daubar et al. (2013) Icarus 225 – https://doi.org/10.1016/j.icarus.2013.04.009
- Diniega et al. (2013) Icarus 225 – https://doi.org/10.1016/j.icarus.2013.04.006
- Dundas et al. (2012) Icarus 220 – https://doi.org/10.1016/j.icarus.2012.04.005
- Dundas et al. (2014) JGR Planets 119 – https://doi.org/10.1002/2013JE004482
- Dundas et al. (2017) Nat. Geosci. 10 – https://doi.org/10.1038/s41561-017-0012-5
- Dundas et al. (2019) Geol. Soc. Spec. Publ. 467 – https://doi.org/10.1144/SP467.5
- Ehlmann & Edwards (2014) Annu. Rev. Earth Planet. Sci. 42 – https://doi.org/10.1146/annurev-earth-060313-055024
- Eigenbrode et al. (2018) Science 360 – https://doi.org/10.1126/science.aas9185
- Giardini et al. (2020) Nat. Geosci. 13 – https://doi.org/10.1038/s41561-020-0539-8
- Golombek et al. (1997) Science 278 – https://doi.org/10.1126/science.278.5344.1743
- Grotzinger et al. (2014) Science 343 – https://doi.org/10.1126/science.1242777
- Hecht et al. (2009) Science 325 – https://doi.org/10.1126/science.1172466
- Hoffman et al. (2022) Science Advances 8 – https://doi.org/10.1126/sciadv.abp8636
- Horvath et al. (2021) Icarus 365 – https://doi.org/10.1016/j.icarus.2021.114499
- Hurowitz et al. (2025) Nature 645 – https://doi.org/10.1038/s41586-025-09413-0
- Ivanov & Head (2006) JGR 111 – https://doi.org/10.1029/2005JE002469
- Jones et al. (1979) Science 204 – https://doi.org/10.1126/science.204.4395.799
- Khan et al. (2023) Nature 622 – https://doi.org/10.1038/s41586-023-06586-4
- Klein (1978) Icarus 34 – https://doi.org/10.1016/0019-1035(78)90053-2
- Korablev et al. (2019) Nature 568 – https://doi.org/10.1038/s41586-019-1096-4
- Mangold et al. (2021) Science 374 – https://doi.org/10.1126/science.abl4051
- McEwen et al. (2011) Science 333 – https://doi.org/10.1126/science.1204816
- Morris et al. (2010) Science 329 – https://doi.org/10.1126/science.1189667
- Navarro-González et al. (2010) JGR 115 – https://doi.org/10.1029/2010JE003599
- Neukum et al. (2004) Nature 432 – https://doi.org/10.1038/nature03231
- Ojha et al. (2015) Nat. Geosci. 8 – https://doi.org/10.1038/ngeo2546
- Osterloo et al. (2008) Science 319 – https://doi.org/10.1126/science.1150690
- Osterloo et al. (2010) JGR 115 – https://doi.org/10.1029/2010JE003613
- Phillips et al. (2001) Science 291 – https://doi.org/10.1126/science.1058701
- Posiolova et al. (2022) Science 378 – https://doi.org/10.1126/science.abq7704
- Rieder et al. (1997) Science 278 – https://doi.org/10.1126/science.278.5344.1771
- Ruff & Farmer (2016) Nat. Commun. 7 – https://doi.org/10.1038/ncomms13554
- Smith et al. (2009) Science 325 – https://doi.org/10.1126/science.1172339
- Squyres et al. (2004) Science 306 – https://doi.org/10.1126/science.1104559
- Squyres et al. (2008) Science 320 – https://doi.org/10.1126/science.1155429
- Squyres et al. (2012) Science 336 – https://doi.org/10.1126/science.1220476
- Stähler et al. (2021) Science 373 – https://doi.org/10.1126/science.abi7730
- Stillman et al. (2014) Icarus 233 – https://doi.org/10.1016/j.icarus.2014.01.017
- Webster et al. (2018) Science 360 – https://doi.org/10.1126/science.aaq0131
- Whiteway et al. (2009) Science 325 – https://doi.org/10.1126/science.1172344
- Books without DOI: Lucchitta, B. K. et al. (1992), in *Mars*, Univ. of Arizona Press; Carr, M. H. (1996), *Water on Mars*, Oxford Univ. Press.

All DOIs were resolved through Crossref on 15 Nov 2026. A line-by-line audit of every value (measured / model / assumption, with the corrections made) is in `DATA_AUDIT.md`.
