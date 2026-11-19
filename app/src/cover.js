const freezeStops = (stops) => Object.freeze(stops.map((stop) => Object.freeze(stop)));

export const GRADES = Object.freeze({
  sunset: Object.freeze({
    name: 'Vice Sunset',
    lut: freezeStops([
      [0, 18, 12, 43],
      [0.28, 72, 28, 91],
      [0.55, 193, 58, 79],
      [0.78, 244, 126, 68],
      [1, 255, 229, 166],
    ]),
  }),
  neon: Object.freeze({
    name: 'Neon Night',
    lut: freezeStops([
      [0, 5, 10, 25],
      [0.3, 22, 35, 83],
      [0.56, 179, 31, 137],
      [0.8, 40, 196, 218],
      [1, 206, 255, 255],
    ]),
  }),
  gold: Object.freeze({
    name: 'Palm Gold',
    lut: freezeStops([
      [0, 39, 25, 15],
      [0.32, 105, 61, 29],
      [0.58, 190, 119, 43],
      [0.82, 239, 193, 112],
      [1, 255, 245, 213],
    ]),
  }),
  mono: Object.freeze({
    name: 'Mono Noir',
    lut: freezeStops([
      [0, 0, 0, 0],
      [1, 255, 255, 255],
    ]),
  }),
});

// Every panel rectangle is [left, top, width, height] in output-canvas fractions.
export const LAYOUTS = Object.freeze({
  grid: Object.freeze([
    Object.freeze({ rect: [0, 0, 0.5, 0.5] }),
    Object.freeze({ rect: [0.5, 0, 0.5, 0.5] }),
    Object.freeze({ rect: [0, 0.5, 0.5, 0.5] }),
    Object.freeze({ rect: [0.5, 0.5, 0.5, 0.5] }),
  ]),
  hero: Object.freeze([
    Object.freeze({ rect: [0, 0, 1, 1 / 3] }),
    Object.freeze({ rect: [0, 1 / 3, 1, 1 / 3] }),
    Object.freeze({ rect: [0, 2 / 3, 1, 1 / 3] }),
  ]),
  split: Object.freeze([
    Object.freeze({ rect: [0, 0, 1, 1], clip: 'upper' }),
    Object.freeze({ rect: [0, 0, 1, 1], clip: 'lower' }),
  ]),
  solo: Object.freeze([Object.freeze({ rect: [0, 0, 1, 1] })]),
});

// focus selects a normalized photo point; xOffset keeps the grid's paired face crops distinct.
export const PANEL_FOCUS = Object.freeze({
  grid: Object.freeze([
    Object.freeze({ focus: 'face', zoom: 1.4, xOffset: -0.08 }),
    Object.freeze({ focus: 'face', zoom: 1.4, xOffset: 0.08 }),
    Object.freeze({ focus: 'detail', zoom: 1 }),
    Object.freeze({ focus: 'scene', zoom: 1 }),
  ]),
  hero: Object.freeze([
    Object.freeze({ focus: 'face', zoom: 1.6 }),
    Object.freeze({ focus: 'detail', zoom: 1.3 }),
    Object.freeze({ focus: 'scene', zoom: 1 }),
  ]),
  split: Object.freeze([
    Object.freeze({ focus: 'face', zoom: 1.4 }),
    Object.freeze({ focus: 'detail', zoom: 1 }),
  ]),
  solo: Object.freeze([Object.freeze({ focus: 'face', zoom: 1.2 })]),
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const coordinate = (value, fallback) => value == null || !Number.isFinite(Number(value)) ? fallback : clamp(Number(value), 0, 1);

function makeOffscreenCanvas(canvas, width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const doc = canvas.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) throw new Error('A document or OffscreenCanvas implementation is required');
  const offscreen = doc.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  return offscreen;
}

function getPhotoSize(photo) {
  return {
    width: photo.naturalWidth || photo.videoWidth || photo.width,
    height: photo.naturalHeight || photo.videoHeight || photo.height,
  };
}

function mapLuminance(value, lut) {
  for (let i = 1; i < lut.length; i += 1) {
    const left = lut[i - 1];
    const right = lut[i];
    if (value <= right[0]) {
      const amount = (value - left[0]) / (right[0] - left[0]);
      return [
        left[1] + (right[1] - left[1]) * amount,
        left[2] + (right[2] - left[2]) * amount,
        left[3] + (right[3] - left[3]) * amount,
      ];
    }
  }
  const last = lut[lut.length - 1];
  return [last[1], last[2], last[3]];
}

function applyGrade(ctx, width, height, grade) {
  const image = ctx.getImageData(0, 0, width, height);
  const pixels = image.data;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    const luminance = (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) / 255;
    const color = mapLuminance(luminance, grade.lut);
    pixels[i] = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
  }
  ctx.putImageData(image, 0, 0);
}

