// Gera exemplos para os cérebros imitarem: roda o especialista em muitos corpos sorteados e
// missões, executa a ação com ruído e grava a ação limpa (para o cérebro aprender a se recuperar).
//   node train/gerar_dados.mjs [--episodios 1600] [--semente 7]
// Saída: train/dados/amostras.f32 + train/dados/meta.json
import fs from 'node:fs';
import { FLEET, buildBody, makeWheel, finishBody, bodyClass } from '../docs/core/parts.js';
import { MISSIONS, WAREHOUSE } from '../docs/core/warehouse.js';
import { World, mulberry32, clearance } from '../docs/core/physics.js';
import { planPath, Follower } from '../docs/core/planner.js';
import { expertAction } from '../docs/core/expert.js';
import { wheelRaw, bodyRaw, stateRaw, N_WHEEL_RAW, N_STATE_RAW, N_BODY_RAW } from '../docs/core/brain.js';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map(s => s.trim().split(/\s+/)).map(([k, v]) => [k, v ?? true]));
const EPISODES = +(args.episodios || 1600);
const rng = mulberry32(+(args.semente || 7));
const U = (a, b) => a + (b - a) * rng();
const pick = arr => arr[Math.floor(rng() * arr.length)];

const CLASSES = ['diferencial', 'carro', 'puxado', 'holonomico'];

// ---- corpos de treino: a frota com variações + montagens sorteadas de cada classe ----
function proc(wheels, massBase) {
  const ext = Math.max(...wheels.map(w => Math.hypot(w.x, w.y) + (w.len || 0) / 2));
  const colR = Math.max(0.22, ext + 0.08);
  const m = massBase * U(0.8, 1.2);
  return finishBody(wheels, m, 0.5 * m * colR * colR * 0.8, colR, U(0.07, 0.15), null);
}

function randomBody(cls) {
  if (rng() < 0.35) {
    const opts = FLEET.filter(f => bodyClass(buildBody(f.spec)) === cls);
    const b = buildBody(pick(opts).spec);
    b.mass *= U(0.85, 1.15); b.inertia *= U(0.85, 1.15); b.tau = U(0.07, 0.15);
    return b;
  }
  const W = [];
  if (cls === 'diferencial') {
    const x0 = U(-0.08, 0.08), y0 = U(0.12, 0.22);
    if (rng() < 0.3) {                                  // derrapante de 4 rodas
      const a = U(0.1, 0.2);
      for (const sx of [1, -1]) for (const sy of [1, -1]) W.push(makeWheel('comum', sx * a, sy * y0, 0, 'p'));
    } else {
      const t = rng() < 0.3 ? 'esteira' : 'comum';
      W.push(makeWheel(t, x0, y0, 0, 'e'), makeWheel(t, x0, -y0, 0, 'd'));
      if (rng() < 0.7) W.push(makeWheel(pick(['boba', 'omni']), U(0.15, 0.24), 0, 0, 'f'));
      if (rng() < 0.7) W.push(makeWheel(pick(['boba', 'omni']), -U(0.15, 0.24), 0, 0, 't'));
    }
  } else if (cls === 'carro') {
    const a = U(0.13, 0.22), r = U(0.12, 0.22), y0 = U(0.12, 0.18);
    if (rng() < 0.7) W.push(makeWheel('direcional', a, y0, 0, 'fe'), makeWheel('direcional', a, -y0, 0, 'fd'));
    else W.push(makeWheel('direcional', a, 0, 0, 'f'));
    W.push(makeWheel('comum', -r, y0, 0, 'te'), makeWheel('comum', -r, -y0, 0, 'td'));
  } else if (cls === 'puxado') {
    const a = U(0.13, 0.22), r = U(0.12, 0.2), y0 = U(0.12, 0.18);
    if (rng() < 0.7) W.push(makeWheel('direcional', a, 0, 0, 'f'));
    else W.push(makeWheel('direcional', a, y0, 0, 'fe'), makeWheel('direcional', a, -y0, 0, 'fd'));
    const rear = rng() < 0.75 ? 'boba' : 'omni';
    W.push(makeWheel(rear, -r, y0, 0, 'te'), makeWheel(rear, -r, -y0, 0, 'td'));
  } else {
    const k = rng();
    if (k < 0.4) {                                      // omni em disco, rodas tangenciais
      const r = U(0.13, 0.22), off = U(0, Math.PI * 2), n = rng() < 0.75 ? 3 : 4;
      for (let i = 0; i < n; i++) {
        const be = off + i * 2 * Math.PI / n;
        W.push(makeWheel('omni', r * Math.cos(be), r * Math.sin(be), be + Math.PI / 2, 'o' + i));
      }
    } else if (k < 0.75) {                              // mecanum em retângulo
      const a = U(0.12, 0.2), y0 = U(0.12, 0.18);
      for (const sx of [1, -1]) for (const sy of [1, -1]) W.push(makeWheel('mecanum', sx * a, sy * y0, 0, 'm'));
    } else {                                            // omni em X (rodas a 45°)
      const r = U(0.15, 0.22);
      for (let i = 0; i < 4; i++) {
        const be = Math.PI / 4 + i * Math.PI / 2;
        W.push(makeWheel('omni', r * Math.cos(be), r * Math.sin(be), be + Math.PI / 2, 'x' + i));
      }
    }
  }
  return proc(W, U(3.5, 5.0));
}

