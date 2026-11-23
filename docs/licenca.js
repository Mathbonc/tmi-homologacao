// Página do licenciador (CLAUDE.md, seção 4). Lê o pré-cálculo (model/licencas.json), mostra a
// grade robô × missão, o painel da célula com replay e todos os rastros, e o cartão da licença.
// Toda a lógica (classificação, cartão, corrida) vem de core/; aqui só se desenha.
import { MISSIONS, WAREHOUSE, missionById } from './core/warehouse.js';
import { Run, PASSO_OBSTACULO, PASSO_EMPURRAO } from './core/episode.js';
import { DT } from './core/physics.js';
import { drawWarehouse, drawPath, drawTrail, drawRobotAt, drawRobot, drawTarget, viewFor, C } from './core/draw.js';
import { loadPilot, loadModel, BRAIN_NAMES } from './core/pilots.js';
import {
  ROBOS, roboById, corpoDe, condById, classificar, montarCartao, taxa, riscoDe, piorGravidade, contagem,
  GRAVIDADES, GRAV_TEXTO, CLASSES, TOL_PADRAO, VERSAO_FERRAMENTA, CONDICOES, EIXOS, eixoById, idCondicao, descTeste
} from './core/licenca.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtT = s => s.toFixed(1).replace('.', ',') + ' s';
const pct = x => `${Math.round(100 * x)}%`;
const NOME_PILOTO = { especialista: 'Piloto de referência', cerebro1: 'Cérebro 1', cerebro2: 'Cérebro 2', cerebro3: 'Cérebro 3', cerebro4: 'Cérebro 4' };
const SIMBOLO = { liberado: '✓', testar: '!', defeito: '✕', limite: '–' };
const DESC_CLASSE = {
  liberado: 'cérebro ≥ 90%, sem colisão grave',
  testar: 'liberado, mas com falha leve, quase-acidente ou no último nível antes de um limite',
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
const COR_B = '#c2551f', COR_E = '#2a6fb0';      // séries da varredura (paleta validada)
const fmtNum = x => String(x).replace('.', ',');
const rotuloCond = id => condById(id).rotulo;
const fmtRisco = x => x.toFixed(2).replace('.', ',');

// ---------------------------------------------------------------- estado
let L = null;                      // licencas.json
const E = { piloto: 'cerebro1', cond: 'nominal', robo: null, missao: null };
const opc = { tol: TOL_PADRAO };

const celula = (p, r, m, cond = E.cond) => L.pilotos[p]?.[cond]?.[r]?.[m];
// borda: a célula está no último nível antes do limite deste eixo (vira amarela: testar)
let bordasCartao = {};
const ehBorda = (r, m) => (bordasCartao[E.cond] || []).includes(`${r}/${m}`);
const classe = (r, m) => classificar(celula(E.piloto, r, m), celula('especialista', r, m), { ...opc, borda: ehBorda(r, m) });
// ícone da pior gravidade (3.5); 'ok' não tem ícone
const ICONE_G = { grave: '✸', raspao: '≈', travou: '◷', quase: '◌' };

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
  montarSeletorCond();
  montarSeletor();
  montarLegenda();
  render();
  loadModel().then(m => { versaoModelo = m.versao; renderCartao(); }).catch(() => {});
}
let versaoModelo = null;

// #cerebro1/robo/missao@condição (robô, missão e condição são opcionais)
function lerHash() {
  const [base, cond] = decodeURIComponent(location.hash.slice(1)).split('@');
  const [p, r, m] = base.split('/');
  if (BRAIN_NAMES.includes(p) && L.pilotos[p]) E.piloto = p;
  if (roboById(r) && missionById(m)) { E.robo = r; E.missao = m; }
  E.cond = cond && condById(cond) && temCond(cond) ? cond : 'nominal';
}
function gravarHash() {
  const h = [E.piloto, ...(E.robo ? [E.robo, E.missao] : [])].join('/') + (E.cond !== 'nominal' ? '@' + E.cond : '');
  history.replaceState(null, '', '#' + h);
}
window.addEventListener('hashchange', () => { lerHash(); player.parar(); marcarSeletor(); render(); });

// a condição existe no pré-cálculo para o cérebro e a referência, na frota inteira
const temCond = (id, p = E.piloto) => [p, 'especialista'].every(q => frota.every(r => L.pilotos[q]?.[id]?.[r]));