function getFocusPoint(instruction, focus) {
  if (instruction.focus === 'face') return focus.face;
  if (instruction.focus === 'detail') return focus.detail;
  return { x: 0.5, y: 0.5 };
}

function clipPanel(ctx, panel, x, y, width, height) {
  if (!panel.clip) return;
  ctx.beginPath();
  if (panel.clip === 'upper') {
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x, y + height);
  } else {
    ctx.moveTo(x + width, y);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
  }
  ctx.closePath();
  ctx.clip();
}

function drawPhotoPanel(ctx, photo, photoWidth, photoHeight, panel, instruction, canvasWidth, canvasHeight, opts, focus) {
  const [left, top, panelWidth, panelHeight] = panel.rect;
  const x = left * canvasWidth;
  const y = top * canvasHeight;
  const width = panelWidth * canvasWidth;
  const height = panelHeight * canvasHeight;
  const coverScale = Math.max(width / photoWidth, height / photoHeight);
  const zoom = clamp((Number(opts.zoom) || 1) * instruction.zoom, 1, 8);
  const sourceWidth = width / (coverScale * zoom);
  const sourceHeight = height / (coverScale * zoom);
  const point = getFocusPoint(instruction, focus);
  const pan = opts.pan || {};
  const centerX = point.x * photoWidth + (instruction.xOffset || 0) * sourceWidth + (Number(pan.x) || 0) * sourceWidth / 2;
  const centerY = point.y * photoHeight + (Number(pan.y) || 0) * sourceHeight / 2;
  const sourceX = clamp(centerX - sourceWidth / 2, 0, photoWidth - sourceWidth);
  const sourceY = clamp(centerY - sourceHeight / 2, 0, photoHeight - sourceHeight);

  ctx.save();
  clipPanel(ctx, panel, x, y, width, height);
  ctx.drawImage(photo, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  ctx.restore();
}

function drawBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#101020');
  gradient.addColorStop(0.55, '#24172d');
  gradient.addColorStop(1, '#080b14');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawCaption(ctx, width, height, caption) {
  const text = String(caption || '').trim().toUpperCase();
  const labelSize = Math.max(11, height * 0.025);
  const captionY = height * 0.91;
  const labelY = text ? captionY - height * 0.105 : height * 0.91;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${labelSize}px Arial, sans-serif`;
  ctx.letterSpacing = `${Math.max(1, labelSize * 0.18)}px`;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = labelSize * 0.5;
  ctx.fillText('A VICE BAY STORY', width / 2, labelY);

  if (text) {
    const family = '"Arial Narrow", "Liberation Sans Narrow", sans-serif';
    let size = height * 0.105;
    ctx.letterSpacing = '0px';
    ctx.font = `900 ${size}px ${family}`;
    while (ctx.measureText(text).width > width * 0.92 && size > 10) {
      size *= 0.94;
      ctx.font = `900 ${size}px ${family}`;
    }
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.1);
    ctx.strokeStyle = 'rgba(12, 9, 20, 0.95)';
    ctx.shadowBlur = size * 0.25;
    ctx.strokeText(text, width / 2, captionY);
    ctx.fillText(text, width / 2, captionY);
  }
  ctx.restore();
}

export function drawCover(canvas, photo, opts = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable');
  const width = canvas.width;
  const height = canvas.height;
  const layoutName = LAYOUTS[opts.layout] ? opts.layout : 'solo';
  const grade = GRADES[opts.grade] || GRADES.sunset;

  drawBackground(ctx, width, height);
  if (photo) {
    const { width: photoWidth, height: photoHeight } = getPhotoSize(photo);
    if (photoWidth > 0 && photoHeight > 0) {
      const photoCanvas = makeOffscreenCanvas(canvas, width, height);
      const photoCtx = photoCanvas.getContext('2d', { willReadFrequently: true });
      const focus = opts.focus || {};
      const normalizedFocus = {
        face: {
          x: coordinate(focus.face && focus.face.x, 0.5),
          y: coordinate(focus.face && focus.face.y, 0.4),
        },
        detail: {
          x: coordinate(focus.detail && focus.detail.x, 0.5),
          y: coordinate(focus.detail && focus.detail.y, 0.6),
        },
      };
      LAYOUTS[layoutName].forEach((panel, index) => {
        drawPhotoPanel(
          photoCtx,
          photo,
          photoWidth,
          photoHeight,
          panel,
          PANEL_FOCUS[layoutName][index],
          width,
          height,
          opts,
          normalizedFocus,
        );
      });
      applyGrade(photoCtx, width, height, grade);
      ctx.drawImage(photoCanvas, 0, 0);
    }
  }
  drawCaption(ctx, width, height, opts.caption);
  return canvas;
}

export function exportCover(photo, opts, width, height) {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) throw new Error('A document is required to create an export canvas');
  const canvas = doc.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return drawCover(canvas, photo, opts || {});
}
