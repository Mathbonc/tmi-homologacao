// Licença de operação de um cérebro (CLAUDE.md, seções 3.2 a 3.5 e 4.3 a 4.4).
// Funções puras: classificação de célula, gravidade e risco, varredura e montagem do cartão.
// Usado pela página (licenca.js) e pelo pré-cálculo em Node (train/licenciar.mjs).
import { FLEET, bodyClass, buildBody } from './parts.js';
import { MISSIONS } from './warehouse.js';

export const VERSAO_FERRAMENTA = '0.1';
export const TOL_PADRAO = 0.9;
export const SEED0 = 1000;              // corrida r de cada célula usa a semente SEED0 + r

// ------------------------------------------------------------------ gravidade (3.5)
export const IMPACTO_GRAVE = 0.3;       // m/s
export const FOLGA_QUASE = 0.03;        // m
// O índice é o código gravado no pré-cálculo. 'ok' e 'quase' chegaram; 'travou' é tempo esgotado.
export const GRAVIDADES = ['ok', 'quase', 'travou', 'raspao', 'grave'];
export const PESO = { ok: 0, quase: 1, travou: 2, raspao: 3, grave: 10 };
export const GRAV_TEXTO = {
  ok: 'chegou', quase: 'quase-acidente', travou: 'travou (tempo esgotado)',
  raspao: 'raspão', grave: 'colisão grave'
};

export function gravidadeDe(status, impact, minClear) {
  if (status === 'bateu') return impact >= IMPACTO_GRAVE ? 'grave' : 'raspao';
  if (status === 'tempo') return 'travou';
  return minClear < FOLGA_QUASE ? 'quase' : 'ok';
}

// ------------------------------------------------------------------ condições (3.4)
const fmtNum = x => String(x).replace('.', ',');
export const EIXOS = [
  { id: 'giro', nome: 'Saída em qualquer direção', curto: 'saída', niveis: [45, 90, 135, 180], fmt: n => `${n}°` },
  { id: 'empurrao', nome: 'Empurrão', curto: 'empurrão', niveis: [0.3, 0.6, 0.9, 1.2], fmt: n => `${fmtNum(n)} m/s` },
  { id: 'ruido', nome: 'Ruído de sensor', curto: 'ruído', niveis: [10, 20, 30, 45], fmt: n => `${n}°` },
  { id: 'atraso', nome: 'Atraso de comando', curto: 'atraso', niveis: [0.1, 0.2, 0.3, 0.5], fmt: n => `${fmtNum(n)} s` }
  // obstáculo surgindo: etapa 4
];
export const eixoById = id => EIXOS.find(e => e.id === id);

export const CONDICOES = [
  { id: 'nominal', eixo: null, nivel: 0, opts: null, rotulo: 'Nominal' },
  ...EIXOS.flatMap(e => e.niveis.map(n => ({
    id: `${e.id}:${n}`, eixo: e.id, nivel: n, opts: { [e.id]: n }, rotulo: `${e.nome}: ${e.fmt(n)}`
  })))
];
export const condById = id => CONDICOES.find(c => c.id === id);

// ------------------------------------------------------------------ robôs
// Robôs fora da frota calculados junto (a página mostra numa seção à parte). Os dois primeiros
// são limite físico conhecido (seção 3.3); o triciclo é o caso do montador (etapa 8).
export const ROBOS_EXTRAS = [
  { id: 'ret-1dir-3bobas', nome: 'Retângulo: 1 direcional + 3 bobas',
    spec: { base: 'retangulo', pecas: { fe: 'direcional', fd: 'boba', te: 'boba', td: 'boba' } } },
  { id: 'disco-2omni-1boba', nome: 'Disco: 2 omni + 1 boba',
    spec: { base: 'disco', pecas: { a: 'omni', b: 'omni', c: 'boba' } } },
  { id: 'triciclo-dir-2comuns', nome: 'Triciclo: direcional + 2 comuns',
    spec: { base: 'triciclo', pecas: { f: 'direcional', te: 'comum', td: 'comum' } } }
];
export const ROBOS = [
  ...FLEET.map(f => ({ ...f, frota: true })),
  ...ROBOS_EXTRAS.map(r => ({ ...r, frota: false }))
];
export const roboById = id => ROBOS.find(r => r.id === id);
export const corpoDe = id => buildBody(roboById(id).spec);

// ------------------------------------------------------------------ célula
export function novaCelula() {
  return { n: 0, ok: 0, g: [0, 0, 0, 0, 0], minClear: Infinity, risco: 0, runs: [] };
}

