'use strict';
/* Owns the Web Worker. The rest of the app only calls run / search / cancel. */
class Solver {
  constructor({ onMessage, onError }) {
    this.onMessage = onMessage;
    this.onError = onError;
    this.worker = null; // created on first use, so a cancel never spawns one that isn't needed
    // Built once and kept. Revoking it right after `new Worker` can fail in some browsers,
    // because the worker loads its script asynchronously.
    this.url = URL.createObjectURL(new Blob([`(${workerCore})()`], { type: 'text/javascript' }));
  }

  spawn() {
    const w = new Worker(this.url);
    // `this.worker === w` drops late messages from a worker that was already cancelled
    w.onmessage = e => { if (this.worker === w) this.onMessage(e.data); };
    w.onerror = e => { if (this.worker === w) this.onError(e.message || 'Unknown worker error'); };
    return (this.worker = w);
  }

  send(msg) {
    try { (this.worker || this.spawn()).postMessage(msg); }
    catch (err) { this.onError(err.message); } // e.g. browser refuses blob workers: shows a real error instead of silently doing nothing
  }

  run(params) { this.send({ type: 'run', ...params }); }
  search(params) { this.send({ type: 'search', ...params }); }

  cancel() { // instant, even in the middle of a long build
    if (this.worker) { this.worker.terminate(); this.worker = null; }
  }
}