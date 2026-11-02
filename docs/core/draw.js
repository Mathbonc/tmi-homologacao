// Desenho do galpão, dos robôs, da rota e do rastro em canvas. Coordenadas de mundo em metros,
// origem no canto inferior esquerdo do galpão; no canvas, y cresce para baixo.
import { BASES, PARTS } from './parts.js';
import { GOAL_R } from './physics.js';

export const C = {
  floor: '#d9d6cc', floorZone: '#cfcbbf', line: '#e2b33c', lineSoft: 'rgba(226,179,60,0.55)',
  wall: '#3a3f44', ink: '#14181c', soft: '#5f6a72',
  rack: '#3d5a73', rackEdge: '#2b4053', box: '#c9935a', boxEdge: '#9c6b3b',
  teal: '#2f6b7d', orange: '#c2551f', route: '#6a4c93', trail: '#2f6b7d',
  body: '#e8a33d', bodyEdge: '#8a5a12', wheel: '#14181c', goal: '#2f8a5b', paper: '#f7f6f2'
};

// Transformação mundo → canvas para caber o galpão em W×H pixels.
export function viewFor(map, W, H, pad = 10) {
  const s = Math.min((W - 2 * pad) / map.W, (H - 2 * pad) / map.H);
  const ox = (W - map.W * s) / 2, oy = (H + map.H * s) / 2;
  return { s, ox, oy, X: x => ox + x * s, Y: y => oy - y * s };
}

