const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");
const colorButtons = document.querySelectorAll(".color-btn");
const colorWheel = document.getElementById("colorWheel");
const colorWheelMarker = document.getElementById("colorWheelMarker");
const customColorPreview = document.getElementById("customColorPreview");
const brushSizeInput = document.getElementById("brushSize");
const brushSizeValue = document.getElementById("brushSizeValue");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");
const eyedropperBtn = document.getElementById("eyedropperBtn");
const layerList = document.getElementById("layerList");
const layerCountTitle = document.getElementById("layerCountTitle");
const layerOpacity = document.getElementById("layerOpacity");
const layerOpacityValue = document.getElementById("layerOpacityValue");
const layerDownBtn = document.getElementById("layerDownBtn");
const layerUpBtn = document.getElementById("layerUpBtn");
const addLayerBtn = document.getElementById("addLayerBtn");
const deleteLayerBtn = document.getElementById("deleteLayerBtn");
const gallery = document.getElementById("gallery");
const galleryEmpty = document.getElementById("galleryEmpty");

const GALLERY_STORAGE_KEY = "drawapp-gallery";
const MAX_GALLERY_ITEMS = 12;

let isDrawing = false;
let currentColor = "#ffffff";
let currentBrushSize = Number(brushSizeInput.value);
let galleryItems = loadGalleryItems();
let layerIdCounter = 1;
let layers = [];
let activeLayerId = "";
let pixelRatio = 1;
let isWheelPicking = false;
let wheelPoint = { x: 0.5, y: 0.5 };
let isEyedropperActive = false;

function setCurrentColor(color, source) {
  currentColor = color;
  customColorPreview.style.background = color;

  if (source === "palette") {
    customColorPreview.classList.remove("active");
    return;
  }

  colorButtons.forEach((button) => button.classList.remove("active"));
  customColorPreview.classList.add("active");
}

function hsvToRgb(hue, saturation, value) {
  const c = value * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function setEyedropperActive(isActive) {
  isEyedropperActive = isActive;
  eyedropperBtn.classList.toggle("active", isActive);
  canvas.style.cursor = isActive ? "crosshair" : "default";
}

function sampleColorFromCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) * pixelRatio);
  const y = Math.floor((event.clientY - rect.top) * pixelRatio);

  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return;
  }

  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const sampled = rgbToHex({ r: pixel[0], g: pixel[1], b: pixel[2] });
  setCurrentColor(sampled, "wheel");
  setEyedropperActive(false);
}

function drawColorWheel() {
  const wheelCtx = colorWheel.getContext("2d");
  const size = Math.max(1, Math.floor(colorWheel.clientWidth));
  colorWheel.width = size;
  colorWheel.height = size;

  const image = wheelCtx.createImageData(size, size);
  const center = size / 2;
  const radius = center - 1;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;

      if (distance > radius) {
        image.data[idx + 3] = 0;
        continue;
      }

      const hue = (Math.atan2(dy, dx) * 180) / Math.PI;
      const normalizedHue = (hue + 360) % 360;
      const saturation = Math.min(1, distance / radius);
      const rgb = hsvToRgb(normalizedHue, saturation, 1);
      image.data[idx] = rgb.r;
      image.data[idx + 1] = rgb.g;
      image.data[idx + 2] = rgb.b;
      image.data[idx + 3] = 255;
    }
  }

  wheelCtx.putImageData(image, 0, 0);
  updateWheelMarker();
}

function updateWheelMarker() {
  colorWheelMarker.style.left = `${wheelPoint.x * 100}%`;
  colorWheelMarker.style.top = `${wheelPoint.y * 100}%`;
}

function pickWheelColor(event) {
  const rect = colorWheel.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const radius = Math.min(centerX, centerY) - 1;
  let x = event.clientX - rect.left;
  let y = event.clientY - rect.top;

  const dx = x - centerX;
  const dy = y - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > radius) {
    const scale = radius / distance;
    x = centerX + dx * scale;
    y = centerY + dy * scale;
  }

  const hue = ((Math.atan2(y - centerY, x - centerX) * 180) / Math.PI + 360) % 360;
  const saturation = Math.min(1, Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) / radius);
  const color = rgbToHex(hsvToRgb(hue, saturation, 1));

  wheelPoint = {
    x: rect.width > 0 ? x / rect.width : 0.5,
    y: rect.height > 0 ? y / rect.height : 0.5
  };
  updateWheelMarker();
  setCurrentColor(color, "wheel");
}

function getCanvasCssSize() {
  return {
    width: canvas.width / pixelRatio,
    height: canvas.height / pixelRatio
  };
}

function setupStrokeContext(context) {
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";
}

function createLayer(name) {
  const layerCanvas = document.createElement("canvas");
  layerCanvas.width = canvas.width;
  layerCanvas.height = canvas.height;
  const layerCtx = layerCanvas.getContext("2d");
  setupStrokeContext(layerCtx);

  return {
    id: `layer-${layerIdCounter++}`,
    name,
    visible: true,
    opacity: 1,
    canvas: layerCanvas,
    ctx: layerCtx
  };
}

