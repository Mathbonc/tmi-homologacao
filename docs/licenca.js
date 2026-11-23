// Página do licenciador (CLAUDE.md, seção 4). Lê o pré-cálculo (model/licencas.json), mostra a
// grade robô × missão, o painel da célula com replay e todos os rastros, e o cartão da licença.
// Toda a lógica (classificação, cartão, corrida) vem de core/; aqui só se desenha.
import { MISSIONS, WAREHOUSE, missionById } from './core/warehouse.js';
import { Run } from './core/episode.js';
import { DT } from './core/physics.js';
import { drawWarehouse, drawPath, drawTrail, drawRobotAt, drawRobot, viewFor, C } from './core/draw.js';
import { loadPilot, loadModel, BRAIN_NAMES } from './core/pilots.js';
import {
  ROBOS, roboById, corpoDe, condById, classificar, montarCartao, taxa, riscoDe, piorGravidade,
  GRAVIDADES, GRAV_TEXTO, CLASSES, TOL_PADRAO, VERSAO_FERRAMENTA
} from './core/licenca.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtT = s => s.toFixed(1).replace('.', ',') + ' s';
const pct = x => `${Math.round(100 * x)}%`;
const NOME_PILOTO = { especialista: 'Piloto de referência', cerebro1: 'Cérebro 1', cerebro2: 'Cérebro 2', cerebro3: 'Cérebro 3', cerebro4: 'Cérebro 4' };
const SIMBOLO = { liberado: '✓', testar: '!', defeito: '✕', limite: '–' };
const DESC_CLASSE = {
  liberado: 'cérebro ≥ 90%, sem colisão grave',
  testar: 'liberado, mas com falha leve ou quase-acidente',
  defeito: 'a referência consegue, o cérebro não',
  limite: 'nem a referência consegue'
};
const TEXTO_G = {
  ok: 'chegou', quase: 'chegou (quase-acidente)', travou: 'tempo esgotado',
  raspao: 'bateu (raspão)', grave: 'bateu (colisão grave)'
};
const COR_G = { ok: C.goal, quase: '#b8860b', travou: '#8a6d1a', raspao: C.orange, grave: '#9b1c1c' };
const missoes = MISSIONS.map(m => m.id);
const frota = ROBOS.filter(r => r.frota).map(r => r.id);
const extras = ROBOS.filter(r => !r.frota).map(r => r.id);
const estacaoDe = m => Object.entries(WAREHOUSE.stations).find(([, p]) => p === m.goal)?.[0];
// "Doca 1 → Estação A (de costas)" → "D1→A ↺"
const curtoMissao = m => m.nome.replace(/Doca (\d) → Estação (\w).*/, 'D$1→$2') + (m.costas ? ' ↺' : '');

// ---------------------------------------------------------------- estado
let L = null;                      // licencas.json
const E = { piloto: 'cerebro1', cond: 'nominal', robo: null, missao: null };
const opc = { tol: TOL_PADRAO };

const celula = (p, r, m, cond = E.cond) => L.pilotos[p]?.[cond]?.[r]?.[m];
const classe = (r, m) => classificar(celula(E.piloto, r, m), celula('especialista', r, m), opc);

