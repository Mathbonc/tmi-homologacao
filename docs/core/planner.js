// Planejador de rota (tecnologia madura, não é o que se testa).
// A* numa grade de 5 cm com obstáculos inflados pelo raio do robô + folga, custo extra perto
// das prateleiras (a rota prefere o meio do corredor), encurtamento por linha de visada e
// seguidor pure pursuit.
import { clearance } from './physics.js';

export const RES = 0.05;
export const MARGIN = 0.08;      // folga além do raio do robô
export const LOOKAHEAD = 0.5;    // ponto-alvo à frente na rota (m)
export const VNOM = 0.7;         // velocidade desejada em reta (m/s)

// Campo de distâncias livres por mapa (calculado uma vez).
const fields = new WeakMap();
function field(map) {
  let f = fields.get(map);
  if (f) return f;
  const nx = Math.round(map.W / RES), ny = Math.round(map.H / RES);
  const d = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    d[j * nx + i] = clearance(map, (i + 0.5) * RES, (j + 0.5) * RES);
  }
  f = { nx, ny, d };
  fields.set(map, f);
  return f;
}

const cellOf = (f, x, y) => [
  Math.max(0, Math.min(f.nx - 1, Math.floor(x / RES))),
  Math.max(0, Math.min(f.ny - 1, Math.floor(y / RES)))
];

// Fila de prioridade mínima simples.
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1; if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop();
    const n = k.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

// Rota de start a goal para um robô de raio colR. Devolve lista de pontos [x, y] espaçados ~5 cm.
export function planPath(map, start, goal, colR) {
  const f = field(map), { nx, ny, d } = f;
  const r = colR + MARGIN;
  const free = idx => d[idx] >= r;
  // custo extra perto de obstáculos: empurra a rota para o meio do corredor
  const cost = idx => 1 + 3 * Math.max(0, 0.7 - d[idx]) / 0.7;
  let [si, sj] = cellOf(f, start.x, start.y);
  let [gi, gj] = cellOf(f, goal.x, goal.y);
  const sIdx = nearestFree(f, si, sj, free), gIdx = nearestFree(f, gi, gj, free);
  gi = gIdx % nx; gj = (gIdx / nx) | 0;
  const g = new Float32Array(nx * ny).fill(Infinity);
  const came = new Int32Array(nx * ny).fill(-1);
  const closed = new Uint8Array(nx * ny);
  const h = idx => {
    const dx = Math.abs(idx % nx - gi), dy = Math.abs(((idx / nx) | 0) - gj);
    return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy));
  };
  const heap = new Heap();
  g[sIdx] = 0; heap.push(h(sIdx), sIdx);
  const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === gIdx) break;
    const ci = cur % nx, cj = (cur / nx) | 0;
    for (const [di, dj, len] of nb) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      const n = nj * nx + ni;
      if (closed[n] || !free(n)) continue;
      const ng = g[cur] + len * cost(n);
      if (ng < g[n]) { g[n] = ng; came[n] = cur; heap.push(ng + h(n), n); }
    }
  }
  if (came[gIdx] < 0 && gIdx !== sIdx) return null;
  const cells = [];
  for (let c = gIdx; c >= 0; c = came[c]) { cells.push(c); if (c === sIdx) break; }
  cells.reverse();
  const pts = cells.map(c => [(c % nx + 0.5) * RES, (((c / nx) | 0) + 0.5) * RES]);
  pts[0] = [start.x, start.y];
  pts[pts.length - 1] = [goal.x, goal.y];
  const clr = cells.map(c => d[c]);
  return densify(shortcut(map, pts, clr, r));
}

function nearestFree(f, i0, j0, free) {
  for (let rad = 0; rad < 40; rad++) {
    for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== rad) continue;
      const i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= f.nx || j >= f.ny) continue;
      if (free(j * f.nx + i)) return j * f.nx + i;
    }
  }
  return j0 * f.nx + i0;
}