// res: resultado de Run.result()
export function somarCorrida(cel, res) {
  const gi = GRAVIDADES.indexOf(res.gravidade);
  cel.n++;
  if (res.status === 'chegou') cel.ok++;
  cel.g[gi]++;
  cel.minClear = Math.min(cel.minClear, res.minClear);
  cel.runs.push([gi, Math.round(res.t * 100) / 100]);
  cel.risco = riscoDe(cel);
  return cel;
}

// Risco = média dos pesos de gravidade sobre as corridas.
export function riscoDe(cel) {
  if (!cel.n) return 0;
  return GRAVIDADES.reduce((s, g, i) => s + PESO[g] * cel.g[i], 0) / cel.n;
}

export const taxa = cel => (cel && cel.n ? cel.ok / cel.n : 0);
export const contagem = (cel, g) => cel.g[GRAVIDADES.indexOf(g)];
// Pior gravidade que aconteceu na célula ('ok' se nada).
export function piorGravidade(cel) {
  const ordem = ['grave', 'raspao', 'travou', 'quase'];
  return ordem.find(g => contagem(cel, g) > 0) || 'ok';
}

// Para gravar em JSON (Infinity não existe em JSON; arredonda a folga em mm).
export function celulaJSON(cel) {
  return { ...cel, minClear: Number.isFinite(cel.minClear) ? Math.round(cel.minClear * 1000) / 1000 : null,
           risco: Math.round(cel.risco * 1000) / 1000 };
}

// ------------------------------------------------------------------ classificação (3.2)
export const CLASSES = {
  liberado: { nome: 'Liberado', dentro: true },
  testar:   { nome: 'Testar fisicamente', dentro: true },
  defeito:  { nome: 'Defeito do cérebro', dentro: false },
  limite:   { nome: 'Limite físico', dentro: false }
};

// b, e: células do cérebro e do especialista nas mesmas sementes.
// borda: é o último nível de varredura antes do limite (vira "testar").
export function classificar(b, e, { tol = TOL_PADRAO, proibida = 'grave', borda = false } = {}) {
  if (taxa(e) < tol) return 'limite';
  if (taxa(b) < tol) return 'defeito';
  if (proibida && contagem(b, proibida) > 0) return contagem(e, proibida) > 0 ? 'limite' : 'defeito';
  if (borda || b.ok < b.n || contagem(b, 'quase') > 0) return 'testar';
  return 'liberado';
}

// Classes de uma condição inteira: { robo: { missao: classe } }
export function classificarGrade(dadosB, dadosE, robos, missoes, opc) {
  const out = {};
  for (const r of robos) {
    out[r] = {};
    for (const m of missoes) out[r][m] = classificar(dadosB[r][m], dadosE[r][m], opc);
  }
  return out;
}

// ------------------------------------------------------------------ varredura (4.3)
// Fração de células em que o piloto se mantém (taxa ≥ tol, sem colisão grave).
export function fracaoMantida(dados, robos, missoes, tol = TOL_PADRAO) {
  let k = 0, n = 0;
  for (const r of robos) for (const m of missoes) {
    const c = dados[r][m]; n++;
    if (taxa(c) >= tol && contagem(c, 'grave') === 0) k++;
  }
  return n ? k / n : 0;
}

// Limite de um eixo. porCond(condId) -> { b, e } com os dados { robo: { missao: célula } } da
// condição (b = cérebro, e = especialista). escopo: células licenciadas no nominal [[robo, missao]].
// O limite é o maior nível tal que, nele e em todos os anteriores, o cérebro não tem defeito em
// nenhuma célula do escopo (onde o especialista falha é limite físico e não conta).
// limiteEsp: o mesmo para o especialista (maior nível em que ele mantém todo o escopo).
export function varredura(eixo, porCond, escopo, opc = {}) {
  const tol = opc.tol ?? TOL_PADRAO;
  const niveis = [];
  let limite = 0, limiteEsp = 0, quebrouB = false, quebrouE = false;
  for (const nivel of eixo.niveis) {
    const d = porCond(`${eixo.id}:${nivel}`);
    if (!d) break;
    let defeitos = 0, mantB = 0, mantE = 0;
    for (const [r, m] of escopo) {
      const cls = classificar(d.b[r][m], d.e[r][m], opc);
      if (cls === 'defeito') defeitos++;
      if (cls === 'liberado' || cls === 'testar') mantB++;
      if (taxa(d.e[r][m]) >= tol && contagem(d.e[r][m], 'grave') === 0) mantE++;
    }
    const n = escopo.length || 1;
    niveis.push({ nivel, defeitos, fracB: mantB / n, fracE: mantE / n });
    if (!quebrouB && defeitos === 0) limite = nivel; else quebrouB = true;
    if (!quebrouE && mantE === escopo.length) limiteEsp = nivel; else quebrouE = true;
  }
  const max = niveis.length === eixo.niveis.length && !quebrouB;
  return { eixo: eixo.id, niveis, limite, limiteEsp, maximo: max, completo: niveis.length === eixo.niveis.length };
}

