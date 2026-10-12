'use strict';
/* UI controller: wires inputs, Solver, Renderer and Properties together. */

/* Digits-only field with a hard cap. A text input (not type=number) so "e", "+", "-" and
   1e+52 can never get in, and maxlength means the box can never grow with its content. */
class NumberField {
  constructor(input, min, max, notify) {
    Object.assign(this, { input, min, max, notify });
    input.maxLength = String(max).length;
    input.addEventListener('keydown', e => { if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); });
    input.addEventListener('input', () => this.clean());
  }
  get value() { return parseInt(this.input.value, 10) || 0; }
  set value(v) { this.input.value = v; }
  clean() { // also handles paste
    let d = this.input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, this.input.maxLength);
    if (d && +d > this.max) { d = String(this.max); this.notify(`Maximum is ${this.max.toLocaleString()}.`); }
    this.input.value = d;
  }
  settle() { if (this.input.value === '' || this.value < this.min) this.input.value = this.min; }
}

class App {
  constructor() {
    const $ = this.$ = id => document.getElementById(id), toast = m => this.toast(m);
    this.mode = 'idle'; // 'idle' | 'run' | 'search'
    this.renderer = new Renderer($('cv'));
    this.props = new Properties($('props'));
    this.solver = new Solver({ onMessage: d => this.onMessage(d), onError: m => { this.toast('Worker failed: ' + m); this.setMode('idle'); } });
    this.f = {
      n: new NumberField($('numLines'), 3, CONFIG.MAX_N, toast), b: new NumberField($('bRange'), 1, CONFIG.MAX_SPREAD, toast),
      x: new NumberField($('xSpace'), 1, CONFIG.MAX_SPREAD, toast), seed: new NumberField($('seed'), 0, CONFIG.MAX_SEED, toast),
    };
    this.bind(); this.syncSpread(); this.generate();
    this.welcome = new Welcome();
  }

  toast(msg) {
    const t = this.$('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }
  setMode(m) {
    const $ = this.$; this.mode = m;
    $('go').textContent = m === 'run' ? 'Cancel' : 'Generate';
    $('search').textContent = m === 'search' ? 'Stop searching' : 'Search for best';
    $('search').classList.toggle('running', m === 'search');
    $('go').disabled = m === 'search'; $('busy').hidden = m !== 'run';
    if (m !== 'search') $('searchStatus').textContent = '';
  }
  syncSpread() {
    const $ = this.$, f = this.f, n = Math.max(3, f.n.value), auto = $('autoSpread').checked;
    if (auto) { f.b.value = Math.round(n * 0.5) || 1; f.x.value = Math.round(n * 0.6) || 1; }
    $('bRange').disabled = $('xSpace').disabled = auto;
    $('numRange').value = Math.min(n, +$('numRange').max);
    const hint = $('nHint'); hint.hidden = n < 400; hint.classList.toggle('warn', n >= 400);
    hint.textContent = n >= 400 ? `${n.toLocaleString()} lines makes ${(n * (n - 1) / 2).toLocaleString()} intersections. It runs in the background but may take a few seconds.` : '';
  }
  readParams() {
    Object.values(this.f).forEach(f => f.settle()); this.syncSpread();
    const f = this.f; return { n: f.n.value, b: f.b.value, x: f.x.value, seed: f.seed.value };
  }

  showResult(r) {
    const $ = this.$, bound = Bounds.upper(r.n);
    this.renderer.setData({ lines: r.lines, tris: r.tris, count: r.count });
    $('s-tri').textContent = r.count.toLocaleString();
    $('s-bound').textContent = bound.toLocaleString();
    $('s-ref').textContent = CONFIG.REF[r.n] ?? 'n/a';
    $('s-inter').textContent = r.inter.toLocaleString();
    $('s-time').textContent = r.ms < 1000 ? Math.round(r.ms) + ' ms' : (r.ms / 1000).toFixed(1) + ' s';
    $('meterFill').style.width = Math.min(100, bound > 0 ? r.count / bound * 100 : 0) + '%';
    this.f.seed.value = r.seed; $('empty').hidden = true;
    this.props.render(r);
  }
  onMessage(d) {
    if (d.type === 'result') { this.showResult(d); if (this.mode === 'run') this.setMode('idle'); }
    else if (d.type === 'progress') this.$('searchStatus').textContent = `Tried ${d.tries.toLocaleString()} drawings. Best has ${d.best} triangles.`;
    else if (d.type === 'done') this.setMode('idle');
    else if (d.type === 'error') { this.toast('Generation failed: ' + d.message); this.setMode('idle'); }
  }

  generate() {
    if (this.mode === 'search') return this.toast('Stop the search first.');
    if (this.mode === 'run') { this.solver.cancel(); this.setMode('idle'); return this.toast('Cancelled.'); }
    const p = this.readParams();
    this.setMode('run'); this.$('busyText').textContent = `Building ${p.n.toLocaleString()} lines…`;
    this.solver.run(p);
  }
  toggleSearch() {
    if (this.mode === 'run') return this.toast('Wait for the current drawing or cancel it first.');
    if (this.mode === 'search') {
      this.solver.cancel(); this.setMode('idle'); this.$('searchStatus').textContent = 'Stopped. The best drawing found is shown.'; return;
    }
    const p = this.readParams();
    this.setMode('search'); this.$('searchStatus').textContent = 'Starting search…';
    this.solver.search(p);
  }

  bind() {
    const $ = this.$, f = this.f, r = this.renderer;
    f.n.input.addEventListener('input', () => this.syncSpread());
    Object.values(f).forEach(x => x.input.addEventListener('blur', () => { x.settle(); this.syncSpread(); }));
    $('numRange').addEventListener('input', e => { f.n.value = e.target.value; this.syncSpread(); });
    $('autoSpread').addEventListener('change', () => this.syncSpread());
    $('presets').addEventListener('click', e => {
      if (!e.target.dataset.n) return;
      if (this.mode === 'search') return this.toast('Stop the search first.');
      f.n.value = e.target.dataset.n; this.syncSpread(); if (this.mode === 'idle') this.generate();
    });
    $('dice').addEventListener('click', () => { f.seed.value = Math.floor(Math.random() * 1e6); });
    $('go').addEventListener('click', () => this.generate());
    $('search').addEventListener('click', () => this.toggleSearch());
    $('showLines').addEventListener('change', e => { r.show.lines = e.target.checked; r.draw(); });
    $('showTris').addEventListener('change', e => { r.show.tris = e.target.checked; r.draw(); });
    $('zin').addEventListener('click', () => r.zoomCenter(1.4));
    $('zout').addEventListener('click', () => r.zoomCenter(1 / 1.4));
    $('fit').addEventListener('click', () => r.fit());
    $('png').addEventListener('click', () => r.data ? r.exportPNG() : this.toast('Generate something first.'));
    document.addEventListener('keydown', e => {
      if (document.body.classList.contains('welcome-open')) return; // the intro owns the keyboard
      const typing = e.target.matches('input[type=text]');
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { if (this.mode === 'idle') this.generate(); }
      else if (typing) return;
      else if (e.key === 'f') r.fit();
      else if (e.key === '+' || e.key === '=') r.zoomCenter(1.4);
      else if (e.key === '-') r.zoomCenter(1 / 1.4);
    });
  }
}

new App();