export function drawWarehouse(ctx, map, v, { highlight } = {}) {
  const { s, X, Y } = v;
  // chão
  ctx.fillStyle = C.floor; ctx.fillRect(X(0), Y(map.H), map.W * s, map.H * s);
  ctx.fillStyle = C.floorZone; ctx.fillRect(X(0), Y(map.zone), map.W * s, map.zone * s);
  // faixas amarelas: bordas dos corredores e da área das docas
  ctx.strokeStyle = C.lineSoft; ctx.lineWidth = Math.max(1.5, 0.03 * s);
  ctx.setLineDash([0.25 * s, 0.15 * s]);
  ctx.beginPath(); ctx.moveTo(X(0), Y(map.zone - 0.08)); ctx.lineTo(X(map.W), Y(map.zone - 0.08)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(0), Y(map.top + 0.08)); ctx.lineTo(X(map.W), Y(map.top + 0.08)); ctx.stroke();
  ctx.setLineDash([]);
  for (const a of map.aisles) {
    ctx.strokeStyle = C.lineSoft;
    for (const x of [a.x0 + 0.08, a.x1 - 0.08]) {
      ctx.beginPath(); ctx.moveTo(X(x), Y(map.zone)); ctx.lineTo(X(x), Y(map.top)); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(20,24,28,0.35)'; ctx.font = `600 ${Math.round(0.2 * s)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(a.id, X((a.x0 + a.x1) / 2), Y(map.zone + 0.25));
  }
  // docas: portões na parede de baixo
  for (const d of map.docks) {
    ctx.fillStyle = C.line; ctx.fillRect(X(d.x - 0.45), Y(0.12), 0.9 * s, 0.12 * s);
    ctx.strokeStyle = C.line; ctx.lineWidth = Math.max(1.5, 0.025 * s);
    ctx.strokeRect(X(d.x - 0.45), Y(1.55), 0.9 * s, 1.43 * s);
    ctx.fillStyle = 'rgba(20,24,28,0.55)'; ctx.font = `600 ${Math.round(0.17 * s)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d.nome, X(d.x), Y(0.3));
  }
  // estações
  for (const [k, p] of Object.entries(map.stations)) {
    const on = highlight === k;
    ctx.fillStyle = on ? 'rgba(47,138,91,0.28)' : 'rgba(47,138,91,0.12)';
    ctx.strokeStyle = C.goal; ctx.lineWidth = Math.max(1.5, (on ? 0.035 : 0.02) * s);
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), GOAL_R * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.goal; ctx.font = `700 ${Math.round(0.2 * s)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(k, X(p.x), Y(p.y));
  }
  // prateleiras com caixas
  for (const r of map.shelves) drawShelf(ctx, r, v);
  // paredes
  ctx.strokeStyle = C.wall; ctx.lineWidth = Math.max(3, 0.06 * s);
  ctx.strokeRect(X(0), Y(map.H), map.W * s, map.H * s);
}

function drawShelf(ctx, r, v) {
  const { s, X, Y } = v;
  const w = (r.x1 - r.x0) * s, h = (r.y1 - r.y0) * s;
  ctx.fillStyle = C.rack; ctx.fillRect(X(r.x0), Y(r.y1), w, h);
  // caixas em módulos de 0,4 m
  const cols = Math.max(1, Math.round((r.x1 - r.x0) / 0.25));
  const rows = Math.max(1, Math.round((r.y1 - r.y0) / 0.4));
  const cw = (r.x1 - r.x0) / cols, rh = (r.y1 - r.y0) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const seed = Math.sin((r.x0 * 13 + i * 7 + j * 3) * 12.9898) * 43758.5453;
    if (seed - Math.floor(seed) < 0.18) continue;          // vaga vazia
    const m = 0.035;
    ctx.fillStyle = C.box; ctx.strokeStyle = C.boxEdge; ctx.lineWidth = 1;
    ctx.fillRect(X(r.x0 + i * cw + m), Y(r.y0 + (j + 1) * rh - m), (cw - 2 * m) * s, (rh - 2 * m) * s);
    ctx.strokeRect(X(r.x0 + i * cw + m), Y(r.y0 + (j + 1) * rh - m), (cw - 2 * m) * s, (rh - 2 * m) * s);
  }
  ctx.strokeStyle = C.rackEdge; ctx.lineWidth = 2; ctx.strokeRect(X(r.x0), Y(r.y1), w, h);
}

export function drawPath(ctx, path, v, color = C.route) {
  if (!path) return;
  const { X, Y, s } = v;
  ctx.strokeStyle = color; ctx.globalAlpha = 0.7; ctx.lineWidth = Math.max(1.5, 0.025 * s);
  ctx.setLineDash([0.12 * s, 0.08 * s]);
  ctx.beginPath(); ctx.moveTo(X(path.pts[0][0]), Y(path.pts[0][1]));
  for (const [x, y] of path.pts) ctx.lineTo(X(x), Y(y));
  ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
}

export function drawTrail(ctx, trail, v, color = C.trail, now) {
  if (!trail || trail.length < 2) return;
  const { X, Y, s } = v;
  ctx.strokeStyle = color; ctx.globalAlpha = 0.8; ctx.lineWidth = Math.max(2, 0.035 * s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(X(trail[0][0]), Y(trail[0][1]));
  for (const [x, y] of trail) ctx.lineTo(X(x), Y(y));
  if (now) ctx.lineTo(X(now[0]), Y(now[1]));
  ctx.stroke(); ctx.globalAlpha = 1;
}

// Ponto-alvo do seguidor.
export function drawTarget(ctx, t, v) {
  if (!t) return;
  const { X, Y, s } = v;
  ctx.fillStyle = C.route;
  ctx.beginPath(); ctx.arc(X(t.wx), Y(t.wy), Math.max(3, 0.05 * s), 0, Math.PI * 2); ctx.fill();
}

// Robô na pose do mundo. world: {x, y, th, delta?, collided?}
export function drawRobotAt(ctx, body, world, v, { cmd, ghost } = {}) {
  const { X, Y, s } = v;
  ctx.save();
  ctx.translate(X(world.x), Y(world.y)); ctx.rotate(-world.th);
  if (ghost) ctx.globalAlpha = 0.35;
  drawRobot(ctx, body, s, { delta: world.delta, cmd });
  ctx.restore();
  if (world.collided) {
    ctx.strokeStyle = C.orange; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(X(world.x), Y(world.y), body.colR * s + 5, 0, Math.PI * 2); ctx.stroke();
  }
}

// Círculo simples (robô ideal).
export function drawDisc(ctx, world, colR, v) {
  const { X, Y, s } = v;
  ctx.fillStyle = 'rgba(232,163,61,0.85)'; ctx.strokeStyle = C.bodyEdge; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(X(world.x), Y(world.y), colR * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(world.x), Y(world.y));
  ctx.lineTo(X(world.x + Math.cos(world.th) * colR), Y(world.y + Math.sin(world.th) * colR)); ctx.stroke();
}

export function drawBase(ctx, baseKey, s) {
  const b = BASES[baseKey];
  ctx.fillStyle = C.body; ctx.strokeStyle = C.bodyEdge; ctx.lineWidth = 0.012 * s;
  ctx.beginPath();
  if (b.forma === 'circulo') {
    ctx.arc(0, 0, b.raio * s, 0, Math.PI * 2);
  } else if (b.forma === 'triciclo') {
    const L = b.comp * s, W = b.larg * s;
    ctx.moveTo(L / 2, -W * 0.18); ctx.lineTo(L / 2, W * 0.18);
    ctx.lineTo(-L / 2, W / 2); ctx.lineTo(-L / 2, -W / 2); ctx.closePath();
  } else {
    roundRect(ctx, -b.comp / 2 * s, -b.larg / 2 * s, b.comp * s, b.larg * s, 0.04 * s);
  }
  ctx.fill(); ctx.stroke();
  // seta de frente
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const f = (b.forma === 'circulo' ? b.raio : b.comp / 2) * s;
  ctx.beginPath(); ctx.moveTo(f * 0.75, 0); ctx.lineTo(f * 0.35, 0.06 * s); ctx.lineTo(f * 0.35, -0.06 * s); ctx.closePath(); ctx.fill();
}

// Desenha uma roda já posicionada (origem no centro da roda, eixo x = direção de rolamento).
export function drawWheel(ctx, tipo, s, phi = 0) {
  const p = PARTS[tipo];
  ctx.lineWidth = 0.008 * s;
  if (tipo === 'boba') {
    ctx.fillStyle = '#5f6a72'; ctx.strokeStyle = C.wheel;
    ctx.beginPath(); ctx.arc(0, 0, 0.035 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(0, 0, 0.012 * s, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const L = (tipo === 'esteira' ? p.len + 0.06 : 0.12) * s;
  const W = (tipo === 'esteira' ? 0.075 : 0.05) * s;
  ctx.fillStyle = C.wheel;
  ctx.beginPath(); roundRect(ctx, -L / 2, -W / 2, L, W, (tipo === 'esteira' ? 0.03 : 0.012) * s); ctx.fill();
  ctx.strokeStyle = '#9aa3aa'; ctx.lineWidth = 0.006 * s;
  ctx.save(); ctx.beginPath(); roundRect(ctx, -L / 2, -W / 2, L, W, 0.012 * s); ctx.clip();
  if (tipo === 'omni') {
    for (let x = -L / 2 + 0.015 * s; x < L / 2; x += 0.025 * s) { ctx.beginPath(); ctx.moveTo(x, -W / 2); ctx.lineTo(x, W / 2); ctx.stroke(); }
  } else if (tipo === 'mecanum') {
    const k = Math.tan(phi) || 1;
    for (let x = -L; x < L; x += 0.025 * s) { ctx.beginPath(); ctx.moveTo(x - W / 2 * k, -W / 2); ctx.lineTo(x + W / 2 * k, W / 2); ctx.stroke(); }
  } else if (tipo === 'esteira') {
    for (let x = -L / 2 + 0.02 * s; x < L / 2; x += 0.035 * s) { ctx.beginPath(); ctx.moveTo(x, -W / 2); ctx.lineTo(x, W / 2); ctx.stroke(); }
  }
  ctx.restore();
  if (tipo === 'direcional') {
    ctx.strokeStyle = C.orange; ctx.lineWidth = 0.01 * s;
    ctx.beginPath(); ctx.moveTo(-0.035 * s, 0); ctx.lineTo(0.035 * s, 0); ctx.stroke();
  }
}

// Robô completo na origem, frente para +x. delta/cmd opcionais para mostrar esterço e comandos.
export function drawRobot(ctx, body, s, { delta, cmd } = {}) {
  drawBase(ctx, body.spec.base, s);
  body.wheels.forEach((w, i) => {
    ctx.save();
    ctx.translate(w.x * s, -w.y * s);
    ctx.rotate(-(w.ang + (delta ? delta[i] : 0)));
    drawWheel(ctx, w.tipo, s, w.phi);
    if (cmd && w.driven) {
      const val = cmd[i];
      ctx.strokeStyle = val >= 0 ? C.teal : C.orange; ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 0.014 * s;
      const len = val * 0.16 * s;
      if (Math.abs(len) > 0.01 * s) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
        const d = Math.sign(len);
        ctx.beginPath(); ctx.moveTo(len + d * 0.03 * s, 0); ctx.lineTo(len, 0.022 * s); ctx.lineTo(len, -0.022 * s); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
}