// ---------------------------------------------------------------- início
async function iniciar() {
  try {
    const resp = await fetch('model/licencas.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    L = await resp.json();
  } catch (e) {
    $('resumo').textContent = `Não consegui ler model/licencas.json (${e.message}). Rode node train/licenciar.mjs e abra pelo servidor local.`;
    $('resumo').className = 'resumo bad';
    return;
  }
  lerHash();
  montarSeletor();
  montarLegenda();
  render();
  loadModel().then(m => { versaoModelo = m.versao; renderCartao(); }).catch(() => {});
}
let versaoModelo = null;

function lerHash() {
  const [p, r, m] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (BRAIN_NAMES.includes(p) && L.pilotos[p]) E.piloto = p;
  if (roboById(r) && missionById(m)) { E.robo = r; E.missao = m; }
}
function gravarHash() {
  const h = [E.piloto, ...(E.robo ? [E.robo, E.missao] : [])].join('/');
  history.replaceState(null, '', '#' + h);
}
window.addEventListener('hashchange', () => { lerHash(); player.parar(); marcarSeletor(); render(); });

function montarSeletor() {
  const box = $('sel-cerebro');
  for (const p of BRAIN_NAMES) {
    if (!L.pilotos[p]) continue;
    const b = document.createElement('button');
    b.textContent = NOME_PILOTO[p].replace('Cérebro ', '');
    b.title = NOME_PILOTO[p];
    b.dataset.p = p;
    b.onclick = () => { E.piloto = p; player.parar(); marcarSeletor(); render(); };
    box.append(b);
  }
  marcarSeletor();
}
function marcarSeletor() { for (const b of $('sel-cerebro').querySelectorAll('button')) b.classList.toggle('sel', b.dataset.p === E.piloto); }

function montarLegenda() {
  $('legenda').innerHTML = Object.keys(CLASSES).map(k =>
    `<span><span class="sw ${k}">${SIMBOLO[k]}</span><b>${CLASSES[k].nome}</b> <span class="muted">${DESC_CLASSE[k]}</span></span>`).join('');
}

// ---------------------------------------------------------------- render geral
function render() {
  gravarHash();
  const cartao = cartaoAtual();
  const r = $('resumo');
  r.textContent = `${NOME_PILOTO[E.piloto]}: ${cartao.resumo}.`;
  r.className = 'resumo ' + (cartao.licenciavel ? 'ok' : 'bad');
  renderGrade($('grade'), frota, true);
  renderGrade($('grade-extras'), extras.filter(x => celula(E.piloto, x, missoes[0])), false);
  $('rodape-grade').textContent = `Cada célula: ${L.reps} corridas com as sementes ${L.seed0} a ${L.seed0 + L.reps - 1}, as mesmas para o cérebro e para a referência. ` +
    `Tolerância ${String(opc.tol).replace('.', ',')}. Pré-calculado em ${new Date(L.gerado).toLocaleString('pt-BR')}.`;
  renderPainel();
  renderCartao(cartao);
}

function cartaoAtual() {
  const dados = { [E.cond]: L.pilotos[E.piloto][E.cond] }, esp = { [E.cond]: L.pilotos.especialista[E.cond] };
  return montarCartao({ piloto: E.piloto, dados, esp, robos: frota, missoes, opc });
}

const iconeCache = {};
function iconeRobo(id) {
  if (!iconeCache[id]) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); g.translate(32, 32); g.rotate(-Math.PI / 2);
    drawRobot(g, corpoDe(id), 82);
    iconeCache[id] = c.toDataURL();
  }
  const img = new Image(); img.src = iconeCache[id]; img.width = img.height = 28; img.alt = '';
  img.style.verticalAlign = 'middle'; img.style.marginRight = '4px';
  return img;
}

function renderGrade(tab, robos, cabecalho) {
  tab.innerHTML = '';
  if (!robos.length) return;
  const thead = tab.createTHead().insertRow();
  thead.append(document.createElement('th'));
  for (const m of MISSIONS) {
    const th = document.createElement('th');
    th.innerHTML = cabecalho ? `${m.id}<small>${esc(curtoMissao(m))}</small>` : '';
    th.title = m.nome;
    thead.append(th);
  }
  const tb = tab.createTBody();
  for (const r of robos) {
    const tr = tb.insertRow();
    const th = document.createElement('th'); th.className = 'robo';
    th.append(iconeRobo(r), roboById(r).nome);
    tr.append(th);
    for (const m of missoes) {
      const b = celula(E.piloto, r, m), e = celula('especialista', r, m);
      const cls = classe(r, m);
      const td = tr.insertCell();
      td.className = `cel ${cls}` + (E.robo === r && E.missao === m ? ' sel' : '');
      td.textContent = `${pct(taxa(b))} ${SIMBOLO[cls]}`;
      td.title = `${roboById(r).nome} · ${missionById(m).nome}\n${CLASSES[cls].nome}\n` +
        `${NOME_PILOTO[E.piloto]}: ${b.ok}/${b.n} chegaram\nReferência: ${e.ok}/${e.n} chegaram\n` +
        `Risco: ${riscoDe(b).toFixed(2).replace('.', ',')} · pior: ${GRAV_TEXTO[piorGravidade(b)]}`;
      td.onclick = () => { E.robo = r; E.missao = m; player.parar(); render(); };
    }
  }
}

