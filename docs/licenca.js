// Página do licenciador (CLAUDE.md, seção 4). Lê o pré-cálculo (model/licencas.json), mostra a
// grade robô × missão, o painel da célula com replay e todos os rastros, e o cartão da licença.
// Toda a lógica (classificação, cartão, corrida) vem de core/; aqui só se desenha.
import { MISSIONS, WAREHOUSE, missionById } from './core/warehouse.js';
import { Run, PASSO_OBSTACULO, PASSO_EMPURRAO } from './core/episode.js';
import { DT } from './core/physics.js';
import { drawWarehouse, drawPath, drawTrail, drawRobotAt, drawRobot, drawTarget, viewFor, C } from './core/draw.js';
import { loadPilot, loadModel, TODOS_CEREBROS as BRAIN_NAMES } from './core/pilots.js';
import {
  ROBOS, roboById, corpoDe, condById, classificar, montarCartao, taxa, riscoDe, piorGravidade, contagem,
  GRAVIDADES, GRAV_TEXTO, CLASSES, TOL_PADRAO, VERSAO_FERRAMENTA, CONDICOES, EIXOS, eixoById, idCondicao, descTeste,
  camadasPadrao, CLASSES_ROBO, PROIBIDAS, NOME_CAMADA, seMantem
} from './core/licenca.js';
import { bodyClass } from './core/parts.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtT = s => s.toFixed(1).replace('.', ',') + ' s';
const pct = x => `${Math.round(100 * x)}%`;
const NOME_PILOTO = { especialista: 'Piloto de referência', cerebro1: 'Cérebro 1', cerebro2: 'Cérebro 2', cerebro3: 'Cérebro 3', cerebro4: 'Cérebro 4', cerebro3v2: 'Cérebro 3v2' };
// para quem se compara cada versão por padrão
const VERSAO_ANTERIOR = { cerebro3v2: 'cerebro3' };
const SIMBOLO = { liberado: '✓', testar: '!', defeito: '✕', limite: '–' };
const DESC_CLASSE = {
  liberado: 'cérebro dentro da tolerância, sem a gravidade proibida',
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
const E = { piloto: 'cerebro1', cond: 'nominal', robo: null, missao: null, comparar: null };
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

// #cerebro1/robo/missao@condição~comparado (robô, missão, condição e comparação são opcionais)
function lerHash() {
  const [semCmp, cmp] = decodeURIComponent(location.hash.slice(1)).split('~');
  const [base, cond] = semCmp.split('@');
  const [p, r, m] = base.split('/');
  if (BRAIN_NAMES.includes(p) && L.pilotos[p]) E.piloto = p;
  if (roboById(r) && missionById(m)) { E.robo = r; E.missao = m; }
  E.cond = cond && condById(cond) && temCond(cond) ? cond : 'nominal';
  E.comparar = cmp && cmp !== E.piloto && BRAIN_NAMES.includes(cmp) && L.pilotos[cmp] ? cmp : null;
}
function gravarHash() {
  const h = [E.piloto, ...(E.robo ? [E.robo, E.missao] : [])].join('/') + (E.cond !== 'nominal' ? '@' + E.cond : '') +
    (E.comparar ? '~' + E.comparar : '');
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
    b.onclick = () => {
      E.piloto = p;
      // ao abrir uma versão nova, já compara com a anterior; ao voltar para uma antiga, desliga
      E.comparar = VERSAO_ANTERIOR[p] && L.pilotos[VERSAO_ANTERIOR[p]] ? VERSAO_ANTERIOR[p] : E.comparar === p ? null : E.comparar;
      player.parar(); marcarSeletor(); render();
    };
    box.append(b);
  }
  const sc = $('sel-comparar');
  sc.innerHTML = '';
  const op = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; return o; };
  sc.append(op('', 'nada'));
  for (const p of BRAIN_NAMES) if (L.pilotos[p]) sc.append(op(p, NOME_PILOTO[p]));
  sc.onchange = () => { E.comparar = sc.value && sc.value !== E.piloto ? sc.value : null; player.parar(); marcarSeletor(); render(); };
  marcarSeletor();
}
function marcarSeletor() {
  for (const b of $('sel-cerebro').querySelectorAll('button')) b.classList.toggle('sel', b.dataset.p === E.piloto);
  $('sel-cond').value = E.cond;
  $('sel-comparar').value = E.comparar || '';
}

