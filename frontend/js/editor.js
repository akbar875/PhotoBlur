import { downloadDataUrl } from "./download.js";
import { frames } from "./frames.js";
import { stickerLibrary } from "./stickers.js";

const canvas = document.querySelector("#editorCanvas");
const ctx = canvas.getContext("2d");
const layoutOptions = document.querySelector("#layoutOptions");
const frameOptions = document.querySelector("#frameOptions");
const frameSectionTitle = document.querySelector("#frameSectionTitle");
const stickerOptions = document.querySelector("#stickerOptions");
const textInput = document.querySelector("#textInput");
const textColor = document.querySelector("#textColor");
const addTextButton = document.querySelector("#addTextButton");
const filterSelect = document.querySelector("#filterSelect");
const blurRange = document.querySelector("#blurRange");
const brightnessRange = document.querySelector("#brightnessRange");
const contrastRange = document.querySelector("#contrastRange");
const saturationRange = document.querySelector("#saturationRange");
const undoButton = document.querySelector("#undoButton");
const redoButton = document.querySelector("#redoButton");
const resetDecorButton = document.querySelector("#resetDecorButton");
const fullscreenButton = document.querySelector("#fullscreenButton");
const fullscreenPreview = document.querySelector("#fullscreenPreview");
const fullscreenImage = document.querySelector("#fullscreenImage");
const closePreviewButton = document.querySelector("#closePreviewButton");
const downloadButton = document.querySelector("#downloadButton");
const backCameraButton = document.querySelector("#backCameraButton");

const photos = JSON.parse(sessionStorage.getItem("photoblur:photos") || "[]");
const photoCount = Number(sessionStorage.getItem("photoblur:photoCount") || photos.length);

const layouts = [
  { id: "vertical-2", name: "2 Vertikal", counts: [2] },
  { id: "horizontal-2", name: "2 Horizontal", counts: [2] },
  { id: "grid-4", name: "4 Grid", counts: [4] },
  { id: "strip-4", name: "4 Strip", counts: [4] },
  { id: "polaroid", name: "Polaroid", counts: [2, 4] },
  { id: "magazine", name: "Magazine", counts: [2, 4] },
  { id: "scrapbook", name: "Scrapbook", counts: [2, 4] },
];

let state = {
  layout: photoCount === 2 ? "vertical-2" : "grid-4",
  frame: photoCount === 2 ? "template-2-01" : "template-4-01",
  filter: "normal",
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  decorations: [],
};

let loadedPhotos = [];
let loadedFrameImages = new Map();
let selectedId = null;
let dragMode = null;
let dragStart = null;
let undoStack = [];
let redoStack = [];

if (!photos.length) {
  document.querySelector(".editor-layout").innerHTML = `
    <article class="empty-state card">
      <p class="eyebrow">Belum Ada Foto</p>
      <h1>Ambil foto dulu sebelum masuk editor.</h1>
      <button class="primary-btn" type="button" id="goCamera">Buka Kamera</button>
    </article>
  `;
  document.querySelector("#goCamera").addEventListener("click", () => (window.location.href = "camera.html"));
} else {
  init();
}

async function init() {
  loadedPhotos = await Promise.all(photos.map(loadImage));
  loadedFrameImages = await loadFrameImages();
  buildOptions();
  bindControls();
  pushHistory();
  render();
}

function buildOptions() {
  frameSectionTitle.textContent = `Frame ${photoCount} Foto`;

  layouts
    .filter((layout) => layout.counts.includes(photoCount))
    .forEach((layout) => {
      const button = optionButton(layout.name, state.layout === layout.id);
      button.addEventListener("click", () => {
        setState({ layout: layout.id });
      });
      button.dataset.option = layout.id;
      layoutOptions.append(button);
    });

  frames
    .filter((frame) => !frame.counts || frame.counts.includes(photoCount))
    .forEach((frame) => {
    const button = optionButton(frame.name, state.frame === frame.id);
    if (frame.src) {
      button.classList.add("frame-option-btn");
      button.style.setProperty("--frame-preview", `url("${frame.src}")`);
      button.dataset.frameKind = frame.frameKind || `${photoCount} Foto`;
      button.title = frame.name;
    }
    button.addEventListener("click", () => setState({ frame: frame.id }));
    button.dataset.option = frame.id;
    frameOptions.append(button);
  });

  stickerLibrary.forEach((sticker) => {
    const button = document.createElement("button");
    button.className = "sticker-btn";
    button.type = "button";
    button.textContent = sticker.value;
    button.style.color = sticker.color;
    button.title = sticker.name;
    button.addEventListener("click", () => addDecoration(sticker));
    stickerOptions.append(button);
  });
}

