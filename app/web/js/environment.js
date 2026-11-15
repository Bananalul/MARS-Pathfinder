// MARS Pathfinder – Space Apps 2026. Code written with AI assistance (Anthropic Claude), reviewed by the team.
// Surface environment per site: rover weather (REMS / MEDA feeds) and radiation dose for the planned EVA.

const WEATHER_FEEDS = {
  gale: {
    station: "REMS (Curiosity)",
    url: "https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json",
    note: "Daily values processed by Centro de Astrobiología for outreach; scientific data in the PDS.",
    parse: (j) => j.soles,
  },
  jezero: {
    station: "MEDA (Perseverance)",
    url: "https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json",
    note: "The public MEDA feed currently holds only a few sols; values may be older than the mission.",
    parse: (j) => j.sols,
  },
};

// Hassler et al. 2014, Science 343, doi:10.1126/science.1244797 (RAD at Gale crater, ~300 sols).
const RAD_DOSE_RATE = { value: 0.64, sigma: 0.12, unit: "mSv/day" };
// NASA-STD-3001 Vol. 1: career effective dose limit and per-event solar particle event limit.
const NASA_CAREER_LIMIT_MSV = 600;
const NASA_SPE_LIMIT_MSV = 250;

const weatherCache = new Map();

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

async function loadWeather(siteId) {
  const feed = WEATHER_FEEDS[siteId];
  if (!feed) return null;
  if (!weatherCache.has(siteId)) {
    weatherCache.set(
      siteId,
      fetchJson(feed.url).then((j) =>
        feed.parse(j).map((s) => ({
          sol: parseInt(s.sol, 10),
          date: s.terrestrial_date,
          ls: num(s.ls),
          airMin: num(s.min_temp),
          airMax: num(s.max_temp),
          groundMin: num(s.min_gts_temp),
          groundMax: num(s.max_gts_temp),
          pressure: num(s.pressure),
          uv: s.local_uv_irradiance_index && s.local_uv_irradiance_index !== "--" ? s.local_uv_irradiance_index : null,
          sunrise: s.sunrise,
          sunset: s.sunset,
        }))
      )
    );
  }
  try {
    return await weatherCache.get(siteId);
  } catch (err) {
    weatherCache.delete(siteId);
    throw err;
  }
}

// Same season = solar longitude within ±window degrees (wraps at 360°).
function seasonalRange(sols, ls, window = 15) {
  const near = sols.filter((s) => s.ls != null && Math.abs(((s.ls - ls + 540) % 360) - 180) <= window);
  const vals = (key) => near.map((s) => s[key]).filter((v) => v != null);
  const air = [...vals("airMin"), ...vals("airMax")];
  const ground = [...vals("groundMin"), ...vals("groundMax")];
  return {
    count: near.length,
    air: air.length ? [Math.min(...air), Math.max(...air)] : null,
    ground: ground.length ? [Math.min(...ground), Math.max(...ground)] : null,
  };
}

function evaDose(hours) {
  const days = hours / 24;
  return {
    value: RAD_DOSE_RATE.value * days,
    low: (RAD_DOSE_RATE.value - RAD_DOSE_RATE.sigma) * days,
    high: (RAD_DOSE_RATE.value + RAD_DOSE_RATE.sigma) * days,
    careerShare: (RAD_DOSE_RATE.value * days) / NASA_CAREER_LIMIT_MSV,
  };
}

