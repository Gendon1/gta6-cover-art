import { drawCover } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const caption = document.getElementById('caption');
const status = document.getElementById('status');
const sizePicker = document.getElementById('size');
const zoomPicker = document.getElementById('zoom');
const zoomValue = document.getElementById('zoom-value');
const state = { caption: caption.value, layout: 'grid', grade: 'sunset', zoom: 1, panX: 0, panY: 0 };
let photo = null;
let pointerOrigin = null;

function redraw() {
  state.caption = caption.value;
  drawCover(canvas, photo, state);
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

function setPhoto(image, name) {
  photo = image;
  state.panX = 0;
  state.panY = 0;
  redraw();
  if (name) status.textContent = `${name} loaded. Drag the preview to reframe.`;
}

function setSize(value) {
  const [width, height] = value.split('x').map(Number);
  canvas.width = width;
  canvas.height = height;
  document.getElementById('preview-size').textContent = `${width} × ${height}`;
  document.getElementById('export').innerHTML = `Export PNG <span>↗</span>`;
  redraw();
}

document.getElementById('photo').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    setPhoto(await loadImage(URL.createObjectURL(file)), file.name);
  } catch {
    status.textContent = 'That photo could not be opened. Try another image.';
  }
});

document.querySelectorAll('[data-sample]').forEach((button) => button.addEventListener('click', async () => {
  try {
    setPhoto(await loadImage(`samples/${button.dataset.sample}.jpg`), `${button.textContent} sample`);
  } catch {
    status.textContent = 'Could not load the sample photo.';
  }
}));

caption.addEventListener('input', redraw);
document.querySelectorAll('[data-layout]').forEach((button) => button.addEventListener('click', () => {
  state.layout = button.dataset.layout;
  document.querySelectorAll('[data-layout]').forEach((item) => item.classList.toggle('active', item === button));
  redraw();
}));
document.querySelectorAll('[data-grade]').forEach((button) => button.addEventListener('click', () => {
  state.grade = button.dataset.grade;
  document.body.dataset.grade = state.grade;
  document.querySelectorAll('[data-grade]').forEach((item) => item.classList.toggle('active', item === button));
  redraw();
}));
zoomPicker.addEventListener('input', () => {
  state.zoom = Number(zoomPicker.value);
  zoomValue.value = `${state.zoom.toFixed(1)}×`;
  zoomValue.textContent = zoomValue.value;
  redraw();
});
sizePicker.addEventListener('change', () => setSize(sizePicker.value));

canvas.addEventListener('pointerdown', (event) => {
  pointerOrigin = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (event) => {
  if (!pointerOrigin) return;
  const bounds = canvas.getBoundingClientRect();
  state.panX = pointerOrigin.panX + (event.clientX - pointerOrigin.x) * canvas.width / bounds.width;
  state.panY = pointerOrigin.panY + (event.clientY - pointerOrigin.y) * canvas.height / bounds.height;
  redraw();
});
const stopDrag = () => { pointerOrigin = null; canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', stopDrag);
canvas.addEventListener('pointercancel', stopDrag);

document.getElementById('export').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    if (!blob) {
      status.textContent = 'PNG export failed. Please try again.';
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vice-bay-${canvas.width}x${canvas.height}.png`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `Saved vice-bay-${canvas.width}x${canvas.height}.png`;
  }, 'image/png');
});

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, async (sample, text, options = {}) => {
    setPhoto(await loadImage(sample), 'Shot photo');
    caption.value = text;
    state.caption = text;
    if (options.layout) state.layout = options.layout;
    if (options.grade) state.grade = options.grade;
    if (options.layout) document.querySelectorAll('[data-layout]').forEach((button) => button.classList.toggle('active', button.dataset.layout === state.layout));
    if (options.grade) {
      document.body.dataset.grade = state.grade;
      document.querySelectorAll('[data-grade]').forEach((button) => button.classList.toggle('active', button.dataset.grade === state.grade));
    }
    setSize(shot === 'cover' ? '1080x1080' : '1920x1080');
    redraw();
  });
} else {
  setSize(sizePicker.value);
  loadImage('samples/pier.jpg').then((image) => setPhoto(image, 'Moonlit Pier sample')).catch(() => redraw());
}
