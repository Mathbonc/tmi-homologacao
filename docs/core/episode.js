// Uma corrida: robô + missão + piloto. Mesmo código no site e nos scripts de treino.
import { World, DT, GOAL_R, MAX_STEPS, clearance, mulberry32 } from './physics.js';
import { WAREHOUSE, jitterStart } from './warehouse.js';
import { planPath, Follower } from './planner.js';
import { gravidadeDe } from './licenca.js';

const DEG = Math.PI / 180;
export const PASSO_EMPURRAO = 60;      // 3 s

// Imprevisibilidades (CLAUDE.md 3.4). Devolve null se nenhuma está ligada: aí a corrida é
// exatamente a de antes. O obstáculo surgindo fica para a etapa 4.
export function normalizarPerturbacoes(opts) {
  if (!opts) return null;
  if (opts.obstaculo) throw new Error('obstáculo surgindo ainda não implementado (etapa 4)');
  const p = { giro: +opts.giro || 0, empurrao: +opts.empurrao || 0, ruido: +opts.ruido || 0, atraso: +opts.atraso || 0 };
  return p.giro || p.empurrao || p.ruido || p.atraso ? p : null;
}

// pilot(world, target, state) -> { speed: Float64Array, steer: Float64Array }
// opts (opcional): { giro (graus), empurrao (m/s), ruido (graus), atraso (s) }
export class Run {
  constructor(body, mission, seed, pilot, map = WAREHOUSE, opts = null) {
    const rng = mulberry32(seed);
    this.mission = mission;
    this.seed = seed;
    const p = this.pert = normalizarPerturbacoes(opts);
    let start0 = mission.start;
    if (p) {
      // gerador próprio das perturbações: não mexe na sequência da variação de saída
      const prng = this.prng = mulberry32(seed * 7 + 3);
      const uGiro = prng() * 2 - 1;
      this.ladoEmpurrao = prng() < 0.5 ? -1 : 1;
      if (p.giro) start0 = { ...start0, th: start0.th + uGiro * p.giro * DEG };
      this.filaAtraso = [];
      const nAtraso = Math.round(p.atraso / DT);
      const n = body.wheels.length;
      for (let k = 0; k < nAtraso; k++) this.filaAtraso.push({ speed: new Float64Array(n), steer: new Float64Array(n) });
      this.empurrao = null;   // { x, y, vx, vy } quando acontecer (para o desenho)
    }
    this.start = jitterStart(start0, rng);
    this.path = planPath(map, this.start, mission.goal, body.colR);
    this.follower = new Follower(this.path);
    this.world = new World(body, map, this.start, mission.goal);
    this.pilot = pilot;
    this.pilotState = {};
    this.cmdHist = [];      // comandos por passo (para medir suavidade)
    this.target = this.follower.update(this.world);
    this.seen = this.target;  // o ponto-alvo que o piloto recebeu (difere do real com ruído)
  }

  step() {
    const w = this.world;
    if (w.done) return;
    const p = this.pert;
    if (p && p.empurrao && w.t === PASSO_EMPURRAO) this.empurrar(p.empurrao);
    this.target = this.follower.update(w);
    const seen = this.seen = p && p.ruido ? this.comRuido(this.target, p.ruido) : this.target;
    const act = this.pilot(w, seen, this.pilotState);
    this.lastAct = act;
    this.cmdHist.push(Float64Array.from([...act.speed, ...act.steer]));
    let exec = act;
    if (p && this.filaAtraso.length) { this.filaAtraso.push(act); exec = this.filaAtraso.shift(); }
    this.execAct = exec;
    w.step(exec.speed, exec.steer);
  }

  // empurrão lateral + giro, no lado sorteado
  empurrar(v) {
    const w = this.world, s = this.ladoEmpurrao;
    const lx = -Math.sin(w.th), ly = Math.cos(w.th);
    w.vx += s * v * lx; w.vy += s * v * ly;
    w.om += s * 1.5 * (v / 0.6);
    this.empurrao = { x: w.x, y: w.y, vx: s * v * lx, vy: s * v * ly, t: w.t };
  }

  // gira a direção do ponto-alvo por U(-ruido, +ruido) graus
  comRuido(tg, ruido) {
    const a = (this.prng() * 2 - 1) * ruido * DEG, c = Math.cos(a), s = Math.sin(a);
    const lx = c * tg.lx - s * tg.ly, ly = s * tg.lx + c * tg.ly;
    const w = this.world, cw = Math.cos(w.th), sw = Math.sin(w.th);
    return {
      ...tg, lx, ly,
      tx: c * tg.tx - s * tg.ty, ty: s * tg.tx + c * tg.ty,
      alpha: Math.atan2(Math.sin(tg.alpha + a), Math.cos(tg.alpha + a)),
      wx: w.x + cw * lx - sw * ly, wy: w.y + sw * lx + cw * ly
    };
  }

  runToEnd() { while (!this.world.done) this.step(); return this.result(); }

  result() {
    const w = this.world;
    const status = w.reached ? 'chegou' : w.collided ? 'bateu' : 'tempo';
    return {
      status,
      t: w.t * DT,
      smooth: smoothness(this.cmdHist),
      impact: w.impact,
      minClear: w.minClear,
      gravidade: gravidadeDe(status, w.impact, w.minClear)
    };
  }
}

// Variação média do comando entre passos consecutivos (menor = mais suave).
export function smoothness(hist) {
  if (hist.length < 2) return 0;
  let sum = 0, n = 0;
  for (let k = 1; k < hist.length; k++) {
    const a = hist[k], b = hist[k - 1];
    for (let i = 0; i < a.length; i++) { sum += Math.abs(a[i] - b[i]); n++; }
  }
  return n ? sum / n : 0;
}

// Robô ideal: segue o ponto-alvo sem física (para validar o galpão e as rotas).
export class IdealRun {
  constructor(colR, mission, seed, map = WAREHOUSE) {
    const rng = mulberry32(seed);
    this.mission = mission;
    this.map = map;
    this.colR = colR;
    this.start = jitterStart(mission.start, rng);
    this.path = planPath(map, this.start, mission.goal, colR);
    this.follower = new Follower(this.path);
    this.world = { ...this.start, t: 0, done: false, reached: false, collided: false,
                   trail: [[this.start.x, this.start.y]], minClear: Infinity };
    this.target = this.follower.update(this.world);
  }

  step() {
    const w = this.world;
    if (w.done) return;
    const tg = this.target = this.follower.update(w);
    const c = Math.cos(w.th), s = Math.sin(w.th);
    const dx = c * tg.lx - s * tg.ly, dy = s * tg.lx + c * tg.ly;
    const d = Math.hypot(dx, dy) || 1e-9;
    const v = Math.max(0.15, tg.vel);
    w.x += dx / d * v * DT; w.y += dy / d * v * DT; w.th = Math.atan2(dy, dx);
    w.t++;
    if ((w.t & 1) === 0) w.trail.push([w.x, w.y]);
    const cl = clearance(this.map, w.x, w.y);
    w.minClear = Math.min(w.minClear, cl - this.colR);
    if (cl < this.colR) w.collided = true;
    if (Math.hypot(this.mission.goal.x - w.x, this.mission.goal.y - w.y) < GOAL_R) w.reached = true;
    if (w.collided || w.reached || w.t >= MAX_STEPS) w.done = true;
  }

  runToEnd() {
    while (!this.world.done) this.step();
    const w = this.world;
    return { status: w.reached ? 'chegou' : w.collided ? 'bateu' : 'tempo', t: w.t * DT, minClear: w.minClear };
  }
}