function bindControls() {
  addTextButton.addEventListener("click", () => {
    const text = textInput.value.trim();
    if (!text) return;
    addDecoration({ id: "text", type: "label", value: text, color: textColor.value });
    textInput.value = "";
  });

  [filterSelect, blurRange, brightnessRange, contrastRange, saturationRange].forEach((control) => {
    control.addEventListener("input", () => {
      state.filter = filterSelect.value;
      state.blur = Number(blurRange.value);
      state.brightness = Number(brightnessRange.value);
      state.contrast = Number(contrastRange.value);
      state.saturation = Number(saturationRange.value);
      syncRangeLabels();
      render();
    });
    control.addEventListener("change", pushHistory);
  });

  undoButton.addEventListener("click", undo);
  redoButton.addEventListener("click", redo);
  resetDecorButton.addEventListener("click", () => setState({ decorations: [] }));
  fullscreenButton.addEventListener("click", () => {
    selectedId = null;
    render();
    fullscreenImage.src = canvas.toDataURL("image/png");
    fullscreenPreview.classList.add("is-open");
  });
  closePreviewButton.addEventListener("click", () => fullscreenPreview.classList.remove("is-open"));
  fullscreenPreview.addEventListener("click", (event) => {
    if (event.target === fullscreenPreview) fullscreenPreview.classList.remove("is-open");
  });
  downloadButton.addEventListener("click", () => {
    selectedId = null;
    render();
    const dataUrl = canvas.toDataURL("image/png");
    sessionStorage.setItem("photoblur:result", dataUrl);
    downloadDataUrl(dataUrl, `photoblur-${Date.now()}.png`);
    window.location.href = "result.html";
  });
  backCameraButton.addEventListener("click", () => (window.location.href = "camera.html"));

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", (event) => {
    if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
      setState({ decorations: state.decorations.filter((item) => item.id !== selectedId) });
      selectedId = null;
    }
  });
  syncRangeLabels();
}

function optionButton(label, active) {
  const button = document.createElement("button");
  button.className = `option-btn${active ? " is-active" : ""}`;
  button.type = "button";
  button.textContent = label;
  return button;
}

function setState(patch) {
  state = { ...state, ...patch };
  pushHistory();
  render();
}

function addDecoration(source) {
  const size = source.type === "label" ? 72 : 92;
  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    kind: source.type,
    value: source.value,
    color: source.color,
    x: canvas.width / 2,
    y: canvas.height / 2,
    size,
    rotation: 0,
  };
  state.decorations = [...state.decorations, item];
  selectedId = item.id;
  pushHistory();
  render();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const frame = frames.find((item) => item.id === state.frame) || frames[0];

  if (isImageFrame(frame)) {
    drawPhotos(frame);
    drawImageFrame(frame);
  } else {
    drawBackground(frame);
    drawPhotos(frame);
    drawFrameAccent(frame);
  }

  state.decorations.forEach(drawDecoration);
  const selected = state.decorations.find((item) => item.id === selectedId);
  if (selected) drawSelection(selected);
  updateActiveButtons();
}

function drawBackground(frame) {
  ctx.fillStyle = frame.color;
  roundRect(0, 0, canvas.width, canvas.height, 44);
  ctx.fill();
  ctx.strokeStyle = frame.border;
  ctx.lineWidth = 24;
  roundRect(14, 14, canvas.width - 28, canvas.height - 28, 36);
  ctx.stroke();
}

function drawPhotos(frame = null) {
  const slots = getSlots(frame);
  loadedPhotos.forEach((image, index) => {
    const slot = slots[index % slots.length];
    ctx.save();
    roundRect(slot.x, slot.y, slot.w, slot.h, slot.r);
    ctx.clip();
    ctx.filter = cssFilter();
    drawCoverImage(image, slot.x, slot.y, slot.w, slot.h);
    if (state.blur > 0) {
      ctx.globalAlpha = 0.36;
      ctx.filter = `${cssFilter()} blur(${state.blur}px)`;
      drawCoverImage(image, slot.x, slot.y, slot.w, slot.h);
    }
    ctx.restore();
  });
}