// ---- missões: as do galpão + pares sorteados de pontos livres ----
function randomFree(colR) {
  for (;;) {
    const x = U(0.3, WAREHOUSE.W - 0.3), y = U(0.3, WAREHOUSE.H - 0.3);
    if (clearance(WAREHOUSE, x, y) > colR + 0.12) return { x, y };
  }
}
function randomMission(colR) {
  if (rng() < 0.4) return pick(MISSIONS);
  const st = Object.values(WAREHOUSE.stations);
  for (;;) {
    const s = randomFree(colR);
    const g = rng() < 0.5 ? pick(st) : randomFree(colR);
    if (Math.hypot(g.x - s.x, g.y - s.y) > 1.5) return { start: { ...s, th: U(-Math.PI, Math.PI) }, goal: g };
  }
}

// ---- gravação ----
// por amostra (uma roda num passo): estado, corpo, roda, alvo de velocidade, alvo de esterço,
// é motorizada, vira, classe, alfa
const ROW = N_STATE_RAW + N_BODY_RAW + N_WHEEL_RAW + 6;
let buf = new Float32Array(1 << 22), n = 0;
function push(vals) {
  if ((n + 1) * ROW > buf.length) { const nb = new Float32Array(buf.length * 2); nb.set(buf); buf = nb; }
  buf.set(vals, n * ROW); n++;
}

const t0 = Date.now();
const stats = { episodios: 0, chegou: 0, bateu: 0, tempo: 0, porClasse: {} };
for (let ep = 0; ep < EPISODES; ep++) {
  const cls = CLASSES[ep % 4];
  const body = randomBody(cls);
  const m = randomMission(body.colR);
  const start = { x: m.start.x + U(-0.05, 0.05), y: m.start.y + U(-0.05, 0.05), th: m.start.th + U(-0.1, 0.1) };
  const path = planPath(WAREHOUSE, start, m.goal, body.colR);
  if (!path || path.length < 0.5) { ep--; continue; }
  const fol = new Follower(path);
  const world = new World(body, WAREHOUSE, start, m.goal);
  const nW = body.wheels.length;
  const sigma = pick([0, 0.1, 0.2, 0.3, 0.45]);
  const noiseS = new Float64Array(nW), noiseD = new Float64Array(nW);
  const st = {}, bd = bodyRaw(body), sRaw = new Float64Array(N_STATE_RAW), wRaw = new Float64Array(N_WHEEL_RAW);
  const ci = CLASSES.indexOf(cls);
  while (!world.done) {
    const tg = fol.update(world);
    const meas = world.localVel();
    const act = expertAction(body, tg, st, meas);
    if ((world.t & 1) === 0) {                          // grava um passo sim, outro não
      stateRaw(tg, meas, sRaw);
      for (let i = 0; i < nW; i++) {
        const w = body.wheels[i];
        if (!w.driven && !w.steer) continue;
        wheelRaw(w, world.delta[i], world.w[i], wRaw);
        push([...sRaw, ...bd, ...wRaw, act.speed[i], act.steer[i], w.driven ? 1 : 0, w.steer ? 1 : 0, ci, tg.alpha]);
      }
    }
    // ação executada = limpa + ruído correlacionado no tempo
    const sp = new Float64Array(nW), se = new Float64Array(nW);
    for (let i = 0; i < nW; i++) {
      noiseS[i] = 0.85 * noiseS[i] + 0.53 * sigma * gauss();
      noiseD[i] = 0.85 * noiseD[i] + 0.53 * sigma * gauss();
      sp[i] = Math.max(-1, Math.min(1, act.speed[i] + noiseS[i]));
      se[i] = Math.max(-1, Math.min(1, act.steer[i] + noiseD[i]));
    }
    world.step(sp, se);
  }
  stats.episodios++;
  stats[world.reached ? 'chegou' : world.collided ? 'bateu' : 'tempo']++;
  stats.porClasse[cls] = (stats.porClasse[cls] || 0) + 1;
  if ((ep + 1) % 200 === 0) console.log(`${ep + 1}/${EPISODES} episódios, ${n} amostras, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

function gauss() { return Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng()); }

fs.mkdirSync(new URL('./dados/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./dados/amostras.f32', import.meta.url), Buffer.from(buf.buffer, 0, n * ROW * 4));
fs.writeFileSync(new URL('./dados/meta.json', import.meta.url), JSON.stringify({
  n, row: ROW, nState: N_STATE_RAW, nBody: N_BODY_RAW, nWheel: N_WHEEL_RAW, classes: CLASSES, stats
}, null, 1));
console.log(`Pronto: ${n} amostras.`, stats);