function initEnvironment(getRouteHours) {
  const el = (id) => document.getElementById(id);
  let site = null;
  let token = 0;
  let latest = null;

  async function setSite(siteId) {
    site = siteId;
    const tok = ++token;
    const box = el("env-weather");
    const feed = WEATHER_FEEDS[siteId];
    latest = null;
    if (!feed) {
      box.innerHTML = `<div class="muted">Weather data is shown for the Jezero and Gale sites.</div>`;
      renderDose();
      return;
    }
    box.innerHTML = `<div class="muted small">${t("Loading {station} weather …", { station: feed.station })}</div>`;
    try {
      const sols = await loadWeather(siteId);
      if (tok !== token) return;
      const valid = sols.filter((s) => s.airMin != null || s.pressure != null).sort((a, b) => b.sol - a.sol);
      latest = valid[0] || null;
      if (!latest) {
        box.innerHTML = `<div class="muted">${t("No valid sols in the {station} feed.", { station: feed.station })}</div>`;
        return;
      }
      const range = latest.ls != null ? seasonalRange(sols, latest.ls) : null;
      const fmtT = (v) => (v == null ? "–" : `${Math.round(v)} °C`);
      box.innerHTML = `
        <div class="ground-head">${feed.station} · sol ${latest.sol} (${latest.date})</div>
        <table class="kv">
          <tr><th>Air temperature min / max</th><td>${fmtT(latest.airMin)} / ${fmtT(latest.airMax)}</td></tr>
          <tr><th>Ground temperature min / max</th><td>${fmtT(latest.groundMin)} / ${fmtT(latest.groundMax)}</td></tr>
          <tr><th>Pressure</th><td>${latest.pressure == null ? "–" : `${Math.round(latest.pressure)} Pa`}</td></tr>
          <tr><th>UV index</th><td>${latest.uv || "–"}</td></tr>
          <tr><th>Sunrise / sunset (local)</th><td>${latest.sunrise || "–"} / ${latest.sunset || "–"}</td></tr>
          ${range && range.count > 20 ? `
          <tr><th>Season range, air <span class="badge badge-derived">Derived</span></th><td>${fmtT(range.air?.[0])} … ${fmtT(range.air?.[1])}</td></tr>
          <tr><th>Season range, ground</th><td>${fmtT(range.ground?.[0])} … ${fmtT(range.ground?.[1])}</td></tr>` : ""}
        </table>
        <div class="muted small"><span class="badge badge-measured">Measured</span> ${t(feed.note)}${
          range && range.count > 20 ? " " + t("Season range: all {n} sols within Ls {ls}° ± 15°.", { n: range.count, ls: Math.round(latest.ls) }) : ""
        }</div>`;
    } catch (err) {
      console.error(err);
      if (tok === token) box.innerHTML = `<div class="warn">Weather feed could not be loaded.</div>`;
    }
    renderDose();
  }

  function renderDose() {
    const input = el("env-eva-hours");
    const routeHours = getRouteHours();
    if (input.dataset.userSet !== "1" && routeHours) input.value = routeHours.toFixed(1);
    const hours = parseFloat(input.value);
    const box = el("env-dose");
    if (!(hours > 0)) {
      box.innerHTML = `<div class="muted small">Enter an EVA duration or plan a route.</div>`;
      return;
    }
    const d = evaDose(hours);
    box.innerHTML = `
      <table class="kv">
        <tr><th>Surface dose rate <span class="badge badge-measured">Measured</span></th><td>${RAD_DOSE_RATE.value} ± ${RAD_DOSE_RATE.sigma} ${RAD_DOSE_RATE.unit}</td></tr>
        <tr><th>EVA dose <span class="badge badge-derived">Derived</span></th><td>${d.value.toFixed(3)} mSv (${d.low.toFixed(3)}–${d.high.toFixed(3)})</td></tr>
        <tr><th>${t("Share of NASA career limit ({lim} mSv)", { lim: NASA_CAREER_LIMIT_MSV })}</th><td>${(d.careerShare * 100).toFixed(3)} %</td></tr>
      </table>
      <div class="muted small">${t("RAD_NOTE", { spe: NASA_SPE_LIMIT_MSV })}</div>`;
  }

  el("env-eva-hours").addEventListener("input", (e) => {
    e.target.dataset.userSet = e.target.value ? "1" : "";
    renderDose();
  });

  return {
    setSite,
    refreshDose: renderDose,
    summary: () => {
      const hours = parseFloat(el("env-eva-hours").value);
      return {
        weather: latest ? { station: WEATHER_FEEDS[site]?.station, ...latest } : null,
        dose: hours > 0 ? { hours, ...evaDose(hours), rate: RAD_DOSE_RATE } : null,
      };
    },
  };
}