function getSlots(frame = null) {
  if (frame && isImageFrame(frame)) {
    return getTemplateFrameSlots(frame);
  }

  const margin = 90;
  const gap = 28;
  if (state.layout === "horizontal-2") {
    return [
      { x: margin, y: 330, w: 346, h: 460, r: 24 },
      { x: margin + 346 + gap, y: 330, w: 346, h: 460, r: 24 },
    ];
  }
  if (state.layout === "grid-4") {
    const w = (canvas.width - margin * 2 - gap) / 2;
    return [0, 1, 2, 3].map((i) => ({
      x: margin + (i % 2) * (w + gap),
      y: 170 + Math.floor(i / 2) * (390 + gap),
      w,
      h: 390,
      r: 24,
    }));
  }
  if (state.layout === "strip-4") {
    return [0, 1, 2, 3].map((i) => ({ x: 170, y: 80 + i * 268, w: 560, h: 240, r: 18 }));
  }
  if (state.layout === "polaroid") {
    return photoCount === 2
      ? [{ x: 130, y: 155, w: 640, h: 760, r: 20 }, { x: 230, y: 245, w: 440, h: 560, r: 16 }]
      : [0, 1, 2, 3].map((i) => ({ x: 120 + (i % 2) * 340, y: 155 + Math.floor(i / 2) * 360, w: 300, h: 320, r: 16 }));
  }
  if (state.layout === "magazine") {
    return photoCount === 2
      ? [{ x: 80, y: 120, w: 500, h: 760, r: 30 }, { x: 610, y: 450, w: 220, h: 330, r: 24 }]
      : [{ x: 80, y: 120, w: 500, h: 540, r: 30 }, { x: 610, y: 120, w: 220, h: 255, r: 22 }, { x: 610, y: 405, w: 220, h: 255, r: 22 }, { x: 190, y: 690, w: 520, h: 330, r: 24 }];
  }
  if (state.layout === "scrapbook") {
    return photoCount === 2
      ? [{ x: 100, y: 170, w: 530, h: 430, r: 20 }, { x: 260, y: 625, w: 540, h: 410, r: 20 }]
      : [{ x: 95, y: 120, w: 360, h: 300, r: 18 }, { x: 490, y: 175, w: 320, h: 330, r: 18 }, { x: 125, y: 530, w: 330, h: 360, r: 18 }, { x: 490, y: 610, w: 320, h: 300, r: 18 }];
  }
  return photoCount === 2
    ? [{ x: 150, y: 115, w: 600, h: 455, r: 24 }, { x: 150, y: 605, w: 600, h: 455, r: 24 }]
    : [{ x: 150, y: 115, w: 600, h: 220, r: 18 }, { x: 150, y: 360, w: 600, h: 220, r: 18 }, { x: 150, y: 605, w: 600, h: 220, r: 18 }, { x: 150, y: 850, w: 600, h: 220, r: 18 }];
}

function drawFrameAccent(frame) {
  ctx.save();
  ctx.font = "800 34px Poppins, sans-serif";
  ctx.textAlign = "center";
  if (frame.accent === "hearts") {
    ctx.fillStyle = "#fb6f92";
    ["♥", "♡", "♥"].forEach((symbol, index) => ctx.fillText(symbol, 140 + index * 310, 72));
  } else if (frame.accent === "clouds") {
    ctx.fillStyle = "#a7d8ff";
    ctx.fillText("☁  Photoblur  ☁", canvas.width / 2, 72);
  } else if (frame.accent === "stars") {
    ctx.fillStyle = "#7c3aed";
    ctx.fillText("★ ✦ ★", canvas.width / 2, 72);
  } else if (frame.accent === "caption") {
    ctx.fillStyle = "#475569";
    ctx.fillText("Photoblur Memory", canvas.width / 2, canvas.height - 70);
  } else if (frame.accent === "tape") {
    ctx.fillStyle = "rgba(244, 114, 182, 0.42)";
    ctx.rotate(-0.08);
    ctx.fillRect(82, 94, 210, 42);
    ctx.rotate(0.17);
    ctx.fillRect(584, 72, 220, 42);
  }
  ctx.restore();
}

