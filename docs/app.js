// A banca (seção 5.6): entrada → 4 cérebros (bancada ou relatório) → questionário → envio.
import { FLEET, fleetBody } from './core/parts.js';
import { MISSIONS, WAREHOUSE, missionById } from './core/warehouse.js';
import { Run } from './core/episode.js';
import { planPath } from './core/planner.js';
import { DT } from './core/physics.js';
import { drawWarehouse, drawPath, drawTrail, drawRobotAt, drawRobot, viewFor } from './core/draw.js';
import { loadPilot, loadModel } from './core/pilots.js';
import { sequencia, planoDe, sortearRelatorio, novaCorrida, piores, agrupar, STATUS_TEXTO, N_RELATORIO } from './core/banca.js';
import { RESULTS_ENDPOINT } from './config.js';

const VERSAO_SITE = '2026-11-02';
const CHAVE_PROGRESSO = 'banca-progresso', CHAVE_RESPOSTAS = 'banca-respostas';

const $ = id => document.getElementById(id);
const nomeRobo = id => FLEET.find(f => f.id === id).nome;
const nomeMissao = id => missionById(id).nome;
const fmtT = s => s.toFixed(1).replace('.', ',') + ' s';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const falhou = st => st === 'bateu' || st === 'tempo';

// localStorage pode não existir (aba anônima, bloqueio): tudo funciona sem ele.
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* idem */ } }
};

function mostrar(tela) {
  for (const id of ['tela-entrada', 'tela-cerebro', 'tela-questionario', 'tela-fim']) $(id).classList.toggle('hidden', id !== tela);
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- sessão
// S: { apelido, participante, plano, seq, idx, inicio, cerebros: [...] }
let S = null;
let atual = null;          // registro do cérebro em avaliação
let pilot = null;
let relogio = 0;

function salvarProgresso() { store.set(CHAVE_PROGRESSO, S); }

window.addEventListener('beforeunload', e => {
  if (S && !S.enviado) { e.preventDefault(); e.returnValue = ''; }
});

// ---------------------------------------------------------------- entrada
const salvo = store.get(CHAVE_PROGRESSO);
if (salvo && salvo.seq && !salvo.enviado) {
  const b = $('continuar');
  b.classList.remove('hidden');
  b.textContent = salvo.idx < 4
    ? `Continuar como "${salvo.apelido}" (cérebro ${salvo.idx + 1} de 4)`
    : `Continuar como "${salvo.apelido}" (questionário)`;
  b.onclick = () => { S = salvo; seguir(); };
}

$('comecar').onclick = () => {
  const apelido = $('apelido').value.trim();
  const n = parseInt($('participante').value, 10);
  if (!apelido) return ($('erro-entrada').textContent = 'Escreva um apelido.');
  if (!(n >= 1 && n <= 99)) return ($('erro-entrada').textContent = 'Escreva o número de participante (1 a 6).');
  S = { apelido, participante: n, plano: planoDe(n), seq: sequencia(n), idx: 0, inicio: Date.now(), cerebros: [] };
  salvarProgresso();
  seguir();
};

function seguir() {
  if (S.idx < S.seq.length) abrirCerebro();
  else abrirQuestionario();
}

// ---------------------------------------------------------------- galpão animado
const cv = $('cv'), ctx = cv.getContext('2d');
const view = viewFor(WAREHOUSE, cv.width, cv.height);
let velocidade = 2;
const estacaoDe = m => Object.entries(WAREHOUSE.stations).find(([, p]) => p === m.goal)?.[0];

const player = {
  run: null, body: null, mission: null, prev: null, raf: 0, onEnd: null, rotulo: '',

  // mostra rota e robô parados na saída
  preview(body, mission) {
    this.stop();
    this.run = null; this.body = body; this.mission = mission;
    this.prev = body && mission ? planPath(WAREHOUSE, mission.start, mission.goal, body.colR) : null;
    desenhar();
  },

  play(run, body, rotulo, onEnd) {
    this.stop();
    this.run = run; this.body = body; this.mission = run.mission; this.prev = null;
    this.rotulo = rotulo; this.onEnd = onEnd;
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

  // para a animação; se uma corrida estava no meio, avisa como interrompida
  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    const cb = this.onEnd; this.onEnd = null;
    if (cb && this.run && !this.run.world.done) cb({ status: 'interrompida', t: this.run.world.t * DT });
  },

  limpar() { this.stop(); this.run = null; this.prev = null; this.mission = null; desenhar(); }
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
    $('status').innerHTML = !w.done
      ? `${esc(player.rotulo)} · ${fmtT(t)}`
      : `${esc(player.rotulo)} · ` + (w.reached ? `<b class="ok">Chegou</b> em ${fmtT(t)}`
        : w.collided ? `<b class="bad">Bateu</b> em ${fmtT(t)}` : `<b class="bad">Tempo esgotado</b> (${fmtT(t)})`);
  } else if (player.prev) {
    drawPath(ctx, player.prev, view);
    drawRobotAt(ctx, player.body, { ...m.start }, view);
  }
}