// ---------------------------------------------------------------- painel da célula
function renderPainel() {
  const temCel = E.robo && celula(E.piloto, E.robo, E.missao);
  $('painel-vazio').classList.toggle('hidden', !!temCel);
  $('painel-cel').classList.toggle('hidden', !temCel);
  if (!temCel) { player.limpar(); return; }
  const r = E.robo, m = E.missao, mis = missionById(m);
  const b = celula(E.piloto, r, m), e = celula('especialista', r, m);
  const cls = classe(r, m);
  $('p-titulo').textContent = `${roboById(r).nome} · ${m}`;
  $('p-missao').textContent = mis.nome + (roboById(r).frota ? '' : ' · robô que não faz parte da frota (não entra na licença)');
  const refOk = taxa(e) >= opc.tol;
  $('p-lado').innerHTML =
    `<div class="bloco ${cls}"><b>${NOME_PILOTO[E.piloto]}</b><span class="tx">${b.ok}/${b.n}</span> chegaram<br>` +
    `<span class="small">${SIMBOLO[cls]} ${CLASSES[cls].nome}</span></div>` +
    `<div class="bloco ${refOk ? 'liberado' : 'limite'}"><b>Piloto de referência</b><span class="tx">${e.ok}/${e.n}</span> chegaram<br>` +
    `<span class="small">${refOk ? 'consegue: o corpo e a missão são possíveis' : 'não consegue: limite físico'}</span></div>`;
  $('p-col-b').textContent = NOME_PILOTO[E.piloto].toLowerCase();
  const tb = $('p-corridas'); tb.innerHTML = '';
  for (let k = 0; k < b.n; k++) {
    const seed = L.seed0 + k;
    const tr = tb.insertRow();
    tr.insertCell().textContent = k + 1;
    tr.insertCell().textContent = seed;
    for (const [p, cel] of [[E.piloto, b], ['especialista', e]]) {
      const [gi, t] = cel.runs[k], g = GRAVIDADES[gi];
      const td = tr.insertCell(); td.className = 'g-' + g; td.id = `res-${p}-${k}`;
      td.textContent = `${TEXTO_G[g]} · ${fmtT(t)}`;
      const bt = document.createElement('button'); bt.textContent = '▶'; bt.title = `Replay: ${NOME_PILOTO[p]}, corrida ${k + 1}`;
      bt.onclick = () => replay(p, k);
      tr.insertCell().append(bt);
    }
  }
  $('rastros-b').textContent = `Rastros nas 7 missões: ${NOME_PILOTO[E.piloto].toLowerCase()}`;
  $('rastros-b').onclick = () => rastros(E.piloto);
  $('rastros-e').onclick = () => rastros('especialista');
  if (!player.run && !player.trilhas) player.preview(r, mis);
}

// corrida pré-calculada k de uma célula: mesma semente e mesmas opções → mesma corrida
async function novaCorrida(p, r, m, k) {
  const pilot = await loadPilot(p);
  return new Run(corpoDe(r), missionById(m), L.seed0 + k, pilot, undefined, condById(E.cond).opts);
}

// confere o resultado do navegador com o pré-calculado (3.6: mostrar, não esconder)
function conferir(p, r, m, k, res) {
  const [gi, t] = celula(p, r, m).runs[k];
  return res.gravidade === GRAVIDADES[gi] && Math.abs(res.t - t) < 0.01 ? null
    : `este navegador reproduziu com outro resultado (${TEXTO_G[res.gravidade]} · ${fmtT(res.t)}; pré-cálculo: ${TEXTO_G[GRAVIDADES[gi]]} · ${fmtT(t)})`;
}