function montarSeletorCond() {
  const sel = $('sel-cond');
  sel.innerHTML = '';
  const opcao = (id, txt) => { const o = document.createElement('option'); o.value = id; o.textContent = txt; return o; };
  sel.append(opcao('nominal', 'Nominal (sem imprevisibilidade)'));
  for (const e of EIXOS) {
    const ids = e.niveis.map(n => idCondicao(e, n)).filter(id => temCond(id));
    if (!ids.length) continue;
    if (e.binario) { sel.append(opcao(ids[0], e.nome)); continue; }
    const g = document.createElement('optgroup'); g.label = e.nome;
    for (const id of ids) g.append(opcao(id, `${e.nome}: ${e.fmt(condById(id).nivel)}`));
    sel.append(g);
  }
  sel.onchange = () => mudarCond(sel.value);
}
function mudarCond(id) { E.cond = id; player.parar(); marcarSeletor(); render(); }

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
function marcarSeletor() {
  for (const b of $('sel-cerebro').querySelectorAll('button')) b.classList.toggle('sel', b.dataset.p === E.piloto);
  $('sel-cond').value = E.cond;
}

function montarLegenda() {
  $('legenda').innerHTML = Object.keys(CLASSES).map(k =>
    `<span><span class="sw ${k}">${SIMBOLO[k]}</span><b>${CLASSES[k].nome}</b> <span class="muted">${DESC_CLASSE[k]}</span></span>`).join('') +
    `<span class="leg-g"><b>Pior caso nas corridas do cérebro:</b> ` +
    ['grave', 'raspao', 'travou', 'quase'].map(g => `<span class="gi-leg">${ICONE_G[g]}</span> ${GRAV_TEXTO[g]}`).join(' · ') +
    ` <span class="muted">(sem ícone: todas chegaram com folga)</span></span>`;
}

// ---------------------------------------------------------------- render geral
function render() {
  gravarHash();
  const cartao = cartaoAtual();
  bordasCartao = cartao.bordas;
  const r = $('resumo');
  r.textContent = `${NOME_PILOTO[E.piloto]}: ${cartao.resumo}.`;
  r.className = 'resumo ' + (cartao.licenciavel ? 'ok' : 'bad');
  $('resumo-cond').innerHTML = resumoCond();
  renderGrade($('grade'), frota, true);
  renderGrade($('grade-extras'), extras.filter(x => celula(E.piloto, x, missoes[0])), false);
  $('rodape-grade').textContent = `Cada célula: ${L.reps} corridas com as sementes ${L.seed0} a ${L.seed0 + L.reps - 1}, as mesmas para o cérebro e para a referência. ` +
    `Tolerância ${String(opc.tol).replace('.', ',')}. Pré-calculado em ${new Date(L.gerado).toLocaleString('pt-BR')}.`;
  renderPainel();
  renderVarredura(cartao);
  renderCartao(cartao);
}

// O cartão é sempre o da licença: classes do nominal + limites de operação de toda a varredura.
function cartaoAtual() {
  const dados = {}, esp = {};
  for (const c of CONDICOES) if (temCond(c.id)) { dados[c.id] = L.pilotos[E.piloto][c.id]; esp[c.id] = L.pilotos.especialista[c.id]; }
  return montarCartao({ piloto: E.piloto, dados, esp, robos: frota, missoes, opc });
}

