// Deterministic screenshot scenes support ?shot=cover|editor plus local photo, caption, layout, and grade parameters.
export async function runShot(shot, query, load) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const layout = query.get('layout') ?? 'grid';
  const grade = query.get('grade') ?? 'sunset';
  await load(`samples/${photo}.jpg`, caption, { layout, grade });
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