function montarLegenda() {
  if (E.comparar) {
    $('legenda').innerHTML = `<span><span class="sw dif-melhor">+</span><b>Passou a liberar</b></span>` +
      `<span><span class="sw dif-pior">−</span><b>Regrediu</b></span><span><span class="sw dif-igual">=</span><b>Igual</b></span>` +
      `<span class="muted">Cada célula: taxa de ${esc(NOME_PILOTO[E.comparar].toLowerCase())} → taxa de ${esc(NOME_PILOTO[E.piloto].toLowerCase())}.</span>`;
    return;
  }
  $('legenda').innerHTML = Object.keys(CLASSES).map(k =>
    `<span><span class="sw ${k}">${SIMBOLO[k]}</span><b>${CLASSES[k].nome}</b> <span class="muted">${DESC_CLASSE[k]}</span></span>`).join('') +
    `<span class="leg-g"><b>Pior caso nas corridas do cérebro:</b> ` +
    ['grave', 'raspao', 'travou', 'quase'].map(g => `<span class="gi-leg">${ICONE_G[g]}</span> ${GRAV_TEXTO[g]}`).join(' · ') +
    ` <span class="muted">(sem ícone: todas chegaram com folga)</span></span>`;
}

// ---------------------------------------------------------------- render geral
function render() {
  gravarHash();
  montarLegenda();
  const cartao = cartaoVig = cartaoAtual();
  bordasCartao = cartao.bordas;
  Object.assign(opc, { tol: cartao.tol, proibida: cartao.proibida });   // as camadas decidem
  const r = $('resumo');
  r.textContent = `${NOME_PILOTO[E.piloto]}: ${cartao.resumo}.`;
  r.className = 'resumo ' + (cartao.licenciavel ? 'ok' : 'bad');
  $('resumo-cond').innerHTML = E.comparar ? resumoComparacao(cartaoAtual(E.comparar)) : resumoCond();
  renderGrade($('grade'), frota, true);
  renderGrade($('grade-extras'), extras.filter(x => celula(E.piloto, x, missoes[0])), false);
  $('rodape-grade').textContent = `Cada célula: ${L.reps} corridas com as sementes ${L.seed0} a ${L.seed0 + L.reps - 1}, as mesmas para o cérebro e para a referência. ` +
    `Tolerância ${String(opc.tol).replace('.', ',')}. Pré-calculado em ${new Date(L.gerado).toLocaleString('pt-BR')}.`;
  renderPainel();
  renderVarredura(cartao);
  renderCamadas();
  renderCartao(cartao);
}
let cartaoVig = null;

// O cartão é sempre o da licença: classes do nominal + limites de operação de toda a varredura.
function cartaoAtual(p = E.piloto) {
  const dados = {}, esp = {};
  for (const c of CONDICOES) if (temCond(c.id, p)) { dados[c.id] = L.pilotos[p][c.id]; esp[c.id] = L.pilotos.especialista[c.id]; }
  return montarCartao({ piloto: p, dados, esp, robos: frota, missoes, opc, camadas: camadasDe(p) });
}

