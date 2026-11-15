// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Bases with supply inventories (oxygen, water, food, medical, vehicles, tools, energy, shelter).
// Stored in this browser (localStorage); export/import as JSON. Used by the crew logistics of the route planner.

const BASES_KEY = "mars-pathfinder-bases";
const SUPPLY_CATS = {
  oxygen: { label: "Oxygen", de: "Sauerstoff", unit: "kg", icon: "O₂" },
  water: { label: "Water", de: "Wasser", unit: "L", icon: "💧" },
  food: { label: "Food", de: "Nahrung", unit: "kcal", icon: "🍞" },
  medical: { label: "Medical", de: "Medizin", unit: "kits", icon: "✚" },
  vehicle: { label: "Vehicle", de: "Fahrzeug", unit: "pcs", icon: "🚙" },
  tool: { label: "Tools", de: "Werkzeug", unit: "pcs", icon: "🔧" },
  energy: { label: "Energy", de: "Energie", unit: "kWh", icon: "⚡" },
  shelter: { label: "Shelter / suits", de: "Schutz / Anzüge", unit: "pcs", icon: "⛺" },
  other: { label: "Other", de: "Sonstiges", unit: "", icon: "•" },
};

// Starter kit for a 4-person crew, 30 sols – planning values, clearly marked as assumptions.
const SUPPLY_TEMPLATE = [
  { cat: "oxygen", name: "Breathing O₂ (0.84 kg/person/day)", qty: 100, unit: "kg" },
  { cat: "water", name: "Drinking + food water (≈3 L/person/day)", qty: 360, unit: "L" },
  { cat: "food", name: "Food (≈3000 kcal/person/day)", qty: 360000, unit: "kcal" },
  { cat: "medical", name: "Medical kit incl. burn/trauma", qty: 2, unit: "kits" },
  { cat: "vehicle", name: "Pressurised rover", qty: 1, unit: "pcs", range: 100, seats: 4 },
  { cat: "vehicle", name: "Unpressurised rover (LRV class)", qty: 1, unit: "pcs", range: 30, seats: 2 },
  { cat: "shelter", name: "EVA suits", qty: 4, unit: "pcs" },
  { cat: "tool", name: "Geology tools, drill, sample bags", qty: 1, unit: "set" },
  { cat: "energy", name: "Battery storage", qty: 200, unit: "kWh" },
];