async function replay(p, k) {
  const r = E.robo, m = E.missao;
  player.parar();
  $('status').textContent = 'Carregando…';
  let run;
  try { run = await novaCorrida(p, r, m, k); }
  catch (e) { $('status').textContent = 'Erro ao carregar o piloto: ' + e.message; return; }
  const rotulo = `${NOME_PILOTO[p]} · corrida ${k + 1} (semente ${L.seed0 + k})`;
  player.play(run, corpoDe(r), rotulo, res => {
    const aviso = conferir(p, r, m, k, res);
    if (aviso) $('status').innerHTML += `<br><span class="aviso-replay">⚠ ${esc(aviso)}</span>`;
  });
}

// Resultado sem o detalhe de gravidade: chegou / bateu / tempo.
const DESFECHO = { ok: 'chegou', quase: 'chegou', travou: 'tempo', raspao: 'bateu', grave: 'bateu' };
// A célula diverge se as corridas dela não têm todas o mesmo desfecho.
const diverge = cel => new Set(cel.runs.map(([gi]) => DESFECHO[GRAVIDADES[gi]])).size > 1;

// Rastros do robô nas 7 missões: uma corrida por missão; todas as corridas onde a célula diverge.
async function rastros(p) {
  const r = E.robo;
  player.parar();
  $('status').textContent = 'Rodando as corridas…';
  await new Promise(res => setTimeout(res, 20));      // deixa o texto aparecer
  const trilhas = [], avisos = [], porMissao = [];
  try {
    for (const m of missoes) {
      const cel = celula(p, r, m), div = diverge(cel);
      const ks = div ? [...Array(cel.n).keys()] : [0];
      const res1 = [];
      for (const k of ks) {
        const run = await novaCorrida(p, r, m, k);
        const res = run.runToEnd();
        trilhas.push({ trail: [...run.world.trail, [run.world.x, run.world.y]], res, w: run.world, path: run.path, missao: m });
        res1.push(res);
        const a = conferir(p, r, m, k, res); if (a) avisos.push(`${m}, corrida ${k + 1}: ${a}`);
      }
      porMissao.push({ m, div, res: res1 });
      await new Promise(res => setTimeout(res, 0));    // não trava a aba
    }
  } catch (e) { $('status').textContent = 'Erro: ' + e.message; return; }
  player.mostrarRastros(trilhas, corpoDe(r), E.missao);
  const marca = g => `<span style="color:${COR_G[g]}">■</span>`;
  const linha = ({ m, div, res }) => {
    if (!div) return `${marca(res[0].gravidade)} ${m}`;
    const cont = {};
    for (const x of res) cont[DESFECHO[x.gravidade]] = (cont[DESFECHO[x.gravidade]] || 0) + 1;
    const rot = { chegou: ['chegou', 'chegaram'], bateu: ['bateu', 'bateram'], tempo: ['travou', 'travaram'] };
    return `<b>${m}: divergiu</b> (${Object.entries(cont).map(([d, n]) => `${n} ${rot[d][n > 1 ? 1 : 0]}`).join(', ')}; todas as ${res.length} corridas desenhadas)`;
  };
  const usadas = GRAVIDADES.filter(g => trilhas.some(t => t.res.gravidade === g));
  $('status').innerHTML = `<b>${esc(NOME_PILOTO[p])}</b> · ${esc(roboById(r).nome)} nas 7 missões: ` + porMissao.map(linha).join(' · ') +
    `<br><span class="muted">${usadas.map(g => `${marca(g)} ${TEXTO_G[g]}`).join(' · ')}</span>` +
    (avisos.length ? `<br><span class="aviso-replay">⚠ ${esc(avisos.join('; '))}</span>` : '');
}

// ---------------------------------------------------------------- galpão animado
const cv = $('cv'), ctx = cv.getContext('2d');
const view = viewFor(WAREHOUSE, cv.width, cv.height);
let velocidade = 2;