// ---------------------------------------------------------------- comparação de versões (4.6)
const dentroDe = (p, r, m, cond = E.cond) => CLASSES[classificar(celula(p, r, m, cond), celula('especialista', r, m, cond), opc)].dentro;
// diferença de uma célula entre o cérebro atual (novo) e o comparado (antigo)
function difCelula(r, m, cond = E.cond) {
  const a = dentroDe(E.comparar, r, m, cond), b = dentroDe(E.piloto, r, m, cond);
  return a === b ? 'igual' : b ? 'melhor' : 'pior';
}
function resumoComparacao(cA) {
  const nomeA = NOME_PILOTO[E.comparar], nomeB = NOME_PILOTO[E.piloto];
  const conta = cond => {
    const n = { melhor: [], pior: [] };
    for (const r of frota) for (const m of missoes) { const d = difCelula(r, m, cond); if (d !== 'igual') n[d].push(`${roboById(r).nome} ${m}`); }
    return n;
  };
  const aqui = conta(E.cond);
  let piorEmAlguma = 0;
  for (const c of CONDICOES) if (temCond(c.id) && temCond(c.id, E.comparar)) piorEmAlguma += conta(c.id).pior.length;
  // limites: o que mudou, e se a queda vem só de células que a versão antiga nem liberava
  const cB = cartaoVig, linhas = [];
  for (const lb of cB.limites) {
    const la = cA.limites.find(x => x.eixo === lb.eixo); if (!la || la.limite === lb.limite) continue;
    const e = eixoById(lb.eixo), f = v => e.binario ? (v ? 'sim' : 'não') : v ? e.fmt(v) : 'não tolera';
    let txt = `${e.nome}: ${f(la.limite)} → ${f(lb.limite)}`;
    if (lb.limite < la.limite) {
      const nivel = e.niveis.find(n => n > lb.limite), id = idCondicao(e, nivel);
      const caem = cB.robos.flatMap(r => cB.missoes.filter(m => CLASSES[cB.classes[r][m]].dentro &&
        classificar(celula(E.piloto, r, m, id), celula('especialista', r, m, id), opc) === 'defeito').map(m => [r, m]));
      const novas = caem.filter(([r, m]) => !dentroDe(E.comparar, r, m, 'nominal'));
      txt += novas.length === caem.length
        ? ` (só porque a licença nova cobre mais células: ${juntar(novas.map(([r, m]) => `${roboById(r).nome} ${m}`))}, que o ${nomeA.toLowerCase()} nem liberava, ` +
          `não ${novas.length > 1 ? 'aguentam' : 'aguenta'} ${e.fmt(nivel)})`
        : ' (piorou)';
    } else txt += ' (melhorou)';
    linhas.push(txt);
  }
  return `<b>Comparando ${esc(nomeB)} com ${esc(nomeA)}</b> na grade (${esc(rotuloCond(E.cond))}): ` +
    `${aqui.melhor.length} célula${aqui.melhor.length === 1 ? '' : 's'} passa${aqui.melhor.length === 1 ? '' : 'm'} a liberar, ` +
    `${aqui.pior.length} regred${aqui.pior.length === 1 ? 'iu' : 'iram'}. ` +
    (piorEmAlguma ? `<b>Em todas as condições juntas, ${piorEmAlguma} regressões.</b>` : 'Nenhuma célula regrediu em nenhuma das condições.') +
    (linhas.length ? `<br>Limites de operação: ${esc(linhas.join('; '))}.` : '');
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
  const mFora = cabecalho ? cartaoVig.missoesFora : [];
  const rFora = cabecalho ? Object.fromEntries(cartaoVig.foraEscopo.map(i => [i.robo, i])) : {};
  for (const m of MISSIONS) {
    const th = document.createElement('th');
    th.innerHTML = cabecalho ? `${m.id}<small>${esc(curtoMissao(m))}</small>` : '';
    th.title = m.nome + (mFora.includes(m.id) ? ' · fora do escopo: a fábrica usuária não usa esta missão' : '');
    if (mFora.includes(m.id)) th.className = 'fora-escopo';
    thead.append(th);
  }
  const tb = tab.createTBody();
  for (const r of robos) {
    const tr = tb.insertRow();
    const th = document.createElement('th'); th.className = 'robo';
    th.append(iconeRobo(r), roboById(r).nome);
    if (rFora[r]) { tr.className = 'fora-escopo'; th.title = `Fora do escopo (${NOME_CAMADA[rFora[r].origem]}): ${rFora[r].motivo}`; }
    tr.append(th);
    for (const m of missoes) {
      const b = celula(E.piloto, r, m), e = celula('especialista', r, m);
      const cls = classe(r, m);
      const td = tr.insertCell();
      const bMin = cabecalho && E.cond === 'nominal' ? cartaoVig.bloqueado.find(i => i.origem === 'minimo' && i.robo === r && i.missao === m) : null;
      td.className = `cel ${cls}` + (E.robo === r && E.missao === m ? ' sel' : '') + (mFora.includes(m) ? ' fora-escopo' : '') + (bMin ? ' min-bloq' : '');
      if (E.comparar) {
        const d = difCelula(r, m), ba = celula(E.comparar, r, m);
        td.className = `cel dif-${d}` + (E.robo === r && E.missao === m ? ' sel' : '');
        td.innerHTML = `${pct(taxa(ba))}→${pct(taxa(b))}`;
        td.title = `${roboById(r).nome} · ${missionById(m).nome}\n` + { melhor: 'Passou a liberar', pior: 'Regrediu', igual: 'Igual nas duas versões' }[d] +
          `\n${NOME_PILOTO[E.comparar]}: ${ba.ok}/${ba.n} chegaram\n${NOME_PILOTO[E.piloto]}: ${b.ok}/${b.n} chegaram\nReferência: ${e.ok}/${e.n} chegaram`;
        td.onclick = () => { E.robo = r; E.missao = m; player.parar(); render(); };
        continue;
      }
      const g = piorGravidade(b);
      td.innerHTML = `${pct(taxa(b))} ${SIMBOLO[cls]}` + (ICONE_G[g] ? `<span class="gi">${ICONE_G[g]}</span>` : '');
      td.title = `${roboById(r).nome} · ${missionById(m).nome}\n${CLASSES[cls].nome}` +
        (ehBorda(r, m) ? ' (último nível antes do limite: no nível seguinte vira defeito)' : '') + '\n' +
        `${NOME_PILOTO[E.piloto]}: ${b.ok}/${b.n} chegaram\nReferência: ${e.ok}/${e.n} chegaram\n` +
        `Risco: ${fmtRisco(riscoDe(b))} · pior caso: ${GRAV_TEXTO[g]}` +
        (bMin ? `\nBloqueada pela certificadora: não aguenta ${eixoById(bMin.eixo).curto} de ${eixoById(bMin.eixo).fmt(bMin.nivel)} (mínimo exigido)` : '');
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
  const escopo = c.robos.flatMap(r => c.missoes.filter(m => CLASSES[c.classes[r][m]].dentro).map(m => [r, m]));
  const mantemE = id => escopo.filter(([r, m]) => seMantem(celula('especialista', r, m, id), opc.tol, opc.proibida)).length / (escopo.length || 1);
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

// ---------------------------------------------------------------- camadas (4.5)
// Estado das camadas e assinaturas, guardado no navegador (localStorage pode não existir: aí
// tudo funciona, só não fica guardado). A certificadora e a fábrica valem para todos os cérebros;
// o fabricante é um por cérebro.
const ARMAZ = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } }
};
const CHAVE_CAM = 'licenciador.camadas.v1', CHAVE_ASS = 'licenciador.assinaturas.v1';
const CAMADAS = ['certificadora', 'fabricante', 'fabrica'];
const TITULO_CAMADA = { certificadora: 'Certificadora', fabricante: 'Fabricante do cérebro', fabrica: 'Fábrica usuária' };

