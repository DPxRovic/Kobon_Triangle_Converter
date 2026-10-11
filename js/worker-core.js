'use strict';
/* Runs inside a Web Worker (Solver turns this function into a Blob).
   MUST stay self-contained: it cannot see CONFIG or anything else on the page. */
function workerCore() {
  const VIEW_W = 1000, VIEW_H = 700, PAD = 30;
  let stop = false, posBuf = null;
  const getPos = n => (posBuf && posBuf.length >= n * n) ? posBuf : (posBuf = new Int32Array(n * n)); // reused between Search attempts

  function rng(a) { // mulberry32: seeded, so a seed always gives the same drawing
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  // Triangle (i,j,k) is an empty face iff on each of its 3 lines the other two are neighbours in crossing order.
  function build(n, bRange, xSpacing, seed) {
    const t0 = performance.now(), rnd = rng(seed);
    const m = new Float64Array(n), b = new Float64Array(n);
    let xc = 0;
    for (let i = 1; i < n; i++) {
      xc += 10 + rnd() * xSpacing;
      const bi = (i % 2 === 0 ? 1 : -1) * (5 + rnd() * bRange);
      b[i] = bi; m[i] = -bi / xc;
    }
    const orders = new Array(n), pos = getPos(n), X = new Float64Array(n);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    // Big n: a few far-away crossings would squash everything into a speck, so frame the 1st-99th percentile of a sample.
    const sample = n > 60, prob = Math.min(1, 20000 / (n * (n - 1) / 2)), r2 = rng(seed ^ 0x9e3779b9), sxs = [], sys = [];
    for (let i = 0; i < n; i++) {
      const idx = new Int32Array(n - 1);
      for (let j = 0, c = 0; j < n; j++) {
        if (j === i) continue;
        idx[c++] = j;
        const d = m[i] - m[j], x = d === 0 ? Infinity : (b[j] - b[i]) / d;
        X[j] = x;
        if (j > i && isFinite(x)) {
          const y = m[i] * x + b[i];
          if (sample) { if (r2() < prob) { sxs.push(x); sys.push(y); } }
          else { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
      }
      idx.sort((p, q) => X[p] - X[q]);
      orders[i] = idx;
      for (let r = 0; r < n - 1; r++) pos[i * n + idx[r]] = r;
    }
    if (sample && sxs.length > 10) {
      const q = (a, f) => Float64Array.from(a).sort()[Math.floor(f * (a.length - 1))];
      minX = q(sxs, .01); maxX = q(sxs, .99); minY = q(sys, .01); maxY = q(sys, .99);
    }
    const sx = (VIEW_W - PAD * 2) / Math.max(maxX - minX, 1), sy = (VIEW_H - PAD * 2) / Math.max(maxY - minY, 1);
    const pt = (a, c, out, o) => {
      const x = (b[c] - b[a]) / (m[a] - m[c]), y = m[a] * x + b[a];
      out[o] = PAD + (x - minX) * sx; out[o + 1] = VIEW_H - (PAD + (y - minY) * sy);
    };

    // use[line*(n-1)+rank] = how many triangles have the bounded segment (rank, rank+1) of that line as an edge
    const use = new Uint8Array(n * (n - 1)), tri = [], W = n - 1, bump = k => { if (use[k] < 255) use[k]++; };
    for (let i = 0; i < n; i++) {
      const o = orders[i];
      for (let r = 0; r < n - 2; r++) {
        const j = o[r], k = o[r + 1];
        if (j < i || k < i) continue;
        const pji = pos[j * n + i], pjk = pos[j * n + k], pki = pos[k * n + i], pkj = pos[k * n + j];
        if (Math.abs(pji - pjk) === 1 && Math.abs(pki - pkj) === 1) {
          tri.push(i, j, k);
          bump(i * W + r); bump(j * W + Math.min(pji, pjk)); bump(k * W + Math.min(pki, pkj));
        }
      }
    }
    let unused = 0, shared = 0;
    for (let i = 0; i < n; i++) for (let r = 0; r < n - 2; r++) { const u = use[i * W + r]; if (!u) unused++; else if (u > 1) shared++; }

    const count = tri.length / 3, tris = new Float32Array(count * 6), lines = new Float32Array(n * 4);
    for (let t = 0; t < count; t++) {
      const i = tri[t * 3], j = tri[t * 3 + 1], k = tri[t * 3 + 2];
      pt(i, j, tris, t * 6); pt(i, k, tris, t * 6 + 2); pt(j, k, tris, t * 6 + 4);
    }
    for (let i = 0; i < n; i++) { pt(i, orders[i][0], lines, i * 4); pt(i, orders[i][n - 2], lines, i * 4 + 2); }
    return { type: 'result', n, seed, count, lines, tris, inter: n * (n - 1) / 2, segments: n * (n - 2), unused, shared, ms: performance.now() - t0 };
  }

  const send = r => postMessage(r, [r.lines.buffer, r.tris.buffer]);

  self.onmessage = e => {
    const d = e.data;
    if (d.type === 'run') {
      try { send(build(d.n, d.b, d.x, d.seed)); } catch (err) { postMessage({ type: 'error', message: err.message }); }
    } else if (d.type === 'search') {
      stop = false; let tries = 0, best = -1;
      const step = () => {
        if (stop) return postMessage({ type: 'done', tries, best });
        try {
          const r = build(d.n, d.b, d.x, d.seed + tries++);
          if (r.count > best) { best = r.count; send(r); }
        } catch (err) { return postMessage({ type: 'error', message: err.message }); }
        postMessage({ type: 'progress', tries, best });
        setTimeout(step, 0); // yield so a 'stop' message can arrive
      };
      step();
    } else if (d.type === 'stop') stop = true;
  };
}