// Uma corrida: robô + missão + piloto. Mesmo código no site e nos scripts de treino.
import { World, DT, GOAL_R, MAX_STEPS, clearance, mulberry32 } from './physics.js';
import { WAREHOUSE, jitterStart } from './warehouse.js';
import { planPath, Follower } from './planner.js';
import { gravidadeDe } from './licenca.js';

const DEG = Math.PI / 180;
export const PASSO_EMPURRAO = 60;      // 3 s
export const PASSO_OBSTACULO = 80;     // 4 s
export const OBSTACULO_R = 0.25;       // raio do obstáculo que surge (m)
export const OBSTACULO_DIST = 1.2;     // a que distância à frente, medida na rota (m)

// Imprevisibilidades (CLAUDE.md 3.4). Devolve null se nenhuma está ligada: aí a corrida é
// exatamente a de antes.
export function normalizarPerturbacoes(opts) {
  if (!opts) return null;
  const p = { giro: +opts.giro || 0, empurrao: +opts.empurrao || 0, ruido: +opts.ruido || 0, atraso: +opts.atraso || 0,
              obstaculo: !!opts.obstaculo };
  return p.giro || p.empurrao || p.ruido || p.atraso || p.obstaculo ? p : null;
}

// pilot(world, target, state) -> { speed: Float64Array, steer: Float64Array }
// opts (opcional): { giro (graus), empurrao (m/s), ruido (graus), atraso (s), obstaculo (bool) }
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
      if (p.giro) { start0 = { ...start0, th: start0.th + uGiro * p.giro * DEG }; this.giroAplicado = uGiro * p.giro; }
      this.filaAtraso = [];
      const nAtraso = Math.round(p.atraso / DT);
      const n = body.wheels.length;
      for (let k = 0; k < nAtraso; k++) this.filaAtraso.push({ speed: new Float64Array(n), steer: new Float64Array(n) });
      this.empurrao = null;   // { x, y, vx, vy } quando acontecer (para o desenho)
      this.obstaculo = null;  // { x, y, r, t } quando surgir; { semEspaco: true } se não coube
      this.bloqueado = false; // obstáculo sem rota possível: a corrida para (limite, não defeito)
    }
    this.start = jitterStart(start0, rng);
    this.path = this.pathOriginal = planPath(map, this.start, mission.goal, body.colR);
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
    if (p && p.obstaculo && w.t === PASSO_OBSTACULO) { this.surgirObstaculo(); if (w.done) return; }
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

  // Um obstáculo circular surge na rota, ~1,2 m à frente (medido na rota, e longe o bastante do
  // robô em linha reta). O mapa da corrida passa a ter o obstáculo (vale para colisão), a rota é
  // replanejada do ponto atual e o seguidor é trocado. O piloto não vê o mapa: só percebe a
  // mudança pelo ponto-alvo, como no resto da corrida. Se o robô já está perto do destino, o
  // obstáculo não surge. Sem rota possível, a corrida para (bloqueado).
  surgirObstaculo() {
    const w = this.world, f = this.follower, body = w.body, R = OBSTACULO_R;
    const s0 = f.path.s[f.idx], fim = f.path.length - (R + 0.45);
    let pos = null;
    for (let sq = s0 + OBSTACULO_DIST; sq <= fim; sq += 0.1) {
      const [x, y] = f.pointAt(sq);
      if (Math.hypot(x - w.x, y - w.y) >= R + body.colR + 0.5) { pos = [x, y]; break; }
    }
    if (!pos) { this.obstaculo = { semEspaco: true, t: w.t }; return; }
    const map = { ...w.map, obstacles: [...(w.map.obstacles || []), { x: pos[0], y: pos[1], r: R }] };
    w.map = map;
    this.obstaculo = { x: pos[0], y: pos[1], r: R, t: w.t };
    const novo = planPath(map, { x: w.x, y: w.y, th: w.th }, this.mission.goal, body.colR);
    if (!novo) { this.bloqueado = true; w.done = true; return; }
    this.path = novo;
    this.follower = new Follower(novo);
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
    // bloqueado (obstáculo sem rota) conta como não chegou, sem batida: 'travou'
    const status = w.reached ? 'chegou' : w.collided ? 'bateu' : 'tempo';
    return {
      ...(this.bloqueado ? { bloqueado: true } : {}),
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
