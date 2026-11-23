// Pré-cálculo das licenças (CLAUDE.md 3.6): roda a matriz piloto × condição × robô × missão ×
// repetições e grava docs/model/licencas.json. Depois imprime a licença em texto de cada cérebro.
//
//   node train/licenciar.mjs                                  (tudo; uns minutos)
//   node train/licenciar.mjs --pilotos especialista,cerebro2 --reps 3 --condicoes nominal
//   node train/licenciar.mjs --condicoes nominal,atraso       (eixo inteiro ou id como atraso:0.1)
//   node train/licenciar.mjs --robos frota                    (frota | extras | todos | ids)
//   node train/licenciar.mjs --so-imprimir                    (não roda; lê o arquivo e imprime)
//
// Rodadas parciais são mescladas no arquivo existente (se as repetições forem as mesmas).
import fs from 'node:fs';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { MISSIONS } from '../docs/core/warehouse.js';
import { Run } from '../docs/core/episode.js';
import {
  CONDICOES, EIXOS, ROBOS, SEED0, TOL_PADRAO, VERSAO_FERRAMENTA, condById, corpoDe, roboById, idCondicao,
  novaCelula, somarCorrida, celulaJSON, montarCartao, cartaoTexto, classificarGrade, fracaoMantida, varredura
} from '../docs/core/licenca.js';

// ------------------------------------------------------------------ worker: roda uma linha da grade
if (!isMainThread) {
  const { loadPilot } = await import('../docs/core/pilots.js');
  const pilots = {};
  parentPort.on('message', async ({ piloto, condId, robo, reps }) => {
    const pilot = pilots[piloto] ||= await loadPilot(piloto);
    const body = corpoDe(robo);
    const opts = condById(condId).opts;
    const cells = {};
    for (const m of MISSIONS) {
      const cel = novaCelula();
      for (let r = 0; r < reps; r++) somarCorrida(cel, new Run(body, m, SEED0 + r, pilot, undefined, opts).runToEnd());
      cells[m.id] = celulaJSON(cel);
    }
    parentPort.postMessage({ piloto, condId, robo, cells });
  });
}

async function principal() {
  const { PILOTOS_LICENCA: PILOT_NAMES, TODOS_CEREBROS: BRAIN_NAMES } = await import('../docs/core/pilots.js');
  const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => s.trim().split(/\s+/)).map(([k, v]) => [k, v ?? true]));
  const lista = v => String(v).split(',').map(s => s.trim()).filter(Boolean);
  const reps = +(args.reps || 6);
  const pilotos = args.pilotos ? lista(args.pilotos) : PILOT_NAMES;
  const condicoes = args.condicoes ? lista(args.condicoes).flatMap(c =>
    c === 'todas' ? CONDICOES.map(x => x.id) : condById(c) ? [c] : CONDICOES.filter(x => x.eixo === c).map(x => x.id)) : CONDICOES.map(c => c.id);
  const robosArg = args.robos || 'todos';
  const robos = robosArg === 'todos' ? ROBOS.map(r => r.id) : robosArg === 'frota' ? ROBOS.filter(r => r.frota).map(r => r.id)
    : robosArg === 'extras' ? ROBOS.filter(r => !r.frota).map(r => r.id) : lista(robosArg);
  for (const p of pilotos) if (!PILOT_NAMES.includes(p)) throw new Error(`piloto desconhecido: ${p}`);
  for (const r of robos) if (!roboById(r)) throw new Error(`robô desconhecido: ${r}`);
  if (!condicoes.length) throw new Error('nenhuma condição reconhecida em --condicoes');
  const saida = args.saida ? pathToFileURL(args.saida) : new URL('../docs/model/licencas.json', import.meta.url);

  // arquivo existente (para mesclar)
  let dados = null;
  if (fs.existsSync(saida)) {
    try { dados = JSON.parse(fs.readFileSync(saida, 'utf8')); } catch { dados = null; }
    if (dados && dados.reps !== reps && !args['so-imprimir']) {
      console.log(`(o arquivo existente tem ${dados.reps} repetições; com --reps ${reps} ele será recomeçado)`);
      dados = null;
    }
  }
  dados ||= { reps, pilotos: {} };
  Object.assign(dados, {
    ferramenta: VERSAO_FERRAMENTA, reps, seed0: SEED0, tolPadrao: TOL_PADRAO,
    robos: ROBOS.map(({ id, nome, frota, spec }) => ({ id, nome, frota, spec })),
    missoes: MISSIONS.map(({ id, nome, costas }) => ({ id, nome, costas: !!costas })),
    condicoes: CONDICOES.map(({ id, eixo, nivel, opts, rotulo }) => ({ id, eixo, nivel, opts, rotulo }))
  });

  if (!args['so-imprimir']) {
    const tarefas = [];
    for (const piloto of pilotos) for (const condId of condicoes) for (const robo of robos) tarefas.push({ piloto, condId, robo, reps });
    const nCorridas = tarefas.length * MISSIONS.length * reps;
    const nJobs = Math.max(1, Math.min(+(args.jobs || Math.max(1, os.cpus().length - 1)), tarefas.length));
    console.log(`Rodando ${pilotos.length} piloto(s) × ${condicoes.length} condição(ões) × ${robos.length} robô(s) × ${MISSIONS.length} missões × ${reps} repetições = ${nCorridas} corridas, em ${nJobs} processo(s)…`);
    const t0 = Date.now();
    let feitas = 0, ultimo = 0;
    await new Promise((resolve, reject) => {
      let proxima = 0, ativos = 0;
      const workers = Array.from({ length: nJobs }, () => new Worker(new URL(import.meta.url)));
      const mandar = w => {
        if (proxima >= tarefas.length) { w.terminate(); if (--ativos === 0) resolve(); return; }
        w.postMessage(tarefas[proxima++]);
      };
      for (const w of workers) {
        ativos++;
        w.on('error', reject);
        w.on('message', ({ piloto, condId, robo, cells }) => {
          ((dados.pilotos[piloto] ||= {})[condId] ||= {})[robo] = cells;
          feitas++;
          const agora = Date.now();
          if (agora - ultimo > 5000 || feitas === tarefas.length) {
            ultimo = agora;
            process.stdout.write(`  ${feitas}/${tarefas.length} linhas · ${((agora - t0) / 1000).toFixed(0)} s\n`);
          }
          mandar(w);
        });
        mandar(w);
      }
    });
    dados.gerado = new Date().toISOString();
    if (!args['nao-gravar']) {
      fs.writeFileSync(saida, JSON.stringify(dados));
      console.log(`Gravado ${saida.pathname.split('/').slice(-3).join('/')} (${(fs.statSync(saida).size / 1024).toFixed(0)} KB) em ${((Date.now() - t0) / 1000).toFixed(0)} s.\n`);
    }
  }
  imprimir(dados, BRAIN_NAMES);
}