for (const k of [1, 2, 4]) {
  const b = document.createElement('button');
  b.textContent = k + '×';
  b.onclick = () => { velocidade = k; for (const x of $('velocidades').children) x.classList.toggle('sel', x === b); };
  if (k === velocidade) b.classList.add('sel');
  $('velocidades').append(b);
}

// ---------------------------------------------------------------- um cérebro
let roboSel = FLEET[0].id, missaoSel = MISSIONS[0].id;

async function abrirCerebro() {
  const item = S.seq[S.idx];
  mostrar('tela-cerebro');
  player.limpar();
  pilot = null;
  $('status').textContent = 'Carregando o cérebro…';
  try { pilot = await loadPilot('cerebro' + item.cerebro); }
  catch (e) { $('status').textContent = 'Erro ao carregar o cérebro: ' + e.message; return; }

  atual = {
    cerebro: item.cerebro, modo: item.modo, posicao: S.idx + 1, inicio: Date.now(),
    corridas: [], relatorio: null, replays: []
  };
  const bancada = item.modo === 'bancada';
  $('c-titulo').textContent = `Cérebro ${item.cerebro}`;
  $('c-selo').textContent = bancada ? 'Bancada: você testa' : 'Relatório automático';
  $('c-posicao').textContent = `${S.idx + 1} de 4`;
  $('d-titulo').textContent = `Sua decisão sobre o Cérebro ${item.cerebro}`;
  $('c-instrucao').textContent = bancada
    ? 'Escolha um robô e uma missão e clique em Rodar. Repita quantas vezes quiser, com os robôs e missões que quiser. Quando achar que já sabe, decida lá embaixo.'
    : 'Clique em "Rodar avaliação". O relatório mostra a taxa de sucesso, as tabelas por robô e por missão e as 3 piores corridas, que você pode assistir. Depois decida lá embaixo.';
  $('painel-bancada').classList.toggle('hidden', !bancada);
  $('painel-relatorio').classList.toggle('hidden', bancada);
  limparDecisao();

  if (bancada) {
    roboSel = FLEET[0].id; missaoSel = MISSIONS[0].id;
    montarBancada();
    $('status').textContent = 'Escolha robô e missão e clique em Rodar.';
  } else {
    $('avaliar').disabled = false; $('avaliar').textContent = 'Rodar avaliação';
    $('progresso').classList.add('hidden'); $('resultado').classList.add('hidden');
    $('status').textContent = 'Rode a avaliação para ver o resultado.';
  }

  clearInterval(relogio);
  const tick = () => {
    const s = Math.floor((Date.now() - atual.inicio) / 1000);
    $('c-relogio').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  tick(); relogio = setInterval(tick, 1000);
  validarDecisao();
}

// ---- bancada
function montarBancada() {
  const robos = $('robos'); robos.innerHTML = '';
  for (const f of FLEET) {
    const b = document.createElement('button');
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); g.translate(64, 64); g.rotate(-Math.PI / 2);
    drawRobot(g, fleetBody(f.id), 165);
    b.append(c, f.nome);
    b.dataset.id = f.id;
    b.onclick = () => { roboSel = f.id; marcarSelecao(); };
    robos.append(b);
  }
  const ms = $('missoes'); ms.innerHTML = '';
  for (const m of MISSIONS) {
    const b = document.createElement('button');
    b.textContent = m.nome; b.dataset.id = m.id;
    b.onclick = () => { missaoSel = m.id; marcarSelecao(); };
    ms.append(b);
  }
  marcarSelecao();
  listarCorridas();
}

