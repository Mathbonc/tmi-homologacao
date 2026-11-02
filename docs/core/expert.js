// Piloto especialista (seção 5.4): controlador cinemático que conhece o corpo. Gera os exemplos
// que os cérebros imitam. Recebe o ponto-alvo no referencial do robô e a velocidade desejada.
import { VMAX, MAX_STEER } from './physics.js';
import { bodyClass, isFixed } from './parts.js';

const K_OM = 2.5;       // ganho de giro (rad/s por rad de erro)
const OM_MAX = 1.6;     // giro máximo pedido (rad/s)
const REV_ON = 100 * Math.PI / 180;   // carro: começa a ré se o alvo passar disto
const REV_OFF = 60 * Math.PI / 180;   // e volta para a frente quando ficar abaixo disto
const REV_MAX = 50;                   // ré dura no máximo 2,5 s
const REV_V = 0.35;
const K_YAW = 3.0;      // diferencial/derrapante: compensa o giro que o atrito lateral segura

const clamp = (x, a) => Math.max(-a, Math.min(a, x));

// Informação do corpo que o especialista usa, calculada uma vez por corpo.
const infoCache = new WeakMap();
export function bodyInfo(body) {
  let inf = infoCache.get(body);
  if (inf) return inf;
  const fixed = body.wheels.filter(isFixed);
  const steer = body.wheels.filter(w => w.steer);
  inf = {
    cls: bodyClass(body),
    // posição do eixo fixo ao longo do robô: nele a velocidade lateral tem que ser zero
    xFixed: fixed.length ? fixed.reduce((a, w) => a + w.x, 0) / fixed.length : 0,
    // distância entre eixos (direcionais até o eixo fixo, ou até as rodas de trás)
    wheelbase: steer.length
      ? Math.max(0.15, steer.reduce((a, w) => a + w.x, 0) / steer.length -
          (fixed.length ? fixed.reduce((a, w) => a + w.x, 0) / fixed.length
                        : Math.min(...body.wheels.map(w => w.x))))
      : 0
  };
  infoCache.set(body, inf);
  return inf;
}

// target: { tx, ty, alpha, vel, lx, ly } (do Follower); meas: velocidade medida [frente, lado, giro].
// state: memória do piloto entre passos.
export function expertAction(body, target, state = {}, meas = [0, 0, 0]) {
  const inf = bodyInfo(body);
  const n = body.wheels.length;
  const speed = new Float64Array(n), steer = new Float64Array(n);
  const { tx, ty, alpha, vel } = target;
  let vx = 0, vy = 0, om = 0;

  if (inf.cls === 'holonomico') {
    vx = vel * tx; vy = vel * ty;
    om = clamp(K_OM * alpha, OM_MAX);
  } else if (inf.cls === 'diferencial') {
    const c = Math.max(0, tx);
    vx = vel * c * c;
    const omDes = clamp(K_OM * alpha, OM_MAX);
    om = omDes + K_YAW * (omDes - meas[2]);
    vy = -om * inf.xFixed;
  } else {
    // carro e puxado: não giram no lugar. Alvo de lado ou atrás → curva máxima,
    // mantendo o lado escolhido até o alvo voltar para a frente.
    let a = alpha;
    if (Math.abs(a) > Math.PI / 2) {
      if (!state.turn) state.turn = Math.sign(a) || 1;
      a = state.turn * Math.PI / 2;
    } else state.turn = 0;
    const L = inf.wheelbase;
    const v = vel * (0.55 + 0.45 * Math.cos(a));      // mais devagar em curva fechada
    if (inf.cls === 'carro') {
      // alvo bem atrás: ré curta esterçando (manobra em três pontos) até ele ficar à frente
      if (!state.rev && Math.abs(alpha) > REV_ON) { state.rev = state.turn || Math.sign(alpha) || 1; state.revT = 0; }
      if (state.rev && (Math.abs(alpha) < REV_OFF || state.revT > REV_MAX)) state.rev = 0;
      if (state.rev) {
        state.revT++;
        vx = -REV_V;
        om = state.rev * REV_V * Math.tan(MAX_STEER) / L * 0.95;
      } else {
        const ld = Math.max(0.3, Math.hypot(target.lx, target.ly));
        om = v * 2 * Math.sin(a) / ld;
        om = clamp(om, v * Math.tan(MAX_STEER) / L);   // curvatura máxima possível
        vx = v;
      }
      vy = -om * inf.xFixed;
    } else {
      // puxado: cada direcional aponta para o alvo e puxa; o resto segue como reboque
      for (let i = 0; i < n; i++) {
        const w = body.wheels[i];
        if (w.steer) {
          let ang = Math.atan2(target.ly - w.y, target.lx - w.x) - w.ang;
          if (state.turn) ang = state.turn * Math.PI / 2;
          ang = Math.atan2(Math.sin(ang), Math.cos(ang));
          steer[i] = clamp(ang, MAX_STEER) / MAX_STEER;
          speed[i] = v / VMAX;
        }
      }
      // rodas com motor que não viram (omni atrás) acompanham o movimento do ponto da frente
      const sw = body.wheels.find(w => w.steer);
      const d = steer[body.wheels.indexOf(sw)] * MAX_STEER + sw.ang;
      vx = v * Math.cos(d);
      om = v * Math.sin(d) / Math.max(0.15, sw.x - Math.min(...body.wheels.map(w => w.x)));
      vy = v * Math.sin(d) - om * sw.x;
      for (let i = 0; i < n; i++) {
        const w = body.wheels[i];
        if (!w.steer && w.driven) speed[i] = wheelSpeed(w, vx, vy, om, 0);
      }
      return scale(speed, steer);
    }
  }

  // cinemática inversa: para cada roda, c = v + om × r
  for (let i = 0; i < n; i++) {
    const w = body.wheels[i];
    if (w.steer) {
      const cx = vx - om * w.y, cy = vy + om * w.x;
      let ang = Math.atan2(cy, cx) - w.ang, sg = 1;
      ang = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (ang > Math.PI / 2) { ang -= Math.PI; sg = -1; }
      else if (ang < -Math.PI / 2) { ang += Math.PI; sg = -1; }
      const d = clamp(ang, MAX_STEER);
      steer[i] = d / MAX_STEER;
      speed[i] = wheelSpeed(w, vx, vy, om, d);
      if (Math.hypot(cx, cy) < 1e-6) speed[i] = 0;
    } else if (w.driven) {
      speed[i] = wheelSpeed(w, vx, vy, om, 0);
    }
  }
  return scale(speed, steer);
}

// comando da roda = (c · e) / ganho / VMAX
function wheelSpeed(w, vx, vy, om, delta) {
  const cx = vx - om * w.y, cy = vy + om * w.x;
  const a = w.ang + delta + w.phi;
  return (cx * Math.cos(a) + cy * Math.sin(a)) / w.gain / VMAX;
}

// Se algum comando passar de 1 em módulo, escala todos juntos.
function scale(speed, steer) {
  let m = 1;
  for (const s of speed) m = Math.max(m, Math.abs(s));
  if (m > 1) for (let i = 0; i < speed.length; i++) speed[i] /= m;
  return { speed, steer };
}

export const expertPilot = (world, target, state) => expertAction(world.body, target, state, world.localVel());
