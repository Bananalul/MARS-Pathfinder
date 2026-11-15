// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Detailed, skippable tutorial in chapters. Opens on the first visit with a chapter menu; restart with "? Tutorial".
// Each step points at one part of the page; the tab or collapsed section that contains it is opened automatically.

(function () {
  const TOUR_KEY = "mars-pathfinder-tour-done";
  const DE = () => typeof LANG !== "undefined" && LANG === "de";
  const L = (en, de) => (DE() ? de : en);

  // ---------- Content ----------
  // [chapter id, chapter title EN, DE, steps]; step = { el, fallback, title:[en,de], text:[en,de] } (text may hold simple HTML)
  const CHAPTERS = [
    ["start", "The basics", "Die Grundlagen", [
      { title: ["Welcome to MARS Pathfinder", "Willkommen bei MARS Pathfinder"],
        text: ["MARS Pathfinder plans a <b>safe walk or drive on Mars</b> using real NASA data. It answers: <i>Can a crew get from A to B, how steep is it, how long does it take, and do oxygen, water and food last?</i><br><br>This tutorial walks through <b>every part of the page</b>. You can jump to any chapter, go back, or skip at any time (Esc). Arrow keys ← → also work.",
               "MARS Pathfinder plant einen <b>sicheren Weg zu Fuß oder mit dem Fahrzeug auf dem Mars</b> – mit echten NASA-Daten. Es beantwortet: <i>Kommt eine Crew sicher von A nach B, wie steil ist es, wie lange dauert es, und reichen Sauerstoff, Wasser und Essen?</i><br><br>Dieses Tutorial erklärt <b>jeden Teil der Seite</b>. Du kannst zu jedem Kapitel springen, zurückgehen oder jederzeit überspringen (Esc). Die Pfeiltasten ← → gehen auch."] },
      { el: ".panel-left", title: ["The page has three parts – 1: left", "Die Seite hat drei Teile – 1: links"],
        text: ["<b>Left side = what you see on the map.</b> Base maps (photos, elevation, heat images), science maps, NASA findings and extra layers. Nothing here changes your route – it only changes the view.",
               "<b>Linke Seite = was du auf der Karte siehst.</b> Grundkarten (Fotos, Höhe, Wärmebilder), Wissenschaftskarten, NASA-Funde und Zusatzebenen. Hier änderst du nichts an der Route – nur an der Ansicht."] },
      { el: "#map", title: ["2: the map in the middle", "2: die Karte in der Mitte"],
        text: ["<b>The map of Mars.</b> Drag to move, mouse wheel to zoom. Clicking the map selects a point (or places waypoints while you draw a route). Results of a route appear on and under the map.",
               "<b>Die Marskarte.</b> Ziehen zum Verschieben, Mausrad zum Zoomen. Ein Klick wählt einen Punkt aus (oder setzt Wegpunkte, während du eine Route zeichnest). Ergebnisse einer Route erscheinen auf und unter der Karte."] },
      { el: ".panel-right", title: ["3: the tabs on the right", "3: die Reiter rechts"],
        text: ["<b>Right side = what you do.</b> Plan routes, look at a point, draw zones, place bases, set up the astronaut or vehicle, and see where the data comes from.",
               "<b>Rechte Seite = was du tust.</b> Routen planen, einen Punkt ansehen, Zonen zeichnen, Basen setzen, Astronaut oder Fahrzeug einstellen und nachsehen, woher die Daten kommen."] },
      { title: ["The 3 colour labels you will see everywhere", "Die 3 Farb-Etiketten, die du überall siehst"],
        text: ["Every value says how trustworthy it is:<ul><li><b>MEASURED</b> – real NASA/USGS data (photos, elevation, rover measurements).</li><li><b>DERIVED / MODEL</b> – calculated from measured data with a documented formula (e.g. temperature, oxygen use).</li><li><b>ASSUMPTION</b> – a planning value we chose (e.g. walking speed). You can change these in Settings.</li></ul>",
               "Jeder Wert sagt, wie verlässlich er ist:<ul><li><b>GEMESSEN</b> – echte NASA/USGS-Daten (Fotos, Höhe, Rover-Messungen).</li><li><b>ABGELEITET / MODELL</b> – aus Messdaten mit einer dokumentierten Formel berechnet (z. B. Temperatur, Sauerstoffverbrauch).</li><li><b>ANNAHME</b> – ein Planungswert, den wir gewählt haben (z. B. Gehtempo). Du kannst ihn in den Einstellungen ändern.</li></ul>"] },
      { title: ["The fastest way to a first route", "Der schnellste Weg zur ersten Route"],
        text: ["<ol><li><b>Settings</b> → choose <i>Astronaut on foot</i> → <b>Yes, apply</b>.</li><li>At the top click <b>Jezero crater</b>.</li><li><b>Route</b> tab → box B → <b>Set A</b>, click on the map; <b>Set B</b>, click again.</li><li><b>Find safest route</b> and wait for the loading bar.</li><li>Read the cards top right and the crew check, then <b>▶ Walk the route</b>.</li></ol>The next chapters explain each of these steps in detail.",
               "<ol><li><b>Einstellungen</b> → <i>Astronaut zu Fuß</i> wählen → <b>Ja, übernehmen</b>.</li><li>Oben auf <b>Jezero-Krater</b> klicken.</li><li>Reiter <b>Route</b> → Box B → <b>A setzen</b>, in die Karte klicken; <b>B setzen</b>, nochmal klicken.</li><li><b>Sicherste Route suchen</b> und auf den Ladebalken warten.</li><li>Die Karten oben rechts und den Crew-Check lesen, dann <b>▶ Route abspielen</b>.</li></ol>Die nächsten Kapitel erklären jeden dieser Schritte genau."] },
    ]],
    ["top", "Top bar", "Obere Leiste", [
      { el: "#site-switch", title: ["Choose the place", "Ort wählen"],
        text: ["<ul><li><b>Global</b> – the whole planet.</li><li><b>Jezero crater</b> – where Perseverance drives. Photos down to 25 cm per pixel and 1 m elevation data.</li><li><b>Gale crater</b> – where Curiosity climbs Mount Sharp.</li></ul>You can plan anywhere, but in these two craters the data is the sharpest, so routes are checked most precisely there.",
               "<ul><li><b>Global</b> – der ganze Planet.</li><li><b>Jezero-Krater</b> – hier fährt Perseverance. Fotos bis 25 cm pro Pixel und Höhendaten mit 1 m.</li><li><b>Gale-Krater</b> – hier klettert Curiosity den Mount Sharp hinauf.</li></ul>Du kannst überall planen, aber in diesen zwei Kratern sind die Daten am schärfsten – dort werden Routen am genauesten geprüft."] },
      { el: "#goto-form", title: ["Go to coordinates", "Zu Koordinaten springen"],
        text: ["Type a position and press <b>Go to</b>. Examples: <code>4.59S 137.44E</code> (Curiosity) or <code>18.44 77.45</code> (Perseverance). North/South and East/West are understood; negative numbers mean South or West.",
               "Gib eine Position ein und drücke <b>Gehe zu</b>. Beispiele: <code>4.59S 137.44E</code> (Curiosity) oder <code>18.44 77.45</code> (Perseverance). Nord/Süd und Ost/West werden erkannt; negative Zahlen bedeuten Süd bzw. West."] },
      { el: "#lang-switch", title: ["Language and this tutorial", "Sprache und dieses Tutorial"],
        text: ["<b>EN / DE</b> switches the whole interface between English and German. <b>? Tutorial</b> opens this guide again at any time.",
               "<b>EN / DE</b> schaltet die ganze Oberfläche zwischen Englisch und Deutsch um. <b>? Tutorial</b> öffnet diese Anleitung jederzeit wieder."] },
    ]],
    ["left", "Map layers (left)", "Kartenebenen (links)", [
      { el: "#basemap-list", title: ["Base map – exactly one at a time", "Grundkarte – immer genau eine"],
        text: ["<ul><li><b>Viking colour mosaic</b> – how Mars looks from orbit.</li><li><b>MOLA elevation</b> – colours show height: blue = low, red/white = high.</li><li><b>MOLA + HRSC</b> – the same, sharper.</li><li><b>THEMIS day infrared</b> – how warm the ground gets during the day.</li></ul>The small <b>i</b> next to each one opens the <b>Data</b> tab: which spacecraft took it (with photo), resolution and links.",
               "<ul><li><b>Viking-Farbmosaik</b> – so sieht der Mars aus dem Orbit aus.</li><li><b>MOLA-Höhe</b> – Farben zeigen die Höhe: blau = tief, rot/weiß = hoch.</li><li><b>MOLA + HRSC</b> – dasselbe, schärfer.</li><li><b>THEMIS Tag-Infrarot</b> – wie warm der Boden tagsüber wird.</li></ul>Das kleine <b>i</b> daneben öffnet den Reiter <b>Daten</b>: welche Raumsonde es aufgenommen hat (mit Foto), Auflösung und Links."] },
      { el: "#site-section", fallback: "#basemap-list", title: ["Local imagery (only in Jezero / Gale)", "Lokale Bilder (nur in Jezero / Gale)"],
        text: ["When you chose Jezero or Gale, this section appears with the sharp <b>CTX</b> (6 m) and <b>HiRISE</b> (25 cm) photos. Tick them on or off, the slider sets transparency. At HiRISE resolution you can see single boulders.",
               "Wenn du Jezero oder Gale gewählt hast, erscheint dieser Abschnitt mit den scharfen <b>CTX</b>- (6 m) und <b>HiRISE</b>-Fotos (25 cm). Häkchen an/aus, der Schieber regelt die Transparenz. In HiRISE-Auflösung siehst du einzelne Felsbrocken."] },
      { el: "#th-theme", title: ["Thematic maps – 12 science views", "Thematische Karten – 12 Wissenschaftsansichten"],
        text: ["Choose a topic, then one of its layers below. Examples:<ul><li><b>Geophysical</b> – gravity and crust thickness.</li><li><b>Geochemical</b> – iron, silicon, chlorine, water in the soil.</li><li><b>Magnetic</b> – the ancient magnetised crust.</li><li><b>Volcanological</b> – the big volcanoes.</li><li><b>Meteorological</b> – temperature, UV, air pressure.</li></ul>",
               "Wähle ein Thema und darunter eine seiner Ebenen. Beispiele:<ul><li><b>Geophysikalisch</b> – Schwerefeld und Krustendicke.</li><li><b>Geochemisch</b> – Eisen, Silizium, Chlor, Wasser im Boden.</li><li><b>Magnetisch</b> – die uralte magnetisierte Kruste.</li><li><b>Vulkanologisch</b> – die großen Vulkane.</li><li><b>Meteorologisch</b> – Temperatur, UV, Luftdruck.</li></ul>"] },
      { el: "#th-opacity", title: ["Transparency, Off and legend", "Transparenz, Aus und Legende"],
        text: ["The slider makes the science map more or less see-through, so you can still see the ground below. <b>Off</b> hides it. Under it you see the colour scale with units and the exact data source.",
               "Der Schieber macht die Wissenschaftskarte mehr oder weniger durchsichtig, damit man den Boden darunter noch sieht. <b>Aus</b> blendet sie aus. Darunter stehen die Farbskala mit Einheit und die genaue Datenquelle."] },
      { el: "details.panel-section:has(#env-utc)", fallback: "#env-utc", title: ["Environment & Mars time", "Umwelt & Marszeit"],
        text: ["Maps that change with time: <b>surface temperature</b>, <b>UV</b>, <b>cosmic radiation</b>, <b>soil radioactivity</b>, <b>thermal inertia</b>.<ul><li>Set the date/time (Earth time UTC) or click <b>Now</b>.</li><li><b>▶</b> plays one Mars day – watch the night–day cycle.</li><li><b>Dust</b> (τ): more dust = less sunlight = colder days, warmer nights.</li></ul>Click the map to read all values at a place.",
               "Karten, die sich mit der Zeit ändern: <b>Oberflächentemperatur</b>, <b>UV</b>, <b>kosmische Strahlung</b>, <b>Boden-Radioaktivität</b>, <b>Wärmeträgheit</b>.<ul><li>Datum/Uhrzeit (Erdzeit UTC) einstellen oder <b>Jetzt</b> klicken.</li><li><b>▶ Einen Sol abspielen</b> spielt einen Marstag ab – Tag und Nacht ansehen.</li><li><b>Staub</b> (τ): mehr Staub = weniger Sonne = kältere Tage, wärmere Nächte.</li></ul>Klick in die Karte zeigt alle Werte an diesem Ort."] },
      { el: "details.panel-section:has(#poi-list)", fallback: "#poi-list", title: ["NASA findings on the map", "NASA-Funde auf der Karte"],
        text: ["Tick what you want to see:<ul><li><b>Mission sites</b> – where all landers and rovers landed and drove.</li><li><b>Human Exploration Zones</b> – 100 km circles NASA discussed in 2015 as landing sites for people.</li><li><b>Minerals</b> – coloured dots where water left minerals (clay, salts, carbonates…).</li><li><b>Active surface</b> – fresh craters, ice, dark streaks on slopes.</li></ul>Click a dot for details.",
               "Hake an, was du sehen willst:<ul><li><b>Missionsorte</b> – wo alle Lander und Rover gelandet und gefahren sind.</li><li><b>Erkundungszonen für Menschen</b> – 100-km-Kreise, die die NASA 2015 als Landeplätze für Menschen besprochen hat.</li><li><b>Minerale</b> – farbige Punkte, wo Wasser Minerale hinterlassen hat (Ton, Salze, Karbonate …).</li><li><b>Aktive Oberfläche</b> – frische Krater, Eis, dunkle Streifen an Hängen.</li></ul>Klick auf einen Punkt zeigt Details."] },
      { el: "#kb-open", title: ["All findings explained", "Alle Funde erklärt"],
        text: ["Opens the knowledge base: for every mission and discovery a page with a <b>real photo</b>, what was found, history, how it is interpreted and the instruments used. Each statement is rated:<ul><li><b>Safe</b> – measured and confirmed.</li><li><b>Maybe safe</b> – well supported but not proven.</li><li><b>Not safe</b> – disputed.</li></ul>",
               "Öffnet die Wissensdatenbank: zu jeder Mission und Entdeckung eine Seite mit <b>echtem Foto</b>, was gefunden wurde, Geschichte, Deutung und benutzte Instrumente. Jede Aussage ist bewertet:<ul><li><b>Sicher</b> – gemessen und bestätigt.</li><li><b>Wahrscheinlich</b> – gut belegt, aber nicht bewiesen.</li><li><b>Unsicher</b> – umstritten.</li></ul>"] },
      { el: "details.panel-section:has(#toggle-geology)", fallback: "#toggle-geology", title: ["More overlays", "Weitere Ebenen"],
        text: ["<ul><li><b>Geologic map</b> (USGS) – rock units with legend; click the map for the unit name.</li><li><b>Night infrared</b> – bright at night = rock, dark = dust/sand (loose ground).</li><li><b>Landing sites</b> and <b>rover traverses</b> – the real paths of Curiosity and Perseverance.</li><li><b>DTM footprints</b> – where high-resolution elevation data exists.</li></ul>",
               "<ul><li><b>Geologische Karte</b> (USGS) – Gesteinseinheiten mit Legende; Klick in die Karte zeigt den Namen.</li><li><b>Nacht-Infrarot</b> – nachts hell = Fels, dunkel = Staub/Sand (lockerer Boden).</li><li><b>Landestellen</b> und <b>Rover-Fahrten</b> – die echten Wege von Curiosity und Perseverance.</li><li><b>DTM-Umrisse</b> – wo es hochaufgelöste Höhendaten gibt.</li></ul>"] },
      { el: "details.panel-section:has(#toggle-graticule)", fallback: "#toggle-graticule", title: ["Map elements", "Kartenelemente"],
        text: ["Show or hide the latitude/longitude grid and the scale bar.", "Gradnetz (Breite/Länge) und Maßstab ein- oder ausblenden."] },
    ]],
    ["map", "The map", "Die Karte", [
      { el: ".leaflet-top.leaflet-left", title: ["Map buttons", "Kartenknöpfe"],
        text: ["<ul><li><b>+ / −</b> zoom.</li><li><b>⬚ 3D</b> – drag a rectangle on the map (or type corners) and see that area as a 3D landscape with real photos and slope colours.</li><li><b>☰ Legend</b> – what all colours mean; can be dragged.</li><li><b>🌐 Globe</b> – the whole planet as a sphere with sun, labels, zones and bases. Zooming far out opens it too.</li></ul>",
               "<ul><li><b>+ / −</b> zoomen.</li><li><b>⬚ 3D</b> – ein Rechteck auf der Karte aufziehen (oder Ecken eintippen) und das Gebiet als 3D-Landschaft mit echten Fotos und Neigungsfarben ansehen.</li><li><b>☰ Legende</b> – was alle Farben bedeuten; verschiebbar.</li><li><b>🌐 Globus</b> – der ganze Planet als Kugel mit Sonne, Beschriftungen, Zonen und Basen. Weites Herauszoomen öffnet ihn auch.</li></ul>"] },
      { el: ".statusbar", fallback: "#status-cursor", title: ["Status bar", "Statusleiste"],
        text: ["At the bottom: coordinates under the mouse, zoom level, how many metres one screen pixel is, and a warning if map tiles fail to load (the NASA servers are sometimes slow).",
               "Unten: Koordinaten unter der Maus, Zoomstufe, wie viele Meter ein Bildschirmpixel sind, und eine Warnung, wenn Kartenkacheln nicht laden (die NASA-Server sind manchmal langsam)."] },
      { title: ["Colours of a route", "Farben einer Route"],
        text: ["A planned route is coloured by slope for your traveller:<ul><li><b>Green</b> – below the caution limit, fine.</li><li><b>Yellow</b> – caution: steep, slower, more energy.</li><li><b>Red</b> – critical: too steep for this traveller.</li><li><b>Grey</b> – no elevation data.</li><li><b>Dashed purple / brown</b> – possible loose ground from night infrared.</li></ul>A <b>red title</b> on the map means a serious problem (e.g. not enough oxygen). Click it for the reason.",
               "Eine geplante Route ist nach Steigung für deinen Reisenden eingefärbt:<ul><li><b>Grün</b> – unter der Vorsichtsgrenze, gut.</li><li><b>Gelb</b> – Vorsicht: steil, langsamer, mehr Kraft.</li><li><b>Rot</b> – kritisch: zu steil für diesen Reisenden.</li><li><b>Grau</b> – keine Höhendaten.</li><li><b>Gestrichelt lila/braun</b> – möglicher lockerer Boden laut Nacht-Infrarot.</li></ul>Ein <b>roter Titel</b> auf der Karte heißt ernstes Problem (z. B. Sauerstoff reicht nicht). Anklicken zeigt den Grund."] },
    ]],
    ["settings", "Settings: who travels", "Einstellungen: wer reist", [
      { el: ".mode-switch", fallback: '#tabs button[data-tab="settings"]', title: ["Astronaut or vehicle", "Astronaut oder Fahrzeug"],
        text: ["<b>Do this first.</b> Everything else depends on it: how steep is too steep, how fast you move, how much oxygen and water is used. Until you confirm a choice, route planning is locked and a red hint tells you so.",
               "<b>Das zuerst machen.</b> Alles andere hängt davon ab: wie steil zu steil ist, wie schnell man vorankommt, wie viel Sauerstoff und Wasser verbraucht wird. Solange du nichts bestätigt hast, ist die Routenplanung gesperrt und ein roter Hinweis sagt es dir."] },
      { el: "#mob-preset", fallback: ".mode-switch", title: ["Choose a vehicle", "Fahrzeug wählen"],
        text: ["<ul><li><b>Apollo Lunar Rover</b> – fast (10 km/h), two people in suits.</li><li><b>Curiosity / Perseverance</b> – the real Mars rovers, very slow (≈0.15 km/h) but very stable.</li><li><b>Pressurised crew rover</b> – a NASA concept: drive without suits (values are assumptions).</li><li><b>Custom</b> – enter your own values.</li></ul>A photo of the real vehicle appears below.",
               "<ul><li><b>Apollo-Mondauto</b> – schnell (10 km/h), zwei Personen im Anzug.</li><li><b>Curiosity / Perseverance</b> – die echten Mars-Rover, sehr langsam (≈0,15 km/h), aber sehr stabil.</li><li><b>Druckkabinen-Rover</b> – ein NASA-Konzept: Fahren ohne Anzug (Werte sind Annahmen).</li><li><b>Eigenes</b> – eigene Werte eintragen.</li></ul>Darunter erscheint ein Foto des echten Fahrzeugs."] },
      { el: "#mob-mass", title: ["Movement and slope limits", "Fortbewegung und Hanglimits"],
        text: ["Mass, speed, power, soil friction and tip-over angle. Under each field it says where the value comes from (NASA fact sheet or assumption). From these the tool <b>calculates</b> two slope limits:<ul><li><b>Caution</b> from here on: slower and harder.</li><li><b>Critical</b> from here on: slipping, tipping or not enough power.</li></ul>",
               "Masse, Geschwindigkeit, Leistung, Bodenreibung und Kippwinkel. Unter jedem Feld steht, woher der Wert kommt (NASA-Datenblatt oder Annahme). Daraus <b>berechnet</b> das Tool zwei Hanglimits:<ul><li><b>Vorsicht</b> ab hier: langsamer und anstrengender.</li><li><b>Kritisch</b> ab hier: Rutschen, Kippen oder zu wenig Kraft.</li></ul>"] },
      { el: "#mob-accept", title: ["Yes, apply", "Ja, übernehmen"],
        text: ["<b>Important:</b> changes only count after you click this. A green note confirms it, and an existing route is checked again with the new profile. <b>Adjust</b> lets you type your own limits instead.",
               "<b>Wichtig:</b> Änderungen gelten erst nach diesem Klick. Ein grüner Hinweis bestätigt es, und eine vorhandene Route wird mit dem neuen Profil neu geprüft. Mit <b>Anpassen</b> trägst du stattdessen eigene Limits ein."] },
      { el: "details.set-astro", fallback: ".mode-switch", title: ["Crew, suit and rations (astronaut)", "Crew, Anzug und Rationen (Astronaut)"],
        text: ["Number of people, body and suit mass, terrain difficulty, oxygen in the suit, maximum EVA hours, drink bag, absorbent garment (the space diaper), food carried, and an equipment list. Spare oxygen bottles add to the supply. All of this feeds the crew check.",
               "Anzahl Personen, Körper- und Anzugmasse, Gelände-Schwierigkeit, Sauerstoff im Anzug, maximale EVA-Stunden, Trinkbeutel, Windel (die „Weltraumwindel“), mitgenommenes Essen und eine Ausrüstungsliste. Ersatz-Sauerstoffflaschen erhöhen den Vorrat. All das fließt in den Crew-Check."] },
      { el: "details.set-vehicle", fallback: ".mode-switch", title: ["Seats, range and supplies (vehicle)", "Sitze, Reichweite und Vorräte (Fahrzeug)"],
        text: ["For a vehicle: seats, range in km, pressurised cabin yes/no, oxygen, water, food and medical kits on board. The crew check then tests: enough seats? Enough range for the route and the way back? Enough supplies per person and day?",
               "Für ein Fahrzeug: Sitze, Reichweite in km, Druckkabine ja/nein, Sauerstoff, Wasser, Essen und Medizin-Sets an Bord. Der Crew-Check prüft dann: genug Sitze? Reichweite für Route und Rückweg? Genug Vorräte pro Person und Tag?"] },
      { el: "#env-marsclock", title: ["Mars time, weather and radiation", "Marszeit, Wetter und Strahlung"],
        text: ["The current Mars time (Mars year, sol, season), the latest weather measured by the rovers, and how much cosmic radiation an EVA of a given length would mean.",
               "Die aktuelle Marszeit (Marsjahr, Sol, Jahreszeit), das neueste von den Rovern gemessene Wetter und wie viel kosmische Strahlung ein Außeneinsatz einer bestimmten Länge bedeuten würde."] },
    ]],
    ["route", "Planning a route", "Eine Route planen", [
      { el: ".plan-for", title: ["Who are you planning for?", "Für wen planst du?"],
        text: ["Shows the current traveller and slope limits. <b>Change in Settings</b> takes you there.", "Zeigt den aktuellen Reisenden und die Hanglimits. <b>In Einstellungen ändern</b> bringt dich dorthin."] },
      { el: "#route-draw", title: ["A – Draw route", "A – Route zeichnen"],
        text: ["Click <b>Draw route</b>, then click points on the map <b>in walking order</b>. Each click adds a waypoint; the line between them is checked metre by metre. Drag a point to move it. Click the button again to stop drawing.",
               "Klicke <b>Route zeichnen</b>, dann Punkte auf der Karte <b>in Laufrichtung</b>. Jeder Klick setzt einen Wegpunkt; die Linie dazwischen wird Meter für Meter geprüft. Einen Punkt ziehen verschiebt ihn. Nochmal auf den Knopf klicken beendet das Zeichnen."] },
      { el: "#route-improve", title: ["Improve (make safe)", "Verbessern (sicher machen)"],
        text: ["Keeps <b>your</b> path as a rough guide but replaces each piece between your points with the safest way around steep or loose spots. Good when your drawn line crosses something red.",
               "Behält <b>deinen</b> Weg als grobe Vorgabe, ersetzt aber jedes Stück zwischen deinen Punkten durch den sichersten Weg um steile oder lockere Stellen herum. Gut, wenn deine Linie durch etwas Rotes geht."] },
      { el: "#route-undo", title: ["Undo, Reverse, Clear, Import", "Zurück, Umkehren, Löschen, Import"],
        text: ["<b>Undo</b> removes the last waypoint, <b>Reverse</b> swaps start and end, <b>Clear</b> deletes the drawn route. <b>Import</b> loads a route saved earlier as GeoJSON. “How it works” explains the checks.",
               "<b>Zurück</b> entfernt den letzten Wegpunkt, <b>Umkehren</b> tauscht Start und Ziel, <b>Löschen</b> entfernt die gezeichnete Route. <b>Import</b> lädt eine früher gespeicherte Route (GeoJSON). „So funktioniert es“ erklärt die Prüfung."] },
      { el: "#ab-set-a", title: ["B – Set A, Set B, Via point", "B – A setzen, B setzen, Zwischenziel"],
        text: ["Click <b>Set A</b>, then the start on the map. Click <b>Set B</b>, then the goal. <b>+ Via point</b> adds stops the route must pass (e.g. a base or a rock you want to visit), in order. The markers can be dragged.",
               "Klicke <b>A setzen</b>, dann den Start in der Karte. <b>B setzen</b>, dann das Ziel. <b>+ Zwischenziel</b> fügt Stopps hinzu, die die Route anlaufen muss (z. B. eine Basis oder ein Fels), in Reihenfolge. Die Marker lassen sich ziehen."] },
      { el: "#ab-priority", title: ["Priority and hazard map", "Priorität und Gefahrenkarte"],
        text: ["Slider from <b>fastest</b> to <b>safest</b>: safest makes bigger detours around anything risky. <b>Show hazard map</b> draws the planning grid: red = blocked, orange = partly critical, yellow = caution, purple = loose ground, grey = no data.",
               "Schieber von <b>schnellste</b> bis <b>sicherste</b>: sicherste macht größere Umwege um alles Riskante. <b>Gefahrenkarte des Planungsrasters zeigen</b> zeichnet das Planungsraster: rot = gesperrt, orange = teilweise kritisch, gelb = Vorsicht, lila = lockerer Boden, grau = keine Daten."] },
      { el: "#ab-plan", title: ["Find safest route", "Sicherste Route suchen"],
        text: ["Starts the planner. A loading bar at the top shows progress in %. Long routes take a while because real elevation data is downloaded and every metre is checked; unsafe spots are fed back and the route is re-planned up to 14 times. The status text below says what is happening.",
               "Startet den Planer. Oben zeigt ein Ladebalken den Fortschritt in %. Lange Routen dauern etwas, weil echte Höhendaten geladen und jeder Meter geprüft wird; unsichere Stellen werden zurückgemeldet und die Route bis zu 14-mal neu geplant. Der Statustext darunter sagt, was gerade passiert."] },
    ]],
    ["results", "Reading the results", "Ergebnisse lesen", [
      { el: "#route-cards", fallback: "#map", title: ["The four cards (top right)", "Die vier Karten (oben rechts)"],
        text: ["After planning: <b>length</b>, <b>ascent / descent</b>, <b>walking or travel time</b> (with “longest EVA leg / 8 h”) and <b>steepest slope</b>. A card with a red frame means a limit is exceeded.",
               "Nach dem Planen: <b>Länge</b>, <b>Anstieg / Abstieg</b>, <b>Geh- bzw. Fahrzeit</b> (mit „längste EVA-Etappe / 8 h“) und <b>steilste Stelle</b>. Eine Karte mit rotem Rand heißt: ein Limit ist überschritten."] },
      { el: "#profile-panel", fallback: "#map", title: ["Elevation profile (bottom)", "Höhenprofil (unten)"],
        text: ["The height along the route, coloured like the route. Move the mouse over it to see height and slope at each point – the same spot is marked on the map. <b>Click a red stretch</b> to open it in 3D.",
               "Die Höhe entlang der Route, eingefärbt wie die Route. Mit der Maus darüberfahren zeigt Höhe und Steigung an jeder Stelle – derselbe Punkt wird auf der Karte markiert. <b>Klick auf ein rotes Stück</b> öffnet es in 3D."] },
      { el: "#lg-out", fallback: '#tabs button[data-tab="route"]', title: ["Crew check", "Crew-Check"],
        text: ["The most important box. It lists <b>warnings first</b> (red = critical, yellow = caution), then a table: metabolic power, energy, <b>oxygen</b>, <b>water</b>, <b>toilet</b>, <b>EVA time</b> incl. the way back, nearest base, farthest point from any base, vehicles, radiation dose, solar-storm shelter and dust season. If the route passes a base, it is split into <b>legs</b> and oxygen/water are refilled there.",
               "Die wichtigste Box. Oben stehen die <b>Warnungen</b> (rot = kritisch, gelb = Vorsicht), dann eine Tabelle: Leistung, Energie, <b>Sauerstoff</b>, <b>Wasser</b>, <b>Toilette</b>, <b>EVA-Zeit</b> inkl. Rückweg, nächste Basis, weitester Punkt von jeder Basis, Fahrzeuge, Strahlendosis, Schutz bei Sonnensturm und Staubsaison. Führt die Route an einer Basis vorbei, wird sie in <b>Etappen</b> geteilt und Sauerstoff/Wasser dort aufgefüllt."] },
      { el: "#route-dataq", fallback: '#tabs button[data-tab="route"]', title: ["Critical sections, foot vs. vehicle, loose ground", "Kritische Abschnitte, Fuß vs. Fahrzeug, lockerer Boden"],
        text: ["<ul><li><b>Critical sections</b> – each too-steep stretch with its position and a <b>3D</b> button.</li><li><b>Crew on foot vs. vehicle</b> – where a vehicle could drive but a person in a suit could not walk (over 20°).</li><li><b>Possible loose ground</b> – sandy stretches from night infrared.</li><li><b>All route values</b> – every number in detail, including which elevation data was used.</li></ul>",
               "<ul><li><b>Kritische Abschnitte</b> – jedes zu steile Stück mit Position und <b>3D</b>-Knopf.</li><li><b>Crew zu Fuß vs. Fahrzeug</b> – wo ein Fahrzeug fahren, ein Mensch im Anzug aber nicht gehen kann (über 20°).</li><li><b>Möglicher lockerer Boden</b> – sandige Stücke laut Nacht-Infrarot.</li><li><b>Alle Routenwerte</b> – jede Zahl im Detail, auch welche Höhendaten benutzt wurden.</li></ul>"] },
      { el: "#route-dock", fallback: "#map", title: ["Start time and route walk", "Startzeit und Route abspielen"],
        text: ["Next to the profile. Set the <b>start time</b> (UTC) or choose “next local time” (e.g. 08:00 Mars time). Then <b>▶ Walk the route</b>: a marker moves along the route with time, temperature, UV and radiation dose. The little <b>astronaut figure</b> shows O₂, water, bladder, strain and EVA time going from green to red. Pause, change speed, or drag the slider.",
               "Neben dem Profil. <b>Startzeit</b> (UTC) einstellen oder „nächste Ortszeit“ wählen (z. B. 08:00 Marszeit). Dann <b>▶ Route abspielen</b>: ein Marker läuft mit Zeit, Temperatur, UV und Strahlendosis die Route entlang. Die kleine <b>Astronauten-Figur</b> zeigt O₂, Wasser, Blase, Belastung und EVA-Zeit von grün nach rot. Pausieren, Tempo ändern oder den Schieber ziehen."] },
      { el: "#export-report", fallback: '#tabs button[data-tab="route"]', title: ["Export", "Export"],
        text: ["<b>Mission report</b> – a printable summary (also as PDF via the print dialog). <b>GeoJSON</b> – the route for other map tools or for importing later. <b>CSV</b> – the profile for Excel.",
               "<b>Missionsbericht</b> – eine druckbare Zusammenfassung (über den Druckdialog auch als PDF). <b>GeoJSON</b> – die Route für andere Kartenprogramme oder zum späteren Importieren. <b>CSV</b> – das Profil für Excel."] },
    ]],
    ["tabs", "Point, Zones, Bases, Data", "Punkt, Zonen, Basen, Daten", [
      { el: '.tab-pane[data-pane="point"]', fallback: '#tabs button[data-tab="point"]', title: ["Point", "Punkt"],
        text: ["Click anywhere on the map (when not drawing): coordinates in all formats, <b>elevation and slope</b> from the best data, geologic unit and distance to the landing site. Near a rover stop you also get its <b>real raw photos</b> with a view cone on the map.",
               "Klick irgendwo in die Karte (wenn du nicht zeichnest): Koordinaten in allen Formaten, <b>Höhe und Steigung</b> aus den besten Daten, geologische Einheit und Abstand zur Landestelle. In der Nähe eines Rover-Halts gibt es seine <b>echten Rohbilder</b> mit Blickkegel auf der Karte."] },
      { el: '#tabs button[data-tab="point"]', title: ["Draw on rover photos", "In Rover-Fotos zeichnen"],
        text: ["Click a rover photo to enlarge it. On the right: <b>pen</b>, <b>eraser</b>, colour and size. Mark rocks or paths directly in the image. The drawing is saved in your browser for that image (a ✎ appears on the thumbnail). The NASA image itself is never changed.",
               "Klick auf ein Rover-Foto vergrößert es. Rechts: <b>Stift</b>, <b>Radierer</b>, Farbe und Größe. Markiere Felsen oder Wege direkt im Bild. Die Zeichnung wird im Browser für dieses Bild gespeichert (ein ✎ erscheint am Vorschaubild). Das NASA-Bild selbst wird nie verändert."] },
      { el: '.tab-pane[data-pane="zones"]', fallback: '#tabs button[data-tab="zones"]', title: ["Zones", "Zonen"],
        text: ["Draw your own areas as <b>polygon</b> or <b>circle</b>: ore/resources, water ice, hazard, science target, base area. Give a name, colour and note. Tick <b>avoid</b> and the route planner will go around it. Export/import as GeoJSON.",
               "Zeichne eigene Gebiete als <b>Vieleck</b> oder <b>Kreis</b>: Erz/Rohstoffe, Wassereis, Gefahr, Forschungsziel, Basisgebiet. Name, Farbe und Notiz vergeben. Häkchen bei <b>meiden</b>, und der Routenplaner fährt außen herum. Export/Import als GeoJSON."] },
      { el: '.tab-pane[data-pane="bases"]', fallback: '#tabs button[data-tab="bases"]', title: ["Bases", "Basen"],
        text: ["<b>Place base</b>, then click the map. Rename it and fill its supply list (oxygen, water, food, medical, vehicles, tools, energy). Bases are where the crew can walk back to and refill. <b>Route between bases</b>: choose two bases and get the safest (or direct) route.",
               "<b>Basis setzen</b>, dann in die Karte klicken. Umbenennen und Vorratsliste füllen (Sauerstoff, Wasser, Essen, Medizin, Fahrzeuge, Werkzeug, Energie). Zu Basen kann die Crew zurückgehen und nachfüllen. <b>Route zwischen Basen</b>: zwei Basen wählen und die sicherste (oder direkte) Route bekommen."] },
      { el: '.tab-pane[data-pane="data"]', fallback: '#tabs button[data-tab="data"]', title: ["Data", "Daten"],
        text: ["Shows the source of the selected map layer: mission, instrument (with photo of the spacecraft), resolution, coverage, data class and links. Click any <b>i</b> on the left to fill it.",
               "Zeigt die Quelle der gewählten Kartenebene: Mission, Instrument (mit Foto der Raumsonde), Auflösung, Abdeckung, Datenklasse und Links. Klick auf ein <b>i</b> links füllt ihn."] },
    ]],
    ["end", "Tips and finish", "Tipps und Ende", [
      { title: ["Good to know", "Gut zu wissen"],
        text: ["<ul><li>The first route in a new area takes longer – elevation data is downloaded once.</li><li>Routes, zones, bases, settings and drawings stay saved in your browser.</li><li>Sharp 1 m checks only exist where HiRISE elevation data exists (see “DTM footprints”). Elsewhere the coarse MOLA data is used and those parts are marked as not safety-checked.</li><li>Temperature, UV and radiation maps are models, not measurements.</li></ul>",
               "<ul><li>Die erste Route in einem neuen Gebiet dauert länger – die Höhendaten werden einmal geladen.</li><li>Routen, Zonen, Basen, Einstellungen und Zeichnungen bleiben im Browser gespeichert.</li><li>Genaue 1-m-Prüfung gibt es nur, wo HiRISE-Höhendaten existieren (siehe „DTM-Umrisse“). Sonst werden die groben MOLA-Daten benutzt und diese Stücke als nicht sicherheitsgeprüft markiert.</li><li>Temperatur-, UV- und Strahlungskarten sind Modelle, keine Messungen.</li></ul>"] },
      { el: "#tour-start", title: ["Done!", "Fertig!"],
        text: ["Start in <b>Settings</b> with your traveller, then plan your first route in <b>Jezero crater</b>. You can open this tutorial here again at any time – also a single chapter.",
               "Fang in den <b>Einstellungen</b> mit deinem Reisenden an und plane dann deine erste Route im <b>Jezero-Krater</b>. Dieses Tutorial kannst du hier jederzeit wieder öffnen – auch nur ein einzelnes Kapitel."],
        end: true },
    ]],
  ];

  // Flatten to a step list with chapter info.
  const STEPS = [];
  CHAPTERS.forEach(([id, en, de, steps], ci) => steps.forEach((s, k) => STEPS.push({ ...s, chapter: ci, first: k === 0 })));
  const chapterStart = (ci) => STEPS.findIndex((s) => s.chapter === ci);

  // ---------- UI ----------
  let i = -1; // -1 = chapter menu
  let root, hole, card;

  function build() {
    root = document.createElement("div");
    root.className = "tour-root";
    root.innerHTML = `<div class="tour-hole"></div>
      <div class="tour-card" role="dialog" aria-live="polite">
        <div class="tour-count small"></div>
        <h3 class="tour-title"></h3>
        <div class="tour-text"></div>
        <div class="tour-progress"><i></i></div>
        <div class="tour-actions">
          <span>
            <button type="button" class="tour-skip"></button>
            <button type="button" class="tour-menu"></button>
          </span>
          <span class="tour-nav">
            <button type="button" class="tour-back"></button>
            <button type="button" class="tour-next primary"></button>
          </span>
        </div>
      </div>`;
    document.body.appendChild(root);
    hole = root.querySelector(".tour-hole");
    card = root.querySelector(".tour-card");
    root.querySelector(".tour-skip").addEventListener("click", finish);
    root.querySelector(".tour-menu").addEventListener("click", () => go(-1));
    root.querySelector(".tour-back").addEventListener("click", () => go(i - 1));
    root.querySelector(".tour-next").addEventListener("click", () => (i >= STEPS.length - 1 ? finish() : go(i + 1)));
    card.addEventListener("click", (e) => {
      const b = e.target.closest("[data-chapter]");
      if (b) go(chapterStart(+b.dataset.chapter));
    });
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
  }

  function onKey(e) {
    if (!root) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      finish();
    } else if (e.key === "ArrowRight") root.querySelector(".tour-next").click();
    else if (e.key === "ArrowLeft" && i > -1) go(i - 1);
  }

  // Make the target visible: switch to the tab that contains it and open collapsed sections around it.
  function reveal(el) {
    const pane = el.closest(".tab-pane");
    if (pane && !pane.classList.contains("active")) document.querySelector(`#tabs button[data-tab="${pane.dataset.pane}"]`)?.click();
    for (let d = el.closest("details"); d; d = d.parentElement?.closest("details")) d.open = true;
    if (el.matches('#tabs button[data-tab]')) el.click();
  }

  function visible(el) {
    if (!el || el.hidden) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  }

  function target() {
    if (i < 0) return null;
    const s = STEPS[i];
    for (const sel of [s.el, s.fallback]) {
      if (!sel) continue;
      const el = document.querySelector(sel);
      if (!el) continue;
      reveal(el);
      if (visible(el)) return el;
    }
    return null;
  }

  function place() {
    if (!root) return;
    const el = i < 0 ? null : document.querySelector(STEPS[i].el || "#__none") && target();
    const vw = window.innerWidth, vh = window.innerHeight;
    if (!el) {
      hole.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0`;
      card.classList.add("tour-center");
      card.style.left = card.style.top = "";
      return;
    }
    card.classList.remove("tour-center");
    const r = el.getBoundingClientRect();
    const pad = 6;
    const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad);
    const w = Math.min(vw - x - 4, r.width + 2 * pad), h = Math.min(vh - y - 4, r.height + 2 * pad);
    hole.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 14;
    const opts = [
      [x + w + gap, y],
      [x - cw - gap, y],
      [x, y + h + gap],
      [x, y - ch - gap],
      [x + w + gap, vh - ch - 12],
      [x - cw - gap, vh - ch - 12],
    ];
    let [cx, cy] = opts.find(([a, b]) => a >= 8 && b >= 8 && a + cw <= vw - 8 && b + ch <= vh - 8) || [(vw - cw) / 2, vh - ch - 20];
    cx = Math.min(Math.max(8, cx), vw - cw - 8);
    cy = Math.min(Math.max(8, cy), vh - ch - 8);
    card.style.left = cx + "px";
    card.style.top = cy + "px";
  }

  function menuHtml() {
    return `<p>${L("Choose where to start. <b>Full tour</b> takes about 5 minutes; each chapter can also be opened on its own.", "Wähle, wo du anfangen willst. Die <b>ganze Tour</b> dauert etwa 5 Minuten; jedes Kapitel kann man auch einzeln öffnen.")}</p>
      <div class="tour-chapters">${CHAPTERS.map(([id, en, de, st], ci) => `<button type="button" data-chapter="${ci}"><b>${ci + 1}.</b> ${L(en, de)} <span>${st.length}</span></button>`).join("")}</div>`;
  }

  function go(n) {
    i = Math.max(-1, Math.min(STEPS.length - 1, n));
    const q = (s) => root.querySelector(s);
    q(".tour-skip").textContent = L("Skip tutorial", "Tutorial überspringen");
    q(".tour-menu").textContent = L("Chapters", "Kapitel");
    q(".tour-back").textContent = L("Back", "Zurück");
    q(".tour-menu").hidden = i < 0;
    if (i < 0) {
      q(".tour-count").textContent = L("Tutorial", "Tutorial");
      q(".tour-title").textContent = L("What would you like to learn?", "Was möchtest du lernen?");
      q(".tour-text").innerHTML = menuHtml();
      q(".tour-back").disabled = true;
      q(".tour-next").textContent = L("Full tour →", "Ganze Tour →");
      q(".tour-progress i").style.width = "0%";
      card.classList.add("tour-wide");
    } else {
      const s = STEPS[i];
      const [, en, de, st] = CHAPTERS[s.chapter];
      const k = STEPS.slice(0, i + 1).filter((x) => x.chapter === s.chapter).length;
      q(".tour-count").textContent = `${L("Chapter", "Kapitel")} ${s.chapter + 1}/${CHAPTERS.length}: ${L(en, de)} · ${k}/${st.length}`;
      q(".tour-title").textContent = L(...s.title);
      q(".tour-text").innerHTML = L(...s.text);
      q(".tour-back").disabled = false;
      q(".tour-next").textContent = i === STEPS.length - 1 ? L("Start planning", "Los geht's") : L("Next →", "Weiter →");
      q(".tour-progress i").style.width = `${((i + 1) / STEPS.length) * 100}%`;
      card.classList.remove("tour-wide");
      const el = target();
      el?.scrollIntoView({ block: el.offsetHeight > window.innerHeight * 0.6 ? "start" : "center", inline: "nearest" });
      for (const pnl of document.querySelectorAll(".panel")) pnl.scrollLeft = 0;
    }
    requestAnimationFrame(() => setTimeout(place, 80));
  }

  function finish() {
    if (STEPS[i]?.end) document.querySelector('#tabs button[data-tab="settings"]')?.click();
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {}
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", place);
    root?.remove();
    root = null;
  }

  function start() {
    if (root) return;
    build();
    go(-1);
  }

  document.getElementById("tour-start")?.addEventListener("click", start);
  window.startTour = start;
  let done = false;
  try {
    done = localStorage.getItem(TOUR_KEY) === "1";
  } catch {}
  if (!done) setTimeout(start, 1200);
})();
