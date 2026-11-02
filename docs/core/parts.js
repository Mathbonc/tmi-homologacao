// Catálogo de peças, bases e a frota da fábrica. Fonte única para o treino (Node) e para a página.
// Unidades: metros, radianos, quilos.

export const PARTS = {
  comum: {
    nome: 'Roda comum', driven: true, latFree: false, steer: false, caster: false,
    len: 0, phi: 0, gain: 1,
    desc: 'Empurra para frente e para trás. Não escorrega de lado.'
  },
  omni: {
    nome: 'Roda omni', driven: true, latFree: true, steer: false, caster: false,
    len: 0, phi: 0, gain: 1,
    desc: 'Empurra para frente e para trás. Desliza livre de lado.'
  },
  direcional: {
    nome: 'Roda direcional', driven: true, latFree: false, steer: true, caster: false,
    len: 0, phi: 0, gain: 1,
    desc: 'Roda comum que vira, como a de um carro.'
  },
  boba: {
    nome: 'Roda boba', driven: false, latFree: true, steer: false, caster: true,
    len: 0, phi: 0, gain: 0,
    desc: 'Sem motor. Gira solta para qualquer lado e só apoia.'
  },
  esteira: {
    nome: 'Esteira', driven: true, latFree: false, steer: false, caster: false,
    len: 0.36, phi: 0, gain: 1,
    desc: 'Lagarta de tanque. Agarra muito o chão, inclusive de lado.'
  },
  mecanum: {
    nome: 'Mecanum', driven: true, latFree: true, steer: false, caster: false,
    len: 0, phi: 'auto', gain: Math.SQRT1_2,
    desc: 'Roletes a 45°. Empurra na diagonal.'
  }
};

export const MOTORS = {
  normal: { nome: 'Motor normal', tau: 0.10, desc: 'Responde rápido.' },
  lento:  { nome: 'Motor lento',  tau: 0.60, desc: 'Demora quase um segundo para chegar na velocidade.' }
};

const D = Math.PI / 180;
const tang = (beta, r, aceita, id) => ({
  id, x: r * Math.cos(beta * D), y: r * Math.sin(beta * D), ang: (beta + 90) * D, aceita
});

export const BASES = {
  retangulo: {
    nome: 'Retângulo', forma: 'retangulo', comp: 0.50, larg: 0.36, colisao: 0.31, massa: 4.5,
    slots: [
      { id: 'fe', nome: 'frente esq.', x: 0.17, y: 0.15, ang: 0, aceita: ['comum', 'omni', 'direcional', 'mecanum', 'boba'] },
      { id: 'fd', nome: 'frente dir.', x: 0.17, y: -0.15, ang: 0, aceita: ['comum', 'omni', 'direcional', 'mecanum', 'boba'] },
      { id: 'te', nome: 'trás esq.', x: -0.17, y: 0.15, ang: 0, aceita: ['comum', 'omni', 'mecanum', 'boba'] },
      { id: 'td', nome: 'trás dir.', x: -0.17, y: -0.15, ang: 0, aceita: ['comum', 'omni', 'mecanum', 'boba'] }
    ]
  },
  tanque: {
    nome: 'Tanque', forma: 'retangulo', comp: 0.50, larg: 0.42, colisao: 0.32, massa: 5.0,
    slots: [
      { id: 'e', nome: 'lateral esq.', x: 0, y: 0.19, ang: 0, aceita: ['esteira', 'comum'] },
      { id: 'd', nome: 'lateral dir.', x: 0, y: -0.19, ang: 0, aceita: ['esteira', 'comum'] },
      { id: 'f', nome: 'frente', x: 0.21, y: 0, ang: 0, aceita: ['boba', 'omni'] },
      { id: 't', nome: 'trás', x: -0.21, y: 0, ang: 0, aceita: ['boba', 'omni'] }
    ]
  },
  triciclo: {
    nome: 'Triciclo', forma: 'triciclo', comp: 0.46, larg: 0.34, colisao: 0.29, massa: 4.0,
    slots: [
      { id: 'f', nome: 'frente', x: 0.18, y: 0, ang: 0, aceita: ['direcional', 'comum', 'omni', 'boba'] },
      { id: 'te', nome: 'trás esq.', x: -0.15, y: 0.15, ang: 0, aceita: ['comum', 'omni', 'boba'] },
      { id: 'td', nome: 'trás dir.', x: -0.15, y: -0.15, ang: 0, aceita: ['comum', 'omni', 'boba'] }
    ]
  },
  disco: {
    nome: 'Disco', forma: 'circulo', raio: 0.22, colisao: 0.24, massa: 3.5,
    slots: [
      { ...tang(90, 0.18, ['omni', 'comum', 'boba'], 'a'), nome: 'roda A' },
      { ...tang(210, 0.18, ['omni', 'comum', 'boba'], 'b'), nome: 'roda B' },
      { ...tang(330, 0.18, ['omni', 'comum', 'boba'], 'c'), nome: 'roda C' }
    ]
  }
};

