// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Photos for the info pages (data layers and NASA findings). Only real images of the subject itself, all public
// domain (NASA/JPL, USGS, ESA artwork released by NASA), served by Wikimedia Commons. Entries without a fitting
// image are left out on purpose.

const MEDIA = {
  // Spacecraft behind the data layers
  "sc:viking": ["Viking Orbiter releasing the lander.jpg", "Viking Orbiter releasing its lander (artist's impression)", "Viking-Orbiter setzt seinen Lander ab (Illustration)", "Don Davis / NASA"],
  "sc:mgs": ["Mars Global Surveyor spacecraft illustration.jpg", "Mars Global Surveyor (illustration)", "Mars Global Surveyor (Illustration)", "NASA/JPL"],
  "sc:odyssey": ["Mars Odyssey spacecraft model.png", "2001 Mars Odyssey in mission configuration (rendering)", "2001 Mars Odyssey im Einsatz (Rendering)", "NASA"],
  "sc:mro": ["Mars Reconnaissance Orbiter, front view, artist's concept (PIA07245).jpg", "Mars Reconnaissance Orbiter (artist's concept, PIA07245)", "Mars Reconnaissance Orbiter (Illustration, PIA07245)", "NASA/JPL/Corby Waste"],
  "sc:mex": ["Mars-express-volcanoes-sm.jpg", "ESA Mars Express (illustration)", "ESA Mars Express (Illustration)", "NASA/JPL/Corby Waste"],
  // Missions
  "mission:Viking 1": ["PIA00563-Viking1-FirstColorImage-19760721.jpg", "First colour image from the Viking 1 lander, 21 July 1976 (PIA00563)", "Erstes Farbbild des Viking-1-Landers, 21. Juli 1976 (PIA00563)", "NASA/JPL"],
  "mission:Viking 2": ["Ice on Mars Utopia Planitia (PIA00571).jpg", "Frost at the Viking 2 site, Utopia Planitia (PIA00571)", "Reif am Landeplatz von Viking 2, Utopia Planitia (PIA00571)", "NASA/JPL"],
  "mission:Mars Pathfinder / Sojourner": ["Yogi Rock.jpg", "Sojourner at the rock 'Yogi', Ares Vallis 1997 (PIA00685)", "Sojourner am Felsen „Yogi“, Ares Vallis 1997 (PIA00685)", "NASA/JPL"],
  "mission:Spirit": ["PIA04181-Spirit Rover-Vista from Husband Hill.png", "Spirit's view from the summit of Husband Hill (PIA04181)", "Blick von Spirit vom Gipfel des Husband Hill (PIA04181)", "NASA/JPL"],
  "mission:Opportunity": ["PIA07372-MarsOpportunityRover-SelfPortrait-20041220-crop-rotate-sm.jpg", "Opportunity self-portrait, sols 322–323 (PIA07372)", "Selbstporträt von Opportunity, Sol 322–323 (PIA07372)", "NASA/JPL/Cornell"],
  "mission:Phoenix": ["Phoenix lander illustration 2006.jpg", "Phoenix lander (artist's concept)", "Phoenix-Lander (Illustration)", "NASA/JPL/Corby Waste"],
  "mission:Curiosity": ["PIA16239 High-Resolution Self-Portrait by Curiosity Rover Arm Camera.jpg", "Curiosity self-portrait at Rocknest, Gale crater (PIA16239)", "Selbstporträt von Curiosity an „Rocknest“, Gale-Krater (PIA16239)", "NASA/JPL-Caltech/MSSS"],
  "mission:InSight": ["PIA25287-InSights Final Selfie main.png", "InSight's final selfie, sol 1211 (PIA25287)", "Letztes Selfie von InSight, Sol 1211 (PIA25287)", "NASA/JPL-Caltech"],
  "mission:Perseverance": ["PIA24836 Perseverance's Selfie at Rochette.jpg", "Perseverance selfie at 'Rochette', Jezero crater (PIA24836)", "Selfie von Perseverance an „Rochette“, Jezero-Krater (PIA24836)", "NASA/JPL-Caltech/MSSS"],
  // Major features
  "major:Valles Marineris": ["Mars Valles Marineris.jpeg", "Valles Marineris, Viking Orbiter 1 mosaic", "Valles Marineris, Mosaik von Viking Orbiter 1", "NASA/USGS"],
  "major:Tharsis Volcanic Region": ["PIA00169-MC-9-TharsisRegion-19980605.jpg", "Tharsis region, Viking digital mosaic MC-9 (PIA00169)", "Tharsis-Region, Viking-Mosaik MC-9 (PIA00169)", "NASA/JPL/USGS"],
  "major:Olympus Mons": ["Olympus Mons alt.jpg", "Olympus Mons, Viking Orbiter composite", "Olympus Mons, Viking-Orbiter-Komposit", "NASA"],
  "major:Alba Mons": ["Alba Mons MOLA zoom 64.jpg", "Alba Mons, MOLA colour topography", "Alba Mons, MOLA-Farbhöhenkarte", "NASA/JPL-Caltech/ASU"],
  "major:Shalbatana Vallis": ["Shalbatana Vallis 2.jpg", "Shalbatana Vallis, THEMIS (PIA23742)", "Shalbatana Vallis, THEMIS (PIA23742)", "NASA/JPL-Caltech/ASU"],
  "major:Ares Vallis": ["Ares Vallis 827A23 827A25.jpg", "Mouth of Ares Vallis, Viking Orbiter 1 (Pathfinder site left of centre)", "Mündung der Ares Vallis, Viking Orbiter 1 (Pathfinder-Landeplatz links der Mitte)", "NASA / USGS PILOT"],
  "major:Elysium Volcanic Region": ["Elysium Mons 541A44 541A46.jpg", "Elysium Mons, Viking Orbiter 1", "Elysium Mons, Viking Orbiter 1", "NASA / USGS PILOT"],
  // Minerals and active surface
  "aq:phyllosilicate": ["Inverted crater west of Mawrth Vallis.jpg", "Clay-rich terrain west of Mawrth Vallis, HiRISE (PIA22117)", "Tonreiches Gelände westlich der Mawrth Vallis, HiRISE (PIA22117)", "NASA/JPL-Caltech/Univ. of Arizona"],
  "aq:silica": ["Spirit Mars Silica April 20 2007.jpg", "Silica-rich soil churned up by Spirit's wheel, 2007", "Silikatreicher Boden, von Spirits Rad aufgewühlt, 2007", "NASA/JPL"],
  "aq:carbonate": ["PIA23380 Jezero crater minerals.png", "Minerals in Jezero crater from CRISM; green = carbonates (PIA23380)", "Minerale im Jezero-Krater aus CRISM; grün = Karbonate (PIA23380)", "NASA/JPL-Caltech/MSSS/JHU-APL/Purdue/USGS"],
  "aq:chloride": ["Chloride Deposits on Mars THEMIS HiRISE.png", "Chloride (salt) deposit in the southern highlands, THEMIS + HiRISE", "Chlorid-(Salz-)Vorkommen im südlichen Hochland, THEMIS + HiRISE", "NASA/JPL/ASU/Univ. of Hawaii/Univ. of Arizona"],
  chloride: ["Chloride Deposits on Mars THEMIS HiRISE.png", "Chloride (salt) deposit in the southern highlands, THEMIS + HiRISE", "Chlorid-(Salz-)Vorkommen im südlichen Hochland, THEMIS + HiRISE", "NASA/JPL/ASU/Univ. of Hawaii/Univ. of Arizona"],
  hydrous: ["A Window into the Past.jpg", "Layered, hydrated deposits of Ceti Mensa, HiRISE (PIA22051)", "Geschichtete, wasserhaltige Ablagerungen der Ceti Mensa, HiRISE (PIA22051)", "NASA/JPL-Caltech/Univ. of Arizona"],
  "surface:new crater": ["PIA21578 - A New Impact Site in the Southern Middle Latitudes.jpg", "New impact site, HiRISE (PIA21578)", "Neuer Einschlag, HiRISE (PIA21578)", "NASA/JPL-Caltech/Univ. of Arizona"],
  "surface:icy impact site": ["Icy Material Thrown from Cratering Impact on Mars.jpg", "Fresh crater exposing bright ice, HiRISE (PIA17750)", "Frischer Krater mit hellem Eis, HiRISE (PIA17750)", "NASA/JPL-Caltech/Univ. of Arizona"],
  "surface:confirmed recurring slope lineae (RSL)": ["Warm Season Flows on Slope in Newton Crater.gif", "Recurring slope lineae in Newton crater, HiRISE (PIA14472)", "Wiederkehrende Hangstreifen im Newton-Krater, HiRISE (PIA14472)", "NASA/JPL-Caltech/Univ. of Arizona"],
  "surface:partially confirmed recurring slope lineae (RSL)": ["Warm Season Flows on Slope in Newton Crater.gif", "Recurring slope lineae in Newton crater, HiRISE (PIA14472)", "Wiederkehrende Hangstreifen im Newton-Krater, HiRISE (PIA14472)", "NASA/JPL-Caltech/Univ. of Arizona"],
  "surface:active gully": ["PIA11178 - The Contrasting Colors of Crater Dunes and Gullies.jpg", "Gullies on a crater wall, HiRISE (PIA11178)", "Rinnen an einer Kraterwand, HiRISE (PIA11178)", "NASA/JPL-Caltech/Univ. of Arizona"],
  "surface:dune or sandy gully": ["PIA20736 Glowing Gullies in Kaiser Crater Dunes.jpg", "Gullies on the dunes of Kaiser crater, HiRISE (PIA20736)", "Rinnen auf den Dünen im Kaiser-Krater, HiRISE (PIA20736)", "NASA/JPL-Caltech/Univ. of Arizona"],
};

// Which spacecraft image belongs to a data layer (by its mission text).
function mediaKeyForMission(mission = "") {
  if (/Mars Express/i.test(mission)) return "sc:mex";
  if (/Reconnaissance/i.test(mission)) return "sc:mro";
  if (/Odyssey/i.test(mission)) return "sc:odyssey";
  if (/Global Surveyor/i.test(mission)) return "sc:mgs";
  if (/Viking/i.test(mission)) return "sc:viking";
  return null;
}

function mediaFigure(key) {
  const m = MEDIA[key];
  if (!m) return "";
  const [file, en, de, credit] = m;
  const de_ = typeof LANG !== "undefined" && LANG === "de";
  const src = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=640`;
  const page = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;
  return `<figure class="info-photo"><img src="${src}" alt="${escHtml(de_ ? de : en)}" onerror="this.parentNode.remove()">
    <figcaption>${escHtml(de_ ? de : en)}. ${de_ ? "Bild" : "Image"}: ${escHtml(credit)} (${de_ ? "gemeinfrei" : "public domain"}) · <a href="${page}" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>`;
}