const player = {
  run: null, body: null, mission: null, raf: 0, onEnd: null, rotulo: '', trilhas: null, prevRun: null,

  preview(r, mission) {
    this.parar();
    this.body = corpoDe(r); this.mission = mission;
    this.prevRun = new Run(this.body, mission, L.seed0, () => null, undefined, condById(E.cond).opts);
    $('status').textContent = 'Rota planejada e saída da corrida 1. Clique em ▶ para assistir a uma corrida.';
    desenhar();
  },

  play(run, body, rotulo, onEnd) {
    this.parar();
    this.run = run; this.body = body; this.mission = run.mission; this.rotulo = rotulo; this.onEnd = onEnd;
    let last = performance.now(), acc = 0;
    const tick = now => {
      acc += Math.min(0.1, (now - last) / 1000) * velocidade; last = now;
      while (acc >= DT && !run.world.done) { run.step(); acc -= DT; }
      desenhar();
      if (run.world.done) {
        this.raf = 0;
        const cb = this.onEnd; this.onEnd = null;
        cb?.(run.result());
      } else this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  },

  // trilhas: [{ trail, res, w, path, missao }]; destaque: missão da célula clicada
  mostrarRastros(trilhas, body, destaque) {
    this.parar();
    this.trilhas = trilhas; this.body = body; this.destaque = destaque; this.mission = missionById(destaque);
    desenhar();
  },

  parar() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0; this.onEnd = null; this.run = null; this.trilhas = null; this.prevRun = null;
  },

  limpar() { this.parar(); this.mission = null; $('status').textContent = ''; desenhar(); }
};