function estadoPadrao() {
  const p = camadasPadrao();
  return { certificadora: p.certificadora, fabrica: p.fabrica, fabricantes: {} };
}
function carregarCamadas() {
  const base = estadoPadrao(), s = ARMAZ.get(CHAVE_CAM);
  if (!s || typeof s !== 'object') return base;
  const lista = (v, validos) => Array.isArray(v) ? v.filter(x => validos.includes(x)) : null;
  const c = s.certificadora || {};
  if (typeof c.tol === 'number') base.certificadora.tol = c.tol;
  if (PROIBIDAS[c.proibida]) base.certificadora.proibida = c.proibida;
  if (c.minimos && typeof c.minimos === 'object') base.certificadora.minimos = Object.fromEntries(
    Object.entries(c.minimos).filter(([e, v]) => eixoById(e) && eixoById(e).niveis.includes(v)));
  const f = s.fabrica || {};
  base.fabrica.robos = lista(f.robos, frota) ?? base.fabrica.robos;
  base.fabrica.missoes = lista(f.missoes, missoes) ?? base.fabrica.missoes;
  base.fabrica.proibida = PROIBIDAS[f.proibida] && f.proibida !== 'nenhuma' ? f.proibida : null;
  for (const [p, v] of Object.entries(s.fabricantes || {})) {
    const cl = lista(v?.classes, Object.keys(CLASSES_ROBO));
    if (BRAIN_NAMES.includes(p) && cl) base.fabricantes[p] = { classes: cl };   // inclui as versões novas
  }
  return base;
}
let cam = carregarCamadas();
let assinaturas = ARMAZ.get(CHAVE_ASS) || {};
const avisoAss = {};

const fabricanteDe = p => (cam.fabricantes[p] ||= { classes: [...camadasPadrao().fabricante.classes] });
const camadasDe = p => ({ certificadora: cam.certificadora, fabricante: fabricanteDe(p), fabrica: cam.fabrica });
const configCamada = (k, p) => JSON.stringify(camadasDe(p)[k]);
const assDe = p => assinaturas[p] || {};
const assValida = (k, p) => { const a = assDe(p)[k]; return !!a && a.config === configCamada(k, p); };
const alternar = (arr, x, on) => { const i = arr.indexOf(x); if (on && i < 0) arr.push(x); if (!on && i >= 0) arr.splice(i, 1); };
const fmtData = iso => new Date(iso).toLocaleDateString('pt-BR');

function mudarCamada(t) {
  const d = t.dataset || {};
  if (d.cam === 'certificadora') {
    const c = cam.certificadora;
    if (d.campo === 'tol') c.tol = +t.value;
    else if (d.campo === 'proibida') c.proibida = t.value;
    else if (d.campo === 'min') { if (t.value) c.minimos[d.eixo] = +t.value; else delete c.minimos[d.eixo]; }
  } else if (d.cam === 'fabricante') alternar(fabricanteDe(E.piloto).classes, d.classe, t.checked);
  else if (d.cam === 'fabrica') {
    if (d.robo) alternar(cam.fabrica.robos, d.robo, t.checked);
    else if (d.missao) alternar(cam.fabrica.missoes, d.missao, t.checked);
    else if (d.campo === 'proibida') cam.fabrica.proibida = t.value || null;
  } else return;
  ARMAZ.set(CHAVE_CAM, cam);
  render();
}