export function textoLimite(eixo, v) {
  if (!v.completo && !v.niveis.length) return null;
  if (v.limite === 0) return `${eixo.nome}: não tolera (defeito já em ${eixo.fmt(eixo.niveis[0])})`;
  return `${eixo.nome}: até ${eixo.fmt(v.limite)}` + (v.maximo ? ' (maior nível testado)' : '');
}

// ------------------------------------------------------------------ o que falta treinar
const CLASSE_TREINO = {
  puxado: 'robôs puxados por roda direcional (sem eixo fixo)',
  holonomico: 'robôs holonômicos (que andam de lado: omni, mecanum)',
  carro: 'robôs com direção e eixo fixo (tipo carro)',
  diferencial: 'robôs de tração diferencial'
};
const juntar = xs => xs.length <= 1 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1];

// bloqueios: [[robo, missao]] com defeito do cérebro. Devolve frases de situação.
export function situacoesDeTreino(bloqueios, robos, missoes) {
  const porRobo = {};
  for (const [r, m] of bloqueios) (porRobo[r] ||= []).push(m);
  const frases = [];
  // robôs bloqueados em todas as missões: agrupa por classe cinemática
  const inteiros = Object.keys(porRobo).filter(r => porRobo[r].length === missoes.length);
  const porClasse = {};
  for (const r of inteiros) (porClasse[bodyClass(corpoDe(r))] ||= []).push(r);
  for (const [cls, rs] of Object.entries(porClasse)) {
    const daClasse = robos.filter(r => bodyClass(corpoDe(r)) === cls);
    if (rs.length === daClasse.length && roboById(rs[0]).frota) frases.push(CLASSE_TREINO[cls]);
    else frases.push(juntar(rs.map(r => roboById(r).nome)));
  }
  // bloqueios parciais: agrupa robôs com o mesmo conjunto de missões
  const parciais = {};
  for (const r of Object.keys(porRobo)) {
    if (inteiros.includes(r)) continue;
    const ms = [...porRobo[r]].sort();
    (parciais[ms.join(',')] ||= { ms, rs: [] }).rs.push(r);
  }
  for (const { ms, rs } of Object.values(parciais)) {
    const nomes = juntar(rs.map(r => roboById(r).nome));
    const costas = ms.every(m => MISSIONS.find(x => x.id === m).costas);
    if (costas) frases.push(`meia-volta (saída de costas) com ${nomes}`);
    else frases.push(`${nomes} nas missões ${juntar(ms)}`);
  }
  return frases;
}