function marcarSelecao() {
  for (const b of $('robos').children) b.classList.toggle('sel', b.dataset.id === roboSel);
  for (const b of $('missoes').children) b.classList.toggle('sel', b.dataset.id === missaoSel);
  player.preview(fleetBody(roboSel), missionById(missaoSel));
  $('status').textContent = `${nomeRobo(roboSel)} · ${nomeMissao(missaoSel)} · clique em Rodar`;
}

$('rodar').onclick = () => {
  if (!pilot) return;
  const item = { robo: roboSel, missao: missaoSel, seed: Math.floor(Math.random() * 1e9) };
  const body = fleetBody(item.robo);
  const run = new Run(body, missionById(item.missao), item.seed, pilot);
  const reg = { ...item, status: 'rodando', t: 0 };
  const dono = atual;
  dono.corridas.push(reg);
  listarCorridas();
  player.play(run, body, `${nomeRobo(item.robo)} · ${nomeMissao(item.missao)}`, res => {
    reg.status = res.status; reg.t = +res.t.toFixed(2);
    if (dono === atual) { listarCorridas(); validarDecisao(); }
  });
};

function listarCorridas() {
  const cs = atual?.corridas || [];
  const feitas = cs.filter(c => c.status !== 'rodando' && c.status !== 'interrompida').length;
  $('n-corridas').textContent = cs.length ? `(${feitas})` : '';
  $('corridas').innerHTML = cs.length
    ? cs.map((c, i) => `<tr class="${falhou(c.status) ? 'falha' : ''}"><td class="num muted">${i + 1}</td>
        <td>${esc(nomeRobo(c.robo))}<br><span class="muted small">${esc(nomeMissao(c.missao))}</span></td>
        <td>${c.status === 'rodando' ? '…' : STATUS_TEXTO[c.status]}</td>
        <td class="num">${c.status === 'rodando' ? '' : fmtT(c.t)}</td></tr>`).reverse().join('')
    : '<tr><td class="muted">Nenhuma corrida ainda.</td></tr>';
}

// ---- relatório
$('avaliar').onclick = async () => {
  if (!pilot || atual.relatorio) return;
  const dono = atual;
  $('avaliar').disabled = true;
  $('progresso').classList.remove('hidden');
  player.limpar();
  const itens = sortearRelatorio();
  const res = [];
  for (let k = 0; k < itens.length; k++) {
    const r = novaCorrida(itens[k], pilot).runToEnd();
    res.push({ ...itens[k], status: r.status, t: +r.t.toFixed(2) });
    $('barra').style.width = `${(100 * (k + 1)) / itens.length}%`;
    $('progresso-txt').textContent = `${k + 1} de ${itens.length} corridas`;
    await new Promise(ok => setTimeout(ok, 0));
    if (dono !== atual) return;
  }
  const sucesso = res.filter(r => r.status === 'chegou').length;
  atual.relatorio = { total: res.length, sucesso, itens: res };
  $('avaliar').textContent = 'Avaliação feita';
  mostrarRelatorio();
  validarDecisao();
};

