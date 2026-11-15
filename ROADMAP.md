# MARS Pathfinder – Development roadmap

Challenge: **Interplanetary Survival Guide: Martian Map** (NASA Space Apps 2026).

**The task:** a local, layered plan for a Marswalk (place and route), using at least three kinds of data. The focus is astronaut safety, with optional ground-level imagery.

**Official challenge resources used:**
- JPL Mars Trek
- the USGS-NASA Planetary Geologic Mapping Program
- the Curiosity Mount Sharp traverse
- Perseverance raw images

**Rules we kept throughout:**
- Numerical values (elevation, slope) come only from original elevation models, never from tile colours.
- Every layer and value carries a data class: measured, derived/model or assumption.

## Milestones (all completed)

| # | Content |
|---|---------|
| M1 | Global map, base maps, graticule, Mars scale bar, point selection, go-to coordinates |
| M2 | Exploration sites Jezero and Gale, local HiRISE/CTX imagery, THEMIS night IR overlay, landing sites, distances |
| M3 | Elevation and slope from USGS HiRISE DTMs (1 m, Cloud-Optimized GeoTIFF, read directly in the browser) |
| M4 | Route planning: waypoints, length, elevation profile, slope classes, walking time |
| M5 | Mobility model (mass, power, Mars gravity, friction, tip-over angle) → proposed slope limits, confirmed or corrected by the user; travel time, energy, critical sections |
| M5b | THEMIS night IR along the route, relative to the surroundings: possible loose ground flagged |
| M6 | Geology: USGS SIM 3464 (Jezero) and SIM 3292 (global) with legend, unit at a point, in the report |
| M7 | Rover traverses (NASA MMGIS) and raw images of the nearest rover stop, view cone on the map |
| M8 | Environment: rover weather (REMS/MEDA), seasonal temperature range, EVA dose from MSL RAD |
| M9 | Export: GeoJSON, CSV profile, printable mission report; GeoJSON import |
| M10 | Automatic safest route A → B (A* on DTM + night-IR grid, mobility physics, detailed re-check) |
| M11 | Crew on foot vs. vehicle warning (NASA xEVA 20°, EVA-EXP-0042) |
| M12 | Long A → B planning (corridor + legs), cells from all DTM pixels, 16 neighbours, via points, fastest ↔ safest priority, hazard map, 2 km walking radius |
| M13 | 3D hazard view: DTM terrain coloured by slope, hazard pillars, route, true-scale astronaut and rover |
| M14 | Whole Mars: elevation from the cloud (USGS STAC: HiRISE ≈1 m, CTX 20 m; global MOLA 463 m), data quality shown per section |
| M15 | Adaptive search area that grows around constrained or detouring legs |
| M16 | NASA findings (Mars Trek: mission sites, 2015 Exploration Zones, minerals, chlorides, active surface) and user zones ("avoid" zones blocked for the planner) |
| M17 | Feedback from detailed to coarse planning: unsafe spots blocked, corridor re-planned; CTX in coarse planning |
| M18–M19 | Precise 3D cut-out: elevation mosaic from all DTMs up to 4096 px, slope and shading per elevation pixel, real HiRISE/CTX photo as surface |
| M20 | Mars time (Mars24), route start time, temperature/radiation/UV/soil-radioactivity maps, animated route walk |
| M21 | Knowledge base for all NASA findings rated Safe / Maybe safe / Not safe; bases with inventories; crew logistics (O₂, water, food, toilet, exertion, way back, vehicles, radiation, dust storms) |
| M22 | 12 thematic views (geophysical … meteorological) and globe view with Sun position, labels, zones and bases |
| M23 | Interface rework: tabs Route / Point / Zones / Bases / Settings / Data; draw-it-yourself and A → B planner each with their own controls and collapsible explanations; route summary cards on the map; start time and route walk docked next to the elevation profile; planning blocked until a traveller is chosen |
| M24 | Settings: astronaut or vehicle (LRV, Curiosity, Perseverance, pressurised-rover concept, custom) with rations and cabin supplies; vehicle checks (seats, range, O₂, water, food, medical); bases on the route act as resupply stops (route split into legs); sketching on rover images |
| M25 | Data audit: every value checked against NASA/USGS sources, seven corrections (Mars gravity, scale height, radiation shielding after Guo et al. 2017, GMM-3 naming, IAU volcano coordinates, suit mass, impact positions marked approximate); all references resolved by DOI (see DATA_AUDIT.md) |
| M26 | Real NASA photos on every info page (spacecraft, landers, rovers, features); skippable step-by-step tutorial for first-time users |

## Possible next steps

- Model the solar-activity dependence of atmospheric shielding instead of a mean value.
- Integrate UV from a reference solar spectrum and a dust radiative-transfer model.
- Count the time spent inside bases, and add multi-day expeditions with rest periods.
- Slope- and aspect-dependent surface temperature from the DTMs.
- Mars-specific suit requirements once NASA publishes them.