function assinar(k) {
  const nome = ($('nome-' + k).value || '').trim();
  if (!nome) { avisoAss[k] = 'Escreva o nome de quem assina.'; render(); return; }
  delete avisoAss[k];
  (assinaturas[E.piloto] ||= {})[k] = { nome, data: new Date().toISOString(), config: configCamada(k, E.piloto) };
  ARMAZ.set(CHAVE_ASS, assinaturas);
  render();
}

function renderCamadas() {
  const box = $('camadas');
  // guarda o que já foi digitado nos campos de nome (o painel é redesenhado a cada mudança)
  const digitado = Object.fromEntries(CAMADAS.map(k => [k, document.getElementById('nome-' + k)?.value || '']));
  const sel = (dados, opcoes, atual) => `<select ${dados}>` + opcoes.map(([v, t]) =>
    `<option value="${v}"${String(v) === String(atual ?? '') ? ' selected' : ''}>${esc(t)}</option>`).join('') + '</select>';
  const caixa = (dados, on, txt, dica = '') => `<label${dica ? ` title="${esc(dica)}"` : ''}><input type="checkbox" ${dados}${on ? ' checked' : ''}> ${esc(txt)}</label>`;
  const blocoAss = k => {
    const a = assDe(E.piloto)[k], v = assValida(k, E.piloto);
    const st = avisoAss[k] ? `<div class="ass velha">${esc(avisoAss[k])}</div>`
      : !a ? '<div class="ass muted">Ainda não assinada.</div>'
      : v ? `<div class="ass ok">✓ Assinada por ${esc(a.nome)} em ${fmtData(a.data)}.</div>`
      : `<div class="ass velha">Assinada por ${esc(a.nome)} em ${fmtData(a.data)}, mas a configuração mudou depois: assine de novo.</div>`;
    return st + `<div class="assinar"><input type="text" id="nome-${k}" maxlength="60" placeholder="nome de quem assina" value="${esc(digitado[k])}">` +
      `<button data-assinar="${k}">Assinar</button></div>`;
  };
  const c = cam.certificadora, f = fabricanteDe(E.piloto), u = cam.fabrica;
  // com n corridas por célula, a tolerância vira "quantas falhas em n são aceitas"
  const falhas = t => Math.floor(L.reps * (1 - t) + 1e-9);
  const tols = [0.6, 0.8, 0.9, 1].map(t => [t, `${fmtNum(t)} · ${falhas(t) ? `aceita ${falhas(t)} falha${falhas(t) > 1 ? 's' : ''}` : 'nenhuma falha'} em ${L.reps}` + (t === TOL_PADRAO ? ' (padrão)' : '')]);
  const robosDaClasse = cls => frota.filter(r => bodyClass(corpoDe(r)) === cls);
  box.innerHTML =
    `<div class="camada"><h3>Certificadora</h3><p class="quem muted">outorgada pelo governo · o mínimo, para todos os cérebros</p>` +
      `<label>Tolerância ${sel('data-cam="certificadora" data-campo="tol"', tols, c.tol)}</label>` +
      `<label>Gravidade proibida ${sel('data-cam="certificadora" data-campo="proibida"', Object.entries(PROIBIDAS), c.proibida)}</label>` +
      `<fieldset><legend>Níveis mínimos que todo cérebro tem que aguentar</legend>` +
      EIXOS.map(e => `<label>${esc(e.curto)} ${sel(`data-cam="certificadora" data-campo="min" data-eixo="${e.id}"`,
        [['', '—'], ...e.niveis.map(n => [n, e.binario ? 'exigido' : e.fmt(n)])], c.minimos[e.id])}</label>`).join('') +
      `</fieldset>${blocoAss('certificadora')}</div>` +
    `<div class="camada"><h3>Fabricante do ${esc(NOME_PILOTO[E.piloto].toLowerCase())}</h3><p class="quem muted">declara o escopo: que tipos de robô o cérebro se propõe a pilotar</p>` +
      `<fieldset><legend>O cérebro pilota robôs…</legend>` +
      Object.entries(CLASSES_ROBO).filter(([cls]) => robosDaClasse(cls).length).map(([cls, txt]) =>
        caixa(`data-cam="fabricante" data-classe="${cls}"`, f.classes.includes(cls), txt, robosDaClasse(cls).map(r => roboById(r).nome).join(', '))).join('') +
      `</fieldset><p class="muted small" style="margin:0">Desmarcar declara uma limitação: aqueles robôs saem do escopo da licença em vez de contar como defeito.</p>` +
      `${blocoAss('fabricante')}</div>` +
    `<div class="camada"><h3>Fábrica usuária</h3><p class="quem muted">a frota e as missões que ela usa de verdade</p>` +
      `<fieldset><legend>Robôs da frota</legend>${frota.map(r => caixa(`data-cam="fabrica" data-robo="${r}"`, u.robos.includes(r), roboById(r).nome)).join('')}</fieldset>` +
      `<fieldset><legend>Missões</legend>${MISSIONS.map(m => caixa(`data-cam="fabrica" data-missao="${m.id}"`, u.missoes.includes(m.id), m.id, m.nome)).join('')}</fieldset>` +
      `<label>Gravidade proibida ${sel('data-cam="fabrica" data-campo="proibida"', [['', 'a da certificadora'], ['colisao', PROIBIDAS.colisao], ['quase', PROIBIDAS.quase]], u.proibida)}</label>` +
      `<p class="muted small" style="margin:0">Pode ser mais exigente que a certificadora, nunca menos.</p>` +
      `${blocoAss('fabrica')}</div>`;
  box.onchange = ev => mudarCamada(ev.target);
  box.onclick = ev => { const k = ev.target?.dataset?.assinar; if (k) assinar(k); };
}