// ------------------------------------------------------------------ cartão (4.4)
// dados: { condId: { robo: { missao: célula } } } do cérebro; esp: o mesmo do especialista.
// Devolve um objeto com tudo o que o cartão mostra; a página e o texto do terminal só formatam.
export function montarCartao({ piloto, dados, esp, robos, missoes, opc = {} }) {
  const nominal = classificarGrade(dados.nominal, esp.nominal, robos, missoes, opc);
  const nomeR = r => roboById(r).nome;
  const bloqueado = [], fora = [], testes = [], dentro = [];
  for (const r of robos) for (const m of missoes) {
    const b = dados.nominal[r][m], e = esp.nominal[r][m];
    const item = { robo: r, missao: m, taxa: taxa(b), taxaEsp: taxa(e), gravidade: piorGravidade(b), risco: riscoDe(b) };
    const cls = nominal[r][m];
    if (cls === 'defeito') bloqueado.push(item);
    else if (cls === 'limite') fora.push(item);
    else { dentro.push(item); if (cls === 'testar') testes.push(item); }
  }
  testes.sort((a, b) => b.risco - a.risco);

  // liberado para: robôs inteiros e exceções
  const exc = {};
  for (const it of [...bloqueado, ...fora]) (exc[it.robo] ||= []).push(it.missao);
  const robosInteiros = robos.filter(r => !exc[r]);
  const robosFora = robos.filter(r => exc[r] && exc[r].length === missoes.length);
  const descExc = r => exc[r].length === missoes.length ? `${nomeR(r)} (todas as missões)` : `${nomeR(r)} (${exc[r].join(', ')})`;
  let liberadoTexto;
  if (!Object.keys(exc).length) liberadoTexto = 'todos os robôs, todas as missões';
  else if (robosFora.length === robos.length) liberadoTexto = 'nenhum robô';
  else liberadoTexto = 'todos os robôs, todas as missões, exceto: ' + Object.keys(exc).map(descExc).join('; ');

  let resumo = `Liberado para ${robosInteiros.length} de ${robos.length} robôs em todas as missões`;
  const parc = robos.filter(r => exc[r] && exc[r].length < missoes.length);
  if (parc.length) resumo += `, ${parc.length} com restrição de missão`;
  if (bloqueado.length) resumo += `; bloqueado: ${juntar([...new Set(bloqueado.map(i => i.robo))].map(r => {
    const ms = bloqueado.filter(i => i.robo === r).map(i => i.missao);
    return ms.length === missoes.length ? nomeR(r) : `${nomeR(r)} em ${ms.join(', ')}`;
  }))}`;
  if (fora.length) resumo += `; fora do envelope físico: ${new Set(fora.map(i => i.robo)).size} robô(s)`;

  // limites de operação por eixo, onde houver dados
  const escopo = dentro.map(i => [i.robo, i.missao]);
  const limites = [];
  for (const eixo of EIXOS) {
    if (!eixo.niveis.some(n => dados[`${eixo.id}:${n}`] && esp[`${eixo.id}:${n}`])) continue;
    const v = varredura(eixo, id => dados[id] && esp[id] ? { b: dados[id], e: esp[id] } : null, escopo, opc);
    limites.push({ ...v, texto: textoLimite(eixo, v) });
  }

  const treinar = situacoesDeTreino(bloqueado.map(i => [i.robo, i.missao]), robos, missoes);
  for (const l of limites) {
    const eixo = eixoById(l.eixo);
    if (!l.maximo && l.limite < l.limiteEsp) treinar.push(`${eixo.curto} acima de ${l.limite ? eixo.fmt(l.limite) : 'zero'} (o piloto de referência aguenta até ${eixo.fmt(l.limiteEsp)})`);
  }

  return {
    piloto, versaoFerramenta: VERSAO_FERRAMENTA, tol: opc.tol ?? TOL_PADRAO,
    classes: nominal, liberadoTexto, resumo, bloqueado, fora, testes, limites, treinar,
    licenciavel: bloqueado.length === 0
  };
}

const pct = x => `${Math.round(100 * x)}%`;
export function cartaoTexto(c) {
  const L = [];
  const nomeR = r => roboById(r).nome;
  L.push(`LICENÇA DE OPERAÇÃO · ${c.piloto} · tol ${c.tol} · ferramenta ${c.versaoFerramenta}`);
  L.push(`  ${c.resumo}`);
  L.push(`  Liberado para: ${c.liberadoTexto}`);
  if (c.limites.length) {
    L.push('  Limites de operação:');
    for (const l of c.limites) L.push(`    - ${l.texto}`);
  }
  L.push(`  Bloqueado (defeito do cérebro): ${c.bloqueado.length ? '' : 'nada'}`);
  for (const i of c.bloqueado) L.push(`    - ${nomeR(i.robo)} em ${i.missao}: cérebro ${pct(i.taxa)}, referência ${pct(i.taxaEsp)}; pior: ${GRAV_TEXTO[i.gravidade]}`);
  L.push(`  Fora do envelope (limite físico): ${c.fora.length ? '' : 'nada'}`);
  for (const i of c.fora) L.push(`    - ${nomeR(i.robo)} em ${i.missao}: nem o piloto de referência consegue (${pct(i.taxaEsp)})`);
  L.push(`  Testes físicos obrigatórios: ${c.testes.length ? c.testes.length + ' (por risco)' : 'nenhum'}`);
  for (const i of c.testes.slice(0, 15)) L.push(`    - ${nomeR(i.robo)} em ${i.missao}: risco ${i.risco.toFixed(2)}, ${GRAV_TEXTO[i.gravidade]}`);
  if (c.testes.length > 15) L.push(`    … e mais ${c.testes.length - 15}`);
  L.push(`  O que falta treinar: ${c.treinar.length ? '' : 'nada'}`);
  for (const t of c.treinar) L.push(`    - ${t}`);
  return L.join('\n');
}
