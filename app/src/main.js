import { drawCover, exportCover, GRADES, LAYOUTS } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const photoInput = document.getElementById('photo');
const captionInput = document.getElementById('caption');
const status = document.getElementById('status');
const zoomInput = document.getElementById('zoom');
const zoomValue = document.getElementById('zoom-value');

const FOCUS = {
  boulevard: { face: { x: 0.55, y: 0.18 }, detail: { x: 0.25, y: 0.75 } },
  pier: { face: { x: 0.38, y: 0.18 }, detail: { x: 0.78, y: 0.72 } },
};
const uploadedFocus = { face: { x: 0.5, y: 0.4 }, detail: { x: 0.5, y: 0.6 } };

let photo = null;
let caption = captionInput.value;
let layout = 'hero';
let grade = 'sunset';
let zoom = 1;
let pan = { x: 0, y: 0 };
let focus = uploadedFocus;
let dragging = null;

/** Load an image URL and resolve once it is ready to draw. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${url}`));
    image.src = url;
  });
}

function options() {
  return { caption, layout, grade, zoom, pan, focus };
}

function redraw() {
  drawCover(canvas, photo, options());
}

function updateActiveButtons() {
  document.querySelectorAll('[data-layout]').forEach((button) => {
    const active = button.dataset.layout === layout;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-grade]').forEach((button) => {
    const active = button.dataset.grade === grade;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function updatePublicState() {
  window.__coverState = { layout, grade };
}

function updateZoomLabel() {
  zoomValue.value = `${zoom.toFixed(2)}×`;
  zoomValue.textContent = `${zoom.toFixed(2)}×`;
}

async function loadSample(name) {
  try {
    photo = await loadImage(`samples/${name}.jpg`);
    focus = FOCUS[name] || uploadedFocus;
    pan = { x: 0, y: 0 };
    redraw();
    status.textContent = `${name === 'boulevard' ? 'Boulevard' : 'Pier'} sample loaded.`;
  } catch (error) {
    status.textContent = `Unable to load the ${name} sample.`;
    console.error(error);
  }
}

async function loadUploadedPhoto(file) {
  if (!file) return;
  const objectUrl = URL.createObjectURL(file);
  try {
    photo = await loadImage(objectUrl);
    focus = uploadedFocus;
    pan = { x: 0, y: 0 };
    status.textContent = `${file.name} loaded.`;
    redraw();
  } catch (error) {
    status.textContent = 'Unable to load that image.';
    console.error(error);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function exportPng(width, height) {
  const filename = `cover-${width}x${height}.png`;
  let output;
  try {
    output = exportCover(photo, options(), width, height);
  } catch (error) {
    status.textContent = 'Could not render the cover export.';
    console.error(error);
    return;
  }
  output.toBlob((blob) => {
    if (!blob) {
      status.textContent = 'Could not create the PNG export.';
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `Saved ${filename}`;
  }, 'image/png');
}

photoInput.addEventListener('change', (event) => loadUploadedPhoto(event.target.files[0]));
captionInput.addEventListener('input', () => {
  caption = captionInput.value;
  redraw();
});
document.querySelectorAll('[data-sample]').forEach((button) => {
  button.addEventListener('click', () => loadSample(button.dataset.sample));
});
document.querySelectorAll('[data-layout]').forEach((button) => {
  button.addEventListener('click', () => {
    layout = button.dataset.layout;
    updateActiveButtons();
    updatePublicState();
    redraw();
  });
});
document.querySelectorAll('[data-grade]').forEach((button) => {
  button.addEventListener('click', () => {
    grade = button.dataset.grade;
    updateActiveButtons();
    updatePublicState();
    redraw();
  });
});
zoomInput.addEventListener('input', () => {
  zoom = Number(zoomInput.value);
  updateZoomLabel();
  redraw();
});
document.getElementById('export-1920').addEventListener('click', () => exportPng(1920, 1080));
document.getElementById('export-1350').addEventListener('click', () => exportPng(1080, 1350));
document.getElementById('export-1080').addEventListener('click', () => exportPng(1080, 1080));

canvas.addEventListener('pointerdown', (event) => {
  if (!photo) return;
  dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging || dragging.id !== event.pointerId) return;
  const bounds = canvas.getBoundingClientRect();
  const dx = (event.clientX - dragging.x) / Math.max(1, bounds.width);
  const dy = (event.clientY - dragging.y) / Math.max(1, bounds.height);
  pan = {
    x: Math.max(-1, Math.min(1, pan.x - (dx * 2) / zoom)),
    y: Math.max(-1, Math.min(1, pan.y - (dy * 2) / zoom)),
  };
  dragging.x = event.clientX;
  dragging.y = event.clientY;
  redraw();
});
function stopDragging(event) {
  if (dragging && dragging.id === event.pointerId) dragging = null;
}
canvas.addEventListener('pointerup', stopDragging);
canvas.addEventListener('pointercancel', stopDragging);
canvas.addEventListener('lostpointercapture', stopDragging);

updatePublicState();
window.__applyShot = async ({ photo: sample = 'pier', caption: text = 'Sunset Heist', layout: nextLayout = 'hero', grade: nextGrade = 'sunset' } = {}) => {
  const sampleName = String(sample).replace(/\.jpg$/i, '').split('/').pop();
  const knownLayout = Object.hasOwn(LAYOUTS, nextLayout) ? nextLayout : 'hero';
  const knownGrade = Object.hasOwn(GRADES, nextGrade) ? nextGrade : 'sunset';
  try {
    photo = await loadImage(`samples/${sampleName}.jpg`);
    focus = FOCUS[sampleName] || uploadedFocus;
    caption = String(text).slice(0, 40);
    captionInput.value = caption;
    layout = knownLayout;
    grade = knownGrade;
    pan = { x: 0, y: 0 };
    updateActiveButtons();
    redraw();
    updatePublicState();
  } catch (error) {
    status.textContent = `Unable to load the ${sampleName} sample.`;
    console.error(error);
  }
};

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), async (sample, text) => {
    const sampleName = String(sample).split('/').pop().replace(/\.jpg$/i, '');
    photo = await loadImage(sample);
    focus = FOCUS[sampleName] || uploadedFocus;
    caption = String(text).slice(0, 40);
    captionInput.value = caption;
    redraw();
  });
} else {
  redraw();
}

updateActiveButtons();
updateZoomLabel();
