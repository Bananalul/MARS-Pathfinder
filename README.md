# MARS Pathfinder – Marswalk Planner

NASA Space Apps Challenge 2026 · Challenge: *Interplanetary Survival Guide: Martian Map*

MARS Pathfinder is a browser map and expedition planner for Mars built entirely on open NASA and USGS data. It answers one question: **can a crew get from A to B on Mars safely, and what will they need on the way?**

What it brings together:
- NASA Mars Trek imagery (Viking, MOLA, THEMIS, CTX, HiRISE)
- 1 m HiRISE and 20 m CTX elevation models from USGS
- 12 thematic science views and a 3D globe
- rover traverses and raw rover images
- a Mars clock with environment models
- a knowledge base of NASA findings
- a route planner that checks a crew on foot or a vehicle, including oxygen, water, food, EVA time and resupply at bases

Every value in the app is labelled **measured** (NASA/USGS data), **derived/model** (computed with a documented model) or **assumption** (a planning value, editable). Nothing is made up. A full audit of every value and source is in [DATA_AUDIT.md](DATA_AUDIT.md), and the submission text with all references is in [SUBMISSION.md](SUBMISSION.md).

## Live demo

**[Open MARS Pathfinder](https://bananalul.github.io/MARS-Pathfinder/)** – runs in the browser, no installation. Source code: https://github.com/Bananalul/MARS-Pathfinder

A skippable **tutorial** opens on the first visit and can be restarted any time with **"? Tutorial"** at the top.

Quick start:
1. Open **Settings**, choose *Astronaut on foot* or *Vehicle*, and click **Yes, apply**. Planning is blocked until a traveller is chosen.
2. Choose *Jezero crater* at the top.
3. In **Route**, either draw waypoints yourself (box A) or set A and B and click **Find safest route** (box B).
4. Look at the summary cards (top right), the elevation profile and the crew check, then click **▶ Walk the route**.

## Run locally

Requires Python 3.8+ and an internet connection (data is loaded live from NASA/USGS services).

```
python app/main.py
```

Open http://127.0.0.1:8000 in a current browser (Chrome, Edge or Firefox).

On its first start the server builds the global science grids once from PDS/USGS and saves them as static files:
- `app/web/data/env-grids.*`: TES thermal inertia and albedo, GRS potassium and thorium
- `app/web/data/geo-grids.json`: GMM-3 gravity, crustal thickness, GRS Fe, Si, Cl and H₂O

After that they also work on GitHub Pages.

## Features

### Map and data
- **Global map and exploration sites.** Jezero and Gale, with local imagery down to 25 cm/px. Overlays for THEMIS night IR, USGS geologic maps (SIM 3464 Jezero, SIM 3292 global), rover traverses and NASA findings.
- **Elevation anywhere on Mars.** For every route, point query and 3D view, the app asks the USGS STAC catalogue for HiRISE (≈1 m) and CTX (20 m) DTMs and reads them as Cloud-Optimized GeoTIFFs. Elsewhere it uses MOLA (463 m), and those parts are flagged as not safety-checked.
- **12 thematic views:**
  - geophysical: NASA GMM-3 free-air and Bouguer gravity, crustal thickness, MOLA roughness
  - spectral: TES albedo, dust index and thermal inertia; THEMIS day/night IR
  - atmospheric: pressure, UV, radiation
  - geochemical: Mars Odyssey GRS K, Th, Fe, Si, Cl, H₂O
  - magnetic: crustal field from the Langlais et al. 2019 model, computed in the browser
  - seismic: InSight, Cerberus Fossae, impacts detected by InSight
  - hydrological: valley networks, liquid-water pressure, GRS water
  - volcanological: IAU volcano positions, geology, gravity
  - petrological: TES minerals, geologic units
  - crystallographic: mineral detections by crystal structure
  - geomorphological and meteorological views
- **Globe.** Zoom out past the smallest map zoom or click "🌐 Globe". Shows the Viking mosaic, the active layer, routes, zones, bases and labels, and the Sun placed from the Mars24 sun position. Lighting can be set to sunlit or fully lit.
- **NASA findings explained.** Missions, major features, the 2015 human Exploration Zones, aqueous and hydrous minerals, chlorides and active surface features. Each opens a page with history, interpretation, instruments and sources. Every statement is rated **Safe**, **Maybe safe** or **Not safe** by how well it is established. Info pages and data-source pages show a real NASA photo of the subject (spacecraft, lander, rover, feature) where one exists.

### Route planning (Route tab)
- **A – Draw it yourself.** Click waypoints and drag them. **Improve** keeps your shape as via points and replaces each piece with the safest path between them. Each box has its own Undo, Reverse and Clear.
- **B – A → B planner (safest route).** Coarse corridor on MOLA/CTX, then fine legs on the best DTM. A* with 16 neighbours on cells that aggregate all DTM pixels inside them. It avoids critical slopes, loose ground (THEMIS night IR), "avoid" zones and areas without data. Unsafe spots found in the detailed check are fed back and the corridor is re-planned (up to 14 rounds). A priority slider runs from fastest to safest, and an optional hazard map shows the planning grid.
- **Results.** Length, ascent, travel time and max. slope as cards at the top right of the map. Elevation profile with slope classes, critical sections and a red warning title on the map when something is critical.
- **Start time and route walk.** Fixed next to the elevation profile. Set the start in UTC or as the next local Mars time. The walk animates time, temperature, UV, dose and a crew figure (O₂, water, bladder, strain, EVA time) along the route.
- **3D.** Hazard view of any critical section, or a 3D cut-out of any rectangle. HiRISE/CTX/MOLA mosaic up to 4096 px, coloured by slope or textured with the real orbital photo, with a true-scale astronaut and rover.

### Crew and vehicles (Settings tab)
- **Who travels.** Choose *Astronaut on foot* or *Vehicle*. Vehicles are Apollo LRV, Curiosity, Perseverance (NASA specifications), a pressurised crew-rover concept (assumption) or a custom vehicle. Each real vehicle is shown with a NASA photo. Slope limits are computed from traction, tip-over and power under Mars gravity.
- **Astronaut settings.** Crew size, body and suit mass, terrain, suit O₂, EVA limit, drink bag, absorbent garment, rations and an equipment list.
- **Vehicle settings.** Seats, range, pressurised cabin, O₂, water, rations and medical kits on board.
- **Crew check.**
  - Walking energy from the Pandolf equation scaled to Mars gravity, checked against the Apollo EVA average of 234 kcal/h.
  - O₂, water, food, urine, exertion and EVA time.
  - The way back to the nearest base, and vehicles at bases on the route.
  - Cosmic-ray dose, solar-storm shelter time and dust season.
- **Bases as resupply stops.** Place bases and keep an inventory per base. When a route passes within 300 m of a base, the trip is split into legs. EVA time and toilet reset there, and O₂, water and food are refilled if the base lists them. The base stock is checked against what the crew takes.

### Point and environment
- **Point query.** Coordinates, elevation, slope, geologic unit and distance to the landing site. Shows the nearest raw Perseverance/Curiosity images with a view cone on the map.
- **Sketch on rover images.** Pen and eraser, colour and adjustable size. Drawings are saved per image in the browser and never change the NASA image.
- **Mars time and environment.** Mars24 clock, surface temperature model, UV, cosmic-ray dose, soil gamma dose, rover weather (REMS/MEDA) and EVA dose from MSL RAD.
- **Zones.** Draw coloured, named zones (resources, ice, hazards, targets). "Avoid" zones are blocked for the planner. GeoJSON export and import.
- **Export.** Printable mission report, GeoJSON route, CSV profile.
- **Interface.** English or German (EN/DE switch).

## Data sources (summary)

| Data | Provider |
| --- | --- |
| Viking MDIM 2.1, MOLA, MOLA+HRSC (ESA), THEMIS day/night IR, CTX and HiRISE mosaics, TES layers, geology, valley networks, dune fields, vector layers | NASA Mars Trek (JPL) |
| HiRISE (≈1 m) and CTX (20 m) DTMs, MOLA 463 m DEM, TES albedo mosaic | USGS Astrogeology (STAC, AWS COG) |
| TES thermal inertia, Odyssey GRS elements, MRO GMM-3 gravity and crustal thickness | NASA PDS Geosciences Node |
| Geologic maps SIM 3464 and SIM 3292 | USGS-NASA Planetary Geologic Mapping Program |
| Rover traverses, raw images, REMS/MEDA weather | NASA/JPL (mars.nasa.gov) |
| Crustal magnetic field model | Langlais et al. 2019 (Zenodo) |
| Mars24 algorithm | NASA GISS |
| RAD dose, SEP 2017, radiation limits, EVA limits, life-support values, Apollo metabolic rates | Hassler et al. 2014, Berger et al. 2018, NASA-STD-3001, NASA xEVA ConOps, NASA BVAD, NASA NTRS |

Full list with links and DOIs: [SUBMISSION.md](SUBMISSION.md). Value-by-value audit: [DATA_AUDIT.md](DATA_AUDIT.md).

## Structure

```
index.html                redirect to app/web/ (GitHub Pages entry point)
app/main.py               local server, allow-listed proxy, builds the science grids
app/web/index.html        user interface
app/web/css/style.css     styles
app/web/data/             NASA findings snapshot, knowledge base, prebuilt science grids
app/web/vendor/           Leaflet 1.9.4 (BSD-2-Clause), geotiff.js 2.1.3 (MIT), three.js r181 (MIT)
app/web/js/
  app.js        map setup and UI wiring          i18n.js       English/German interface
  mars.js       Mars geodesy                     datasets.js   map layer catalogue
  dem.js        DTM search and reading (STAC)    mobility.js   vehicle/EVA mobility model, Settings
  route.js      route, profile, export, report   pathfinder.js automatic safest route A → B
  terrain3d.js  3D hazard view                   cut3d.js      3D cut-out
  imagery.js    orbital photo textures           globe.js      globe view
  marstime.js   Mars24 time and Sun position     climate.js    thermal model, radiation, UV, grids
  envui.js      Mars clock, environment layers, route walk
  thematic.js   12 thematic views                kb.js         knowledge base (Safe / Maybe / Not safe)
  poi.js        NASA findings layers             zones.js      user zones
  bases.js      bases and inventories            logistics.js  crew/vehicle logistics, base stops
  rover.js      rover traverses and raw images   vision.js     camera view cone
  sketch.js     drawing on rover images          geology.js    USGS geologic maps
  environment.js rover weather, RAD dose         thermal.js    THEMIS night-IR ground classes
  ui-extra.js   loading bar, legend, draggable panels
  media.js      public-domain NASA photos for the info pages (Wikimedia Commons)
  tour.js       skippable step-by-step tutorial
```

## Limitations

- Temperature, UV, radiation maps and crew consumption are **planning models**, not measurements. The radiation shielding factor is a linearisation for mean solar activity (Guo et al. 2017).
- Rolling resistance, safety factors, minimum speeds, suit O₂, walking speed and equipment masses are assumptions. The app marks them and lets the user change them.
- MOLA (463 m) cannot resolve cliffs or boulder fields, and routes there are corridor suggestions only. CTX (20 m) misses features narrower than ≈50 m. Boulders smaller than a DTM cell are not detected.
- The planner's hazard weights and the 15 % blocking share are design choices, not measurements.
- The 20° walking limit and 2 km walk-back radius come from NASA's lunar xEVA requirements. No Mars suit requirement is published yet.
- Downhill braking and energy recovery are not modelled. Time spent inside a base is not counted.
- Gale has no local geologic map service, so the 1:20M global map is used there.

## Use of AI

- **Code and documents.** The source code was written with the help of an AI coding assistant (Anthropic Claude), directed, tested and reviewed by the team. The assistant also helped verify dataset endpoints, check every reference (all DOIs resolved through Crossref) and draft documentation.
- **Knowledge base.** The texts were drafted with AI from the cited papers.
- **Data.** No data shown in the app is AI-generated, and the app uses no AI service at runtime. Each source file carries a header noting AI assistance.
