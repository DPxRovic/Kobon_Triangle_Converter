'use strict';
/* Welcome screen: a short guided tour with a live, hands-on triangle board. */

/* Tiny line-drawing sandbox. Counts "clean" triangles (no other line cuts through) among up to 10 lines. */
class DemoBoard {
  constructor(cv, onChange) {
    Object.assign(this, { cv, onChange, ctx: cv.getContext('2d'), W: 400, H: 300, MAX: 10, lines: [], tris: [], preview: null, timers: [] });
    this.bind(); this.update();
  }
  static line(p, q) { const a = q[1] - p[1], b = p[0] - q[0]; return { p, q, a, b, c: a * p[0] + b * p[1], norm: Math.hypot(a, b) || 1 }; }
  add(p, q) { if (this.lines.length >= this.MAX) return false; this.lines.push(DemoBoard.line(p, q)); this.update(); return true; }
  clear() { this.stopAuto(); this.lines = []; this.update(); }
  stopAuto() { this.timers.forEach(clearTimeout); this.timers = []; }
  rand() { return [20 + Math.random() * (this.W - 40), 20 + Math.random() * (this.H - 40)]; }
  addRandom() { this.stopAuto(); if (!this.add(this.rand(), this.rand())) return false; return true; }
  star(loop) { // the 5-line pentagram: the best possible arrangement for 5 lines (5 triangles)
    this.clear();
    const v = k => { const t = (-90 + 72 * k) * Math.PI / 180; return [this.W / 2 + 125 * Math.cos(t), this.H / 2 + 8 + 125 * Math.sin(t)]; };
    for (let k = 0; k < 5; k++) this.timers.push(setTimeout(() => this.add(v(k), v((k + 2) % 5)), 350 + k * 450));
    if (loop) this.timers.push(setTimeout(() => this.star(true), 350 + 5 * 450 + 3000)); // replay forever, no button needed
  }
  triangles() {
    const L = this.lines, out = [], W = this.W, H = this.H;
    const x = (l, m) => { const d = l.a * m.b - m.a * l.b; return Math.abs(d) < 1e-9 ? null : [(l.c * m.b - m.c * l.b) / d, (l.a * m.c - m.a * l.c) / d]; };
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) for (let k = j + 1; k < L.length; k++) {
      const P = x(L[i], L[j]), Q = x(L[i], L[k]), R = x(L[j], L[k]);
      if (!P || !Q || !R) continue;
      const pts = [P, Q, R];
      if (Math.abs((Q[0] - P[0]) * (R[1] - P[1]) - (R[0] - P[0]) * (Q[1] - P[1])) < 1) continue;       // squashed flat
      if (!pts.every(p => p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H)) continue;               // must be fully on the board
      const cut = L.some((l, m) => {
        if (m === i || m === j || m === k) return false;
        const s = pts.map(p => (l.a * p[0] + l.b * p[1] - l.c) / l.norm);
        return Math.min(...s) < -0.5 && Math.max(...s) > 0.5;
      });
      if (!cut) out.push(pts);
    }
    return out;
  }
  update() { this.tris = this.triangles(); this.draw(); this.onChange(this.lines.length, this.tris.length); }
  stroke(l, style, dash) {
    const c = this.ctx, dx = l.q[0] - l.p[0], dy = l.q[1] - l.p[1], n = Math.hypot(dx, dy) || 1, f = 1500 / n;
    c.setLineDash(dash || []); c.strokeStyle = style; c.beginPath();
    c.moveTo(l.p[0] - dx * f, l.p[1] - dy * f); c.lineTo(l.p[0] + dx * f, l.p[1] + dy * f); c.stroke();
  }
  draw() {
    const c = this.ctx, P = CONFIG.PALETTE; c.clearRect(0, 0, this.W, this.H); c.lineWidth = 1.5; c.lineJoin = 'round';
    this.tris.forEach((t, i) => {
      c.beginPath(); c.moveTo(...t[0]); c.lineTo(...t[1]); c.lineTo(...t[2]); c.closePath();
      c.fillStyle = P[i % P.length] + '55'; c.fill(); c.strokeStyle = P[i % P.length]; c.setLineDash([]); c.stroke();
    });
    this.lines.forEach(l => this.stroke(l, 'rgba(147,170,205,.75)'));
    if (this.preview) this.stroke(DemoBoard.line(...this.preview), '#ffb454', [6, 5]);
  }
  bind() {
    const cv = this.cv, pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * this.W, (e.clientY - r.top) / r.height * this.H]; };
    let start = null;
    cv.addEventListener('pointerdown', e => { this.stopAuto(); start = pos(e); cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (start) { this.preview = [start, pos(e)]; this.draw(); } });
    cv.addEventListener('pointerup', e => {
      if (!start) return;
      const end = pos(e), long = Math.hypot(end[0] - start[0], end[1] - start[1]) > 8;
      this.preview = null;
      if (long) { if (this.lines.length >= this.MAX) this.clear(); this.add(start, end); } // full board? the next drag starts fresh
      else this.draw();
      start = null;
    });
    cv.addEventListener('pointercancel', () => { start = null; this.preview = null; this.draw(); });
  }
}

