'use strict';
/* Canvas drawing, pan/zoom and level-of-detail. Knows nothing about the DOM outside its canvas. */
class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.data = null; this.view = { k: 1, x: 0, y: 0 };
    this.show = { lines: true, tris: true };
    this.interacting = false; this.timer = 0; this.raf = 0; this.token = 0;
    this.pointers = new Map();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.bindInput();
  }
  get dpr() { return Math.min(devicePixelRatio || 1, CONFIG.MAX_DPR); }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = this.dpr;
    this.w = r.width; this.h = r.height;
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
    this.base = Math.min(this.w / CONFIG.VIEW_W, this.h / CONFIG.VIEW_H);
    this.ox = (this.w - CONFIG.VIEW_W * this.base) / 2; this.oy = (this.h - CONFIG.VIEW_H * this.base) / 2;
    this.draw();
  }
  setData(data) { this.data = data; this.fit(); }
  fit() { this.view = { k: 1, x: 0, y: 0 }; this.draw(); }
  zoomCenter(f) { this.zoomAt(this.w / 2, this.h / 2, f); }
  zoomAt(mx, my, f) {
    const v = this.view, k = Math.max(0.5, Math.min(400, v.k * f)), r = k / v.k;
    v.x = mx - (mx - v.x) * r; v.y = my - (my - v.y) * r; v.k = k; this.touch();
  }
  touch() { // heavy layers are skipped while interacting, then painted in full once idle
    this.interacting = true; clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.interacting = false; this.draw(); }, 140);
    this.schedule();
  }
  schedule() { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); }); }
  draw() {
    const { ctx, view, data } = this, dpr = this.dpr;
    this.token++; // cancels any unfinished triangle pass
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    if (!data) return;
    const s = this.base * view.k, tx = this.ox * view.k + view.x, ty = this.oy * view.k + view.y;
    this.s = s; this.mat = [dpr * s, 0, 0, dpr * s, dpr * tx, dpr * ty];
    ctx.setTransform(...this.mat); ctx.lineWidth = 1 / s; ctx.lineJoin = 'round';
    if (this.show.lines) {
      ctx.beginPath();
      const L = data.lines;
      for (let i = 0; i < L.length; i += 4) { ctx.moveTo(L[i], L[i + 1]); ctx.lineTo(L[i + 2], L[i + 3]); }
      ctx.strokeStyle = 'rgba(147,170,205,.55)'; ctx.stroke();
    }
    if (this.show.tris && !(this.interacting && data.count > CONFIG.LOD_TRIANGLES)) {
      this.job = { i: 0, x0: -tx / s, x1: (this.w - tx) / s, y0: -ty / s, y1: (this.h - ty) / s, stroke: data.count < 30000 || view.k >= 6 };
      this.pump(this.token);
    }
  }
  // Time-sliced (~10ms per frame) so the page never freezes. Skips off-screen and sub-pixel triangles.
  pump(token) {
    const j = this.job, { ctx, data } = this;
    if (!j || token !== this.token) return;
    ctx.setTransform(...this.mat); ctx.lineWidth = 1.2 / this.s;
    const T = data.tris, P = CONFIG.PALETTE, N = P.length, end = performance.now() + 10, tiny = 0.25 / this.s;
    while (j.i < data.count && performance.now() < end) {
      const hi = Math.min(j.i + 4000, data.count);
      for (let c = 0; c < N; c++) {
        ctx.beginPath();
        for (let t = j.i + c; t < hi; t += N) {
          const o = t * 6, ax = T[o], ay = T[o + 1], bx = T[o + 2], by = T[o + 3], cx = T[o + 4], cy = T[o + 5];
          const x0 = Math.min(ax, bx, cx), x1 = Math.max(ax, bx, cx), y0 = Math.min(ay, by, cy), y1 = Math.max(ay, by, cy);
          if (x1 < j.x0 || x0 > j.x1 || y1 < j.y0 || y0 > j.y1 || (x1 - x0 < tiny && y1 - y0 < tiny)) continue;
          ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath();
        }
        ctx.fillStyle = P[c] + '40'; ctx.fill();
        if (j.stroke) { ctx.strokeStyle = P[c]; ctx.stroke(); }
      }
      j.i = hi;
    }
    if (j.i < data.count) requestAnimationFrame(() => this.pump(token));
  }
  bindInput() {
    const cv = this.cv, rel = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('wheel', e => { e.preventDefault(); this.zoomAt(...rel(e), e.deltaY > 0 ? 1 / 1.15 : 1.15); }, { passive: false });
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); cv.classList.add('grabbing');
      this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
    });
    cv.addEventListener('pointermove', e => {
      const prev = this.pointers.get(e.pointerId); if (!prev) return;
      const before = [...this.pointers.values()];
      this.pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (before.length === 2) { // pinch
        const [a, b] = before, [c, d] = [...this.pointers.values()];
        const f = Math.hypot(c[0] - d[0], c[1] - d[1]) / (Math.hypot(a[0] - b[0], a[1] - b[1]) || 1);
        const r = cv.getBoundingClientRect(); this.zoomAt((c[0] + d[0]) / 2 - r.left, (c[1] + d[1]) / 2 - r.top, f);
      } else { this.view.x += e.clientX - prev[0]; this.view.y += e.clientY - prev[1]; this.touch(); }
    });
    const up = e => { this.pointers.delete(e.pointerId); if (!this.pointers.size) cv.classList.remove('grabbing'); };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => cv.addEventListener(t, up));
  }
  exportPNG() {
    const out = document.createElement('canvas'); out.width = this.cv.width; out.height = this.cv.height;
    const c = out.getContext('2d'); c.fillStyle = '#0b1322'; c.fillRect(0, 0, out.width, out.height); c.drawImage(this.cv, 0, 0);
    out.toBlob(b => {
      const a = document.createElement('a'); a.download = 'kobon.png'; a.href = URL.createObjectURL(b); a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }
}