function drawImageFrame(frame) {
  ctx.save();
  ctx.drawImage(loadedFrameImages.get(frame.id), 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function getTemplateFrameSlots() {
  const frame = frames.find((item) => item.id === state.frame);
  if (frame?.slots) {
    return frame.slots;
  }

  if (frame?.slotLayout === "four-photo") {
    return [
      { x: 92, y: 122, w: 344, h: 310, r: 8 },
      { x: 464, y: 122, w: 344, h: 310, r: 8 },
      { x: 92, y: 472, w: 344, h: 310, r: 8 },
      { x: 464, y: 472, w: 344, h: 310, r: 8 },
    ];
  }

  return [
    { x: 96, y: 148, w: 708, h: 350, r: 12 },
    { x: 96, y: 552, w: 708, h: 350, r: 12 },
  ];
}

function isImageFrame(frame) {
  return Boolean(frame?.src && loadedFrameImages.has(frame.id));
}

function drawDecoration(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation);
  ctx.fillStyle = item.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (item.kind === "label") {
    ctx.font = `900 ${item.size * 0.42}px Poppins, sans-serif`;
    const width = ctx.measureText(item.value).width + 34;
    roundRect(-width / 2, -item.size / 2, width, item.size, 18);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fill();
    ctx.fillStyle = item.color;
    ctx.fillText(item.value, 0, 1);
  } else {
    ctx.font = `900 ${item.size}px Poppins, sans-serif`;
    ctx.fillText(item.value, 0, 0);
  }
  ctx.restore();
}

function drawSelection(item) {
  const bounds = decorationBounds(item);
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation);
  ctx.strokeStyle = "#ec4899";
  ctx.lineWidth = 3;
  ctx.setLineDash([9, 7]);
  ctx.strokeRect(-bounds.w / 2, -bounds.h / 2, bounds.w, bounds.h);
  ctx.setLineDash([]);
  drawHandle(-bounds.w / 2, -bounds.h / 2, "#8b5cf6", "↻");
  drawHandle(bounds.w / 2, -bounds.h / 2, "#ef4444", "×");
  drawHandle(bounds.w / 2, bounds.h / 2, "#ec4899", "↘");
  ctx.restore();
}

function drawHandle(x, y, color, label) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "900 18px Poppins, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y - 1);
}

function onPointerDown(event) {
  const point = canvasPoint(event);
  const hit = hitTest(point);
  if (!hit) {
    selectedId = null;
    render();
    return;
  }

  selectedId = hit.item.id;
  if (hit.handle === "delete") {
    setState({ decorations: state.decorations.filter((item) => item.id !== selectedId) });
    selectedId = null;
    return;
  }

  dragMode = hit.handle || "move";
  dragStart = {
    point,
    item: { ...hit.item },
    startAngle: Math.atan2(point.y - hit.item.y, point.x - hit.item.x),
  };
  canvas.setPointerCapture(event.pointerId);
  render();
}

function onPointerMove(event) {
  if (!dragMode || !selectedId || !dragStart) return;
  const point = canvasPoint(event);
  const item = state.decorations.find((entry) => entry.id === selectedId);
  if (!item) return;

  if (dragMode === "move") {
    item.x = dragStart.item.x + point.x - dragStart.point.x;
    item.y = dragStart.item.y + point.y - dragStart.point.y;
  } else if (dragMode === "resize") {
    const base = Math.hypot(dragStart.point.x - dragStart.item.x, dragStart.point.y - dragStart.item.y) || 1;
    const current = Math.hypot(point.x - dragStart.item.x, point.y - dragStart.item.y);
    item.size = clamp(dragStart.item.size * (current / base), 32, 240);
  } else if (dragMode === "rotate") {
    const angle = Math.atan2(point.y - item.y, point.x - item.x);
    item.rotation = dragStart.item.rotation + angle - dragStart.startAngle;
  }
  render();
}

function onPointerUp(event) {
  if (dragMode) pushHistory();
  dragMode = null;
  dragStart = null;
  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer may already be released by the browser.
  }
}