// Linha abaixo do resumo: o que a condição escolhida muda na grade em relação ao nominal.
function resumoCond() {
  if (E.cond === 'nominal') return 'Grade na condição nominal. Escolha uma condição para ver a grade sob aquela imprevisibilidade.';
  const mud = {};
  let n = 0;
  for (const r of frota) for (const m of missoes) {
    const c0 = classificar(celula(E.piloto, r, m, 'nominal'), celula('especialista', r, m, 'nominal'), opc), c1 = classe(r, m);
    if (c0 !== c1) { n++; mud[c1] = (mud[c1] || 0) + 1; }
  }
  const nomes = { defeito: 'defeito do cérebro', limite: 'limite físico', testar: 'testar fisicamente', liberado: 'liberado' };
  return `Grade sob <b>${esc(rotuloCond(E.cond))}</b> (cérebro e referência recebem a mesma perturbação). ` +
    (n ? `${n} célula${n > 1 ? 's' : ''} da frota mud${n > 1 ? 'aram' : 'ou'} de classe em relação ao nominal: ` +
         Object.entries(mud).map(([k, v]) => `${v} para ${nomes[k]}`).join(', ') + '.'
       : 'Nenhuma célula da frota mudou de classe em relação ao nominal.') +
    ' O cartão abaixo continua sendo o da licença (nominal + limites de operação).';
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
      const g = piorGravidade(b);
      td.innerHTML = `${pct(taxa(b))} ${SIMBOLO[cls]}` + (ICONE_G[g] ? `<span class="gi">${ICONE_G[g]}</span>` : '');
      td.title = `${roboById(r).nome} · ${missionById(m).nome}\n${CLASSES[cls].nome}` +
        (ehBorda(r, m) ? ' (último nível antes do limite: no nível seguinte vira defeito)' : '') + '\n' +
        `${NOME_PILOTO[E.piloto]}: ${b.ok}/${b.n} chegaram\nReferência: ${e.ok}/${e.n} chegaram\n` +
        `Risco: ${fmtRisco(riscoDe(b))} · pior caso: ${GRAV_TEXTO[g]}`;
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
  $('p-missao').textContent = mis.nome + (E.cond !== 'nominal' ? ` · condição: ${rotuloCond(E.cond)}` : '') +
    (roboById(r).frota ? '' : ' · robô que não faz parte da frota (não entra na licença)');
  const refOk = taxa(e) >= opc.tol;
  const linhaRisco = c => { const g = piorGravidade(c); return `<span class="small">risco ${fmtRisco(riscoDe(c))} · pior caso: ${ICONE_G[g] ? ICONE_G[g] + ' ' : ''}${GRAV_TEXTO[g]}</span>`; };
  $('p-lado').innerHTML =
    `<div class="bloco ${cls}"><b>${NOME_PILOTO[E.piloto]}</b><span class="tx">${b.ok}/${b.n}</span> chegaram<br>` +
    `<span class="small">${SIMBOLO[cls]} ${CLASSES[cls].nome}${ehBorda(r, m) ? ' (último nível antes do limite)' : ''}</span><br>${linhaRisco(b)}</div>` +
    `<div class="bloco ${refOk ? 'liberado' : 'limite'}"><b>Piloto de referência</b><span class="tx">${e.ok}/${e.n}</span> chegaram<br>` +
    `<span class="small">${refOk ? 'consegue: o corpo e a missão são possíveis' : 'não consegue: limite físico'}</span><br>${linhaRisco(e)}</div>`;
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
        trilhas.push({ trail: [...run.world.trail, [run.world.x, run.world.y]], res, w: run.world, path: run.path, missao: m, obst: run.obstaculo });
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
  $('status').innerHTML = `<b>${esc(NOME_PILOTO[p])}</b> · ${esc(roboById(r).nome)} nas 7 missões` +
    (E.cond !== 'nominal' ? ` (${esc(rotuloCond(E.cond))})` : '') + ': ' + porMissao.map(linha).join(' · ') +
    `<br><span class="muted">${usadas.map(g => `${marca(g)} ${TEXTO_G[g]}`).join(' · ')}</span>` +
    (avisos.length ? `<br><span class="aviso-replay">⚠ ${esc(avisos.join('; '))}</span>` : '');
}

// ---------------------------------------------------------------- varredura (4.3)
// Um gráfico por eixo: nível no x, fração do escopo nominal mantida no y, cérebro e referência.
function renderVarredura(c) {
  const box = $('varreduras');
  $('leg-cerebro').textContent = NOME_PILOTO[E.piloto].toLowerCase();
  const escopo = frota.flatMap(r => missoes.filter(m => CLASSES[c.classes[r][m]].dentro).map(m => [r, m]));
  const mantemE = id => escopo.filter(([r, m]) => { const e = celula('especialista', r, m, id); return taxa(e) >= opc.tol && contagem(e, 'grave') === 0; }).length / (escopo.length || 1);
  const fe0 = mantemE('nominal');
  box.innerHTML = c.limites.map(l => {
    const eixo = eixoById(l.eixo);
    const unidade = eixo.binario ? '' : eixo.fmt(1).replace(/^[\d,]+\s*/, '');
    const pts = [{ id: 'nominal', rot: eixo.binario ? 'não' : '0', nome: 'nominal', fracB: 1, fracE: fe0, defeitos: 0 },
      ...l.niveis.map(n => ({ id: idCondicao(eixo, n.nivel), rot: eixo.binario ? 'sim' : fmtNum(n.nivel), nome: eixo.binario ? 'com obstáculo' : eixo.fmt(n.nivel), ...n }))];
    const iLim = l.limite ? pts.findIndex(p => p.nivel === l.limite) : 0;
    return `<div class="varr"><h3>${esc(eixo.nome)}</h3><p class="lim">${esc(l.texto.replace(eixo.nome + ': ', ''))}${refLimite(l, true)}</p>` +
      graficoVarredura(pts, iLim, unidade) + '</div>';
  }).join('') || '<p class="muted">O pré-cálculo não tem condições de varredura.</p>';
  box.onclick = ev => { const g = ev.target.closest?.('.col'); if (g) mudarCond(g.dataset.id); };
}