function mostrarRelatorio() {
  const { itens, sucesso, total } = atual.relatorio;
  $('resultado').classList.remove('hidden');
  $('taxa').textContent = `${Math.round((100 * sucesso) / total)}%`;
  $('taxa-txt').textContent = `de sucesso (${sucesso} de ${total} corridas chegaram)`;
  $('status').textContent = 'Clique em "replay" para assistir a uma das piores corridas.';

  const pi = piores(itens);
  $('piores').innerHTML = pi.map((r, i) => `<tr class="${falhou(r.status) ? 'falha' : ''}">
      <td>${esc(nomeRobo(r.robo))}<br><span class="muted small">${esc(nomeMissao(r.missao))}</span></td>
      <td>${STATUS_TEXTO[r.status]}<br><span class="muted small">${fmtT(r.t)}</span></td>
      <td class="num"><button data-i="${i}">replay</button></td></tr>`).join('');
  for (const b of $('piores').querySelectorAll('button')) {
    b.onclick = () => {
      const r = pi[+b.dataset.i];
      atual.replays.push({ robo: r.robo, missao: r.missao, status: r.status });
      player.play(novaCorrida(r, pilot), fleetBody(r.robo), `Replay: ${nomeRobo(r.robo)} · ${nomeMissao(r.missao)}`);
    };
  }

  const linhas = (grupo, ids, nome) => ids.map(id => {
    const g = grupo[id];
    if (!g) return `<tr><td>${esc(nome(id))}</td><td class="num muted">não sorteado</td></tr>`;
    return `<tr class="${g.ok < g.n ? 'falha' : ''}"><td>${esc(nome(id))}</td><td class="num">${g.ok} de ${g.n}</td></tr>`;
  }).join('');
  $('por-robo').innerHTML = linhas(agrupar(itens, 'robo'), FLEET.map(f => f.id), nomeRobo);
  $('por-missao').innerHTML = linhas(agrupar(itens, 'missao'), MISSIONS.map(m => m.id), nomeMissao);
}

// ---- decisão
function limparDecisao() {
  for (const el of document.querySelectorAll('#decisao input')) el.checked = false;
  $('porque').value = '';
}

function lerDecisao() {
  return {
    decisao: document.querySelector('input[name=decisao]:checked')?.value,
    confianca: +document.querySelector('input[name=confianca]:checked')?.value || 0,
    porque: $('porque').value.trim()
  };
}

function validarDecisao() {
  if (!atual) return;
  const d = lerDecisao(), falta = [];
  if (atual.modo === 'bancada' && !atual.corridas.some(c => c.status !== 'rodando' && c.status !== 'interrompida'))
    falta.push('rodar pelo menos uma corrida');
  if (atual.modo === 'relatorio' && !atual.relatorio) falta.push('rodar a avaliação');
  if (!d.decisao) falta.push('escolher libero / não libero');
  if (!d.confianca) falta.push('marcar a confiança');
  if (d.porque.length < 3) falta.push('escrever o porquê');
  $('d-falta').textContent = falta.length ? 'Falta: ' + falta.join(', ') + '.' : '';
  $('confirmar').disabled = falta.length > 0;
}
document.querySelector('#decisao').addEventListener('input', validarDecisao);
document.querySelector('#decisao').addEventListener('change', validarDecisao);

$('confirmar').onclick = () => {
  player.stop();
  clearInterval(relogio);
  const d = lerDecisao();
  const a = atual;
  const corridas = a.corridas.filter(c => c.status !== 'rodando');
  const vistas = corridas.filter(c => c.status !== 'interrompida');
  const rel = a.relatorio;
  S.cerebros.push({
    cerebro: a.cerebro, modo: a.modo, posicao: a.posicao,
    decisao: d.decisao, confianca: d.confianca, porque: d.porque,
    tempo_s: Math.round((Date.now() - a.inicio) / 1000),
    n_corridas: a.modo === 'bancada' ? vistas.length : rel.total,
    robos: [...new Set((a.modo === 'bancada' ? vistas : rel.itens).map(c => c.robo))],
    missoes: [...new Set((a.modo === 'bancada' ? vistas : rel.itens).map(c => c.missao))],
    // H3: a pessoa viu uma falha acontecer antes de decidir? (bancada: assistiu a uma corrida
    // que falhou; relatório: assistiu ao replay de uma corrida que falhou)
    viu_falha: a.modo === 'bancada' ? vistas.some(c => falhou(c.status)) : a.replays.some(r => falhou(r.status)),
    viu_replay: a.replays.length > 0,
    replays: a.replays,
    relatorio: rel ? { total: rel.total, sucesso: rel.sucesso, falhas: rel.total - rel.sucesso } : null,
    corridas: a.modo === 'bancada' ? corridas : rel.itens
  });
  atual = null;
  S.idx++;
  salvarProgresso();
  seguir();
};