$('camadas-padrao').onclick = () => { cam = estadoPadrao(); ARMAZ.set(CHAVE_CAM, cam); render(); };

// ---------------------------------------------------------------- cartão da licença (4.4)
const juntar = xs => xs.length <= 1 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1];

// agrupa itens [{robo, missao, ...}] por robô: "Empilhadeira: todas as missões"
function porRobo(itens, nMissoes = missoes.length) {
  const g = {};
  for (const i of itens) (g[i.robo] ||= []).push(i);
  return Object.entries(g).map(([r, xs]) => ({
    robo: r, nome: roboById(r).nome, itens: xs,
    missoesTexto: xs.length === nMissoes ? 'todas as missões' : juntar(xs.map(i => i.missao))
  }));
}

const tag = k => `<span class="origem">· ${NOME_CAMADA[k]}</span>`;

function htmlCartao(c) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const ord = ['grave', 'raspao', 'travou', 'quase', 'ok'];
  const pior = xs => ord.find(g => xs.some(i => i.gravidade === g));
  const faixa = xs => {
    const a = Math.min(...xs.map(i => i.taxa)), b = Math.max(...xs.map(i => i.taxa));
    return a === b ? pct(a) : `${pct(a)} a ${pct(b)}`;
  };
  const lista = (xs, vazio) => xs.length ? `<ul>${xs.join('')}</ul>` : `<p class="muted">${vazio}</p>`;
  const nR = c.robos.length, todasM = c.missoes.length === missoes.length;
  const reduzido = c.foraEscopo.length > 0 || c.missoesFora.length > 0;
  const exc = new Set([...c.bloqueado, ...c.fora].map(i => i.robo));
  const deQuem = reduzido ? 'do escopo' : 'da frota';
  const ondeM = todasM ? 'todas as missões' : `as missões ${juntar(c.missoes)}`;
  const bloqNom = c.bloqueado.filter(i => i.origem !== 'minimo'), bloqMin = c.bloqueado.filter(i => i.origem === 'minimo');
  const nCel = n => `${n} célula${n > 1 ? 's' : ''}`;
  const motivoNao = [bloqNom.length ? `${nCel(bloqNom.length)} com defeito` : '',
    bloqMin.length ? `${nCel(bloqMin.length)} abaixo do mínimo da certificadora` : '', !nR || !c.missoes.length ? 'escopo vazio' : ''].filter(Boolean).join('; ');
  // bloqueios por mínimo, agrupados por eixo e nível
  const gMin = {};
  for (const i of bloqMin) (gMin[`${i.eixo}|${i.nivel}`] ||= []).push(i);
  const itensMin = Object.values(gMin).map(xs => {
    const e = eixoById(xs[0].eixo);
    return `<li>${porRobo(xs, c.missoes.length).map(g => `<b>${esc(g.nome)}</b> em ${g.missoesTexto}`).join('; ')}: com ${esc(e.curto)}` +
      `${e.binario ? '' : ' de ' + esc(e.fmt(xs[0].nivel))} o cérebro chega em ${faixa(xs)}, e a referência aguenta. ${tag('certificadora')}</li>`;
  });
  const selo = c.licenciavel ? (reduzido ? 'Licenciável no escopo das camadas' : 'Licenciável para a frota') : `Não licenciável: ${motivoNao}`;

  // fora do escopo, agrupado por origem
  const foraItens = [];
  const porClasse = {};
  for (const i of c.foraEscopo.filter(i => i.origem === 'fabricante')) (porClasse[i.classe] ||= []).push(roboById(i.robo).nome);
  for (const [cls, nomes] of Object.entries(porClasse))
    foraItens.push(`<li><b>${esc(juntar(nomes))}</b>: limitação declarada pelo fabricante do cérebro (não pilota robôs ${esc(CLASSES_ROBO[cls])}). ${tag('fabricante')}</li>`);
  const daFabrica = c.foraEscopo.filter(i => i.origem === 'fabrica').map(i => roboById(i.robo).nome);
  if (daFabrica.length) foraItens.push(`<li><b>${esc(juntar(daFabrica))}</b>: não ${daFabrica.length > 1 ? 'fazem' : 'faz'} parte da frota da fábrica usuária. ${tag('fabrica')}</li>`);
  if (c.missoesFora.length) foraItens.push(`<li>Missões <b>${juntar(c.missoesFora)}</b>: a fábrica usuária não usa. ${tag('fabrica')}</li>`);

  const assin = CAMADAS.map(k => {
    const a = assDe(c.piloto)[k], v = assValida(k, c.piloto);
    return `<div>${TITULO_CAMADA[k]}<br>` + (!a ? '<span class="muted">nome e data</span>'
      : `<span class="nome${v ? '' : ' velha'}">${esc(a.nome)}</span>, ${fmtData(a.data)}` +
        (v ? '' : '<br><span class="velha small">assinou outra configuração: não vale para esta</span>')) + '</div>';
  }).join('');

  return `
    <div class="row" style="align-items:baseline">
      <h2>Licença de operação · ${esc(NOME_PILOTO[c.piloto])}</h2>
      <span class="grow"></span>
      <span class="selo-lic ${c.licenciavel ? 'ok' : 'bad'}">${esc(selo)}</span>
    </div>
    <p class="muted small">Classes avaliadas na condição nominal; limites de operação por varredura de
      ${CONDICOES.filter(x => x.eixo && temCond(x.id)).length} condições de imprevisibilidade · tolerância ${fmtNum(c.tol)}
      (${NOME_CAMADA[c.origemTol || 'certificadora']}) · gravidade proibida: ${PROIBIDAS[c.proibida]} (${NOME_CAMADA[c.origemProibida || 'certificadora']}) ·
      ${L.reps} corridas por célula · gerada automaticamente a partir do pré-cálculo, sem edição manual.</p>

    <h3>Liberado para</h3>
    <p>${!nR || !c.missoes.length ? '<b>Nada: o escopo das camadas ficou vazio.</b>'
      : c.bloqueado.length + c.fora.length === 0
      ? `<b>${nR === frota.length && !reduzido ? 'Todos os robôs da frota' : `Os ${nR} robôs ${deQuem}`}, em ${ondeM}.</b>`
      : `<b>${nR - exc.size} de ${nR} robôs ${deQuem} em ${ondeM}.</b> ` +
        `Exceções: ${esc(c.liberadoTexto.replace(/^todos os robôs, todas as missões, exceto: /, ''))}.`}</p>

    ${foraItens.length ? `<h3>Fora do escopo (não é defeito)</h3><ul>${foraItens.join('')}</ul>` : ''}

    <h3>Limites de operação</h3>
    ${lista(c.limites.map(l => `<li>${esc(l.texto)}${esc(refLimite(l))}.</li>`), 'O pré-cálculo não tem varredura.')}
    ${c.limites.length ? '<p class="muted small" style="margin-top:0">Cada limite vale sobre os robôs e missões liberados acima; onde nem o piloto de referência aguenta a perturbação, é limite físico e não conta contra o cérebro.</p>' : ''}
    ${c.minimos.length ? `<p style="margin:4px 0 2px"><b>Mínimos exigidos</b> ${tag('certificadora')}</p>` + lista(c.minimos.map(x => {
      const e = eixoById(x.eixo), alvo = e.binario ? `${e.nome}: exigido` : `${e.nome}: pelo menos ${e.fmt(x.nivel)}`;
      return `<li>${esc(alvo)} · ${x.bloqueadas === null ? 'sem dados no pré-cálculo' : !x.bloqueadas ? 'todas as células liberadas aguentam'
        : `<b>${nCel(x.bloqueadas)} não ${x.bloqueadas > 1 ? 'aguentam' : 'aguenta'}</b> e ${x.bloqueadas > 1 ? 'saem' : 'sai'} da licença (ver Bloqueado)`}.</li>`;
    }), '') : ''}

    <h3>Bloqueado (defeito do cérebro) <span class="origem">· tolerância ${fmtNum(c.tol)} (certificadora), proibida ${PROIBIDAS[c.proibida]} (${NOME_CAMADA[c.origemProibida || 'certificadora']})</span></h3>
    ${lista(porRobo(bloqNom, c.missoes.length).map(g =>
      `<li><b>${esc(g.nome)}</b>, ${g.missoesTexto}: o cérebro chega em ${faixa(g.itens)}, a referência em ` +
      `${faixa(g.itens.map(i => ({ taxa: i.taxaEsp })))}. Pior caso: ${GRAV_TEXTO[pior(g.itens)]}.</li>`), bloqMin.length ? 'Nada na condição nominal.' : 'Nada.')}
    ${itensMin.length ? `<p style="margin:4px 0 2px"><b>Não aguentam o mínimo exigido pela certificadora</b></p><ul>${itensMin.join('')}</ul>` : ''}

    <h3>Fora do envelope (limite físico)</h3>
    ${lista(porRobo(c.fora, c.missoes.length).map(g =>
      `<li><b>${esc(g.nome)}</b>, ${g.missoesTexto}: nenhum piloto conseguiu, nem o de referência. Não conta contra o cérebro.</li>`), 'Nada: no escopo, o piloto de referência sempre consegue.')}

    <h3>Testes físicos obrigatórios</h3>
    ${c.testes.length ? '<p class="muted small" style="margin:0">Ordenados por risco (média dos pesos: colisão grave 10, raspão 3, travou 2, quase-acidente 1). Inclui as células amarelas do nominal e as que passam raspando num limite de operação.</p>' : ''}
    ${lista(c.testes.map(i => `<li><b>risco ${fmtRisco(i.risco)}</b> · ${esc(descTeste(i))}.</li>`), 'Nenhum.')}

    <h3>O que falta treinar</h3>
    ${lista(c.treinar.map(t => `<li>${esc(t[0].toUpperCase() + t.slice(1))}.</li>`), 'Nada.')}

    <div class="assinaturas">${assin}</div>
    <p class="muted small" style="margin-top:14px">Emitida em ${hoje} · cérebro: versão ${esc(versaoModelo || '…')} ·
      ferramenta: versão ${VERSAO_FERRAMENTA} · pré-cálculo de ${new Date(L.gerado).toLocaleDateString('pt-BR')}.</p>`;
}