function graficoVarredura(pts, iLim, unidade) {
  const W = 240, H = 136, l = 34, r = 10, t = 10, b = 30, k = pts.length;
  const x = i => k === 1 ? (l + W - r) / 2 : l + i * (W - l - r) / (k - 1);
  const y = v => t + (1 - v) * (H - t - b);
  const passo = k > 1 ? (W - l - r) / (k - 1) : W - l - r;
  const pct0 = v => `${Math.round(100 * v)}%`;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="varredura">`;
  if (iLim > 0) s += `<rect x="${x(0)}" y="${t}" width="${x(iLim) - x(0)}" height="${H - t - b}" fill="var(--c-liberado)"/>`;
  for (const v of [0, 0.5, 1]) s += `<line x1="${l}" x2="${W - r}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(20,24,28,.12)"/>` +
    `<text x="${l - 5}" y="${y(v) + 4}" text-anchor="end">${pct0(v)}</text>`;
  const linha = (key, cor, tr) => `<polyline points="${pts.map((p, i) => `${x(i)},${y(p[key])}`).join(' ')}" fill="none" stroke="${cor}" stroke-width="2" ${tr}/>`;
  s += linha('fracE', COR_E, 'stroke-dasharray="5 4"');
  s += pts.map((p, i) => `<rect x="${x(i) - 4}" y="${y(p.fracE) - 4}" width="8" height="8" fill="${COR_E}" stroke="#fff" stroke-width="1.5"/>`).join('');
  s += linha('fracB', COR_B, '');
  s += pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.fracB)}" r="4.5" fill="${COR_B}" stroke="#fff" stroke-width="2"/>`).join('');
  s += pts.map((p, i) => `<g class="col" data-id="${p.id}"><title>${esc(p.nome)}: ${NOME_PILOTO[E.piloto].toLowerCase()} mantém ${pct0(p.fracB)}, ` +
    `referência ${pct0(p.fracE)}${p.defeitos ? ` · ${p.defeitos} defeito${p.defeitos > 1 ? 's' : ''} do cérebro` : ''} · clique para ver a grade</title>` +
    `<rect class="hit" x="${x(i) - passo / 2}" y="0" width="${passo}" height="${H}" fill="transparent"/>` +
    `<text x="${x(i)}" y="${H - b + 15}" text-anchor="middle" class="${p.id === E.cond ? 'sel' : ''}">${p.rot}</text></g>`).join('');
  if (unidade) s += `<text x="${W - r}" y="${H - 2}" text-anchor="end">${esc(unidade)}</text>`;
  return s + '</svg>';
}

