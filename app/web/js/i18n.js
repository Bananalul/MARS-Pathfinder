// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Language switch EN/DE. English is the source language; German strings are looked up by the English text.
// Static text and text inserted later is translated by a MutationObserver; text with numbers goes through t(key, vars).

const LANG_KEY = "mars-pathfinder-lang";
const LANG = (() => {
  try {
    return localStorage.getItem(LANG_KEY) === "de" ? "de" : "en";
  } catch {
    return "en";
  }
})();

const I18N_DE = {
  "Base map": "Basiskarte",
  "Environment & Mars time": "Umwelt & Mars-Zeit",
  "Model layers from NASA data – time-dependent.": "Modellebenen aus NASA-Daten – zeitabhängig.",
  "More overlays": "Weitere Overlays",
  "🕒 Start time and route walk": "🕒 Startzeit und Routen-Animation",
  "⚠ Critical sections": "⚠ Kritische Abschnitte",
  "No route yet – use A or B above. Waypoints can be dragged.": "Noch keine Route – A oder B oben nutzen. Wegpunkte lassen sich verschieben.",
  "How does the search work?": "Wie funktioniert die Suche?",
  "labels, markers, zones, bases, route": "Beschriftungen, Marker, Zonen, Basen, Route",
  "Sunlight (real time)": "Sonnenlicht (echte Zeit)",
  "Fully lit": "Voll beleuchtet",
  "Thematic maps": "Thematische Karten",
  "Mars – globe view": "Mars – Globusansicht",
  "show active thematic layer": "aktive thematische Ebene zeigen",
  "· Viking MDIM 2.1 colour mosaic (NASA/USGS, via Mars Trek). Drag to rotate, scroll to zoom, click a place to open the map there.": "· Viking-MDIM-2.1-Farbmosaik (NASA/USGS, über Mars Trek). Ziehen zum Drehen, Scrollen zum Zoomen, auf einen Ort klicken, um die Karte dort zu öffnen.",
  "Two ways – both end in the same route, checked below:": "Zwei Wege – beide ergeben eine Route, die unten geprüft wird:",
  "Draw it yourself": "Selbst zeichnen",
  "Click “Draw route”, then click your waypoints on the map in walking order. “Improve” keeps your line's shape but makes each piece safe.": "„Route zeichnen“ klicken, dann die Wegpunkte in Laufrichtung in die Karte klicken. „Verbessern“ behält die Form deiner Linie, macht aber jedes Teilstück sicher.",
  "Keep the shape of your drawn route (your waypoints stay as via points) and replace each piece by the safest path": "Form deiner gezeichneten Route behalten (deine Wegpunkte bleiben Zwischenziele) und jedes Teilstück durch den sichersten Weg ersetzen",
  "Let the planner find it: safest route A → B": "Vom Planer finden lassen: sicherste Route A → B",
  "Set only start A and destination B (and optional via points) – the planner draws the whole route for you.": "Nur Start A und Ziel B setzen (optional Zwischenziele) – der Planer zeichnet die ganze Route.",
  "✦ Improve (make safe)": "✦ Verbessern (sicher machen)",
  "Replace the drawn line by the safest route from its start to its end (automatic search)": "Gezeichnete Linie durch die sicherste Route von ihrem Start zu ihrem Ende ersetzen (automatische Suche)",
  "Safest route": "Sicherste Route",
  "Loading elevation data along the route …": "Lade Höhendaten entlang der Route …",
  "🧑‍🚀 Astronaut / crew check": "🧑‍🚀 Astronauten-/Crew-Check",
  "Crew, suit and equipment carried": "Crew, Anzug und mitgeführte Ausrüstung",
  "Equipment carried per person": "Ausrüstung pro Person",
  "Route between bases": "Route zwischen Basen",
  "From": "Von",
  "to": "nach",
  "Direct line": "Direkte Linie",
  "The safest route uses the automatic A → B search with your vehicle / astronaut profile; the result appears in the Route tab with the astronaut check.": "Die sicherste Route nutzt die automatische A → B-Suche mit deinem Fahrzeug-/Astronautenprofil; das Ergebnis erscheint im Route-Tab mit dem Astronauten-Check.",
  "Environment (model + NASA data)": "Umwelt (Modell + NASA-Daten)",
  "Off": "Aus",
  "Surface temperature": "Oberflächentemperatur",
  "Bases": "Basen",
  "Bases and supplies": "Basen und Vorräte",
  "Place bases and list what is stored there – oxygen, water, food, medical kits, vehicles (with range and seats), tools, energy, suits. The route planner checks the crew logistics against the nearest base. Stored in this browser; export as JSON to share.": "Basen setzen und eintragen, was dort lagert – Sauerstoff, Wasser, Nahrung, Medizin, Fahrzeuge (mit Reichweite und Sitzen), Werkzeug, Energie, Anzüge. Die Routenplanung prüft die Crew-Logistik gegen die nächste Basis. Im Browser gespeichert; als JSON exportierbar.",
  "Place base": "Basis setzen",
  "Export JSON": "JSON exportieren",
  "Crew logistics": "Crew-Logistik",
  "Crew and suit assumptions": "Annahmen zu Crew und Anzug",
  "Crew": "Crew",
  "Body mass kg": "Körpermasse kg",
  "Suit + life support kg": "Anzug + Lebenserhaltung kg",
  "Carried load kg": "Zusatzlast kg",
  "Ground": "Untergrund",
  "firm": "fest",
  "loose regolith": "lockerer Regolith",
  "sand": "Sand",
  "Suit O₂ kg": "Anzug-O₂ kg",
  "EVA limit h": "EVA-Limit h",
  "Drink bag L": "Trinkbeutel L",
  "Absorbent garment L": "Windel (MAG) L",
  "ℹ All findings explained (Safe / Maybe / Not safe)": "ℹ Alle Erkenntnisse erklärt (Sicher / Wahrscheinlich / Unsicher)",
  "← Overview": "← Übersicht",
  // Mars time, environment maps, route walk
  "Mars time": "Mars-Zeit",
  "Time (UTC)": "Zeit (UTC)",
  "Now": "Jetzt",
  "Environment map": "Umweltkarte",
  "No environment layer": "Keine Umweltebene",
  "Surface temperature (model)": "Oberflächentemperatur (Modell)",
  "Cosmic radiation dose": "Kosmische Strahlendosis",
  "UV irradiance": "UV-Einstrahlung",
  "Soil radioactivity (K, Th)": "Boden-Radioaktivität (K, Th)",
  "Thermal inertia (TES, measured)": "Wärmeträgheit (TES, gemessen)",
  "▶ Play one sol": "▶ Einen Sol abspielen",
  "Dust": "Staub",
  "clear (τ 0.3)": "klar (τ 0,3)",
  "typical (τ 0.5)": "typisch (τ 0,5)",
  "dusty (τ 1.0)": "staubig (τ 1,0)",
  "dust storm (τ 2.5)": "Staubsturm (τ 2,5)",
  "Click the map for all values at a place.": "Auf die Karte klicken für alle Werte an einem Ort.",
  "Start (UTC)": "Start (UTC)",
  "or next local time": "oder nächste Ortszeit",
  "▶ Walk the route": "▶ Route abspielen",
  "Route walk": "Routen-Animation",
  "Simulated hours per second": "Simulierte Stunden pro Sekunde",
  "ground temperature": "Bodentemperatur",
  "accumulated dose": "Dosis kumuliert",
  "night": "Nacht",
  // Top bar, tabs, panels
  "Marswalk Planner": "Marswalk-Planer",
  "Coordinate, e.g. 4.59S 137.44E": "Koordinate, z. B. 4.59S 137.44E",
  "Go to": "Gehe zu",
  Global: "Global",
  "Jezero crater": "Jezero-Krater",
  "Gale crater / Mount Sharp": "Gale-Krater / Mount Sharp",
  "Gale crater": "Gale-Krater",
  "Map layers": "Kartenebenen",
  "Local imagery": "Lokale Bilddaten",
  "Geology (USGS)": "Geologie (USGS)",
  "Geologic map": "Geologische Karte",
  Opacity: "Deckkraft",
  "mapped interpretation ·": "kartierte Interpretation ·",
  "Science overlays": "Wissenschaftliche Overlays",
  "Base map (global)": "Basiskarte (global)",
  "Map elements": "Kartenelemente",
  "Landing sites": "Landestellen",
  "Rover traverse (NASA/JPL)": "Rover-Fahrstrecke (NASA/JPL)",
  "DTM coverage (HiRISE, 1 m)": "DTM-Abdeckung (HiRISE, 1 m)",
  Graticule: "Koordinatennetz",
  "Show data source": "Datenquelle anzeigen",
  Route: "Route",
  Point: "Punkt",
  Environment: "Umwelt",
  Data: "Daten",
  "Tiles: NASA/JPL-Caltech Mars Trek · USGS Astrogeology": "Kacheln: NASA/JPL-Caltech Mars Trek · USGS Astrogeology",
  Resolution: "Auflösung",
  outside: "außerhalb",
  "{n} tile(s) failed to load": "{n} Kachel(n) nicht geladen",
  "East–west scale at {lat}° latitude": "Ost-West-Maßstab bei {lat}° Breite",

  // Profile
  "Elevation profile (HiRISE DTM)": "Höhenprofil (HiRISE-DTM)",
  "below caution limit": "unter Vorsicht-Grenze",
  caution: "Vorsicht",
  critical: "kritisch",
  "no data": "keine Daten",
  "low night IR": "niedriges Nacht-IR",
  "high night IR": "hohes Nacht-IR",
  "no DTM data": "keine DTM-Daten",
  slope: "Neigung",
  "night IR": "Nacht-IR",
  low: "niedrig",
  mid: "mittel",
  high: "hoch",
  "No DTM coverage along the route.": "Keine DTM-Abdeckung entlang der Route.",
  "Loading elevation data …": "Höhendaten werden geladen …",

  // Route tab
  "Choose a site": "Einsatzgebiet wählen",
  "Jezero crater or Gale crater in the top bar.": "Jezero- oder Gale-Krater in der oberen Leiste.",
  "Vehicle or astronaut": "Fahrzeug oder Astronaut",
  "Set profile": "Profil festlegen",
  "Plan the Marswalk": "Marswalk planen",
  "Draw route": "Route zeichnen",
  "Stop drawing": "Zeichnen beenden",
  "Load example route": "Beispielroute laden",
  Undo: "Zurück",
  Reverse: "Umkehren",
  Clear: "Löschen",
  Import: "Import",
  "Remove last waypoint": "Letzten Wegpunkt entfernen",
  "Reverse direction": "Richtung umkehren",
  "Click “Draw route”, then click waypoints on the map. Waypoints can be dragged.":
    "Auf „Route zeichnen“ klicken, dann Wegpunkte auf die Karte setzen. Wegpunkte lassen sich verschieben.",
  Length: "Länge",
  "Ascent / descent": "Auf- / Abstieg",
  "Travel time": "Fahrzeit",
  "Max. slope": "Max. Neigung",
  "Critical sections": "Kritische Abschnitte",
  "Possible loose ground": "Möglicher lockerer Boden",
  "THEMIS night IR in the lowest 10 % of the surroundings (±2 km): likely dust or loose sand, risk of wheel sinkage. Relative values, not calibrated.":
    "THEMIS-Nacht-IR in den untersten 10 % der Umgebung (±2 km): wahrscheinlich Staub oder lockerer Sand, Einsinkgefahr für Räder. Relative Werte, nicht kalibriert.",
  "All route values": "Alle Routenwerte",
  Waypoints: "Wegpunkte",
  "DTM coverage": "DTM-Abdeckung",
  "Elevation min … max": "Höhe min … max",
  "Max. grade (along route)": "Max. Steigung (entlang Route)",
  "Max. terrain slope": "Max. Geländeneigung",
  "Limits caution / critical": "Grenzen Vorsicht / kritisch",
  "Share caution / critical": "Anteil Vorsicht / kritisch",
  "Mechanical energy (model)": "Mechanische Energie (Modell)",
  "Distance at reduced speed": "Strecke mit reduzierter Geschw.",
  "Night IR low / high": "Nacht-IR niedrig / hoch",
  "elevation from USGS HiRISE stereo DTMs ·": "Höhe aus USGS-HiRISE-Stereo-DTMs ·",
  "slope, grade, distance": "Neigung, Steigung, Distanz",
  "Slope baseline ≈ {b} m, elevation bilinear from DTM cells of {c} m":
    "Neigungsbasis ≈ {b} m, Höhe bilinear aus DTM-Zellen à {c} m",
  Export: "Export",
  "Mission report": "Missionsbericht",
  "CSV profile": "CSV-Profil",
  unconfirmed: "unbestätigt",
  "no THEMIS coverage": "keine THEMIS-Abdeckung",
  "No sections above the critical slope.": "Keine Abschnitte über der kritischen Neigung.",
  "No stretches with very low thermal inertia.": "Keine Abschnitte mit sehr niedriger thermischer Trägheit.",
  "Show on map": "Auf der Karte zeigen",
  "single point": "punktuell",
  "up to": "bis",
  "DTM could not be loaded (see console).": "DTM konnte nicht geladen werden (siehe Konsole).",
  "Import failed: {msg}": "Import fehlgeschlagen: {msg}",
  "No LineString route found": "Keine LineString-Route gefunden",
  "Pop-up blocked – please allow pop-ups for this page.": "Pop-up blockiert – bitte Pop-ups für diese Seite erlauben.",

  // Point tab
  "Click the map to set a point.": "Auf die Karte klicken, um einen Punkt zu setzen.",
  Latitude: "Breite",
  "Longitude (0–360° E)": "Länge (0–360° E)",
  "Longitude (±180°)": "Länge (±180°)",
  Decimal: "Dezimal",
  "Elevation (DTM)": "Höhe (DTM)",
  "Terrain slope": "Geländeneigung",
  "Geologic unit": "Geologische Einheit",
  "Distance to landing site": "Distanz zur Landestelle",
  "Distance to {name}": "Distanz {name}",
  "Copy coordinates": "Koordinaten kopieren",
  Copied: "Kopiert",
  "Copy failed": "Kopieren fehlgeschlagen",
  Remove: "Entfernen",
  "loading …": "lädt …",
  "no HiRISE DTM": "kein HiRISE-DTM",
  "not available": "nicht verfügbar",
  "{dem}, cell {cell} m. Elevation relative to the Mars 2015 sphere (R = 3396.19 km).":
    "{dem}, Zelle {cell} m. Höhe relativ zur Mars-2015-Kugel (R = 3396,19 km).",
  "Horn method over 3×3 cells (baseline ≈ {b} m), derived": "Horn-Verfahren über 3×3 Zellen (Basis ≈ {b} m), abgeleitet",
  "Great-circle distance on the Mars sphere, R = 3396.19 km (derived)":
    "Großkreisdistanz auf der Mars-Kugel, R = 3396,19 km (abgeleitet)",
  "Interpretation:": "Interpretation:",
  Source: "Quelle",
  "Ground view (rover raw images)": "Bodenansicht (Rover-Rohbilder)",
  "Select a point or waypoint inside a site.": "Punkt oder Wegpunkt im Einsatzgebiet wählen.",
  "Ground images are available for the Jezero and Gale sites.": "Bodenbilder gibt es für die Einsatzgebiete Jezero und Gale.",
  "Finding nearest rover stop …": "Suche nächsten Rover-Halt …",
  "No {mission} stop within {max} m (nearest: {d}).": "Kein {mission}-Halt im Umkreis von {max} m (nächster: {d}).",
  "Stop {d} from the point": "Halt {d} vom Punkt entfernt",
  "Loading raw images …": "Lade Rohbilder …",
  "NASA raw images could not be loaded.": "NASA-Rohbilder konnten nicht geladen werden.",
  "No navigation or mast camera images for sol {sol}.": "Für Sol {sol} gibt es keine Navigations- oder Mastkamera-Bilder.",
  "Raw images from the rover position on this sol. Viewing direction varies per image.":
    "Rohbilder vom Rover-Standort an diesem Sol. Blickrichtung je Bild verschieden.",
  Gallery: "Galerie",
  Image: "Bild",
  "open at NASA": "bei NASA öffnen",
  Close: "Schließen",

  // Environment tab
  Weather: "Wetter",
  "Select Jezero or Gale.": "Jezero oder Gale wählen.",
  "Weather data is shown for the Jezero and Gale sites.": "Wetterdaten gibt es für Jezero und Gale.",
  "Loading {station} weather …": "Lade {station}-Wetter …",
  "No valid sols in the {station} feed.": "Keine gültigen Sols im {station}-Feed.",
  "Weather feed could not be loaded.": "Wetter-Feed konnte nicht geladen werden.",
  "Air temperature min / max": "Lufttemperatur min / max",
  "Ground temperature min / max": "Bodentemperatur min / max",
  Pressure: "Druck",
  "UV index": "UV-Index",
  "Sunrise / sunset (local)": "Sonnenauf- / -untergang (lokal)",
  "Season range, air": "Jahreszeit-Bereich, Luft",
  "Season range, ground": "Jahreszeit-Bereich, Boden",
  "Daily values processed by Centro de Astrobiología for outreach; scientific data in the PDS.":
    "Tageswerte, aufbereitet vom Centro de Astrobiología für die Öffentlichkeit; wissenschaftliche Daten im PDS.",
  "The public MEDA feed currently holds only a few sols; values may be older than the mission.":
    "Der öffentliche MEDA-Feed enthält derzeit nur wenige Sols; Werte können älter als der Missionsstand sein.",
  "Season range: all {n} sols within Ls {ls}° ± 15°.": "Jahreszeit-Bereich: alle {n} Sols innerhalb Ls {ls}° ± 15°.",
  "Radiation during the EVA": "Strahlung während des EVA",
  "EVA duration": "EVA-Dauer",
  "(default: route travel time)": "(Standard: Fahrzeit der Route)",
  "Enter an EVA duration or plan a route.": "EVA-Dauer eingeben oder Route planen.",
  "Surface dose rate": "Dosisrate Oberfläche",
  "EVA dose": "EVA-Dosis",
  "Share of NASA career limit ({lim} mSv)": "Anteil am NASA-Karrierelimit ({lim} mSv)",
  RAD_NOTE:
    "Galaktische kosmische Strahlung, gemessen von RAD im Gale-Krater (Hassler et al. 2014, Science). Ohne Abschirmung durch den Anzug. Jezero liegt etwa 1,9 km höher als Gale, unter weniger Atmosphäre – die Dosis ist dort vermutlich etwas höher. Ein Sonnenteilchen-Ereignis kann deutlich mehr bringen; NASA begrenzt ein Ereignis auf {spe} mSv – Zugang zu einem Schutzraum einplanen.",

  // Data tab
  "Data source": "Datenquelle",
  "Data classes": "Datenklassen",
  Measured: "Messdaten",
  Derived: "Abgeleitet",
  Illustrative: "Illustrativ",
  "directly from instrument data": "direkt aus Instrumentdaten",
  "computed / visualized from measurements": "berechnet / visualisiert aus Messdaten",
  "placeholder or assumption, not measured": "Platzhalter oder Annahme, keine Messung",
  About: "Über",
  "MARS Pathfinder – NASA Space Apps Challenge 2026, challenge “Interplanetary Survival Guide: Martian Map”. Coordinates: Mars 2000 sphere, planetocentric latitude, east longitude.":
    "MARS Pathfinder – NASA Space Apps Challenge 2026, Challenge „Interplanetary Survival Guide: Martian Map“. Koordinaten: Mars-2000-Kugel, planetozentrische Breite, Ost-Länge.",
  Mission: "Mission",
  Instrument: "Instrument",
  "Data type": "Datentyp",
  Coverage: "Abdeckung",
  "Layer-ID": "Layer-ID",
  Sources: "Quellen",

  // Dataset catalog
  "Viking MDIM 2.1 color mosaic": "Viking MDIM 2.1 Farbmosaik",
  "MOLA elevation (color hillshade)": "MOLA-Höhenmodell (Farbschummerung)",
  "MOLA + HRSC elevation (color hillshade)": "MOLA + HRSC Höhenmodell (Farbschummerung)",
  "THEMIS daytime infrared": "THEMIS Tag-Infrarot",
  "THEMIS nighttime infrared": "THEMIS Nacht-Infrarot",
  "CTX Jezero, controlled": "CTX Jezero, kontrolliert",
  "HiRISE Jezero, controlled": "HiRISE Jezero, kontrolliert",
  "CTX Gale crater": "CTX Gale-Krater",
  "HiRISE Curiosity traverse area": "HiRISE Curiosity-Fahrgebiet",
  optical: "optisch",
  topographic: "topografisch",
  thermal: "thermal",
  global: "global",
  "approx. 6 m/px": "ca. 6 m/px",
  "tiles up to approx. 0.6 m/px": "Kacheln bis ca. 0,6 m/px",
  "Jezero crater, delta and crater floor": "Jezero-Krater, Delta und Kraterboden",
  "Aeolis Palus to lower Mount Sharp": "Aeolis Palus bis unterer Mount Sharp",
  "Mars Odyssey (NASA, since 2001)": "Mars Odyssey (NASA, seit 2001)",
  "Mars Reconnaissance Orbiter (NASA, since 2006)": "Mars Reconnaissance Orbiter (NASA, seit 2006)",
  "Orbital images, controlled and colorized (USGS / NASA Ames).": "Orbitalbilder, kontrolliert und eingefärbt (USGS / NASA Ames).",
  "Visualization of measured laser altimetry. Colors show elevation qualitatively – no queryable values in this layer.":
    "Visualisierung gemessener Laserhöhen. Farben zeigen Höhe qualitativ – keine abfragbaren Messwerte in diesem Layer.",
  "Visualization of a blended elevation model. Colors are qualitative, no queryable values.":
    "Visualisierung eines kombinierten Höhenmodells. Farben qualitativ, keine Messwerte abfragbar.",
  "Controlled IR mosaic. Brightness shows daytime surface heating, strongly affected by slope and aspect. No calibrated temperatures.":
    "Kontrolliertes IR-Mosaik. Helligkeit zeigt Erwärmung am Tag, stark beeinflusst von Neigung und Ausrichtung. Keine kalibrierten Temperaturen.",
  "Bright at night = surface keeps heat = high thermal inertia (rock, indurated material). Dark = dust, fine sand. Relative, no calibrated temperatures.":
    "Nachts hell = Oberfläche hält Wärme = hohe thermische Trägheit (Fels, verfestigtes Material). Dunkel = Staub, feiner Sand. Relativ, keine kalibrierten Temperaturen.",
  "Controlled orthomosaic (Mars 2020 landing site mapping).": "Kontrolliertes Orthomosaik (Mars-2020-Landestellenkartierung).",
  "Controlled orthomosaic. Individual boulders from about 1 m are visible.": "Kontrolliertes Orthomosaik. Einzelne Felsblöcke ab ca. 1 m erkennbar.",
  "Block-adjusted CTX mosaic.": "Blockausgeglichenes CTX-Mosaik.",
  "HiRISE mosaic along the Curiosity route.": "HiRISE-Mosaik entlang der Curiosity-Route.",
  "Perseverance landing site, 18 Feb 2021": "Landestelle Perseverance, 18.02.2021",
  "Curiosity landing site, 6 Aug 2012": "Landestelle Curiosity, 06.08.2012",
  "SIM 3464 – Jezero crater and Nili Planum (1:75,000)": "SIM 3464 – Jezero-Krater und Nili Planum (1:75.000)",
  "SIM 3292 – Geologic map of Mars (1:20M)": "SIM 3292 – Geologische Karte des Mars (1:20 Mio.)",
  "Loading geologic map …": "Lade geologische Karte …",
  "Geologic map could not be loaded.": "Geologische Karte konnte nicht geladen werden.",

  // View direction
  Save: "Speichern",
  Surface: "Untergrund",
  medium: "mittel",
  "View direction": "Blickrichtung",
  "View direction {az}° ({dir}), elevation {el}°, field of view ≈ {fov}° – from the camera model in the NASA metadata.":
    "Blickrichtung {az}° ({dir}), Neigung {el}°, Bildwinkel ≈ {fov}° – aus dem Kameramodell der NASA-Metadaten.",
  "View direction not available in the metadata of this image.": "Blickrichtung ist in den Metadaten dieses Bildes nicht verfügbar.",

  // Automatic route A → B
  "Automatic: safest route A → B": "Automatisch: sicherste Route A → B",
  "Set A": "A setzen",
  "Set B": "B setzen",
  "Find safest route": "Sicherste Route suchen",
  "Remove A and B": "A und B entfernen",
  "Avoids slopes above your critical limit, steep grades, loose ground (night IR) and areas without elevation data; minimises travel time with your vehicle's physics.":
    "Meidet Hänge über deinem kritischen Grenzwert, steile Steigungen, lockeren Boden (Nacht-IR) und Gebiete ohne Höhendaten; minimiert die Fahrzeit mit der Physik deines Fahrzeugs.",
  "Click the start point A on the map.": "Startpunkt A auf der Karte anklicken.",
  "Click the destination B on the map.": "Ziel B auf der Karte anklicken.",
  "A and B set. Start the search.": "A und B gesetzt. Suche starten.",
  "Loading DTM and night IR for {n} grid cells ({c} m) …": "Lade DTM und Nacht-IR für {n} Rasterzellen ({c} m) …",
  "Searching safest path (pass {i}) …": "Suche sichersten Weg (Durchgang {i}) …",
  "Checking the path at full DTM resolution (pass {i}) …": "Prüfe den Weg in voller DTM-Auflösung (Durchgang {i}) …",
  "No HiRISE elevation data in this area – automatic planning needs a DTM (see “DTM coverage” on the map).":
    "Keine HiRISE-Höhendaten in diesem Gebiet – die automatische Planung braucht ein DTM (siehe „DTM-Abdeckung“ auf der Karte).",
  "No safe path found: slopes at or above {c}° block every connection inside the planning area.":
    "Kein sicherer Weg gefunden: Hänge ab {c}° blockieren jede Verbindung im Planungsgebiet.",
  "No safe path left after the detailed check – the only connections cross slopes at or above {c}°.":
    "Nach der Detailprüfung bleibt kein sicherer Weg – alle Verbindungen queren Hänge ab {c}°.",
  "Night IR not available – loose ground not considered.": "Nacht-IR nicht verfügbar – lockerer Boden nicht berücksichtigt.",
  "A or B lies outside the DTM – that part is unchecked.": "A oder B liegt außerhalb des DTM – dieser Teil ist ungeprüft.",
  "{n} points remain at or above the critical slope after {i} passes – see “Critical sections”.":
    "{n} Punkte liegen nach {i} Durchgängen noch auf/über der kritischen Neigung – siehe „Kritische Abschnitte“.",
  "Safest route found ({n} waypoints).": "Sicherste Route gefunden ({n} Wegpunkte).",
  "Planning failed: {msg}": "Planung fehlgeschlagen: {msg}",

  "+ Via point": "+ Zwischenziel",
  "Optional stops between A and B, in travel order": "Optionale Zwischenziele zwischen A und B, in Fahrtreihenfolge",
  "Click via points on the map in travel order; click “Via point” again to stop.":
    "Zwischenziele in Fahrtreihenfolge auf der Karte anklicken; zum Beenden „Zwischenziel“ erneut klicken.",
  Priority: "Priorität",
  fastest: "am schnellsten",
  fast: "schnell",
  balanced: "ausgewogen",
  safe: "sicher",
  safest: "am sichersten",
  "Show hazard map of the planning grid": "Gefahrenkarte des Planungsrasters zeigen",
  blocked: "gesperrt",
  "partly critical": "teilweise kritisch",
  "caution slope": "Vorsichts-Hang",
  "loose ground (IR)": "lockerer Boden (IR)",
  "no DTM": "kein DTM",
  "Every grid cell is checked against all DTM pixels inside it. Avoids slopes above your critical limit, steep grades, loose ground (night IR) and areas without elevation data; minimises travel time with your vehicle's physics. Long distances: corridor first, then legs of ≤ 1.8 km in detail.":
    "Jede Rasterzelle wird gegen alle DTM-Pixel darin geprüft. Meidet Hänge über deinem kritischen Grenzwert, steile Steigungen, lockeren Boden (Nacht-IR) und Gebiete ohne Höhendaten; minimiert die Fahrzeit mit der Physik deines Fahrzeugs. Lange Strecken: erst ein Korridor, dann Etappen von ≤ 1,8 km im Detail.",
  "Leg {n}": "Etappe {n}",
  "Finding a corridor over the whole area ({n} cells of {c} m) …": "Suche Korridor über das ganze Gebiet ({n} Zellen à {c} m) …",
  "Loading DTM pixels and night IR for {n} grid cells ({c} m) …": "Lade DTM-Pixel und Nacht-IR für {n} Rasterzellen ({c} m) …",
  "These points are too far apart for one planning area (max. ≈ {km} km). Add via points.":
    "Diese Punkte liegen für ein Planungsgebiet zu weit auseinander (max. ≈ {km} km). Zwischenziele setzen.",
  "The hazard map shows why.": "Die Gefahrenkarte zeigt, warum.",
  "{l} legs, cells {c} m from DTM pixels of {p} m, {k} with elevation data, {s} s.":
    "{l} Etappen, Zellen {c} m aus DTM-Pixeln von {p} m, {k} mit Höhendaten, {s} s.",
  "On foot, the route goes {d} km from the start – beyond the {r} km walking radius of the NASA xEVA concept.":
    "Zu Fuß entfernt sich die Route {d} km vom Start – mehr als der Gehradius von {r} km im NASA-xEVA-Konzept.",

  // 3D view
  "3D view": "3D-Ansicht",
  Area: "Gebiet",
  "Vertical exaggeration": "Überhöhung",
  "Hazard pillars": "Gefahrensäulen",
  "slope below caution": "Neigung unter Vorsicht",
  "at/above critical slope": "auf/über kritischer Neigung",
  "hazard pillar: ≥ 15 % of the block critical": "Gefahrensäule: ≥ 15 % des Blocks kritisch",
  "hazard pillar: ≥ 40 % of the block caution": "Gefahrensäule: ≥ 40 % des Blocks Vorsicht",
  route: "Route",
  "hazard zone of the section": "Gefahrenbereich des Abschnitts",
  "terrain: HiRISE DTM.": "Gelände: HiRISE-DTM.",
  "slope colours.": "Neigungsfarben.",
  "pillar height is a symbol, not a measurement.": "Säulenhöhe ist ein Symbol, kein Messwert.",
  "Astronaut at true scale. Drag to rotate, scroll to zoom, right-drag to pan.":
    "Astronaut in echter Größe. Ziehen zum Drehen, Mausrad zum Zoomen, Rechtsziehen zum Verschieben.",
  "Astronaut {h} m (true scale)": "Astronaut {h} m (echte Größe)",
  "Elevation at the point": "Höhe am Punkt",
  "Max. slope in view": "Max. Neigung im Ausschnitt",
  "Area at/above critical ({c}°)": "Fläche ab kritisch ({c}°)",
  "DTM pixel": "DTM-Pixel",
  Elevation: "Höhe",
  "from the point": "vom Punkt",
  "No HiRISE elevation data at this point.": "An diesem Punkt gibt es keine HiRISE-Höhendaten.",
  "3D view failed: {msg}": "3D-Ansicht fehlgeschlagen: {msg}",
  "Critical section {a}–{b}: up to {m}°": "Kritischer Abschnitt {a}–{b}: bis {m}°",
  "Route at {d}": "Route bei {d}",
  "Show this section in 3D": "Diesen Abschnitt in 3D zeigen",

  Reference: "Referenz",
  "Close-up": "Nah heran",
  "Rover + astronaut": "Rover + Astronaut",
  "Rover {l} m (Apollo LRV size)": "Rover {l} m (Größe Apollo-LRV)",
  "Rover tilt at the point": "Rover-Neigung am Punkt",
  "Astronaut (1.8 m) and rover (Apollo LRV, 3.1 × 1.83 m) at true scale; the rover is tilted to the DTM surface.":
    "Astronaut (1,8 m) und Rover (Apollo-LRV, 3,1 × 1,83 m) in echter Größe; der Rover ist an die DTM-Oberfläche angelehnt.",
  "Drag to rotate, scroll to zoom, right-drag to pan.": "Ziehen zum Drehen, Mausrad zum Zoomen, Rechtsziehen zum Verschieben.",
  "Click for 3D view": "Klicken für 3D-Ansicht",
  "{m}° – click for 3D view": "{m}° – klicken für 3D-Ansicht",
  "Hazard cell": "Gefahrenzelle",
  "Hazard – click for 3D view": "Gefahr – klicken für 3D-Ansicht",

  // Cloud elevation data (STAC: HiRISE / CTX, global MOLA)
  "Asking the USGS catalog for HiRISE and CTX elevation models …": "Frage den USGS-Katalog nach HiRISE- und CTX-Höhenmodellen …",
  "Finding a corridor on the global MOLA DEM ({n} cells of {c} m) …": "Suche Korridor auf dem globalen MOLA-Höhenmodell ({n} Zellen à {c} m) …",
  "{l} legs in {s} s.": "{l} Etappen in {s} s.",
  "Checked in detail: {list}.": "Im Detail geprüft: {list}.",
  "{d} km only with the global MOLA DEM (463 m) – corridor level, slopes NOT safety-checked.":
    "{d} km nur mit dem globalen MOLA-Höhenmodell (463 m) – Korridorebene, Hänge NICHT sicherheitsgeprüft.",
  "{d} km: no safe detailed path found – corridor kept, check the critical sections.":
    "{d} km: kein sicherer Detailweg gefunden – Korridor übernommen, kritische Abschnitte prüfen.",
  "Elevation data along the route": "Höhendaten entlang der Route",
  "{p} of the route only has the global MOLA DEM (463 m): slopes there are smoothed and NOT safety-checked.":
    "{p} der Route haben nur das globale MOLA-Höhenmodell (463 m): Hänge sind dort geglättet und NICHT sicherheitsgeprüft.",
  "over {b} km, smoothed": "über {b} km, geglättet",
  "No HiRISE or CTX elevation model at this point – the global MOLA DEM (463 m) is too coarse for a 3D close-up. Try a larger area.":
    "An diesem Punkt gibt es kein HiRISE- oder CTX-Höhenmodell – das globale MOLA-Modell (463 m) ist für eine 3D-Nahansicht zu grob. Größeres Gebiet wählen.",

  "Path is tight against the loaded area or detours a lot – loading elevation data wider around it (±{m} m, step {e}) …":
    "Weg liegt am Rand der geladenen Daten oder macht einen großen Umweg – lade Höhen in größerem Umkreis (±{m} m, Stufe {e}) …",
  "Big detour – re-planning together with the next leg so the waypoint between them can move …":
    "Großer Umweg – plane gemeinsam mit der nächsten Etappe neu, damit sich der Zwischenpunkt verschieben kann …",
  "Search area widened {n}× where the path was boxed in.": "Suchgebiet {n}× erweitert, wo der Weg eingeengt war.",

  // NASA findings
  "NASA findings": "NASA-Erkenntnisse",
  "detections from NASA Mars Trek (CRISM, OMEGA, THEMIS, HiRISE); click a point for source and citation.":
    "Nachweise aus NASA Mars Trek (CRISM, OMEGA, THEMIS, HiRISE); Punkt anklicken für Quelle und Zitat.",
  "NASA findings could not be loaded.": "NASA-Erkenntnisse konnten nicht geladen werden.",
  "Mission sites & features (NASA)": "Missionsorte & Wegpunkte (NASA)",
  "Human Exploration Zones (NASA 2015)": "Erkundungszonen für Menschen (NASA 2015)",
  "Aqueous minerals (Ehlmann & Edwards 2014)": "Wasser-gebildete Minerale (Ehlmann & Edwards 2014)",
  "Hydrous minerals (Carter et al. 2013)": "Wasserhaltige Minerale (Carter et al. 2013)",
  "Chloride salt deposits (Osterloo et al. 2010)": "Chloridsalz-Vorkommen (Osterloo et al. 2010)",
  "Active surface: RSL, gullies, new/icy craters": "Aktive Oberfläche: RSL, Rinnen, neue/eisige Krater",
  "Proposed Exploration Zone, 100 km radius": "Vorgeschlagene Erkundungszone, Radius 100 km",
  Abstract: "Abstract",
  "Aqueous mineral detection": "Nachweis wasser-gebildeter Minerale",
  "Hydrous mineral detection": "Nachweis wasserhaltiger Minerale",
  "Chloride-bearing deposit": "Chloridhaltiges Vorkommen",
  silica: "Silikat (Opal/SiO₂)",
  phyllosilicate: "Schichtsilikate (Tonminerale)",
  sulfate: "Sulfate",
  chloride: "Chloride",
  carbonate: "Karbonate",
  "new crater": "neuer Krater",
  "icy impact site": "Einschlag mit freigelegtem Eis",
  "confirmed recurring slope lineae (RSL)": "bestätigte Hangstreifen (RSL)",
  "partially confirmed recurring slope lineae (RSL)": "teilweise bestätigte Hangstreifen (RSL)",
  "active gully": "aktive Rinne",
  "dune or sandy gully": "Dünen- oder Sandrinne",

  // Zones
  Zones: "Zonen",
  "My zones": "Meine Zonen",
  "Mark and name areas anywhere on Mars – ore and resource finds, water ice, hazards, targets. Stored in this browser; export as GeoJSON to share.":
    "Gebiete überall auf dem Mars markieren und benennen – Erz- und Rohstofffunde, Wassereis, Gefahren, Ziele. Gespeichert in diesem Browser; zum Teilen als GeoJSON exportieren.",
  "Draw zone": "Zone zeichnen",
  "Circle zone": "Kreiszone",
  Finish: "Fertig",
  Name: "Name",
  Category: "Kategorie",
  Colour: "Farbe",
  Note: "Notiz",
  "Route planner must avoid this zone": "Routenplaner muss diese Zone meiden",
  "Save zone": "Zone speichern",
  Cancel: "Abbrechen",
  "Export GeoJSON": "GeoJSON exportieren",
  "Ore / resource": "Erz / Rohstoff",
  "Water / ice": "Wasser / Eis",
  Hazard: "Gefahr",
  "Science target": "Wissenschaftliches Ziel",
  "Base / landing site": "Basis / Landeplatz",
  Other: "Sonstiges",
  "Click the corners of the zone on the map, then “Finish” (or click the first corner).":
    "Ecken der Zone auf der Karte anklicken, dann „Fertig“ (oder die erste Ecke anklicken).",
  "Click the centre of the zone on the map (radius from the field).": "Mittelpunkt der Zone auf der Karte anklicken (Radius aus dem Feld).",
  "A zone needs at least 3 corners.": "Eine Zone braucht mindestens 3 Ecken.",
  "Enter a radius in km first.": "Zuerst einen Radius in km eingeben.",
  "route planner avoids it": "Routenplaner meidet sie",
  "Own entry – not NASA data": "Eigener Eintrag – keine NASA-Daten",
  "No zones yet.": "Noch keine Zonen.",
  avoided: "gemieden",
  Edit: "Bearbeiten",
  Delete: "Löschen",
  "Sure?": "Sicher?",
  "Imported zone": "Importierte Zone",
  "The route crosses zones marked “avoid”: {z}": "Die Route quert Zonen, die gemieden werden sollen: {z}",

  "Round {r}: the detailed check found {n} unsafe spots – blocking them and re-planning the corridor around them …":
    "Runde {r}: Die Detailprüfung fand {n} unsichere Stellen – sperre sie und plane den Korridor drumherum neu …",
  "Corridor re-planned in {n} rounds around spots the detailed check found unsafe.":
    "Korridor in {n} Runden um Stellen neu geplant, die die Detailprüfung als unsicher erkannt hat.",

  // 3D cut-out
  "3D cut-out": "3D-Ausschnitt",
  "Open in 3D": "In 3D öffnen",
  "Draw again": "Neu zeichnen",
  "Cut out an area and view it in 3D: drag a rectangle on the map": "Gebiet ausschneiden und in 3D ansehen: Rechteck auf der Karte aufziehen",
  "Drag a rectangle on the map.": "Rechteck auf der Karte aufziehen.",
  "Fine-tune the corners if needed, then open the 3D view.": "Ecken bei Bedarf genau eintragen, dann die 3D-Ansicht öffnen.",
  "Enter valid corners (west < east, south < north).": "Gültige Ecken eingeben (West < Ost, Süd < Nord).",
  "checking elevation data …": "prüfe Höhendaten …",
  "≈ {p} m per point from {src}": "≈ {p} m pro Punkt aus {src}",
  "no elevation data": "keine Höhendaten",
  "3D cut-out {lat}, {lon}": "3D-Ausschnitt {lat}, {lon}",
  "No elevation data could be read for this area.": "Für dieses Gebiet konnten keine Höhendaten gelesen werden.",
  "Elevation at the centre": "Höhe in der Mitte",
  "Larger areas are read from coarser overview levels (≤ {n} points per side).": "Größere Gebiete werden aus gröberen Übersichtsstufen gelesen (≤ {n} Punkte pro Seite).",
  None: "Keine",

  Detail: "Detailgrad",
  "Standard (≤ 420)": "Standard (≤ 420)",
  "Fine (≤ 800)": "Fein (≤ 800)",
  "Very fine (≤ 1200)": "Sehr fein (≤ 1200)",
  "Maximum (≤ 1800)": "Maximum (≤ 1800)",
  "Standard (≤ 420 points/side)": "Standard (≤ 420 Punkte/Seite)",
  "Maximum (≤ 1800, slow)": "Maximum (≤ 1800, langsam)",
  "finest available: {g} m": "feinste verfügbare: {g} m",
  "full resolution": "volle Auflösung",
  "Loading elevation data ({n} points per side max.) …": "Lade Höhendaten (max. {n} Punkte pro Seite) …",
  "Mesh: {w} × {h} points.": "Netz: {w} × {h} Punkte.",

  "Standard (≤ 1024)": "Standard (≤ 1024)",
  "Fine (≤ 2048)": "Fein (≤ 2048)",
  "Very fine (≤ 3072)": "Sehr fein (≤ 3072)",
  "Maximum (≤ 4096)": "Maximum (≤ 4096)",
  "Standard (≤ 1024 points/side)": "Standard (≤ 1024 Punkte/Seite)",
  "Maximum (≤ 4096, slow)": "Maximum (≤ 4096, langsam)",
  "Photo (CTX / HiRISE)": "Foto (CTX / HiRISE)",
  "Photo + hazards": "Foto + Gefahren",
  "Slope classes": "Neigungsklassen",
  "Loading elevation models ({i}/{n}, {k}) …": "Lade Höhenmodelle ({i}/{n}, {k}) …",
  "Computing slopes and lighting at full resolution …": "Berechne Neigung und Beleuchtung in voller Auflösung …",
  "Elevation resolution": "Höhenauflösung",
  "Elevation sources": "Höhenquellen",
  "Elevation grid {w} × {h} (lighting, slopes); 3D mesh {mw} × {mh}. Larger areas are read coarser.":
    "Höhenraster {w} × {h} (Beleuchtung, Neigung); 3D-Netz {mw} × {mh}. Größere Gebiete werden gröber gelesen.",
  "Surface image": "Oberflächenbild",
  "Loading surface images ({l}: {a}/{b}) …": "Lade Oberflächenbilder ({l}: {a}/{b}) …",
  "elevation ≈ {p} m per point": "Höhe ≈ {p} m pro Punkt",
  "plus CTX/HiRISE photo": "dazu CTX/HiRISE-Foto",

  // Crew on foot vs. vehicle
  "Crew on foot vs. vehicle": "Crew zu Fuß vs. Fahrzeug",
  "Suited astronauts must be able to walk slopes up to 20° (NASA xEVA requirement, EVA-EXP-0042). Steeper stretches are flagged even if a vehicle can drive them.":
    "Astronauten im Anzug müssen Hänge bis 20° begehen können (NASA-xEVA-Anforderung, EVA-EXP-0042). Steilere Abschnitte werden markiert, auch wenn ein Fahrzeug sie befahren kann.",
  "suited walking (NASA xEVA requirement)": "Gehen im Anzug (NASA-xEVA-Anforderung)",
  "Walkable in a suit: no slope at or above {h}°.": "Im Anzug begehbar: keine Neigung ab {h}°.",
  "Too steep on foot, but possible for a vehicle (critical {m}°): use a rover for these stretches.":
    "Zu Fuß zu steil, für ein Fahrzeug aber möglich (kritisch {m}°): diese Abschnitte mit einem Rover fahren.",
  "Dangerous for crew on foot: if they must leave or walk back from the vehicle here, the slope exceeds {h}°. The vehicle itself can drive it (critical {m}°).":
    "Gefährlich für die Crew zu Fuß: Muss sie hier aussteigen oder zurücklaufen, ist der Hang steiler als {h}°. Das Fahrzeug selbst kann ihn befahren (kritisch {m}°).",
  "Too steep for crew on foot and for the vehicle.": "Zu steil für die Crew zu Fuß und für das Fahrzeug.",

  // Mobility dialog
  "Vehicle / EVA profile": "Fahrzeug- / EVA-Profil",
  "Slope limits are computed from Mars gravity, mass, power, soil friction and vehicle geometry. You confirm the proposal or correct it.":
    "Die Grenzneigungen werden aus Mars-Schwerkraft, Masse, Leistung, Bodenreibung und Fahrzeuggeometrie berechnet. Du bestätigst den Vorschlag oder korrigierst ihn.",
  Preset: "Vorlage",
  "Apollo LRV on Mars": "Apollo-LRV auf dem Mars",
  "Astronaut on foot (EVA)": "Astronaut zu Fuß (EVA)",
  "Custom vehicle": "Eigenes Fahrzeug",
  "Total mass incl. crew/payload": "Gesamtmasse inkl. Besatzung/Nutzlast",
  "Cruise speed": "Reisegeschwindigkeit",
  "Minimum speed": "Mindestgeschwindigkeit",
  "Drive power": "Antriebsleistung",
  "Rolling resistance Crr": "Rollwiderstand Crr",
  "Soil friction angle φ": "Reibungswinkel Boden φ",
  "Static tip-over angle": "Statischer Kippwinkel",
  "Safety factor": "Sicherheitsfaktor",
  Calculation: "Berechnung",
  "Sliding and tip-over limits do not depend on mass or gravity (m·g cancels out). Mass and gravity decide through P = m·g·v·(sin θ + C":
    "Rutsch- und Kippgrenze hängen nicht von Masse oder Schwerkraft ab (m·g kürzt sich). Masse und Schwerkraft bestimmen über P = m·g·v·(sin θ + C",
  "·cos θ) how steep the vehicle can still climb with the given power.": "·cos θ), wie steil es bei gegebener Leistung noch vorangeht.",
  "Do these limits fit your mission?": "Passen diese Grenzwerte für deine Mission?",
  "Yes, apply": "Ja, übernehmen",
  "No, adjust myself": "Nein, selbst anpassen",
  "Caution from": "Vorsicht ab",
  "Critical from": "Kritisch ab",
  "Apply my values": "Eigene Werte übernehmen",
  "Values between 0 and 90°, caution ≤ critical.": "Werte zwischen 0 und 90°, Vorsicht ≤ kritisch.",
  "No profile confirmed yet.": "Noch kein Profil bestätigt.",
  "Weight on Mars (g = {g} m/s²)": "Gewichtskraft Mars (g = {g} m/s²)",
  "for comparison, Earth": "zum Vergleich Erde",
  "Power needed on flat ground at {v} km/h": "Leistungsbedarf Ebene bei {v} km/h",
  "Cruise speed sustained up to (grade)": "Reisegeschwindigkeit haltbar bis (Steigung)",
  "Limit: {label}": "Grenze: {label}",
  "(mass-independent)": "(masseunabhängig)",
  "traction (sliding)": "Bodenhaftung (Rutschen)",
  "tip-over stability": "Kippstabilität",
  "power (below {v} km/h)": "Leistung (unter {v} km/h)",
  "not limiting": "nicht begrenzend",
  "Power is not enough for {v} km/h even on flat ground.": "Die Leistung reicht selbst in der Ebene nicht für {v} km/h.",
  "Proposal:": "Vorschlag:",
  "caution from {a}": "Vorsicht ab {a}",
  "critical from {a}": "kritisch ab {a}",
  "Critical: {a}. Caution: {b}.": "Kritisch: {a}. Vorsicht: {b}.",
  "safety factor {f} on tan θ of the critical limit": "Sicherheitsfaktor {f} auf tan θ der kritischen Grenze",
  "caution from {a}°, critical from {b}°": "Vorsicht ab {a}°, kritisch ab {b}°",
  computed: "berechnet",
  manual: "manuell",
  "210 kg vehicle + 490 kg payload (NASA NSSDCA)": "210 kg Fahrzeug + 490 kg Nutzlast (NASA NSSDCA)",
  "4 wheel motors × 0.25 hp = 746 W (Apollo LRV)": "4 Radmotoren × 0,25 hp = 746 W (Apollo-LRV)",
  "Assumption; LRV design approx. 10–13 km/h": "Annahme; LRV-Auslegung ca. 10–13 km/h",
  "Assumption for loose regolith": "Annahme für lockeren Regolith",
  "typical friction angle of Martian surface material ≈ 30° (Golombek et al. 2008)":
    "typischer Reibungswinkel von Mars-Oberflächenmaterial ≈ 30° (Golombek et al. 2008)",
  "pitch/roll stability ≥ 45° (LRV design)": "Nick-/Rollstabilität ≥ 45° (LRV-Auslegung)",
  "Assumption: 80 kg person + 82 kg spacesuit (Apollo) + 20 kg equipment":
    "Annahme: 80 kg Person + 82 kg Raumanzug (Apollo) + 20 kg Ausrüstung",
  "Assumption: sustainable mechanical power": "Annahme: dauerhaft leistbare mechanische Leistung",
  "Assumption (walking resistance simplified as rolling resistance)": "Annahme (Gehwiderstand vereinfacht wie Rollwiderstand)",
  "not applicable": "nicht anwendbar",
  Assumption: "Annahme",
  "Choose who travels first": "Zuerst auswählen, wer unterwegs ist",
  "Select astronaut or vehicle in Settings and click “Yes, apply” – the slope limits and the crew check depend on it.": "In den Einstellungen Astronaut oder Fahrzeug wählen und „Ja, übernehmen“ klicken – Hanglimits und Crew-Check hängen davon ab.",
  "Open Settings": "Einstellungen öffnen",
  "A and B swapped – click “Find safest route” to re-plan.": "A und B getauscht – „Sicherste Route finden“ klicken, um neu zu planen.",
  "How it works": "So funktioniert es",
  "Remove the drawn route": "Gezeichnete Route entfernen",
  "Remove the last via point (then B, then A)": "Letzten Zwischenpunkt entfernen (dann B, dann A)",
  "Swap A and B": "A und B tauschen",
  "Remove A, B, via points and the planned route": "A, B, Zwischenpunkte und geplante Route entfernen",
  "Applied – the route is re-checked with this profile.": "Übernommen – die Route wird mit diesem Profil neu geprüft.",
  "Sketch on the image": "Ins Bild zeichnen",
  "drawing on": "Zeichnen an",
  "Pen": "Stift",
  "Eraser": "Radierer",
  "Size": "Größe",
  "Clear drawing": "Zeichnung löschen",
  "Saved automatically in this browser for this image.": "Wird für dieses Bild automatisch in diesem Browser gespeichert.",
  "saved drawing loaded": "gespeicherte Zeichnung geladen",
  "saved": "gespeichert",
  "not saved – browser storage full": "nicht gespeichert – Browser-Speicher voll",
  "Settings": "Einstellungen",
  "Who travels? (astronaut or vehicle)": "Wer ist unterwegs? (Astronaut oder Fahrzeug)",
  "⚙ Change in Settings": "⚙ In Einstellungen ändern",
  "How it works:": "So funktioniert es:",
  "click “Draw route”, then click waypoints on the map in walking order (drag them to adjust). Elevation is loaded from the best NASA/USGS model (HiRISE 1 m, CTX 20 m, else MOLA); every stretch is coloured by slope and checked for your profile. “Improve” keeps your waypoints as via points and replaces each piece with the safest path between them.": "„Route zeichnen“ klicken, dann Wegpunkte in Gehrichtung auf die Karte klicken (zum Anpassen ziehen). Die Höhe kommt aus dem besten NASA/USGS-Modell (HiRISE 1 m, CTX 20 m, sonst MOLA); jeder Abschnitt wird nach Hangneigung eingefärbt und für dein Profil geprüft. „Verbessern“ behält deine Wegpunkte als Zwischenpunkte und ersetzt jedes Teilstück durch den sichersten Weg dazwischen.",
  "A → B planner (safest route)": "A → B-Planer (sicherste Route)",
  "set A and B (optionally via points). The planner first finds a corridor on coarse elevation data, then plans legs of ≤ 1.8 km on a fine grid where every cell is checked against all DTM pixels inside it. It avoids slopes above your critical limit, steep grades, loose ground (THEMIS night IR) and areas without elevation data, and minimises travel time with your profile's physics. Unsafe spots found in the detailed check are fed back and the corridor is re-planned (up to 14 rounds). Priority shifts between fastest and safest.": "A und B setzen (optional Zwischenpunkte). Der Planer sucht zuerst einen Korridor auf groben Höhendaten und plant dann Teilstücke ≤ 1,8 km auf einem feinen Raster, in dem jede Zelle gegen alle DTM-Pixel darin geprüft wird. Er meidet Hänge über deinem kritischen Limit, starke Steigungen, lockeren Boden (THEMIS-Nacht-IR) und Gebiete ohne Höhendaten und minimiert die Fahrzeit mit der Physik deines Profils. Unsichere Stellen aus der Detailprüfung werden zurückgemeldet und der Korridor neu geplant (bis zu 14 Runden). Die Priorität verschiebt zwischen schnellster und sicherster Route.",
  "Crew, suit, equipment, rations and vehicle cargo are set in": "Crew, Anzug, Ausrüstung, Rationen und Fahrzeugladung werden eingestellt unter",
  "⚙ Settings": "⚙ Einstellungen",
  "Who travels?": "Wer ist unterwegs?",
  "🧑‍🚀 Astronaut on foot": "🧑‍🚀 Astronaut zu Fuß",
  "🚙 Vehicle": "🚙 Fahrzeug",
  "Vehicle": "Fahrzeug",
  "Movement and slope limits": "Fortbewegung und Hanglimits",
  "Slope limits are computed from Mars gravity, mass, power, soil friction and geometry. Check the proposal and apply it (or set your own limits).": "Hanglimits werden aus Marsschwerkraft, Masse, Leistung, Bodenreibung und Geometrie berechnet. Vorschlag prüfen und übernehmen (oder eigene Limits setzen).",
  "🧑‍🚀 Crew, suit, equipment and rations": "🧑‍🚀 Crew, Anzug, Ausrüstung und Rationen",
  "Rations carried kcal": "Mitgeführte Rationen kcal",
  "🚙 Vehicle seats, range and supplies on board": "🚙 Fahrzeug: Sitze, Reichweite und Vorräte an Bord",
  "Seats": "Sitze",
  "Range km": "Reichweite km",
  "Pressurised cabin": "Druckkabine",
  "no (crew in suits)": "nein (Crew im Anzug)",
  "yes": "ja",
  "O₂ on board kg": "O₂ an Bord kg",
  "Water on board L": "Wasser an Bord L",
  "Rations on board kcal": "Rationen an Bord kcal",
  "Medical kits": "Medizin-Sets",
  "Used by the crew check on the Route tab: seats vs. crew, range vs. route + way back, and O₂ (0.84 kg), water (≈3 L) and food (≈3000 kcal) per person and day (NASA planning values) for the trip duration.": "Wird vom Crew-Check im Tab Route genutzt: Sitze vs. Crew, Reichweite vs. Route + Rückweg sowie O₂ (0,84 kg), Wasser (≈3 L) und Essen (≈3000 kcal) pro Person und Tag (NASA-Planungswerte) für die Dauer der Fahrt.",
  "🌍 Mars time, weather and EVA radiation": "🌍 Marszeit, Wetter und EVA-Strahlung",
  "Remove the route and A/B": "Route und A/B entfernen",
  "Curiosity rover (MSL)": "Curiosity-Rover (MSL)",
  "Perseverance rover (Mars 2020)": "Perseverance-Rover (Mars 2020)",
  "Pressurised crew rover (concept)": "Druckkabinen-Crewrover (Konzept)",
};

