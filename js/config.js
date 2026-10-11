'use strict';
/* Shared constants and the pure maths helpers. No DOM here. */
const CONFIG = {
  VIEW_W: 1000, VIEW_H: 700, PAD: 30,
  MAX_N: 2000, MAX_SPREAD: 1000000, MAX_SEED: 9999999,
  LOD_TRIANGLES: 20000,   // above this, triangle fills are skipped while panning
  MAX_DPR: 2,             // cap canvas resolution: 3x phones paint 2.25x more pixels for no visible gain
  PALETTE: ['#ffb454', '#5eead4', '#f472b6', '#93c5fd', '#c4b5fd'],
  REF: { 3: 1, 4: 2, 5: 5, 6: 7, 7: 11, 8: 15, 9: 21, 10: 25, 11: 32, 12: 38, 13: 47, 14: 53, 15: 65, 16: 72, 17: 85, 18: 93, 19: 104, 20: 115, 21: 130 },
};

const Bounds = {
  tamura: n => Math.floor(n * (n - 2) / 3),
  bbl: n => Math.floor(n * (3 * n - 7) / 9),            // Bartholdi–Blanc–Loisel
  upper(n) {                                             // Tamura + Clément–Bader correction
    const b = this.tamura(n);
    return (n % 6 === 0 || n % 6 === 2) ? b - 1 : b;
  },
};