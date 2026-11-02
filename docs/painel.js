// Painel do apresentador (seção 5.7): lê as respostas da planilha (ou de arquivos baixados) e a
// verdade do modelo, e mostra o que a conversa precisa.
import { FLEET } from './core/parts.js';
import { MISSIONS } from './core/warehouse.js';
import { loadModel } from './core/pilots.js';
import { RESULTS_ENDPOINT } from './config.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nomeRobo = id => FLEET.find(f => f.id === id)?.nome || id;
const nomeMissao = id => MISSIONS.find(m => m.id === id)?.nome || id;
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
const media = xs => (xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1).replace('.', ',') : '—');
const MODOS = { bancada: 'Bancada', relatorio: 'Relatório' };
const Q2 = { bancada: 'Bancada', relatorio: 'Relatório', igual: 'Igual' };
const Q3 = { numero: 'O número', ver_falha: 'Ver a falha acontecendo', explicacao: 'Uma explicação do motivo', outro: 'Outro' };
const Q4 = { empresa_cerebro: 'A empresa que fez o cérebro', fabricante_robo: 'O fabricante do robô', governo: 'Um órgão do governo',
             certificadora: 'Uma certificadora independente', fabrica_usuaria: 'A fábrica que vai usar' };

let model = null, brutas = [], deArquivos = [];

async function carregar() {
  $('erro').textContent = '';
  model ||= await loadModel();
  if (RESULTS_ENDPOINT) {
    try {
      const r = await fetch(RESULTS_ENDPOINT);
      brutas = await r.json();
    } catch (e) {
      $('erro').textContent = 'Não consegui ler a planilha (' + e.message + '). Dá para abrir os arquivos baixados pelas pessoas.';
      brutas = [];
    }
  }
  render();
}

$('arquivos').onchange = async e => {
  deArquivos = [];
  for (const f of e.target.files) {
    try { const j = JSON.parse(await f.text()); deArquivos.push(...(Array.isArray(j) ? j : [j])); }
    catch { $('erro').textContent = `Arquivo inválido: ${f.name}`; }
  }
  render();
};
$('atualizar').onclick = carregar;
$('filtro-teste').onchange = render;
$('revelar').onclick = () => {
  const on = $('verdade').classList.toggle('hidden');
  $('revelado').classList.toggle('hidden', on);
  $('revelar').textContent = on ? 'Revelar a verdade' : 'Esconder a verdade';
};

function respostas() {
  // mesma pessoa enviada pela planilha e por arquivo conta uma vez
  const vistos = new Set(), out = [];
  for (const r of [...brutas, ...deArquivos]) {
    if (!r || r.tipo !== 'banca' || !Array.isArray(r.cerebros)) continue;
    if ($('filtro-teste').checked && /^teste/i.test(r.apelido || '')) continue;
    const k = `${r.apelido}|${r.participante}|${r.enviado_em}`;
    if (vistos.has(k)) continue;
    vistos.add(k); out.push(r);
  }
  return out;
}

const certa = n => (model.verdade?.['cerebro' + n]?.cumpre ? 'libero' : 'nao_libero');

function contar(lista, rotulos) {
  const c = {};
  for (const v of lista) c[v] = (c[v] || 0) + 1;
  const total = lista.length;
  return Object.entries(rotulos).map(([k, nome]) =>
    `<div class="row small"><span style="min-width:240px">${esc(nome)}</span>
      <span class="barra grow" style="max-width:300px"><div style="width:${total ? (100 * (c[k] || 0)) / total : 0}%"></div></span>
      <b>${c[k] || 0}</b></div>`).join('') || '<span class="muted">Sem respostas.</span>';
}