// ------------------------------------------------------------------ relatório no terminal
// Gabarito (seção 3.1): o que a licença nominal de cada cérebro tem que bloquear, e nada mais.
const TODAS = r => MISSIONS.map(m => [r, m.id]);
const GABARITO = {
  cerebro1: [],
  cerebro2: TODAS('empilhadeira'),
  cerebro3: [['carro', 'm6'], ['carro', 'm7'], ['empilhadeira', 'm6'], ['empilhadeira', 'm7']],
  cerebro4: [...TODAS('omni3'), ...TODAS('mecanum')],
  cerebro3v2: []        // o 3 retreinado: espera-se que libere carro e empilhadeira em m6 e m7
};

function imprimir(dados, brainNames) {
  const missoes = MISSIONS.map(m => m.id);
  const frota = ROBOS.filter(r => r.frota).map(r => r.id);
  const extras = ROBOS.filter(r => !r.frota).map(r => r.id);
  const esp = dados.pilotos.especialista;
  const temLinhas = (d, rs) => d && rs.every(r => d[r]);
  if (!esp || !temLinhas(esp.nominal, frota)) {
    console.log('Sem o especialista na condição nominal para a frota inteira: não dá para classificar.');
    return;
  }
  const nomeCls = { liberado: 'L', testar: 'T', defeito: 'D', limite: '·' };

  for (const b of brainNames) {
    const d = dados.pilotos[b];
    if (!d || !temLinhas(d.nominal, frota)) continue;
    // só as condições que existem para os dois e para a frota inteira
    const condsB = {}, condsE = {};
    for (const c of Object.keys(d)) if (temLinhas(d[c], frota) && temLinhas(esp[c], frota)) { condsB[c] = d[c]; condsE[c] = esp[c]; }
    const cartao = montarCartao({ piloto: b, dados: condsB, esp: condsE, robos: frota, missoes });
    console.log('='.repeat(96));
    console.log(cartaoTexto(cartao));
    // grade nominal compacta
    console.log('\n  Grade nominal (L liberado, T testar fisicamente, D defeito do cérebro, · limite físico):');
    console.log('    ' + ''.padEnd(22) + missoes.map(m => m.padEnd(4)).join(''));
    for (const r of frota) console.log('    ' + roboById(r).nome.padEnd(22) + missoes.map(m => nomeCls[cartao.classes[r][m]].padEnd(4)).join(''));
    // gabarito
    if (GABARITO[b]) {
      const chave = ([r, m]) => `${r}/${m}`;
      const esperado = new Set(GABARITO[b].map(chave));
      const obtido = new Set(cartao.bloqueado.map(i => chave([i.robo, i.missao])));
      const falta = [...esperado].filter(k => !obtido.has(k)), sobra = [...obtido].filter(k => !esperado.has(k));
      const foraFrota = cartao.fora.length;
      console.log(`\n  Gabarito (seção 3.1): ${!falta.length && !sobra.length ? 'CONFERE' : 'NÃO CONFERE'}` +
        (falta.length ? ` · deixou de bloquear: ${falta.join(' ')}` : '') + (sobra.length ? ` · bloqueou a mais: ${sobra.join(' ')}` : '') +
        (foraFrota ? ` · atenção: ${foraFrota} célula(s) da frota como limite físico` : ''));
    }
  }

  // robôs fora da frota
  const extrasPresentes = extras.filter(r => esp.nominal[r]);
  if (extrasPresentes.length) {
    console.log('\n' + '='.repeat(96));
    console.log('ROBÔS FORA DA FROTA, condição nominal (classe por missão: L T D ·)');
    const nomes = ['especialista', ...brainNames].filter(p => dados.pilotos[p]?.nominal && extrasPresentes.every(r => dados.pilotos[p].nominal[r]));
    for (const r of extrasPresentes) {
      console.log(`  ${roboById(r).nome}`);
      for (const p of nomes) {
        const cls = classificarGrade(dados.pilotos[p].nominal, esp.nominal, [r], missoes)[r];
        const tx = missoes.map(m => Math.round(100 * dados.pilotos[p].nominal[r][m].ok / dados.pilotos[p].nominal[r][m].n));
        console.log(`    ${p.padEnd(13)} ${missoes.map(m => nomeCls[cls[m]]).join(' ')}   taxas ${tx.map(x => String(x).padStart(3) + '%').join(' ')}`);
      }
    }
  }

  // varreduras: fração de células da frota mantidas, por nível
  for (const eixo of EIXOS) {
    const ids = eixo.niveis.map(n => idCondicao(eixo, n));
    const comDados = p => dados.pilotos[p] && ids.some(id => temLinhas(dados.pilotos[p][id], frota));
    if (!comDados('especialista')) continue;
    const ps = ['especialista', ...brainNames.filter(comDados)];
    console.log('\n' + '='.repeat(96));
    console.log(`VARREDURA · ${eixo.nome} · fração das 49 células da frota em que o piloto se mantém (taxa ≥ ${TOL_PADRAO}, sem colisão grave)`);
    console.log('  ' + 'nível'.padEnd(10) + ps.map(p => p.padEnd(14)).join(''));
    for (const [k, id] of [['nominal', 'nominal'], ...ids.map((id, i) => [eixo.fmt(eixo.niveis[i]), id])]) {
      if (!temLinhas(esp[id], frota)) continue;
      console.log('  ' + k.padEnd(10) + ps.map(p => {
        const d = dados.pilotos[p][id];
        return (temLinhas(d, frota) ? `${Math.round(100 * fracaoMantida(d, frota, missoes))}%` : '-').padEnd(14);
      }).join(''));
    }
    // limite de cada cérebro (sobre as células que ele tem licenciadas no nominal)
    for (const p of ps.slice(1)) {
      const d = dados.pilotos[p];
      const cls = classificarGrade(d.nominal, esp.nominal, frota, missoes);
      const escopo = frota.flatMap(r => missoes.filter(m => cls[r][m] === 'liberado' || cls[r][m] === 'testar').map(m => [r, m]));
      const v = varredura(eixo, id => temLinhas(d[id], frota) && temLinhas(esp[id], frota) ? { b: d[id], e: esp[id] } : null, escopo);
      console.log(`  limite ${p}: ${v.limite ? eixo.fmt(v.limite) : 'nenhum'}${v.maximo ? ' (máximo testado)' : ''} · referência mantém todo o escopo ${v.limiteEsp ? 'até ' + eixo.fmt(v.limiteEsp) : 'só no nominal'}` +
        ` · defeitos por nível: ${v.niveis.map(n => n.defeitos).join(' ')}`);
    }
  }
}

if (isMainThread) await principal();
