const REF_TABLE = { 3: 1, 4: 2, 5: 5, 6: 7, 7: 11, 8: 15, 9: 21, 10: 25, 11: 32, 12: 38, 13: 47, 14: 53, 15: 65, 16: 72, 17: 85, 18: 93, 19: 104, 20: 115, 21: 130 };

// FIX: arbitrarily large n can freeze the tab (O(n^2) intersections + triangle search).
// No hard cap is enforced (per request), but we confirm before running anything huge.
const LARGE_N_WARNING_THRESHOLD = 500;

const numLinesEl = document.getElementById('numLines');
const bRangeEl = document.getElementById('bRange');
const xSpaceEl = document.getElementById('xSpace');

function equalizeRangesToLines() {
  const n = Math.max(3, parseInt(numLinesEl.value, 10) || 3);
  bRangeEl.value = Math.round(n * 0.5);
  xSpaceEl.value = Math.round(n * 0.6);
}
// FIX: also update live while typing, not just on blur/enter
numLinesEl.addEventListener('change', equalizeRangesToLines);
numLinesEl.addEventListener('input', equalizeRangesToLines);

function generateKobon(n, bRange, xSpacing) {
  const lines = [{ m: 0, b: 0 }];
  let xCursor = 0;
  for (let i = 1; i < n; i++) {
    xCursor += 10 + Math.random() * xSpacing;
    const sign = (i % 2 === 0) ? 1 : -1;
    const b = sign * (5 + Math.random() * bRange);
    const m = -b / xCursor;
    lines.push({ m, b });
  }
  lines.forEach(l => { l.intersections = []; l.segments = []; });

  const intersections = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const li = lines[i], lj = lines[j];
      if (li.m === lj.m) continue;
      const x = (lj.b - li.b) / (li.m - lj.m);
      const y = li.m * x + li.b;
      const idx = intersections.length;
      intersections.push({ line1: i, line2: j, x, y, segments: [] });
      lines[i].intersections.push(idx);
      lines[j].intersections.push(idx);
    }
  }

  const segments = [];
  const segMap = new Map();
  for (let i = 0; i < n; i++) {
    const ids = lines[i].intersections.slice().sort((a, b) => intersections[a].x - intersections[b].x);
    for (let j = 0; j < ids.length - 1; j++) {
      const a = ids[j], b = ids[j + 1];
      const segIdx = segments.length;
      segments.push({ line: i, a, b });
      intersections[a].segments.push(segIdx);
      intersections[b].segments.push(segIdx);
      lines[i].segments.push(segIdx);
      const key = a < b ? a + '_' + b : b + '_' + a;
      segMap.set(key, segIdx);
    }
  }

  const triangleMap = new Map();
  intersections.forEach((inter, idx) => {
    const segs = inter.segments;
    for (let p = 0; p < segs.length; p++) {
      for (let q = p + 1; q < segs.length; q++) {
        const s1 = segments[segs[p]], s2 = segments[segs[q]];
        if (s1.line === s2.line) continue;
        const far1 = (s1.a === idx) ? s1.b : s1.a;
        const far2 = (s2.a === idx) ? s2.b : s2.a;
        if (far1 === far2) continue;
        const key = far1 < far2 ? far1 + '_' + far2 : far2 + '_' + far1;
        const connectingIdx = segMap.get(key);
        if (connectingIdx === undefined) continue;
        const connecting = segments[connectingIdx];
        const triLines = [s1.line, s2.line, connecting.line].sort((a, b) => a - b);
        const triKey = triLines.join(',');
        if (!triangleMap.has(triKey)) {
          triangleMap.set(triKey, [inter, intersections[far1], intersections[far2]]);
        }
      }
    }
  });

  return { lines, intersections, segments, triangles: Array.from(triangleMap.values()) };
}

// ---- rendering ----
const svg = document.getElementById('svg');
const NS = 'http://www.w3.org/2000/svg';