// ---------------------------------------------------------------- questionário
function abrirQuestionario() {
  mostrar('tela-questionario');
  validarQuestionario();
}

function lerQuestionario() {
  const q = document.querySelector('#tela-questionario');
  const radio = n => q.querySelector(`input[name=${n}]:checked`)?.value || null;
  return {
    q1: [...q.querySelectorAll('#q1 input:checked')].map(i => i.value),
    q2: radio('q2'), q3: radio('q3'), q3_outro: $('q3-outro').value.trim(),
    q4: radio('q4'), q5: $('q5').value.trim()
  };
}

function validarQuestionario() {
  const r = lerQuestionario(), falta = [];
  $('q3-outro').classList.toggle('hidden', r.q3 !== 'outro');
  if (!r.q1.length) falta.push('1');
  if (!r.q2) falta.push('2');
  if (!r.q3 || (r.q3 === 'outro' && !r.q3_outro)) falta.push('3');
  if (!r.q4) falta.push('4');
  $('q-falta').textContent = falta.length ? `Falta responder: ${falta.join(', ')}.` : '';
  $('enviar').disabled = falta.length > 0;
}
// "Nenhum" exclui os cérebros e vice-versa
$('q1').addEventListener('change', e => {
  const boxes = [...$('q1').querySelectorAll('input')];
  if (e.target.value === 'nenhum' && e.target.checked) boxes.forEach(b => { if (b !== e.target) b.checked = false; });
  else if (e.target.checked) boxes.find(b => b.value === 'nenhum').checked = false;
});
$('tela-questionario').addEventListener('input', validarQuestionario);
$('tela-questionario').addEventListener('change', validarQuestionario);

// ---------------------------------------------------------------- envio
let payload = null;

$('enviar').onclick = async () => {
  const model = await loadModel().catch(() => ({}));
  payload = {
    tipo: 'banca', site: VERSAO_SITE, modelo: model.versao || null,
    enviado_em: new Date().toISOString(),
    apelido: S.apelido, participante: S.participante, plano: S.plano,
    tempo_total_s: Math.round((Date.now() - S.inicio) / 1000),
    cerebros: S.cerebros,
    questionario: lerQuestionario()
  };
  const todas = store.get(CHAVE_RESPOSTAS) || [];
  todas.push(payload);
  store.set(CHAVE_RESPOSTAS, todas);
  S.enviado = true;
  store.del(CHAVE_PROGRESSO);
  mostrar('tela-fim');
  await tentarEnviar();
};

async function tentarEnviar() {
  if (!RESULTS_ENDPOINT) {
    $('fim-msg').textContent = 'O envio automático não está configurado. Clique em "Baixar minhas respostas" e mande o arquivo para o Matheus.';
    return;
  }
  $('fim-msg').textContent = 'Enviando…';
  $('reenviar').classList.add('hidden');
  try {
    // no-cors: o Apps Script não devolve cabeçalho de CORS, então a resposta é opaca
    await fetch(RESULTS_ENDPOINT, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    $('fim-msg').textContent = 'Suas respostas foram enviadas.';
  } catch {
    $('fim-msg').textContent = 'Não consegui enviar (sem internet?). Tente de novo, ou baixe suas respostas e mande o arquivo para o Matheus.';
    $('reenviar').classList.remove('hidden');
  }
}
$('reenviar').onclick = tentarEnviar;

$('baixar').onclick = () => {
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `banca-${S.participante}-${S.apelido.replace(/[^\w-]+/g, '_')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

desenhar();