// Um cartão, ou os dois lado a lado quando há comparação de versões (4.6).
function renderCartao(c = cartaoAtual()) {
  if (!E.comparar) { $('cartao').classList.remove('comparando'); $('cartao').innerHTML = htmlCartao(c); return; }
  $('cartao').classList.add('comparando');
  $('cartao').innerHTML = `<div class="lado-a-lado"><div>${htmlCartao(c)}</div><div class="cartao-b">${htmlCartao(cartaoAtual(E.comparar))}</div></div>`;
}

// licença em JSON: camadas, assinaturas (com validade) e o conteúdo do cartão
function licencaJSON() {
  const c = cartaoAtual();
  const nomeR = r => roboById(r).nome;
  return {
    tipo: 'licenca-de-operacao', ferramenta: VERSAO_FERRAMENTA, cerebro: E.piloto, versaoCerebro: versaoModelo,
    emitidaEm: new Date().toISOString(), preCalculo: L.gerado, corridasPorCelula: L.reps,
    camadas: camadasDe(E.piloto),
    assinaturas: Object.fromEntries(CAMADAS.map(k => { const a = assDe(E.piloto)[k]; return [k, a ? { nome: a.nome, data: a.data, valida: assValida(k, E.piloto) } : null]; })),
    licenca: {
      licenciavel: c.licenciavel, resumo: c.resumo, tolerancia: c.tol, gravidadeProibida: c.proibida,
      robos: c.robos.map(nomeR), missoes: c.missoes, liberado: c.liberadoTexto,
      foraDoEscopo: [...c.foraEscopo.map(i => ({ robo: nomeR(i.robo), origem: NOME_CAMADA[i.origem], motivo: i.motivo })),
        ...c.missoesFora.map(m => ({ missao: m, origem: NOME_CAMADA.fabrica, motivo: 'a fábrica usuária não usa' }))],
      bloqueado: c.bloqueado.map(i => ({ robo: nomeR(i.robo), missao: i.missao, taxaCerebro: i.taxa, taxaReferencia: i.taxaEsp, pior: i.gravidade,
        origem: i.origem === 'minimo' ? `${NOME_CAMADA.certificadora}: mínimo de ${eixoById(i.eixo).curto}` : 'defeito na condição nominal' })),
      limiteFisico: c.fora.map(i => ({ robo: nomeR(i.robo), missao: i.missao, taxaReferencia: i.taxaEsp })),
      limitesDeOperacao: c.limites.map(l => ({ eixo: l.eixo, limite: l.limite, referencia: l.limiteEsp, texto: l.texto })),
      minimosDaCertificadora: c.minimos,
      testesFisicos: c.testes.map(i => ({ risco: Math.round(i.risco * 100) / 100, texto: descTeste(i) })),
      oQueFaltaTreinar: c.treinar
    }
  };
}

$('exportar').onclick = () => {
  const blob = new Blob([JSON.stringify(licencaJSON(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `licenca-${E.piloto}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

$('imprimir').onclick = () => window.print();

iniciar();