// Encurtamento por linha de visada. Um atalho só vale se, ao longo dele, a folga nunca ficar
// menor que a do trecho original (ou que r + 15 cm, o que for menor): em espaço aberto a rota
// vira reta, mas não passa a raspar quinas que o A* evitava.
function shortcut(map, pts, clr, r) {
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let best = i + 1;
    let runMin = clr[i];
    const mins = [];
    for (let j = i + 1; j < pts.length; j++) { runMin = Math.min(runMin, clr[j]); mins[j] = runMin; }
    for (let j = pts.length - 1; j > i + 1; j--) {
      const need = Math.min(r + 0.15, mins[j]) - 1e-4;
      if (segmentClear(map, pts[i], pts[j], need)) { best = j; break; }
    }
    out.push(pts[best]);
    i = best;
  }
  return out;
}

function segmentClear(map, a, b, need) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(L / 0.025));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    if (clearance(map, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) < need) return false;
  }
  return true;
}

function densify(wp) {
  const out = [wp[0]];
  for (let k = 1; k < wp.length; k++) {
    const [ax, ay] = wp[k - 1], [bx, by] = wp[k];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / RES));
    for (let q = 1; q <= n; q++) out.push([ax + (bx - ax) * q / n, ay + (by - ay) * q / n]);
  }
  const s = [0];
  for (let k = 1; k < out.length; k++) s.push(s[k - 1] + Math.hypot(out[k][0] - out[k - 1][0], out[k][1] - out[k - 1][1]));
  return { pts: out, s, waypoints: wp, length: s[s.length - 1] };
}

// Seguidor: guarda o progresso na rota e devolve o ponto-alvo no referencial do robô.
export class Follower {
  constructor(path) { this.path = path; this.idx = 0; }

  // pose: {x, y, th}. Devolve {tx, ty, alpha, vel, lx, ly, wx, wy, remaining}
  update(pose) {
    const { pts, s, length } = this.path;
    // ponto mais próximo, procurando só para frente (até 2 m)
    let best = this.idx, bd = Infinity;
    for (let k = this.idx; k < pts.length && s[k] - s[this.idx] < 2.0; k++) {
      const dd = (pts[k][0] - pose.x) ** 2 + (pts[k][1] - pose.y) ** 2;
      if (dd < bd) { bd = dd; best = k; }
    }
    this.idx = best;
    const sNow = s[best];
    const [wx, wy] = this.pointAt(sNow + LOOKAHEAD);
    const dx = wx - pose.x, dy = wy - pose.y;
    const c = Math.cos(pose.th), sn = Math.sin(pose.th);
    const lx = c * dx + sn * dy, ly = -sn * dx + c * dy;
    const dl = Math.hypot(lx, ly) || 1e-9;
    const remaining = length - sNow;
    // velocidade desejada: menor perto do destino e antes de curvas fechadas
    const turn = this.turnAhead(sNow);
    let vel = VNOM * Math.min(1, Math.max(0.3, remaining / 0.8)) * (1 - 0.55 * Math.min(1, turn / (Math.PI / 2)));
    return { tx: lx / dl, ty: ly / dl, alpha: Math.atan2(ly, lx), vel, lx, ly, wx, wy, remaining };
  }

  pointAt(sq) {
    const { pts, s } = this.path;
    if (sq >= s[s.length - 1]) return pts[pts.length - 1];
    let k = this.idx;
    while (k < s.length - 1 && s[k + 1] < sq) k++;
    const t = (sq - s[k]) / ((s[k + 1] - s[k]) || 1e-9);
    return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t];
  }

  // quanto a rota vira no próximo metro (rad)
  turnAhead(sNow) {
    const p0 = this.pointAt(sNow), p1 = this.pointAt(sNow + 0.35);
    const p2 = this.pointAt(sNow + 0.65), p3 = this.pointAt(sNow + 1.0);
    const a1 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    const a2 = Math.atan2(p3[1] - p2[1], p3[0] - p2[0]);
    if (p1[0] === p0[0] && p1[1] === p0[1]) return 0;
    if (p3[0] === p2[0] && p3[1] === p2[1]) return 0;
    return Math.abs(wrap(a2 - a1));
  }
}

export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