class Welcome {
  static KEY = 'kobon.skipWelcome';
  static STEPS = [
    { t: 'What is a <span class="acc">Kobon triangle</span>?', demo: 'star', cap: 'Each colored shape is one clean triangle',
      h: `<p>Take a sheet of paper and draw <b>straight lines</b> across it. Where lines cross, little triangles appear.</p>
          <p>A <b>Kobon triangle</b> is a triangle that <b>no other line cuts through</b>. The puzzle: with <i>n</i> lines, how many clean triangles can you make?</p>
          <p>Watch the board: five lines, five clean triangles.</p>` },
    { t: 'Try it <span class="acc">yourself</span>', demo: 'clear', hint: 'Drag across the board to draw a line',
      h: `<p><b>Drag</b> on the board to draw a line. After 10 lines, your next drag starts a fresh board.</p>
          <p>Every clean triangle lights up and the counter goes up. Slice through one with a new line and it vanishes, so placement is everything.</p>
          <p>Challenge: <b>4 lines can make 2 clean triangles at most</b>. Can you find it? The board tells you when you hit the record.</p>` },
    { t: 'The <span class="acc">score</span>', demo: 'star', cap: 'The pentagram reaches the ceiling for 5 lines',
      h: `<p>Mathematicians proved a <b>ceiling</b> on how many triangles <i>n</i> lines can ever make. Nobody knows if every ceiling can be reached.</p>
          <div class="w-meter"><i></i></div>
          <p>For 5 lines the ceiling is 5 and the pentagram reaches it. The lab shows your <b>Triangles</b>, the <b>Upper bound</b>, the <b>Best known</b> record (up to 21 lines) and a bar for how close you are.</p>` },
    { t: 'Your <span class="acc">lab</span>', demo: 'star', cap: 'Your turn',
      h: `<p>Now it is your turn, with up to 2,000 lines.</p>
          <div class="w-chips">
            <div><b>Generate</b>draws a random arrangement. The same seed always repeats it.</div>
            <div><b>Search for best</b>tries seed after seed and keeps the winner.</div>
            <div><b>Scroll / pinch</b>zooms, <b>drag</b> pans, <b>F</b> fits the screen.</div>
            <div><b>Properties</b>below the canvas checks your result against the maths.</div>
          </div>` },
  ];

  constructor() {
    const $ = this.$ = id => document.getElementById(id);
    this.root = $('welcome'); this.i = 0;
    this.board = new DemoBoard($('wCv'), (n, t, msg) => this.onBoard(n, t, msg));
    $('wNext').addEventListener('click', () => this.i === Welcome.STEPS.length - 1 ? this.close() : this.go(this.i + 1));
    $('wBack').addEventListener('click', () => this.go(this.i - 1));
    $('wClose').addEventListener('click', () => this.close());
    $('help').addEventListener('click', () => this.open());
    $('wDots').addEventListener('click', e => { if (e.target.dataset.i) this.go(+e.target.dataset.i); });
    document.addEventListener('keydown', e => {
      if (this.root.hidden) return;
      if (e.key === 'Escape') this.close();
      else if (e.key === 'ArrowRight' && this.i < Welcome.STEPS.length - 1) this.go(this.i + 1);
      else if (e.key === 'ArrowLeft' && this.i > 0) this.go(this.i - 1);
    });
    let skip = false; try { skip = localStorage.getItem(Welcome.KEY) === '1'; } catch (_) {}
    skip ? (this.root.hidden = true) : this.open();
  }
  gate(on) { document.querySelectorAll('.top,.layout').forEach(n => { n.inert = on; }); document.body.classList.toggle('welcome-open', on); }
  open() { this.root.classList.remove('out'); this.root.hidden = false; this.gate(true); this.go(0); this.$('wNext').focus(); }
  close() {
    this.board.stopAuto();
    try { localStorage.setItem(Welcome.KEY, this.$('wSkip').checked ? '1' : '0'); } catch (_) {}
    this.root.classList.add('out');
    setTimeout(() => { this.root.hidden = true; this.gate(false); this.$('go').focus(); }, 300);
  }
  go(i) {
    const S = Welcome.STEPS, s = S[i], last = i === S.length - 1; this.i = i;
    this.$('wStep').innerHTML = `<div class="w-step"><h2>${s.t}</h2>${s.h}</div>`;
    this.$('wDots').innerHTML = S.map((_, k) => `<button type="button" data-i="${k}" class="${k === i ? 'on' : ''}" aria-label="Step ${k + 1}"></button>`).join('');
    this.$('wBack').hidden = i === 0;
    this.$('wCount').textContent = `${i + 1} / ${S.length}`;
    this.$('wNext').textContent = last ? 'Enter the lab' : 'Next';
    this.hint = s.hint || ''; this.cap = s.cap || '';
    if (s.demo === 'star') this.board.star(true); else if (s.demo === 'clear') this.board.clear();
    this.onBoard(this.board.lines.length, this.board.tris.length);
  }
  onBoard(n, t, msg) {
    this.$('wN').textContent = n;
    const b = this.$('wT'), changed = b.textContent !== String(t); b.textContent = t;
    if (changed) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
    const best = this.i === 1 && n >= 3 && CONFIG.REF[n] === t; // step 2 only: celebrate hitting the record
    this.$('wMsg').textContent = msg || (best ? `Best possible for ${n} lines!` : n === 0 ? this.hint : this.cap);
    this.$('wMsg').classList.toggle('win', !msg && best);
  }
}