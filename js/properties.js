'use strict';
/* Turns a result into a list of checks ("properties") and renders them. */
class Properties {
  constructor(root) { this.root = root; }

  compute(r) {
    const n = r.n, T = r.count, S = r.segments, tamura = Bounds.tamura(n), bbl = Bounds.bbl(n), upper = Bounds.upper(n);
    const tight = upper < tamura, ref = CONFIG.REF[n], perfect = T > 0 && r.unused === 0 && r.shared === 0, f = x => x.toLocaleString();
    return [
      { id: 'P1', name: 'Bounded segments per line', formula: `at most k − 2 = ${f(n - 2)}`, value: `max ${f(n - 2)}`, ok: true },
      { id: 'P2', name: 'Total bounded segments', formula: `S ≤ k(k − 2) = ${f(n * (n - 2))}`, value: `S = ${f(S)}`, ok: S <= n * (n - 2) },
      { id: 'P3', name: 'Segment-counting principle', formula: '3K ≤ S (each triangle uses 3 segments)', value: `${f(3 * T)} ≤ ${f(S)}`, ok: 3 * T <= S },
      { id: 'T4', name: 'Tamura upper bound', formula: `K ≤ ⌊k(k − 2)/3⌋ = ${f(tamura)}`, value: `${f(T)} / ${f(tamura)}`, ok: T <= tamura },
      { id: 'BBL', name: 'Bartholdi–Blanc–Loisel bound', formula: `K ≤ ⌊k(3k − 7)/9⌋ = ${f(bbl)}`, value: `${f(T)} / ${f(bbl)}`, ok: T <= bbl },
      { id: 'C5', name: 'Reaches the Tamura bound', formula: 'K = ⌊k(k − 2)/3⌋', value: T === tamura ? 'yes' : `no (−${f(tamura - T)})`, ok: T === tamura ? true : null },
      { id: 'T7', name: 'Tighter bound (k ≡ 0 or 2 mod 6)', formula: tight ? `K ≤ ⌊k(k − 2)/3⌋ − 1 = ${f(upper)}` : `k ≡ ${n % 6} (mod 6), not applicable`, value: tight ? `${f(T)} / ${f(upper)}` : 'n/a', ok: tight ? T <= upper : null },
      { id: 'P6', name: 'Parity of k', formula: 'a perfect configuration needs k odd', value: n % 2 ? 'k odd' : 'k even', ok: n % 2 ? true : null },
      { id: 'D4', name: 'Perfect configuration', formula: 'every segment is an edge of exactly one triangle', value: perfect ? 'yes' : `${f(r.unused)} unused, ${f(r.shared)} shared`, ok: perfect ? true : null },
      { id: 'EFF', name: 'Share of upper bound', formula: ref !== undefined ? `best known for k = ${n} is ${ref}` : 'no best-known value for this k', value: `${upper > 0 ? (T / upper * 100).toFixed(1) : 0}%`, ok: ref !== undefined ? (T >= ref ? true : null) : null },
    ];
  }

  render(result) {
    this.root.replaceChildren(...this.compute(result).map(r => {
      const row = document.createElement('div'); row.className = 'prop';
      const name = document.createElement('div'); name.className = 'name';
      const id = document.createElement('i'); id.textContent = r.id; name.append(id, r.name);
      const val = document.createElement('div'); val.className = 'value'; val.append(r.value);
      if (r.ok !== null) { const p = document.createElement('span'); p.className = 'pill ' + (r.ok ? 'ok' : 'no'); p.textContent = r.ok ? 'holds' : 'violated'; val.append(p); }
      const fm = document.createElement('div'); fm.className = 'formula'; fm.textContent = r.formula;
      row.append(name, val, fm); return row;
    }));
  }
}