function getActiveLayer() {
  return layers.find((layer) => layer.id === activeLayerId) || null;
}

function renderLayerUI() {
  layerList.innerHTML = "";
  layerCountTitle.textContent = `LAYERS (${layers.length})`;

  const displayLayers = [...layers].reverse();
  displayLayers.forEach((layer) => {
    const row = document.createElement("div");
    row.className = "layer-item";
    if (layer.id === activeLayerId) {
      row.classList.add("active");
    }
    row.dataset.layerId = layer.id;
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", String(layer.id === activeLayerId));
    row.innerHTML = `
      <span class="layer-dot" aria-hidden="true"></span>
      <span class="layer-name">${layer.name}</span>
      <button class="layer-visibility ${layer.visible ? "" : "off"}" data-layer-visibility="${layer.id}" type="button" aria-label="Toggle layer visibility">${layer.visible ? "◉" : "○"}</button>
    `;
    layerList.append(row);
  });

  const activeLayer = getActiveLayer();
  if (activeLayer) {
    layerOpacity.value = String(Math.round(activeLayer.opacity * 100));
    layerOpacityValue.textContent = `${Math.round(activeLayer.opacity * 100)}%`;
  }

  deleteLayerBtn.disabled = layers.length <= 1;

  const activeIndex = layers.findIndex((layer) => layer.id === activeLayerId);
  layerDownBtn.disabled = activeIndex <= 0;
  layerUpBtn.disabled = activeIndex === -1 || activeIndex >= layers.length - 1;
}

function moveActiveLayer(direction) {
  const currentIndex = layers.findIndex((layer) => layer.id === activeLayerId);
  if (currentIndex === -1) {
    return;
  }

  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= layers.length) {
    return;
  }

  const [activeLayer] = layers.splice(currentIndex, 1);
  layers.splice(targetIndex, 0, activeLayer);
  renderLayerUI();
  renderComposite();
}

function renderComposite() {
  const { width, height } = getCanvasCssSize();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  layers.forEach((layer) => {
    if (!layer.visible) {
      return;
    }
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(layer.canvas, 0, 0, width, height);
  });
  ctx.globalAlpha = 1;
}

function initializeLayers() {
  layers = [createLayer("Layer 1")];
  activeLayerId = layers[0].id;
  renderLayerUI();
  renderComposite();
}

function loadGalleryItems() {
  try {
    const rawItems = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (!rawItems) {
      return [];
    }

    const parsed = JSON.parse(rawItems);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => typeof item?.id === "string" && typeof item?.dataUrl === "string");
  } catch {
    return [];
  }
}

function saveGalleryItems() {
  localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(galleryItems));
}

function renderGallery() {
  gallery.innerHTML = "";

  if (galleryItems.length === 0) {
    galleryEmpty.hidden = false;
    return;
  }

  galleryEmpty.hidden = true;

  galleryItems.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "gallery-item";
    card.innerHTML = `
      <img src="${item.dataUrl}" alt="Drawing ${index + 1}">
      <div class="gallery-actions">
        <a href="${item.dataUrl}" download="draw-${item.id}.png">Download</a>
        <button type="button" data-delete-id="${item.id}">Delete</button>
      </div>
    `;
    gallery.append(card);
  });
}

function hasCanvasContent() {
  for (const layer of layers) {
    const pixels = layer.ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height).data;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] !== 0) {
        return true;
      }
    }
  }

  return false;
}

function exportImageWithWhiteBackground() {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const exportCtx = exportCanvas.getContext("2d");

  exportCtx.fillStyle = "#ffffff";
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  layers.forEach((layer) => {
    if (!layer.visible) {
      return;
    }
    exportCtx.globalAlpha = layer.opacity;
    exportCtx.drawImage(layer.canvas, 0, 0);
  });
  exportCtx.globalAlpha = 1;

  return exportCanvas.toDataURL("image/png");
}