function hitTest(point) {
  for (let index = state.decorations.length - 1; index >= 0; index -= 1) {
    const item = state.decorations[index];
    const local = toLocal(point, item);
    const bounds = decorationBounds(item);
    const handles = {
      rotate: { x: -bounds.w / 2, y: -bounds.h / 2 },
      delete: { x: bounds.w / 2, y: -bounds.h / 2 },
      resize: { x: bounds.w / 2, y: bounds.h / 2 },
    };

    for (const [handle, handlePoint] of Object.entries(handles)) {
      if (Math.hypot(local.x - handlePoint.x, local.y - handlePoint.y) <= 24) {
        return { item, handle };
      }
    }

    if (Math.abs(local.x) <= bounds.w / 2 && Math.abs(local.y) <= bounds.h / 2) {
      return { item };
    }
  }
  return null;
}

function decorationBounds(item) {
  if (item.kind === "label") {
    ctx.save();
    ctx.font = `900 ${item.size * 0.42}px Poppins, sans-serif`;
    const w = Math.max(90, ctx.measureText(item.value).width + 42);
    ctx.restore();
    return { w, h: item.size };
  }
  return { w: item.size, h: item.size };
}

function toLocal(point, item) {
  const dx = point.x - item.x;
  const dy = point.y - item.y;
  const cos = Math.cos(-item.rotation);
  const sin = Math.sin(-item.rotation);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function pushHistory() {
  const snapshot = JSON.stringify(state);
  if (undoStack[undoStack.length - 1] !== snapshot) {
    undoStack.push(snapshot);
    if (undoStack.length > 60) undoStack.shift();
  }
  redoStack = [];
}

function undo() {
  if (undoStack.length <= 1) return;
  redoStack.push(undoStack.pop());
  state = JSON.parse(undoStack[undoStack.length - 1]);
  selectedId = null;
  syncControls();
  render();
}

function redo() {
  if (!redoStack.length) return;
  const snapshot = redoStack.pop();
  undoStack.push(snapshot);
  state = JSON.parse(snapshot);
  selectedId = null;
  syncControls();
  render();
}

function syncControls() {
  filterSelect.value = state.filter;
  blurRange.value = state.blur;
  brightnessRange.value = state.brightness;
  contrastRange.value = state.contrast;
  saturationRange.value = state.saturation;
  syncRangeLabels();
}

function syncRangeLabels() {
  document.querySelector("#blurValue").textContent = blurRange.value;
  document.querySelector("#brightnessValue").textContent = brightnessRange.value;
  document.querySelector("#contrastValue").textContent = contrastRange.value;
  document.querySelector("#saturationValue").textContent = saturationRange.value;
}

function updateActiveButtons() {
  document.querySelectorAll("#layoutOptions .option-btn").forEach((button) => button.classList.toggle("is-active", button.dataset.option === state.layout));
  document.querySelectorAll("#frameOptions .option-btn").forEach((button) => button.classList.toggle("is-active", button.dataset.option === state.frame));
}

function cssFilter() {
  let brightness = state.brightness;
  let contrast = state.contrast;
  let saturation = state.saturation;
  let extra = "";

  if (state.filter === "warm") extra = "sepia(0.16) hue-rotate(-8deg)";
  if (state.filter === "cool") extra = "hue-rotate(12deg)";
  if (state.filter === "vintage") extra = "sepia(0.34) contrast(0.9)";
  if (state.filter === "bw") extra = "grayscale(1)";
  if (state.filter === "sepia") extra = "sepia(0.72)";
  if (state.filter === "pink") extra = "sepia(0.16) hue-rotate(300deg)";
  if (state.filter === "low") contrast = Math.min(contrast, 86);
  if (state.filter === "bright") brightness = Math.max(brightness, 118);
  if (state.filter === "soft") extra = "contrast(0.96) saturate(1.08)";

  return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) ${extra}`;
}

function drawCoverImage(image, x, y, w, h) {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.width - sw) / 2;
  const sy = (image.height - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function loadFrameImages() {
  const entries = await Promise.all(
    frames
      .filter((frame) => frame.src)
      .map(async (frame) => {
        try {
          return [frame.id, await loadImage(frame.src)];
        } catch {
          return null;
        }
      }),
  );
  return new Map(entries.filter(Boolean));
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