function t(text, vars) {
  let out = text;
  if (LANG === "de" && Object.prototype.hasOwnProperty.call(I18N_DE, text)) out = I18N_DE[text];
  else if (text === "RAD_NOTE") out = I18N_EN_RAD_NOTE;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return out;
}
const I18N_EN_RAD_NOTE =
  "Galactic cosmic rays measured by RAD at Gale crater (Hassler et al. 2014, Science). No suit shielding included. Jezero lies about 1.9 km higher than Gale, under less atmosphere, so its dose is likely somewhat higher. A solar particle event can add far more; NASA limits one event to {spe} mSv – plan shelter access.";

function setLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // storage unavailable: the choice lasts only for this page load
  }
  location.reload();
}

// ---------- Automatic DOM translation (German only) ----------

const I18N_ATTRS = ["title", "placeholder", "alt"];

function translateTextNode(node) {
  const raw = node.nodeValue;
  const key = raw.trim();
  if (!key || !Object.prototype.hasOwnProperty.call(I18N_DE, key)) return;
  const translated = I18N_DE[key];
  if (translated !== key) node.nodeValue = raw.replace(key, translated);
}

function translateElementAttrs(el) {
  for (const a of I18N_ATTRS) {
    const v = el.getAttribute && el.getAttribute(a);
    if (v && Object.prototype.hasOwnProperty.call(I18N_DE, v.trim())) el.setAttribute(a, I18N_DE[v.trim()]);
  }
}

function translateTree(root) {
  if (root.nodeType === Node.TEXT_NODE) return translateTextNode(root);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if (root.tagName === "SCRIPT" || root.tagName === "STYLE") return;
  translateElementAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) translateTextNode(n);
    else translateElementAttrs(n);
  }
}

if (LANG === "de") {
  document.documentElement.lang = "de";
  translateTree(document.body);
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData") translateTextNode(m.target);
      else if (m.type === "attributes") translateElementAttrs(m.target);
      else m.addedNodes.forEach(translateTree);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
}