function resizeCanvas() {
  const previousLayers = layers.map((layer) => {
    const snapshot = document.createElement("canvas");
    snapshot.width = layer.canvas.width;
    snapshot.height = layer.canvas.height;
    snapshot.getContext("2d").drawImage(layer.canvas, 0, 0);
    return {
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      snapshot,
      oldWidth: layer.canvas.width,
      oldHeight: layer.canvas.height
    };
  });

  pixelRatio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
  setupStrokeContext(ctx);

  if (previousLayers.length === 0) {
    initializeLayers();
    return;
  }

  layers = previousLayers.map((layerData) => {
    const layerCanvas = document.createElement("canvas");
    layerCanvas.width = canvas.width;
    layerCanvas.height = canvas.height;
    const layerCtx = layerCanvas.getContext("2d");
    setupStrokeContext(layerCtx);

    if (layerData.oldWidth > 0 && layerData.oldHeight > 0) {
      layerCtx.drawImage(layerData.snapshot, 0, 0, layerData.oldWidth, layerData.oldHeight, 0, 0, layerCanvas.width, layerCanvas.height);
    }

    return {
      id: layerData.id,
      name: layerData.name,
      visible: layerData.visible,
      opacity: layerData.opacity,
      canvas: layerCanvas,
      ctx: layerCtx
    };
  });

  renderLayerUI();
  renderComposite();
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function startDrawing(event) {
  if (isEyedropperActive) {
    sampleColorFromCanvas(event);
    return;
  }

  const activeLayer = getActiveLayer();
  if (!activeLayer) {
    return;
  }

  isDrawing = true;
  const point = getPoint(event);
  activeLayer.ctx.beginPath();
  activeLayer.ctx.moveTo(point.x, point.y);
}

function draw(event) {
  if (!isDrawing) {
    return;
  }

  const activeLayer = getActiveLayer();
  if (!activeLayer) {
    return;
  }

  const point = getPoint(event);
  activeLayer.ctx.strokeStyle = currentColor;
  activeLayer.ctx.lineWidth = currentBrushSize;
  activeLayer.ctx.lineTo(point.x, point.y);
  activeLayer.ctx.stroke();
  renderComposite();
}

function stopDrawing() {
  if (!isDrawing) {
    return;
  }

  isDrawing = false;
  const activeLayer = getActiveLayer();
  if (activeLayer) {
    activeLayer.ctx.closePath();
  }
}

colorButtons.forEach((button) => {
  button.addEventListener("click", () => {
    colorButtons.forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    setCurrentColor(button.dataset.color, "palette");
  });
});

colorWheel.addEventListener("pointerdown", (event) => {
  isWheelPicking = true;
  pickWheelColor(event);
  colorWheel.setPointerCapture(event.pointerId);
});

colorWheel.addEventListener("pointermove", (event) => {
  if (!isWheelPicking) {
    return;
  }

  pickWheelColor(event);
});

colorWheel.addEventListener("pointerup", () => {
  isWheelPicking = false;
});

colorWheel.addEventListener("pointercancel", () => {
  isWheelPicking = false;
});

brushSizeInput.addEventListener("input", () => {
  currentBrushSize = Number(brushSizeInput.value);
  brushSizeValue.textContent = String(currentBrushSize);
});

clearBtn.addEventListener("click", () => {
  layers.forEach((layer) => {
    layer.ctx.clearRect(0, 0, layer.canvas.width / pixelRatio, layer.canvas.height / pixelRatio);
  });
  renderComposite();
});

eyedropperBtn.addEventListener("click", () => {
  setEyedropperActive(!isEyedropperActive);
});

saveBtn.addEventListener("click", () => {
  if (!hasCanvasContent()) {
    window.alert("Draw something on the canvas first.");
    return;
  }

  const item = {
    id: String(Date.now()),
    dataUrl: exportImageWithWhiteBackground()
  };

  galleryItems.unshift(item);
  if (galleryItems.length > MAX_GALLERY_ITEMS) {
    galleryItems = galleryItems.slice(0, MAX_GALLERY_ITEMS);
  }

  saveGalleryItems();
  renderGallery();
});

addLayerBtn.addEventListener("click", () => {
  const layerNumber = layers.length + 1;
  const newLayer = createLayer(`Layer ${layerNumber}`);
  layers.push(newLayer);
  activeLayerId = newLayer.id;
  renderLayerUI();
  renderComposite();
});

layerDownBtn.addEventListener("click", () => {
  moveActiveLayer(-1);
});

layerUpBtn.addEventListener("click", () => {
  moveActiveLayer(1);
});

deleteLayerBtn.addEventListener("click", () => {
  if (layers.length <= 1) {
    window.alert("You cannot delete the last layer.");
    return;
  }

  layers = layers.filter((layer) => layer.id !== activeLayerId);
  activeLayerId = layers[layers.length - 1].id;
  renderLayerUI();
  renderComposite();
});

layerList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const visibilityButton = target.closest("[data-layer-visibility]");
  if (visibilityButton instanceof HTMLElement) {
    const layerId = visibilityButton.dataset.layerVisibility;
    const layer = layers.find((item) => item.id === layerId);
    if (!layer) {
      return;
    }

    layer.visible = !layer.visible;
    renderLayerUI();
    renderComposite();
    return;
  }

  const layerRow = target.closest("[data-layer-id]");
  if (!(layerRow instanceof HTMLElement)) {
    return;
  }

  activeLayerId = layerRow.dataset.layerId || activeLayerId;
  renderLayerUI();
});

layerOpacity.addEventListener("input", () => {
  const activeLayer = getActiveLayer();
  if (!activeLayer) {
    return;
  }

  activeLayer.opacity = Number(layerOpacity.value) / 100;
  layerOpacityValue.textContent = `${layerOpacity.value}%`;
  renderComposite();
});

gallery.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const deleteId = target.dataset.deleteId;
  if (!deleteId) {
    return;
  }

  galleryItems = galleryItems.filter((item) => item.id !== deleteId);
  saveGalleryItems();
  renderGallery();
});

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", draw);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);

window.addEventListener("resize", resizeCanvas);
window.addEventListener("resize", drawColorWheel);
resizeCanvas();
drawColorWheel();
setCurrentColor(currentColor, "palette");
setEyedropperActive(false);
renderGallery();
