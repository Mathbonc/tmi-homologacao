// Uma corrida: robô + missão + piloto. Mesmo código no site e nos scripts de treino.
import { World, DT, GOAL_R, MAX_STEPS, clearance, mulberry32 } from './physics.js';
import { WAREHOUSE, jitterStart } from './warehouse.js';
import { planPath, Follower } from './planner.js';

// pilot(world, target, state) -> { speed: Float64Array, steer: Float64Array }
export class Run {
  constructor(body, mission, seed, pilot, map = WAREHOUSE) {
    const rng = mulberry32(seed);
    this.mission = mission;
    this.start = jitterStart(mission.start, rng);
    this.path = planPath(map, this.start, mission.goal, body.colR);
    this.follower = new Follower(this.path);
    this.world = new World(body, map, this.start, mission.goal);
    this.pilot = pilot;
    this.pilotState = {};
    this.cmdHist = [];      // comandos por passo (para medir suavidade)
    this.target = this.follower.update(this.world);
  }

  step() {
    const w = this.world;
    if (w.done) return;
    this.target = this.follower.update(w);
    const act = this.pilot(w, this.target, this.pilotState);
    this.lastAct = act;
    this.cmdHist.push(Float64Array.from([...act.speed, ...act.steer]));
    w.step(act.speed, act.steer);
  }

  runToEnd() { while (!this.world.done) this.step(); return this.result(); }

  result() {
    const w = this.world;
    return {
      status: w.reached ? 'chegou' : w.collided ? 'bateu' : 'tempo',
      t: w.t * DT,
      smooth: smoothness(this.cmdHist)
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