function initBases(map, hooks = {}) {
  const el = (id) => document.getElementById(id);
  const tr = (en, de) => (LANG === "de" ? de : en);
  const catName = (c) => tr(SUPPLY_CATS[c]?.label || c, SUPPLY_CATS[c]?.de || c);
  let bases = [];
  let placing = false;
  let selected = null;
  const layer = L.layerGroup().addTo(map);

  try {
    bases = JSON.parse(localStorage.getItem(BASES_KEY) || "[]");
  } catch {
    bases = [];
  }
  const save = () => {
    try {
      localStorage.setItem(BASES_KEY, JSON.stringify(bases));
    } catch {}
    draw();
    renderList();
    if (hooks.onChange) hooks.onChange();
  };
  const uid = () => Math.random().toString(36).slice(2, 10);

  function totals(b) {
    const t = {};
    for (const it of b.items) t[it.cat] = (t[it.cat] || 0) + (Number(it.qty) || 0);
    return t;
  }

  function popupHtml(b) {
    const t = totals(b);
    const rows = Object.keys(SUPPLY_CATS)
      .filter((c) => t[c])
      .map((c) => `<tr><th>${SUPPLY_CATS[c].icon} ${catName(c)}</th><td>${t[c].toLocaleString()} ${SUPPLY_CATS[c].unit}</td></tr>`)
      .join("");
    return `<b>⌂ ${escHtml(b.name)}</b><div class="small mono">${formatLat(b.lat, 3)}, ${formatLonEast(b.lon, 3)}</div>
      <table class="kv small">${rows || `<tr><td>${tr("No supplies listed", "Keine Vorräte eingetragen")}</td></tr>`}</table>`;
  }

  function draw() {
    layer.clearLayers();
    for (const b of bases) {
      L.marker([b.lat, b.lon], {
        icon: L.divIcon({ className: "base-marker", html: `<div>⌂</div><span>${escHtml(b.name)}</span>`, iconSize: null }),
        draggable: true,
      })
        .bindPopup(popupHtml(b))
        .on("click", () => {
          selected = b.id;
          renderList();
          if (hooks.onOpen) hooks.onOpen();
        })
        .on("dragend", (e) => {
          const p = e.target.getLatLng();
          b.lat = p.lat;
          b.lon = normalizeLon180(p.lng);
          save();
        })
        .addTo(layer);
    }
  }

  function itemRow(b, it) {
    const c = SUPPLY_CATS[it.cat] || SUPPLY_CATS.other;
    const veh = it.cat === "vehicle" ? ` · ${tr("range", "Reichweite")} ${it.range ?? "?"} km · ${it.seats ?? "?"} ${tr("seats", "Sitze")}` : "";
    return `<tr data-item="${it.id}"><td>${c.icon}</td><td>${escHtml(it.name)}<div class="small muted">${catName(it.cat)}${veh}</div></td>
      <td class="num"><input type="number" min="0" step="any" value="${it.qty}" data-qty> ${escHtml(it.unit || "")}</td>
      <td><button type="button" data-del title="${tr("Remove", "Entfernen")}">✕</button></td></tr>`;
  }

  function renderRouteSel() {
    const opts = bases.map((b) => `<option value="${b.id}">${escHtml(b.name)}</option>`).join("");
    for (const id of ["base-from", "base-to"]) {
      const s = el(id), prev = s.value;
      s.innerHTML = opts;
      if (bases.some((b) => b.id === prev)) s.value = prev;
    }
    if (bases.length > 1 && el("base-from").value === el("base-to").value) el("base-to").selectedIndex = 1;
    el("base-route-box").hidden = bases.length < 2;
  }

  function renderList() {
    renderRouteSel();
    const box = el("base-list");
    if (!bases.length) {
      box.innerHTML = `<div class="muted small">${tr("No bases yet. Click “Place base”, then click the map.", "Noch keine Basis. „Basis setzen“ klicken, dann in die Karte klicken.")}</div>`;
      return;
    }
    box.innerHTML = bases
      .map((b) => {
        const open = b.id === selected;
        return `<div class="base-card${open ? " open" : ""}" data-base="${b.id}">
          <div class="base-head">${open ? `⌂ <input data-rename class="base-name-edit" type="text" maxlength="60" value="${escHtml(b.name)}" title="${tr("Name of the base", "Name der Basis")}">` : `<b>⌂ ${escHtml(b.name)}</b>`} <span class="small muted">${formatLat(b.lat, 2)}, ${formatLonEast(b.lon, 2)} · ${b.items.length} ${tr("items", "Posten")}</span>
            <span class="base-btns"><button type="button" data-go>${tr("Go to", "Gehe zu")}</button><button type="button" data-toggle>${open ? "▴" : "▾"}</button><button type="button" data-remove>✕</button></span></div>
          ${open ? `<table class="base-items">${b.items.map((it) => itemRow(b, it)).join("")}</table>
          <div class="base-add">
            <select data-cat>${Object.keys(SUPPLY_CATS).map((c) => `<option value="${c}">${catName(c)}</option>`).join("")}</select>
            <input data-name type="text" placeholder="${tr("Item, e.g. O₂ tanks", "Posten, z. B. O₂-Tanks")}" maxlength="80">
            <input data-qty type="number" min="0" step="any" placeholder="${tr("qty", "Menge")}">
            <input data-unit type="text" placeholder="${tr("unit", "Einheit")}" maxlength="12">
            <span data-vehicle hidden><input data-range type="number" min="0" placeholder="${tr("range km", "Reichweite km")}"><input data-seats type="number" min="1" placeholder="${tr("seats", "Sitze")}"></span>
            <button type="button" data-add class="primary">${tr("Add", "Hinzufügen")}</button>
            <button type="button" data-template>${tr("Add starter kit (4 crew, 30 sols)", "Grundausstattung (4 Pers., 30 Sol)")}</button>
          </div>` : ""}
        </div>`;
      })
      .join("");
  }

  el("base-list").addEventListener("click", (e) => {
    const card = e.target.closest("[data-base]");
    if (!card) return;
    const b = bases.find((x) => x.id === card.dataset.base);
    if (e.target.matches("[data-go]")) map.setView([b.lat, b.lon], Math.max(map.getZoom(), 9));
    else if (e.target.matches("[data-toggle]")) {
      selected = selected === b.id ? null : b.id;
      renderList();
    } else if (e.target.matches("[data-remove]")) {
      // Two-step confirm without window.confirm (not available in every browser pane).
      if (e.target.dataset.armed) {
        bases = bases.filter((x) => x !== b);
        save();
      } else {
        e.target.dataset.armed = "1";
        e.target.textContent = tr("Delete?", "Löschen?");
        e.target.classList.add("danger");
        setTimeout(() => {
          if (e.target.isConnected) {
            delete e.target.dataset.armed;
            e.target.textContent = "✕";
            e.target.classList.remove("danger");
          }
        }, 3000);
      }
    } else if (e.target.matches("[data-del]")) {
      const id = e.target.closest("[data-item]").dataset.item;
      b.items = b.items.filter((it) => it.id !== id);
      save();
    } else if (e.target.matches("[data-add]")) {
      const q = (s) => card.querySelector(s);
      const cat = q("[data-cat]").value;
      const name = q("[data-name]").value.trim() || catName(cat);
      const qty = parseFloat(q(".base-add [data-qty]").value);
      if (!Number.isFinite(qty)) return q(".base-add [data-qty]").focus();
      const it = { id: uid(), cat, name, qty, unit: q("[data-unit]").value.trim() || SUPPLY_CATS[cat].unit };
      if (cat === "vehicle") {
        it.range = parseFloat(q("[data-range]").value) || null;
        it.seats = parseInt(q("[data-seats]").value, 10) || null;
      }
      b.items.push(it);
      save();
    } else if (e.target.matches("[data-template]")) {
      for (const it of SUPPLY_TEMPLATE) b.items.push({ ...it, id: uid() });
      save();
    }
  });
  el("base-list").addEventListener("change", (e) => {
    if (e.target.matches("[data-rename]")) {
      const b = bases.find((x) => x.id === e.target.closest("[data-base]").dataset.base);
      b.name = e.target.value.trim() || b.name;
      save();
      return;
    }
    if (e.target.matches("[data-cat]")) {
      const card = e.target.closest("[data-base]");
      card.querySelector("[data-vehicle]").hidden = e.target.value !== "vehicle";
      card.querySelector("[data-unit]").placeholder = SUPPLY_CATS[e.target.value].unit || tr("unit", "Einheit");
      return;
    }
    if (!e.target.matches("[data-item] [data-qty]")) return;
    const b = bases.find((x) => x.id === e.target.closest("[data-base]").dataset.base);
    const it = b.items.find((x) => x.id === e.target.closest("[data-item]").dataset.item);
    it.qty = parseFloat(e.target.value) || 0;
    save();
  });

  function setPlacing(on) {
    placing = on;
    el("base-place").classList.toggle("active", on);
    el("base-hint").textContent = on ? tr("Click the map where the base should be.", "In die Karte klicken, wo die Basis stehen soll.") : "";
    map.getContainer().style.cursor = on ? "crosshair" : "";
    if (on && hooks.onStartPlacing) hooks.onStartPlacing();
  }
  el("base-place").addEventListener("click", () => setPlacing(!placing));
  map.on("click", (e) => {
    if (!placing) return;
    if (Math.abs(e.latlng.lat) > 90) return;
    setPlacing(false);
    // No prompt(): the desktop app's browser pane does not support it. The name is edited in the list.
    const b = { id: uid(), name: tr(`Base ${bases.length + 1}`, `Basis ${bases.length + 1}`), lat: e.latlng.lat, lon: normalizeLon180(e.latlng.lng), items: [] };
    bases.push(b);
    selected = b.id;
    save();
    if (hooks.onOpen) hooks.onOpen();
    const inp = document.querySelector(`[data-base="${b.id}"] [data-rename]`);
    if (inp) {
      inp.focus();
      inp.select();
    }
  });

  const routeBetween = (safest) => {
    const a = bases.find((b) => b.id === el("base-from").value), b = bases.find((x) => x.id === el("base-to").value);
    if (!a || !b || a === b) return;
    if (hooks.routeBetween) hooks.routeBetween(a, b, safest);
  };
  el("base-route-safe").addEventListener("click", () => routeBetween(true));
  el("base-route-direct").addEventListener("click", () => routeBetween(false));

  el("base-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ type: "mars-pathfinder-bases", bases }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mars-bases.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  el("base-import").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const list = Array.isArray(j) ? j : j.bases;
      for (const b of list) if (Number.isFinite(b.lat) && Number.isFinite(b.lon)) bases.push({ id: uid(), name: String(b.name || "Base"), lat: b.lat, lon: b.lon, items: (b.items || []).map((it) => ({ ...it, id: uid() })) });
      save();
    } catch (err) {
      alert(tr("Could not read the file.", "Datei konnte nicht gelesen werden."));
    }
    e.target.value = "";
  });

  draw();
  renderList();

  return {
    isDrawing: () => placing,
    stopDrawing: () => setPlacing(false),
    list: () => bases,
    totals,
    // Nearest base by great-circle distance.
    nearest(lat, lon) {
      let best = null;
      for (const b of bases) {
        const km = greatCircleKm(lat, lon, b.lat, b.lon);
        if (!best || km < best.km) best = { base: b, km };
      }
      return best;
    },
  };
}
