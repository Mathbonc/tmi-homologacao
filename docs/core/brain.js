// O cérebro (seção 5.5): uma rede condicionada ao corpo. Recebe a descrição de cada roda e o
// estado da missão e devolve o comando de cada roda. Os mesmos pesos pilotam 2, 3 ou 4 rodas.
//
//   psi(roda)   = [1, características da roda, tanh(B·roda + c)]
//   phi(estado) = [1, características do estado, resumo do corpo, estado ⊗ resumo, tanh(A·[estado, resumo] + b)]
//   comando_i   = phi ᵀ · W · psi_i       esterço_i = phi ᵀ · V · psi_i
//
// A, b, B, c são aleatórios e fixos (vêm do modelo); W e V são ajustados por mínimos quadrados
// (train/ajustar.py). As características brutas são calculadas aqui, e o treino as grava com
// este mesmo código.
import { VMAX, MAX_STEER } from './physics.js';
import { isFixed } from './parts.js';

export const N_WHEEL_RAW = 14;
export const N_STATE_RAW = 8;
export const N_BODY_RAW = 5;

// Características de uma roda (fixas da montagem + estado atual).
export function wheelRaw(w, delta, speed, out = new Float64Array(N_WHEEL_RAW)) {
  const a = w.ang + w.phi;
  const ex = Math.cos(a), ey = Math.sin(a);
  const ig = w.gain > 0 ? 1 / w.gain : 0;
  out[0] = w.x / 0.3; out[1] = w.y / 0.3;
  out[2] = Math.cos(w.ang); out[3] = Math.sin(w.ang);
  out[4] = ex * ig; out[5] = ey * ig;                 // direção de tração / ganho
  out[6] = (w.x * ey - w.y * ex) / 0.3 * ig;          // braço de torque / ganho
  out[7] = w.latFree ? 1 : 0;
  out[8] = w.driven ? 1 : 0;
  out[9] = w.steer ? 1 : 0;
  out[10] = w.len / 0.3;
  out[11] = delta / MAX_STEER;
  out[12] = speed / VMAX;
  out[13] = w.caster ? 1 : 0;
  return out;
}

// Resumo do corpo: médias de características das rodas.
export function bodyRaw(body, out = new Float64Array(N_BODY_RAW)) {
  const ws = body.wheels, n = ws.length;
  const fixed = ws.filter(isFixed), steer = ws.filter(w => w.steer);
  out[0] = fixed.length ? 1 : 0;                          // tem roda de eixo fixo
  out[1] = steer.length ? 1 : 0;                          // tem roda que vira
  out[2] = out[0] * out[1];
  out[3] = fixed.length ? fixed.reduce((s, w) => s + w.x, 0) / fixed.length / 0.3 : 0;
  out[4] = n / 4;
  return out;
}

// Estado da missão: ponto-alvo no referencial do robô, velocidade desejada e medida.
export function stateRaw(target, meas, out = new Float64Array(N_STATE_RAW)) {
  const { tx, ty, vel } = target;           // tx, ty = cos e sen do erro de direção
  out[0] = tx; out[1] = ty;
  out[2] = vel;
  out[3] = meas[0]; out[4] = meas[1]; out[5] = meas[2];
  out[6] = vel * tx; out[7] = vel * ty;
  return out;
}

// Expansão em características (igual ao train/ajustar.py).
export function makeExpander(feat) {
  const { A, b, B, c } = feat;
  const nA = A.length, nB = B.length;
  const nPsi = 1 + N_WHEEL_RAW + nB;
  const nPhi = 1 + N_STATE_RAW + N_BODY_RAW + N_STATE_RAW * N_BODY_RAW + nA;
  function psi(raw, out = new Float64Array(nPsi)) {
    out[0] = 1;
    for (let k = 0; k < N_WHEEL_RAW; k++) out[1 + k] = raw[k];
    for (let j = 0; j < nB; j++) {
      let s = c[j]; const row = B[j];
      for (let k = 0; k < N_WHEEL_RAW; k++) s += row[k] * raw[k];
      out[1 + N_WHEEL_RAW + j] = Math.tanh(s);
    }
    return out;
  }
  function phi(st, bd, out = new Float64Array(nPhi)) {
    let p = 0;
    out[p++] = 1;
    for (let k = 0; k < N_STATE_RAW; k++) out[p++] = st[k];
    for (let k = 0; k < N_BODY_RAW; k++) out[p++] = bd[k];
    for (let i = 0; i < N_STATE_RAW; i++) for (let k = 0; k < N_BODY_RAW; k++) out[p++] = st[i] * bd[k];
    for (let j = 0; j < nA; j++) {
      let s = b[j]; const row = A[j];
      for (let k = 0; k < N_STATE_RAW; k++) s += row[k] * st[k];
      for (let k = 0; k < N_BODY_RAW; k++) s += row[N_STATE_RAW + k] * bd[k];
      out[p++] = Math.tanh(s);
    }
    return out;
  }
  return { psi, phi, nPsi, nPhi };
}

// Piloto a partir de um cérebro do modelo. Filtro passa-baixa igual para todos os cérebros.
export function brainPilot(model, brain) {
  const ex = makeExpander(model.features);
  const W = brain.W, V = brain.V;          // matrizes nPhi × nPsi (listas de linhas)
  const LP = model.lowpass ?? 0.3;
  return (world, target, state) => {
    const body = world.body, ws = body.wheels, n = ws.length;
    if (!state.bd) {
      state.bd = bodyRaw(body);
      state.speed = new Float64Array(n); state.steer = new Float64Array(n);
    }
    const ph = ex.phi(stateRaw(target, world.localVel()), state.bd);
    const raw = new Float64Array(N_WHEEL_RAW);
    const speed = new Float64Array(n), steer = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const w = ws[i];
      const ps = ex.psi(wheelRaw(w, world.delta[i], world.w[i], raw));
      let sp = 0, se = 0;
      for (let a = 0; a < ph.length; a++) {
        const pa = ph[a]; if (pa === 0) continue;
        const wr = W[a], vr = V[a];
        let s1 = 0, s2 = 0;
        for (let k = 0; k < ps.length; k++) { s1 += wr[k] * ps[k]; s2 += vr[k] * ps[k]; }
        sp += pa * s1; se += pa * s2;
      }
      sp = Math.max(-1, Math.min(1, sp));
      se = w.steer ? Math.max(-1, Math.min(1, se)) : 0;
      state.speed[i] = (1 - LP) * state.speed[i] + LP * sp;
      state.steer[i] = (1 - LP) * state.steer[i] + LP * se;
      speed[i] = w.driven ? state.speed[i] : 0;
      steer[i] = state.steer[i];
    }
    return { speed, steer };
  };
}
