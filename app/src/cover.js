const GRADES = {
  sunset: { stops: [[0, '#180d35'], [0.52, '#f07835'], [1, '#ff4e9a']], accent: '#ff4e9a', overlay: ['rgba(255,111,54,0.18)', 'rgba(222,42,147,0.18)'], tint: 'rgba(52,34,92,0.08)' },
  neon: { stops: [[0, '#080d1b'], [0.52, '#d51a94'], [1, '#51f2ed']], accent: '#55f5ef', overlay: ['rgba(238,18,153,0.16)', 'rgba(26,228,232,0.2)'], tint: 'rgba(19,14,50,0.08)' },
  gold: { stops: [[0, '#27140e'], [0.5, '#b46a22'], [1, '#ffe5a0']], accent: '#f4be59', overlay: ['rgba(234,151,42,0.14)', 'rgba(255,219,129,0.12)'], tint: 'rgba(55,28,10,0.06)' },
  noir: { stops: [[0, '#08090d'], [0.5, '#777a82'], [1, '#f4f4f2']], accent: '#b8e7ee', overlay: ['rgba(37,68,91,0.15)', 'rgba(180,219,226,0.08)'], tint: 'rgba(48,95,116,0.1)' },
};

const PANEL_FOCUS = {
  hero: [
    { ox: 0, oy: 0.38, zoom: 1.1 },
    { ox: 0.2, oy: 0.36, zoom: 1.8 },
    { ox: -0.45, oy: -0.4, zoom: 1.8 },
    { ox: 0.55, oy: -0.35, zoom: 1.8 },
  ],
  grid: [
    { ox: 0, oy: 0.72, zoom: 1.15 },
    { ox: 0.06, oy: 0.82, zoom: 1.6 },
    { ox: 0.15, oy: -0.75, zoom: 1.3 },
    { ox: -0.15, oy: 0.85, zoom: 1.3 },
  ],
  diagonal: [
    { ox: 0, oy: 0.3, zoom: 1.2 },
    { ox: -0.08, oy: 0, zoom: 1.0 },
  ],
  solo: [
    { ox: 0, oy: 0.12, zoom: 1.05 },
  ],
};

let gradeSource = null;
let gradeImage = null;
let gradeKey = '';

function makeGraded(photo, gradeName) {
  if (gradeSource === photo && gradeKey === gradeName && gradeImage) return gradeImage;
  const w = photo.naturalWidth || photo.width;
  const h = photo.naturalHeight || photo.height;
  const source = document.createElement('canvas');
  source.width = w;
  source.height = h;
  const sourceCtx = source.getContext('2d', { willReadFrequently: true });
  sourceCtx.drawImage(photo, 0, 0, w, h);
  const pixels = sourceCtx.getImageData(0, 0, w, h);
  const palette = document.createElement('canvas');
  palette.width = 256;
  palette.height = 1;
  const paletteCtx = palette.getContext('2d');
  const gradient = paletteCtx.createLinearGradient(0, 0, 256, 0);
  for (const [stop, color] of GRADES[gradeName].stops) gradient.addColorStop(stop, color);
  paletteCtx.fillStyle = gradient;
  paletteCtx.fillRect(0, 0, 256, 1);
  const colors = paletteCtx.getImageData(0, 0, 256, 1).data;
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = Math.min(255, Math.round(data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722)) * 4;
    data[i] = colors[luminance];
    data[i + 1] = colors[luminance + 1];
    data[i + 2] = colors[luminance + 2];
  }
  sourceCtx.putImageData(pixels, 0, 0);
  gradeSource = photo;
  gradeKey = gradeName;
  gradeImage = source;
  return source;
}

function panelPaths(layout, w, h, gutter) {
  const g = gutter;
  if (layout === 'hero') return [
    [[0, 0], [w, 0], [w, h * 0.62 - g / 2], [0, h * 0.62 - g / 2]],
    [[0, h * 0.62 + g / 2], [w / 3 - g, h * 0.62 + g / 2], [w / 3 - g, h], [0, h]],
    [[w / 3, h * 0.62 + g / 2], [2 * w / 3 - g / 2, h * 0.62 + g / 2], [2 * w / 3 - g / 2, h], [w / 3, h]],
    [[2 * w / 3 + g / 2, h * 0.62 + g / 2], [w, h * 0.62 + g / 2], [w, h], [2 * w / 3 + g / 2, h]],
  ];
  if (layout === 'diagonal') return [
    [[0, 0], [w * 0.62 - g / 2, 0], [w * 0.38 - g / 2, h], [0, h]],
    [[w * 0.62 + g / 2, 0], [w, 0], [w, h], [w * 0.38 + g / 2, h]],
  ];
  if (layout === 'solo') return [[[0, 0], [w, 0], [w, h], [0, h]]];
  return [
    [[0, 0], [w / 2 - g / 2, 0], [w / 2 - g / 2, h / 2 - g / 2], [0, h / 2 - g / 2]],
    [[w / 2 + g / 2, 0], [w, 0], [w, h / 2 - g / 2], [w / 2 + g / 2, h / 2 - g / 2]],
    [[0, h / 2 + g / 2], [w / 2 - g / 2, h / 2 + g / 2], [w / 2 - g / 2, h], [0, h]],
    [[w / 2 + g / 2, h / 2 + g / 2], [w, h / 2 + g / 2], [w, h], [w / 2 + g / 2, h]],
  ];
}

function pathFromPoints(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
}

