// Sketching on rover images in the lightbox: pen and eraser, adjustable size and colour.
// The drawing lives on a transparent canvas over the image (the NASA image itself is never changed)
// and is saved per image URL in this browser (localStorage) – it stays until "Clear" is pressed.

const SKETCH_PREFIX = "mars-pathfinder-sketch:";

function initSketch() {
  const img = document.getElementById("lightbox-img");
  const side = document.querySelector("#lightbox .lightbox-side");
  if (!img || !side) return;

  // Wrap the image so the canvas can sit exactly on top of it.
  const wrap = document.createElement("div");
  wrap.className = "sk-wrap";
  img.parentNode.insertBefore(wrap, img);
  wrap.appendChild(img);
  const cv = document.createElement("canvas");
  cv.className = "sk-canvas";
  wrap.appendChild(cv);
  const ctx = cv.getContext("2d");

  const box = document.createElement("div");
  box.className = "sk-tools";
  box.innerHTML = `
    <div class="sk-head"><b>${t("Sketch on the image")}</b>
      <label class="small"><input type="checkbox" id="sk-on" checked> ${t("drawing on")}</label></div>
    <div class="sk-row">
      <button type="button" id="sk-pen" class="sk-tool active">✎ ${t("Pen")}</button>
      <button type="button" id="sk-eraser" class="sk-tool">⌫ ${t("Eraser")}</button>
      <input type="color" id="sk-color" value="#ffcc00" title="${t("Colour")}">
    </div>
    <label class="small">${t("Size")} <input type="range" id="sk-size" min="1" max="60" value="6"> <span id="sk-size-v">6</span> px</label>
    <div class="sk-row">
      <button type="button" id="sk-clear">${t("Clear drawing")}</button>
      <span id="sk-status" class="small muted"></span>
    </div>
    <div class="small muted">${t("Saved automatically in this browser for this image.")}</div>`;
  side.appendChild(box);
  const $ = (id) => document.getElementById(id);

  let key = null, mode = "pen", drawing = false, last = null, saveTimer = null, dirty = false;

  function sizeCanvas() {
    const w = img.naturalWidth || 1, h = img.naturalHeight || 1;
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
  }
  function load() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    let data = null;
    try {
      data = localStorage.getItem(SKETCH_PREFIX + key);
    } catch {}
    $("sk-status").textContent = data ? t("saved drawing loaded") : "";
    if (!data) return;
    const im = new Image();
    im.onload = () => ctx.drawImage(im, 0, 0, cv.width, cv.height);
    im.src = data;
  }
  function isEmpty() {
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 3; i < d.length; i += 16) if (d[i]) return false;
    return true;
  }
  function save() {
    if (!key || !dirty) return;
    dirty = false;
    try {
      if (isEmpty()) localStorage.removeItem(SKETCH_PREFIX + key);
      else localStorage.setItem(SKETCH_PREFIX + key, cv.toDataURL("image/png"));
      $("sk-status").textContent = t("saved");
    } catch {
      $("sk-status").textContent = t("not saved – browser storage full");
    }
    markThumbs();
  }
  function scheduleSave() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }

  img.addEventListener("load", () => {
    save(); // flush the previous image's drawing
    key = img.currentSrc || img.src;
    sizeCanvas();
    load();
  });

  function pos(e) {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * cv.width) / r.width, y: ((e.clientY - r.top) * cv.height) / r.height, s: cv.width / r.width };
  }
  function stroke(a, b) {
    ctx.save();
    ctx.globalCompositeOperation = mode === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = $("sk-color").value;
    ctx.lineWidth = +$("sk-size").value * b.s; // size is in screen pixels
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x + 0.01, b.y);
    ctx.stroke();
    ctx.restore();
  }
  cv.addEventListener("pointerdown", (e) => {
    if (!$("sk-on").checked || !key) return;
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    drawing = true;
    last = pos(e);
    stroke(last, last);
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = pos(e);
    stroke(last, p);
    last = p;
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    scheduleSave();
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);

  const setMode = (m) => {
    mode = m;
    $("sk-pen").classList.toggle("active", m === "pen");
    $("sk-eraser").classList.toggle("active", m === "eraser");
    cv.style.cursor = m === "eraser" ? "cell" : "crosshair";
  };
  $("sk-pen").addEventListener("click", () => setMode("pen"));
  $("sk-eraser").addEventListener("click", () => setMode("eraser"));
  $("sk-size").addEventListener("input", () => ($("sk-size-v").textContent = $("sk-size").value));
  $("sk-on").addEventListener("change", () => cv.classList.toggle("off", !$("sk-on").checked));
  $("sk-clear").addEventListener("click", () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    dirty = true;
    save();
  });
  document.getElementById("lightbox").addEventListener("close", save);
  setMode("pen");

  // ✎ marker on gallery thumbnails that have a saved drawing.
  function markThumbs() {
    document.querySelectorAll("[data-large]").forEach((b) => {
      let has = false;
      try {
        has = localStorage.getItem(SKETCH_PREFIX + new URL(b.dataset.large, location.href).href) != null;
      } catch {}
      b.classList.toggle("has-sketch", has);
    });
  }
  window.markSketchThumbs = markThumbs;
}

initSketch();