// A frota: o que a regra da fábrica exige que o cérebro pilote.
export const FLEET = [
  { id: 'diferencial', nome: 'Carrinho diferencial',
    spec: { base: 'tanque', pecas: { e: 'comum', d: 'comum', f: 'boba', t: 'boba' } } },
  { id: 'plataforma', nome: 'Plataforma 4×4',
    spec: { base: 'retangulo', pecas: { fe: 'comum', fd: 'comum', te: 'comum', td: 'comum' } } },
  { id: 'carro', nome: 'Carro com direção',
    spec: { base: 'retangulo', pecas: { fe: 'direcional', fd: 'direcional', te: 'comum', td: 'comum' } } },
  { id: 'esteira', nome: 'Esteira de carga',
    spec: { base: 'tanque', pecas: { e: 'esteira', d: 'esteira' } } },
  { id: 'empilhadeira', nome: 'Empilhadeira',
    spec: { base: 'triciclo', pecas: { f: 'direcional', te: 'boba', td: 'boba' } } },
  { id: 'omni3', nome: 'Omni de 3 rodas',
    spec: { base: 'disco', pecas: { a: 'omni', b: 'omni', c: 'omni' } } },
  { id: 'mecanum', nome: 'Mecanum 4×4',
    spec: { base: 'retangulo', pecas: { fe: 'mecanum', fd: 'mecanum', te: 'mecanum', td: 'mecanum' } } }
];

export const fleetBody = id => buildBody(FLEET.find(f => f.id === id).spec);

// Monta o corpo físico. spec = { base: 'retangulo', pecas: { fe: 'comum', ... }, motor: 'normal' }
export function buildBody(spec) {
  const base = BASES[spec.base];
  const motor = MOTORS[spec.motor || 'normal'];
  const wheels = [];
  for (const s of base.slots) {
    const tipo = spec.pecas[s.id];
    if (!tipo) continue;
    wheels.push(makeWheel(tipo, s.x, s.y, s.ang, s.id));
  }
  return finishBody(wheels, base.massa, inertiaOf(base), base.colisao, motor.tau, spec);
}

export function makeWheel(tipo, x, y, ang, slot) {
  const p = PARTS[tipo];
  let phi = p.phi;
  // mecanum: lado do rolete escolhido pela posição, como numa montagem em X
  if (phi === 'auto') phi = (Math.sign(x || 1) * Math.sign(y || 1) >= 0 ? 1 : -1) * Math.PI / 4;
  const contacts = [];
  if (p.len > 0) {
    for (const t of [-0.5, 0, 0.5]) contacts.push({ x: x + Math.cos(ang) * p.len * t, y: y + Math.sin(ang) * p.len * t });
  } else contacts.push({ x, y });
  return { tipo, slot, x, y, ang, phi, gain: p.gain, driven: p.driven, latFree: p.latFree,
           steer: p.steer, caster: p.caster, len: p.len, contacts };
}

function inertiaOf(base) {
  if (base.forma === 'circulo') return 0.5 * base.massa * base.raio * base.raio;
  return base.massa * (base.comp * base.comp + base.larg * base.larg) / 12;
}

export function finishBody(wheels, mass, inertia, colR, tau, spec) {
  return { wheels, mass, inertia, colR, tau, spec,
           nContacts: wheels.reduce((n, w) => n + w.contacts.length, 0) };
}

// Roda de eixo fixo: tem tração e não escorrega de lado nem vira (comum, esteira).
export const isFixed = w => !w.latFree && !w.steer && !w.caster;

// Classe cinemática do corpo (seção 5.4).
export function bodyClass(body) {
  const fixed = body.wheels.some(isFixed);
  const steer = body.wheels.some(w => w.steer);
  if (steer) return fixed ? 'carro' : 'puxado';
  return fixed ? 'diferencial' : 'holonomico';
}