function drawPanel(ctx, image, points, index, w, h, state, palette, gutter) {
  pathFromPoints(ctx, points);
  ctx.save();
  ctx.clip();
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  const pw = Math.max(...xs) - x, ph = Math.max(...ys) - y;
  if (image) {
    const focus = PANEL_FOCUS[state.layout]?.[index] || { ox: 0, oy: 0, zoom: 1 };
    const base = Math.max(pw / image.width, ph / image.height) * state.zoom * focus.zoom;
    const iw = image.width * base, ih = image.height * base;
    const cx = Math.max(x + pw - iw, Math.min(x, x + (pw - iw) / 2 + (state.panX + focus.ox * pw) * state.zoom));
    const cy = Math.max(y + ph - ih, Math.min(y, y + (ph - ih) / 2 + (state.panY + focus.oy * ph) * state.zoom));
    ctx.drawImage(image, cx, cy, iw, ih);
  } else {
    const placeholder = ctx.createLinearGradient(x, y, x + pw, y + ph);
    placeholder.addColorStop(0, '#40294e');
    placeholder.addColorStop(1, '#bd4c77');
    ctx.fillStyle = placeholder;
    ctx.fillRect(x, y, pw, ph);
  }
  const grade = GRADES[state.grade] || GRADES.sunset;
  const tint = ctx.createLinearGradient(x, y, x + pw, y + ph);
  tint.addColorStop(0, grade.overlay[0]);
  tint.addColorStop(1, grade.overlay[1]);
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, pw, ph);
  ctx.fillStyle = grade.tint;
  ctx.fillRect(x, y, pw, ph);
  const vignette = ctx.createRadialGradient(x + pw * 0.5, y + ph * 0.42, Math.min(pw, ph) * 0.16, x + pw * 0.5, y + ph * 0.5, Math.max(pw, ph) * 0.76);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(x, y, pw, ph);
  const topLight = ctx.createLinearGradient(0, y, 0, y + ph * 0.55);
  topLight.addColorStop(0, 'rgba(255,226,204,0.1)');
  topLight.addColorStop(1, 'rgba(255,226,204,0)');
  ctx.fillStyle = topLight;
  ctx.fillRect(x, y, pw, ph * 0.6);
  ctx.restore();
  ctx.save();
  pathFromPoints(ctx, points);
  ctx.lineWidth = Math.max(1, gutter * 0.25);
  ctx.strokeStyle = 'rgba(15,10,19,0.75)';
  ctx.stroke();
  ctx.restore();
}

function drawTitle(ctx, w, h, state, grade) {
  const solo = state.layout === 'solo';
  const bandTop = solo ? h * 0.67 : h * 0.73;
  const band = ctx.createLinearGradient(0, bandTop - h * 0.1, 0, h);
  band.addColorStop(0, 'rgba(7,5,12,0)');
  band.addColorStop(0.22, 'rgba(7,5,12,0.72)');
  band.addColorStop(1, 'rgba(7,5,12,0.94)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandTop - h * 0.1, w, h - bandTop + h * 0.1);
  const caption = (state.caption || 'VICE BAY').trim().toLocaleUpperCase();
  if (!caption) return;
  const words = caption.split(/\s+/);
  const lineLimit = w * 0.9;
  let lines = [caption];
  if (words.length === 2 && caption.length >= 15) lines = words;
  const maxSize = Math.min(h * (solo ? 0.13 : 0.115), w * 0.105);
  let size = maxSize;
  const font = () => { ctx.font = `900 condensed ${size}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`; };
  font();
  while (size > 18 && Math.max(...lines.map((line) => ctx.measureText(line).width)) > lineLimit) { size -= 2; font(); }
  const lineHeight = size * 0.84;
  const taglineSize = Math.max(11, size * 0.14);
  const titleHeight = lineHeight * lines.length;
  const titleY = h - h * 0.105 - taglineSize * 1.9 - titleHeight;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 10);
  ctx.strokeStyle = '#08060b';
  ctx.fillStyle = '#fff';
  for (let i = 0; i < lines.length; i++) {
    const y = titleY + i * lineHeight;
    ctx.save();
    ctx.shadowColor = grade.accent;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = size * 0.055;
    ctx.shadowOffsetY = size * 0.055;
    ctx.strokeText(lines[i], w / 2, y, lineLimit);
    ctx.fillText(lines[i], w / 2, y, lineLimit);
    ctx.restore();
  }
  ctx.fillStyle = grade.accent;
  ctx.fillRect(w * 0.06, titleY - h * 0.028, w * 0.12, Math.max(3, h * 0.004));
  ctx.font = `700 ${taglineSize}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('A VICE BAY STORY', w / 2, h - h * 0.045);
}

/** Draws a graded, multi-panel Vice Bay cover using the canvas's current dimensions. */
export function drawCover(canvas, photo, state = {}) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const options = { caption: 'Sunset Heist', layout: 'grid', grade: 'sunset', zoom: 1, panX: 0, panY: 0, ...state };
  const gradeName = GRADES[options.grade] ? options.grade : 'sunset';
  options.grade = gradeName;
  ctx.fillStyle = '#17111d';
  ctx.fillRect(0, 0, w, h);
  const gutter = Math.max(5, 8 * Math.min(w / 1080, h / 1080));
  const image = photo ? makeGraded(photo, gradeName) : null;
  const panels = panelPaths(options.layout, w, h, gutter);
  panels.forEach((points, index) => drawPanel(ctx, image, points, index, w, h, options, GRADES[gradeName], gutter));
  drawTitle(ctx, w, h, options, GRADES[gradeName]);
}