function desenhar() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  const m = player.mission;
  drawWarehouse(ctx, WAREHOUSE, view, { highlight: m ? estacaoDe(m) : undefined });
  const run = player.run;
  if (run) {
    const w = run.world;
    drawPath(ctx, run.path, view);
    drawTrail(ctx, w.trail, view, undefined, [w.x, w.y]);
    drawRobotAt(ctx, player.body, w, view);
    const t = w.t * DT;
    const res = w.done ? run.result() : null;
    $('status').innerHTML = `${esc(player.rotulo)} · ` + (!res ? fmtT(t)
      : `<b class="${res.status === 'chegou' ? 'ok' : 'bad'}">${TEXTO_G[res.gravidade]}</b> em ${fmtT(t)}`);
  } else if (player.trilhas) {
    // rota planejada só da missão clicada; ela é desenhada por último, por cima das outras
    const dest = player.trilhas.find(t => t.missao === player.destaque);
    if (dest) drawPath(ctx, dest.path, view);
    const ordem = [...player.trilhas.filter(t => t.missao !== player.destaque), ...player.trilhas.filter(t => t.missao === player.destaque)];
    for (const tr of ordem) {
      drawTrail(ctx, tr.trail, view, COR_G[tr.res.gravidade]);
      drawRobotAt(ctx, player.body, tr.w, view, { ghost: true });
    }
    // rótulo da missão no fim de cada rastro (uma vez por missão)
    ctx.font = `700 ${Math.round(0.16 * view.s)}px system-ui, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    const rotulados = new Set(), pilha = {};
    for (const tr of ordem) {
      if (rotulados.has(tr.missao)) continue;
      rotulados.add(tr.missao);
      const [x, y] = tr.trail[tr.trail.length - 1];
      const chave = `${Math.round(x * 2)},${Math.round(y * 2)}`;     // fins a menos de ~50 cm: empilha
      const n = pilha[chave] = (pilha[chave] ?? -1) + 1;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const tx = view.X(x) + 8, ty = view.Y(y) - 6 - n * 0.21 * view.s, w = ctx.measureText(tr.missao).width;
      ctx.fillRect(tx - 3, ty - 0.17 * view.s, w + 6, 0.19 * view.s);
      ctx.fillStyle = C.ink; ctx.fillText(tr.missao, tx, ty);
    }
  } else if (player.prevRun) {
    drawPath(ctx, player.prevRun.path, view);
    drawRobotAt(ctx, player.body, { ...player.prevRun.start }, view);
  }
}

for (const k of [1, 2, 4]) {
  const b = document.createElement('button');
  b.textContent = k + '×';
  b.onclick = () => { velocidade = k; for (const x of $('velocidades').children) x.classList.toggle('sel', x === b); };
  if (k === velocidade) b.classList.add('sel');
  $('velocidades').append(b);
}

// ---------------------------------------------------------------- cartão da licença (4.4)
const juntar = xs => xs.length <= 1 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1];

// agrupa itens [{robo, missao, ...}] por robô: "Empilhadeira: todas as missões"
function porRobo(itens) {
  const g = {};
  for (const i of itens) (g[i.robo] ||= []).push(i);
  return Object.entries(g).map(([r, xs]) => ({
    robo: r, nome: roboById(r).nome, itens: xs,
    missoesTexto: xs.length === missoes.length ? 'todas as missões' : juntar(xs.map(i => i.missao))
  }));
}

function renderCartao(c = cartaoAtual()) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const ord = ['grave', 'raspao', 'travou', 'quase', 'ok'];
  const pior = xs => ord.find(g => xs.some(i => i.gravidade === g));
  const faixa = xs => {
    const a = Math.min(...xs.map(i => i.taxa)), b = Math.max(...xs.map(i => i.taxa));
    return a === b ? pct(a) : `${pct(a)} a ${pct(b)}`;
  };
  const lista = (xs, vazio) => xs.length ? `<ul>${xs.join('')}</ul>` : `<p class="muted">${vazio}</p>`;
  const nRobos = frota.length;
  const exc = new Set([...c.bloqueado, ...c.fora].map(i => i.robo));

  $('cartao').innerHTML = `
    <div class="row" style="align-items:baseline">
      <h2>Licença de operação · ${esc(NOME_PILOTO[c.piloto])}</h2>
      <span class="grow"></span>
      <span class="selo-lic ${c.licenciavel ? 'ok' : 'bad'}">${c.licenciavel ? 'Licenciável para a frota' : 'Licença com restrições'}</span>
    </div>
    <p class="muted small">Condição avaliada: nominal · tolerância ${String(c.tol).replace('.', ',')} · ${L.reps} corridas por célula ·
      gerada automaticamente a partir do pré-cálculo, sem edição manual.</p>

    <h3>Liberado para</h3>
    <p>${c.bloqueado.length + c.fora.length === 0
      ? '<b>Todos os robôs da frota, em todas as missões.</b>'
      : `<b>${nRobos - exc.size} de ${nRobos} robôs da frota em todas as missões.</b> ` +
        `Exceções: ${esc(c.liberadoTexto.replace(/^todos os robôs, todas as missões, exceto: /, ''))}.`}</p>

    <h3>Bloqueado (defeito do cérebro)</h3>
    ${lista(porRobo(c.bloqueado).map(g =>
      `<li><b>${esc(g.nome)}</b>, ${g.missoesTexto}: o cérebro chega em ${faixa(g.itens)}, a referência em ` +
      `${faixa(g.itens.map(i => ({ taxa: i.taxaEsp })))}. Pior caso: ${GRAV_TEXTO[pior(g.itens)]}.</li>`), 'Nada.')}

    <h3>Fora do envelope (limite físico)</h3>
    ${lista(porRobo(c.fora).map(g =>
      `<li><b>${esc(g.nome)}</b>, ${g.missoesTexto}: nenhum piloto conseguiu, nem o de referência. Não conta contra o cérebro.</li>`), 'Nada: em toda a frota o piloto de referência consegue.')}

    <h3>Testes físicos obrigatórios</h3>
    ${lista(c.testes.map(i =>
      `<li>${esc(roboById(i.robo).nome)} em ${i.missao} (${esc(missionById(i.missao).nome)}): risco ${i.risco.toFixed(2).replace('.', ',')}, ${GRAV_TEXTO[i.gravidade]}.</li>`),
      'Nenhum na condição nominal.')}

    <h3>O que falta treinar</h3>
    ${lista(c.treinar.map(t => `<li>${esc(t[0].toUpperCase() + t.slice(1))}.</li>`), 'Nada na condição nominal.')}

    <div class="assinaturas">
      <div>Certificadora<br><span class="muted">nome e data</span></div>
      <div>Fabricante do cérebro<br><span class="muted">nome e data</span></div>
      <div>Fábrica usuária<br><span class="muted">nome e data</span></div>
    </div>
    <p class="muted small" style="margin-top:14px">Emitida em ${hoje} · cérebro: versão ${esc(versaoModelo || '…')} ·
      ferramenta: versão ${VERSAO_FERRAMENTA} · pré-cálculo de ${new Date(L.gerado).toLocaleDateString('pt-BR')}.</p>`;
}

$('imprimir').onclick = () => window.print();

iniciar();
