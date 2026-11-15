// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Knowledge base for the NASA findings on the map: what was found, history, interpretation, explanation, instruments,
// and a reliability rating per statement: Safe / Maybe safe / Not safe.

let kbData = null;
let kbPromise = null;

function loadKb() {
  if (!kbPromise) kbPromise = fetch("data/findings-kb.json").then((r) => r.json()).then((j) => (kbData = j));
  return kbPromise;
}

function kbTr(en, de) {
  return LANG === "de" && de ? de : en;
}

function kbLevelBadge(level) {
  const L = kbData?.levels[level];
  const icon = { safe: "✓", maybe: "≈", not: "✗" }[level];
  return `<span class="kb-level kb-${level}" title="${escHtml(kbTr(L?.desc, L?.desc_de) || "")}">${icon} ${escHtml(kbTr(L?.label, L?.label_de) || level)}</span>`;
}

// Short reliability summary for popups.
function kbSummary(key) {
  const e = kbData?.entries[key];
  if (!e) return "";
  const n = { safe: 0, maybe: 0, not: 0 };
  for (const c of e.claims) n[c.conf]++;
  return Object.entries(n)
    .filter(([, v]) => v)
    .map(([k, v]) => `${kbLevelBadge(k)}×${v}`)
    .join(" ");
}

function kbButton(key) {
  return `<div class="kb-pop">${kbSummary(key)}<br><button type="button" class="kb-btn" data-kb="${escHtml(key)}">ℹ ${kbTr("History, explanation, instruments", "Geschichte, Erklärung, Instrumente")}</button></div>`;
}

function kbEntryHtml(key, ctx = {}) {
  const e = kbData.entries[key];
  if (!e) return `<p>${kbTr("No entry.", "Kein Eintrag.")}</p>`;
  const sec = (title, txt) => (txt ? `<h3>${title}</h3><p>${escHtml(txt)}</p>` : "");
  return `
    <h2>${escHtml(kbTr(e.title, e.title_de))}</h2>
    ${ctx.name ? `<div class="small muted">${escHtml(ctx.name)}${ctx.lat != null ? ` · ${formatLat(ctx.lat, 3)}, ${formatLonEast(ctx.lon, 3)}` : ""}</div>` : ""}
    ${typeof mediaFigure === "function" ? mediaFigure(key) : ""}
    ${sec(kbTr("What was found", "Was gefunden wurde"), kbTr(e.what, e.what_de))}
    ${sec(kbTr("History", "Geschichte"), kbTr(e.history, e.history_de))}
    ${sec(kbTr("Interpretation and explanation", "Deutung und Erklärung"), kbTr(e.interpretation, e.interpretation_de))}
    <h3>${kbTr("Statements and how reliable they are", "Aussagen und wie verlässlich sie sind")}</h3>
    <table class="kb-claims">${e.claims
      .map((c) => `<tr><td>${kbLevelBadge(c.conf)}</td><td><b>${escHtml(kbTr(c.text, c.text_de))}</b><div class="small muted">${escHtml(kbTr(c.why, c.why_de))}</div></td></tr>`)
      .join("")}</table>
    <h3>${kbTr("Instruments and tools", "Instrumente und Werkzeuge")}</h3>
    <ul class="kb-instr">${e.instruments.map((i) => `<li>${escHtml(i)}</li>`).join("")}</ul>
    <h3>${kbTr("Sources", "Quellen")}</h3>
    <ul class="small">${e.sources.map((s) => `<li>${escHtml(s)}</li>`).join("")}</ul>
    <div class="kb-legend small">${["safe", "maybe", "not"].map((l) => `<div>${kbLevelBadge(l)} ${escHtml(kbTr(kbData.levels[l].desc, kbData.levels[l].desc_de))}</div>`).join("")}</div>
    <div class="small muted">${escHtml(kbTr(kbData.note, "Für MARS Pathfinder (Space Apps 2026) aus der zitierten Fachliteratur und NASA-Missionsdaten zusammengestellt; die Einstufung ist die Bewertung des Teams."))}</div>`;
}

function kbIndexHtml() {
  const groups = [
    [kbTr("Missions", "Missionen"), "mission:"],
    [kbTr("Major features", "Große Strukturen"), "major:"],
    [kbTr("Minerals and water", "Minerale und Wasser"), "aq:"],
    [kbTr("Active surface", "Aktive Oberfläche"), "surface:"],
  ];
  const other = ["hydrous", "chloride", "ez"];
  const item = (k) => `<li><a href="#" data-kb="${escHtml(k)}">${escHtml(kbTr(kbData.entries[k].title, kbData.entries[k].title_de))}</a> ${kbSummary(k)}</li>`;
  return `<h2>${kbTr("NASA findings explained", "NASA-Erkenntnisse erklärt")}</h2>
    <p class="small muted">${kbTr("Every statement is rated: Safe, Maybe safe or Not safe – how certain science is that it is true.", "Jede Aussage ist eingestuft: Sicher, Wahrscheinlich oder Unsicher – wie sicher die Wissenschaft ist, dass sie stimmt.")}</p>
    ${groups.map(([t, p]) => `<h3>${t}</h3><ul class="kb-index">${Object.keys(kbData.entries).filter((k) => k.startsWith(p)).map(item).join("")}</ul>`).join("")}
    <h3>${kbTr("Other layers", "Weitere Ebenen")}</h3><ul class="kb-index">${other.map(item).join("")}</ul>`;
}

async function openKb(key, ctx) {
  await loadKb();
  const dlg = document.getElementById("kb-dialog");
  const body = document.getElementById("kb-body");
  body.innerHTML = key ? kbEntryHtml(key, ctx) : kbIndexHtml();
  document.getElementById("kb-back").hidden = !key;
  body.scrollTop = 0;
  if (!dlg.open) dlg.showModal();
}

function initKb() {
  loadKb().catch((err) => console.warn("Knowledge base not loaded", err));
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-kb]");
    if (!t) return;
    e.preventDefault();
    const pop = t.closest(".leaflet-popup");
    openKb(t.dataset.kb, pop ? { name: pop.querySelector("b")?.textContent } : undefined);
  });
  document.getElementById("kb-close").addEventListener("click", () => document.getElementById("kb-dialog").close());
  document.getElementById("kb-back").addEventListener("click", () => openKb(null));
  document.getElementById("kb-open").addEventListener("click", () => openKb(null));
}