function render(result) {
  const { lines, intersections, triangles } = result;
  svg.innerHTML = '';

  if (intersections.length === 0) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  intersections.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const W = 1000, H = 700, PAD = 30;
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scaleX = (W - PAD * 2) / spanX;
  const scaleY = (H - PAD * 2) / spanY;

  const sx = x => PAD + (x - minX) * scaleX;
  const sy = y => H - (PAD + (y - minY) * scaleY);

  lines.forEach(line => {
    if (line.intersections.length < 2) return;
    const ids = line.intersections.slice().sort((a, b) => intersections[a].x - intersections[b].x);
    const first = intersections[ids[0]];
    const last = intersections[ids[ids.length - 1]];
    const el = document.createElementNS(NS, 'line');
    el.setAttribute('x1', sx(first.x)); el.setAttribute('y1', sy(first.y));
    el.setAttribute('x2', sx(last.x)); el.setAttribute('y2', sy(last.y));
    el.setAttribute('class', 'line-path');
    svg.appendChild(el);
  });

  triangles.forEach(([p1, p2, p3]) => {
    const pts = `${sx(p1.x)},${sy(p1.y)} ${sx(p2.x)},${sy(p2.y)} ${sx(p3.x)},${sy(p3.y)}`;
    const el = document.createElementNS(NS, 'polygon');
    el.setAttribute('points', pts);
    el.setAttribute('class', 'tri');
    svg.appendChild(el);
  });
}

const BASE_VB = { x: 0, y: 0, w: 1000, h: 700 };
let viewBox = { ...BASE_VB };

function applyViewBox() {
  svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
}

function clientToSvgPoint(clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const px = (clientX - rect.left) / rect.width;
  const py = (clientY - rect.top) / rect.height;
  return {
    x: viewBox.x + px * viewBox.w,
    y: viewBox.y + py * viewBox.h
  };
}

function zoomAt(clientX, clientY, factor) {
  const pt = clientToSvgPoint(clientX, clientY);
  const newW = Math.max(20, Math.min(BASE_VB.w * 20, viewBox.w * factor));
  const newH = Math.max(14, Math.min(BASE_VB.h * 20, viewBox.h * factor));
  viewBox.x = pt.x - (pt.x - viewBox.x) * (newW / viewBox.w);
  viewBox.y = pt.y - (pt.y - viewBox.y) * (newH / viewBox.h);
  viewBox.w = newW;
  viewBox.h = newH;
  applyViewBox();
}

svg.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
  zoomAt(e.clientX, e.clientY, factor);
}, { passive: false });

let isPanning = false;
let panStart = null;
let vbStart = null;

svg.addEventListener('pointerdown', (e) => {
  isPanning = true;
  svg.classList.add('grabbing');
  panStart = { x: e.clientX, y: e.clientY };
  vbStart = { ...viewBox };
  svg.setPointerCapture(e.pointerId);
});

svg.addEventListener('pointermove', (e) => {
  if (!isPanning) return;
  const rect = svg.getBoundingClientRect();
  const dxPx = e.clientX - panStart.x;
  const dyPx = e.clientY - panStart.y;
  const dx = -dxPx * (vbStart.w / rect.width);
  const dy = -dyPx * (vbStart.h / rect.height);
  viewBox.x = vbStart.x + dx;
  viewBox.y = vbStart.y + dy;
  applyViewBox();
});

function endPan(e) {
  if (!isPanning) return;
  isPanning = false;
  svg.classList.remove('grabbing');
}
svg.addEventListener('pointerup', endPan);
svg.addEventListener('pointerleave', endPan);
svg.addEventListener('pointercancel', endPan);

document.getElementById('resetView').addEventListener('click', () => {
  viewBox = { ...BASE_VB };
  applyViewBox();
});

function run() {
  const n = parseInt(numLinesEl.value, 10);
  const bRange = parseInt(bRangeEl.value, 10);
  const xSpacing = parseInt(xSpaceEl.value, 10);

  if (!n || n < 3 || !bRange || !xSpacing) {
    alert('Please enter all required fields before generating.');
    return;
  }

  // FIX: no hard cap on n anymore, but warn before doing something that could hang the tab
  if (n > LARGE_N_WARNING_THRESHOLD) {
    const proceed = confirm(
      `${n} lines has no built-in limit, but this can take a while and may freeze the tab ` +
      `(intersections and triangle search both grow roughly with n^2/n^3). Continue anyway?`
    );
    if (!proceed) return;
  }

  const result = generateKobon(n, bRange, xSpacing);
  render(result);
  viewBox = { ...BASE_VB };
  applyViewBox();

  document.getElementById('s-lines').textContent = n;
  document.getElementById('s-inter').textContent = result.intersections.length;
  document.getElementById('s-tri').textContent = result.triangles.length;

  const refRow = document.getElementById('ref-row');
  if (REF_TABLE[n] !== undefined) {
    refRow.style.display = 'flex';
    document.getElementById('s-ref').textContent = REF_TABLE[n];
  } else {
    refRow.style.display = 'none';
  }
}

document.getElementById('go').addEventListener('click', run);

// FIX: populate default values on load instead of leaving fields empty (null/0 issue)
numLinesEl.value = numLinesEl.value || 10;
equalizeRangesToLines();