function render() {
  const rs = respostas();
  const ds = rs.flatMap(r => r.cerebros.map(c => ({ ...c, apelido: r.apelido })));
  $('contagem').textContent = `${rs.length} resposta${rs.length === 1 ? '' : 's'}`;

  // decisões por cérebro (sem a verdade)
  $('t-decisoes').innerHTML = [1, 2, 3, 4].map(n => {
    const d = ds.filter(x => x.cerebro === n);
    const lib = m => { const xs = d.filter(x => x.modo === m); return `${xs.filter(x => x.decisao === 'libero').length} de ${xs.length}`; };
    return `<tr><td>Cérebro ${n}</td><td class="num">${lib('bancada')}</td><td class="num">${lib('relatorio')}</td>
      <td class="num">${media(d.map(x => x.confianca))}</td></tr>`;
  }).join('');

  // a verdade
  $('verdade').innerHTML = [1, 2, 3, 4].map(n => {
    const v = model.verdade?.['cerebro' + n];
    if (!v) return `<p>Cérebro ${n}: sem tabela de verdade no modelo.</p>`;
    const fal = v.falhas.map(f => `${esc(nomeRobo(f.robo))} em "${esc(nomeMissao(f.missao))}" (${pct(f.taxa, 1)})`);
    return `<div style="margin-bottom:12px"><b>Cérebro ${n}</b>:
      ${v.cumpre ? '<span class="tag-ok">cumpre a regra, devia ser liberado</span>' : '<span class="tag-bad">não cumpre a regra, devia ser reprovado</span>'}
      · sucesso geral medido ${pct(v.geral, 1)} (${v.reps} corridas por robô × missão)<br>
      <span class="muted">${esc(model.lacunas?.['cerebro' + n] || '')}</span>
      ${fal.length ? `<br><span class="small">Falha em ${fal.length} de ${FLEET.length * MISSIONS.length} combinações: ${fal.join('; ')}</span>` : ''}
    </div>`;
  }).join('');

  // H1 e H2
  const porModo = m => {
    const xs = ds.filter(x => x.modo === m);
    const certos = xs.filter(x => x.decisao === certa(x.cerebro));
    const errados = xs.filter(x => x.decisao !== certa(x.cerebro));
    return { xs, certos, errados };
  };
  $('kpis').innerHTML = ['bancada', 'relatorio'].map(m => {
    const { xs, certos, errados } = porModo(m);
    return `<div class="kpi"><span class="muted small">${MODOS[m]}: acerto</span><div class="v">${pct(certos.length, xs.length)}</div>
        <span class="small">${certos.length} de ${xs.length} decisões</span></div>
      <div class="kpi"><span class="muted small">${MODOS[m]}: confiança nas decisões erradas</span><div class="v">${media(errados.map(x => x.confianca))}</div>
        <span class="small">${errados.length} erradas · nas certas: ${media(certos.map(x => x.confianca))}</span></div>`;
  }).join('');
  $('t-acerto').innerHTML = [1, 2, 3, 4].map(n => {
    const ac = m => { const xs = ds.filter(x => x.cerebro === n && x.modo === m); return `${xs.filter(x => x.decisao === certa(n)).length} de ${xs.length}`; };
    return `<tr><td>Cérebro ${n}</td><td>${certa(n) === 'libero' ? 'liberar' : 'reprovar'}</td>
      <td class="num">${ac('bancada')}</td><td class="num">${ac('relatorio')}</td></tr>`;
  }).join('');
  $('t-relatorios').innerHTML = ds.filter(x => x.modo === 'relatorio' && x.relatorio).map(x => {
    const ok = x.decisao === certa(x.cerebro);
    return `<tr class="${ok ? '' : 'falha'}"><td>${esc(x.apelido)}</td><td>Cérebro ${x.cerebro}</td>
      <td class="num">${pct(x.relatorio.sucesso, x.relatorio.total)}</td><td>${x.viu_falha ? 'sim' : 'não'}</td>
      <td>${x.decisao === 'libero' ? 'liberou' : 'reprovou'} ${ok ? '(certo)' : '(errado)'}</td><td class="num">${x.confianca}</td></tr>`;
  }).join('') || '<tr><td class="muted">Sem decisões no relatório.</td></tr>';

  // H3
  $('t-h3').innerHTML = ['bancada', 'relatorio'].map(m => {
    const rep = ds.filter(x => x.modo === m && x.decisao === 'nao_libero');
    return `<tr><td>${MODOS[m]}</td><td class="num">${rep.length}</td><td class="num">${rep.filter(x => x.viu_falha).length} (${pct(rep.filter(x => x.viu_falha).length, rep.length)})</td></tr>`;
  }).join('');
  const qs = rs.map(r => r.questionario || {});
  $('q3').innerHTML = contar(qs.map(q => q.q3).filter(Boolean), Q3);
  $('q4').innerHTML = contar(qs.map(q => q.q4).filter(Boolean), Q4);
  $('q2').innerHTML = contar(qs.map(q => q.q2).filter(Boolean), Q2);
  $('q1').innerHTML = contar(qs.flatMap(q => q.q1 || []), { 1: 'Cérebro 1', 2: 'Cérebro 2', 3: 'Cérebro 3', 4: 'Cérebro 4', nenhum: 'Nenhum' });

  // respostas abertas
  const porque = [1, 2, 3, 4].map(n => `<h3>Por quê: Cérebro ${n}</h3>` + (ds.filter(x => x.cerebro === n).map(x =>
    `<p class="small"><b>${esc(x.apelido)}</b> (${MODOS[x.modo]}, ${x.decisao === 'libero' ? 'liberou' : 'reprovou'}, confiança ${x.confianca}):
      ${esc(x.porque)}</p>`).join('') || '<p class="muted small">—</p>')).join('');
  const outros = rs.filter(r => r.questionario?.q3_outro).map(r => `<p class="small"><b>${esc(r.apelido)}</b>: ${esc(r.questionario.q3_outro)}</p>`).join('');
  const q5 = rs.filter(r => r.questionario?.q5).map(r => `<p class="small"><b>${esc(r.apelido)}</b>: ${esc(r.questionario.q5)}</p>`).join('');
  $('abertas').innerHTML = porque
    + `<h3>Questão 3, "outro"</h3>${outros || '<p class="muted small">—</p>'}`
    + `<h3>Questão 5: o que faltou para decidir com segurança?</h3>${q5 || '<p class="muted small">—</p>'}`;
}

carregar();