// texto da referência ao lado de um limite
function refLimite(l, curto = false) {
  const eixo = eixoById(l.eixo);
  // limiteEsp: maior nível em que a referência mantém todas as células do escopo
  const perde = n => `perde ${n} ${n > 1 ? 'células' : 'célula'}`;
  const nPerdidas = nv => Math.round((1 - nv.fracE) * (l.escopoN || 0));
  if (eixo.binario) return l.niveis[0]?.fracE < 1 ? `; a referência também ${perde(nPerdidas(l.niveis[0]))} (limite físico, não conta)` : '';
  const max = l.limiteEsp === eixo.niveis[eixo.niveis.length - 1];
  const primeiraQueda = l.niveis.find(nv => nv.fracE < 1);
  return (curto ? '; referência: ' : ' · piloto de referência: ') +
    (l.limiteEsp ? `mantém todas até ${eixo.fmt(l.limiteEsp)}${max && !curto ? ' (maior nível testado)' : ''}`
      : `já ${perde(nPerdidas(primeiraQueda))} em ${eixo.fmt(primeiraQueda.nivel)} (limite físico, não conta)`);
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
    const w = run.world, ob = run.obstaculo;
    if (ob?.r && run.path !== run.pathOriginal) drawPath(ctx, run.pathOriginal, view, '#9aa3a9');
    drawPath(ctx, run.path, view);
    if (ob?.r) desenharObstaculo(ob, w.t - ob.t);
    drawTrail(ctx, w.trail, view, undefined, [w.x, w.y]);
    if (run.empurrao) desenharEmpurrao(run.empurrao, w.t);
    if (run.pert?.ruido && !w.done) { drawTarget(ctx, run.target, view); desenharVisto(w, run.seen); }
    drawRobotAt(ctx, player.body, w, view);
    const t = w.t * DT;
    const res = w.done ? run.result() : null;
    const desc = descPerturbacao(run);
    $('status').innerHTML = `${esc(player.rotulo)} · ` + (!res ? fmtT(t)
      : `<b class="${res.status === 'chegou' ? 'ok' : 'bad'}">${TEXTO_G[res.gravidade]}</b> em ${fmtT(t)}`) +
      (desc ? `<br><span class="muted">${esc(desc)}</span>` : '');
  } else if (player.trilhas) {
    // rota planejada só da missão clicada; ela é desenhada por último, por cima das outras
    const dest = player.trilhas.find(t => t.missao === player.destaque);
    if (dest) drawPath(ctx, dest.path, view);
    const ordem = [...player.trilhas.filter(t => t.missao !== player.destaque), ...player.trilhas.filter(t => t.missao === player.destaque)];
    for (const tr of player.trilhas) if (tr.obst?.r) desenharObstaculo(tr.obst, 99, true);
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
  if (E.cond !== 'nominal' && m) {
    // rótulo da condição no canto do galpão
    const txt = rotuloCond(E.cond);
    ctx.font = `700 ${Math.round(0.18 * view.s)}px system-ui, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const tw = ctx.measureText(txt).width, x0 = view.X(0) + 10, y0 = view.Y(WAREHOUSE.H) + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x0 - 6, y0 - 4, tw + 12, 0.18 * view.s + 10);
    ctx.fillStyle = COR_B; ctx.fillText(txt, x0, y0);
  }
}

// obstáculo que surgiu; idade em passos desde que surgiu (anel de alerta no começo)
function desenharObstaculo(o, idade, fraco = false) {
  const { X, Y, s } = view;
  ctx.globalAlpha = fraco ? 0.45 : 1;
  ctx.fillStyle = C.box; ctx.strokeStyle = C.boxEdge; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(X(o.x), Y(o.y), o.r * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1;
  if (!fraco && idade < 30) {
    ctx.strokeStyle = COR_B; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(X(o.x), Y(o.y), (o.r + 0.08 + 0.004 * idade) * s, 0, Math.PI * 2); ctx.stroke();
  }
}

// seta do empurrão, no ponto em que aconteceu (velocidade somada, desenhada como 0,8 s de deslocamento)
function desenharEmpurrao(e, t) {
  const { X, Y, s } = view;
  const x1 = e.x + e.vx * 0.8, y1 = e.y + e.vy * 0.8;
  ctx.globalAlpha = t - e.t < 40 ? 1 : 0.55;
  ctx.strokeStyle = COR_B; ctx.fillStyle = COR_B; ctx.lineWidth = Math.max(2.5, 0.04 * s);
  ctx.beginPath(); ctx.moveTo(X(e.x), Y(e.y)); ctx.lineTo(X(x1), Y(y1)); ctx.stroke();
  const a = Math.atan2(-(y1 - e.y), x1 - e.x), h = 0.14 * s;
  ctx.beginPath(); ctx.moveTo(X(x1), Y(y1));
  ctx.lineTo(X(x1) - h * Math.cos(a - 0.45), Y(y1) - h * Math.sin(a - 0.45));
  ctx.lineTo(X(x1) - h * Math.cos(a + 0.45), Y(y1) - h * Math.sin(a + 0.45));
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}

// ponto-alvo que o piloto recebeu (com ruído), ligado ao robô
function desenharVisto(w, seen) {
  const { X, Y, s } = view;
  ctx.strokeStyle = COR_B; ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(w.x), Y(w.y)); ctx.lineTo(X(seen.wx), Y(seen.wy)); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(X(seen.wx), Y(seen.wy), Math.max(5, 0.07 * s), 0, Math.PI * 2); ctx.stroke();
}

// o que a perturbação fez nesta corrida, em uma linha
function descPerturbacao(run) {
  const p = run.pert;
  if (!p) return '';
  const x = [];
  if (p.giro) x.push(`saída girada ${run.giroAplicado >= 0 ? '+' : '−'}${Math.abs(Math.round(run.giroAplicado))}° (sorteio entre −${p.giro}° e +${p.giro}°)`);
  if (p.empurrao) x.push(`empurrão de ${fmtNum(p.empurrao)} m/s aos ${fmtNum(PASSO_EMPURRAO * DT)} s` + (run.empurrao ? ' (seta laranja)' : ''));
  if (p.ruido) x.push(`ruído de até ±${p.ruido}° na direção do ponto-alvo: o anel laranja é o que o piloto recebe, o ponto roxo é o real`);
  if (p.atraso) x.push(`atraso de ${fmtNum(p.atraso)} s: cada comando é executado ${Math.round(p.atraso / DT)} passos depois de dado`);
  if (p.obstaculo) {
    const o = run.obstaculo, quando = `aos ${fmtNum(PASSO_OBSTACULO * DT)} s`;
    x.push(!o ? `um obstáculo surge na rota ${quando}` : o.semEspaco ? `o obstáculo não surgiu: ${quando} o robô já estava perto do destino`
      : run.bloqueado ? `obstáculo surgiu ${quando} e não há rota possível: corrida parada (bloqueado)`
      : `obstáculo surgiu ${quando}; rota replanejada (a cinza é a original)`);
  }
  return x.join(' · ');
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
    <p class="muted small">Classes avaliadas na condição nominal; limites de operação por varredura de
      ${CONDICOES.filter(x => x.eixo && temCond(x.id)).length} condições de imprevisibilidade · tolerância ${String(c.tol).replace('.', ',')} ·
      ${L.reps} corridas por célula · gerada automaticamente a partir do pré-cálculo, sem edição manual.</p>

    <h3>Liberado para</h3>
    <p>${c.bloqueado.length + c.fora.length === 0
      ? '<b>Todos os robôs da frota, em todas as missões.</b>'
      : `<b>${nRobos - exc.size} de ${nRobos} robôs da frota em todas as missões.</b> ` +
        `Exceções: ${esc(c.liberadoTexto.replace(/^todos os robôs, todas as missões, exceto: /, ''))}.`}</p>

    <h3>Limites de operação</h3>
    ${lista(c.limites.map(l => `<li>${esc(l.texto)}${esc(refLimite(l))}.</li>`), 'O pré-cálculo não tem varredura.')}
    ${c.limites.length ? '<p class="muted small" style="margin-top:0">Cada limite vale sobre os robôs e missões liberados acima; onde nem o piloto de referência aguenta a perturbação, é limite físico e não conta contra o cérebro.</p>' : ''}

    <h3>Bloqueado (defeito do cérebro)</h3>
    ${lista(porRobo(c.bloqueado).map(g =>
      `<li><b>${esc(g.nome)}</b>, ${g.missoesTexto}: o cérebro chega em ${faixa(g.itens)}, a referência em ` +
      `${faixa(g.itens.map(i => ({ taxa: i.taxaEsp })))}. Pior caso: ${GRAV_TEXTO[pior(g.itens)]}.</li>`), 'Nada.')}

    <h3>Fora do envelope (limite físico)</h3>
    ${lista(porRobo(c.fora).map(g =>
      `<li><b>${esc(g.nome)}</b>, ${g.missoesTexto}: nenhum piloto conseguiu, nem o de referência. Não conta contra o cérebro.</li>`), 'Nada: em toda a frota o piloto de referência consegue.')}

    <h3>Testes físicos obrigatórios</h3>
    ${c.testes.length ? '<p class="muted small" style="margin:0">Ordenados por risco (média dos pesos: colisão grave 10, raspão 3, travou 2, quase-acidente 1). Inclui as células amarelas do nominal e as que passam raspando num limite de operação.</p>' : ''}
    ${lista(c.testes.map(i => `<li><b>risco ${fmtRisco(i.risco)}</b> · ${esc(descTeste(i))}.</li>`), 'Nenhum.')}

    <h3>O que falta treinar</h3>
    ${lista(c.treinar.map(t => `<li>${esc(t[0].toUpperCase() + t.slice(1))}.</li>`), 'Nada.')}

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
