// Simulador 2D de robô com rodas. Corpo rígido; cada ponto de contato com o chão
// aplica atrito na direção de tração e na direção lateral, limitado pelo atrito máximo.

export const VMAX = 1.0;        // velocidade máxima da superfície da roda (m/s)
export const DT = 0.05;         // passo de controle (s)
const SUB = 4;                  // subpassos de física por passo de controle
const G = 9.81;
export const MU = 0.9;
export const MAX_STEER = 0.6;   // ângulo máximo da roda direcional (rad)
const STEER_RATE = 3.0;         // rad/s
export const GOAL_R = 0.25;     // chegou se o centro ficar a menos disto do destino
export const MAX_STEPS = 600;   // 30 s

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Distância de um ponto à superfície de um retângulo {x0, y0, x1, y1} (0 se estiver dentro).
export function distRect(x, y, r) {
  const cx = Math.max(r.x0, Math.min(r.x1, x)), cy = Math.max(r.y0, Math.min(r.y1, y));
  return Math.hypot(x - cx, y - cy);
}

// Distância livre do ponto até o obstáculo mais próximo (paredes, prateleiras, obstáculos).
export function clearance(map, x, y) {
  let d = Math.min(x, map.W - x, y, map.H - y);
  for (const s of map.shelves) d = Math.min(d, distRect(x, y, s));
  for (const o of map.obstacles || []) {
    d = Math.min(d, o.r !== undefined ? Math.hypot(x - o.x, y - o.y) - o.r : distRect(x, y, o));
  }
  return d;
}

export class World {
  // map: galpão (warehouse.js); start: {x, y, th}; goal: {x, y}
  constructor(body, map, start, goal) {
    this.body = body;
    this.map = map;
    this.start = start;
    this.goal = goal;
    this.reset();
  }

  reset() {
    const s = this.start;
    this.x = s.x; this.y = s.y; this.th = s.th;
    this.vx = 0; this.vy = 0; this.om = 0;
    this.w = new Float64Array(this.body.wheels.length);
    this.delta = new Float64Array(this.body.wheels.length);
    this.t = 0;
    this.done = false; this.reached = false; this.collided = false;
    this.trail = [[this.x, this.y]];
  }

  dist() { return Math.hypot(this.goal.x - this.x, this.goal.y - this.y); }

  // speed[i], steer[i] em [-1, 1]
  step(speed, steer) {
    if (this.done) return;
    const b = this.body, ws = b.wheels;
    const dts = DT / SUB;
    const N = b.mass * G / b.nContacts;          // carga por ponto de contato
    const mc = b.mass / b.nContacts;             // massa efetiva por contato
    const fmax = MU * N * dts;                   // impulso máximo de atrito por subpasso
    const motorK = Math.min(1, dts / b.tau);
    for (let k = 0; k < SUB; k++) {
      for (let i = 0; i < ws.length; i++) {
        const wh = ws[i];
        if (wh.driven) this.w[i] += (speed[i] * VMAX - this.w[i]) * motorK;
        if (wh.steer) {
          const tgt = steer[i] * MAX_STEER;
          const dd = Math.max(-STEER_RATE * dts, Math.min(STEER_RATE * dts, tgt - this.delta[i]));
          this.delta[i] += dd;
        }
      }
      const c = Math.cos(this.th), s = Math.sin(this.th);
      let Px = 0, Py = 0, Pt = 0;
      for (let i = 0; i < ws.length; i++) {
        const wh = ws[i];
        const a = this.th + wh.ang + this.delta[i] + wh.phi;
        const ex = Math.cos(a), ey = Math.sin(a);   // direção de tração
        const nx = -ey, ny = ex;                    // direção lateral
        for (const p of wh.contacts) {
          const rx = c * p.x - s * p.y, ry = s * p.x + c * p.y;
          const cvx = this.vx - this.om * ry, cvy = this.vy + this.om * rx;
          const ve = cvx * ex + cvy * ey, vn = cvx * nx + cvy * ny;
          let pe, pn;
          if (wh.caster) {
            pe = -0.03 * mc * ve; pn = -0.03 * mc * vn;
          } else {
            pe = wh.driven ? 0.5 * mc * (wh.gain * this.w[i] - ve) : -0.03 * mc * ve;
            pn = wh.latFree ? -0.02 * mc * vn : -0.8 * mc * vn;
          }
          // círculo de atrito
          const mag = Math.hypot(pe, pn);
          if (mag > fmax) { pe *= fmax / mag; pn *= fmax / mag; }
          const fx = pe * ex + pn * nx, fy = pe * ey + pn * ny;
          Px += fx; Py += fy; Pt += rx * fy - ry * fx;
        }
      }
      this.vx += Px / b.mass; this.vy += Py / b.mass; this.om += Pt / b.inertia;
      this.x += this.vx * dts; this.y += this.vy * dts; this.th += this.om * dts;
    }
    this.t++;
    if ((this.t & 1) === 0) this.trail.push([this.x, this.y]);
    if (clearance(this.map, this.x, this.y) < b.colR) this.collided = true;
    if (this.dist() < GOAL_R) this.reached = true;
    if (this.collided || this.reached || this.t >= MAX_STEPS) this.done = true;
  }

  // velocidade no referencial do robô: [frente, lado, giro]
  localVel() {
    const c = Math.cos(this.th), s = Math.sin(this.th);
    return [c * this.vx + s * this.vy, -s * this.vx + c * this.vy, this.om];
  }
}
