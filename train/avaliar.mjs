// Mede a verdade: roda cada robô da frota em cada missão, várias vezes.
//   node train/avaliar.mjs --piloto ideal
//   node train/avaliar.mjs --piloto especialista [--reps 5]
//   node train/avaliar.mjs --piloto cerebros --reps 20 --gravar   (os 4; grava a verdade no modelo)
import fs from 'node:fs';
import { FLEET, fleetBody } from '../docs/core/parts.js';
import { MISSIONS, WAREHOUSE } from '../docs/core/warehouse.js';
import { Run, IdealRun } from '../docs/core/episode.js';
import { clearance } from '../docs/core/physics.js';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map(s => s.trim().split(/\s+/)).map(([k, v]) => [k, v ?? true]));
const piloto = args.piloto || 'ideal';
const reps = +(args.reps || 5);

const pad = (s, n) => String(s).padEnd(n);
const pct = x => (100 * x).toFixed(0).padStart(3) + '%';

function corridorsOf(path) {
  const seen = [];
  for (const [x, y] of path.pts) {
    if (y < WAREHOUSE.zone || y > WAREHOUSE.top) continue;
    const a = WAREHOUSE.aisles.find(c => x > c.x0 && x < c.x1);
    const id = a ? a.id : 'FORA';
    if (seen[seen.length - 1] !== id) seen.push(id);
  }
  return seen.join('→') || '(só área aberta)';
}

if (piloto === 'ideal') {
  console.log(`Robô ideal (sem física), ${reps} corridas por robô × missão\n`);
  let ok = 0, total = 0, touched = 0;
  for (const m of MISSIONS) {
    console.log(m.nome);
    for (const f of FLEET) {
      const body = fleetBody(f.id);
      let chegou = 0, minClear = Infinity, pathMin = Infinity, len = 0, corr = '';
      for (let r = 0; r < reps; r++) {
        const run = new IdealRun(body.colR, m, 1000 + r);
        const res = run.runToEnd();
        if (res.status === 'chegou') chegou++;
        minClear = Math.min(minClear, res.minClear);
        for (const [x, y] of run.path.pts) pathMin = Math.min(pathMin, clearance(WAREHOUSE, x, y) - body.colR);
        len = run.path.length; corr = corridorsOf(run.path);
      }
      ok += chegou; total += reps;
      if (pathMin <= 0) touched++;
      console.log(`  ${pad(f.nome, 22)} chegou ${chegou}/${reps}  rota ${len.toFixed(1)} m  folga mín. da rota ${(pathMin * 100).toFixed(0).padStart(3)} cm  corredores ${corr}`);
    }
  }
  console.log(`\nTotal: ${ok}/${total} (${pct(ok / total)}) chegaram. Rotas que encostam em prateleira: ${touched}.`);
  process.exit(0);
}

const { loadPilot, BRAIN_NAMES } = await import('../docs/core/pilots.js');
const names = piloto === 'cerebros' ? BRAIN_NAMES : [piloto];
const verdade = {};
for (const name of names) {
  const pilot = await loadPilot(name);
  console.log(`Piloto: ${name}, ${reps} corridas por robô × missão
`);
  const taxa = {}, falhas = [];
  let worst = 1, okTot = 0;
  console.log(pad('', 22) + MISSIONS.map(m => pad(m.id, 6)).join('') + ' total  suav.');
  for (const f of FLEET) {
    const body = fleetBody(f.id);
    let line = pad(f.nome, 22), okAll = 0, smooth = 0, n = 0;
    taxa[f.id] = {};
    for (const m of MISSIONS) {
      let ok = 0;
      for (let r = 0; r < reps; r++) {
        const res = new Run(body, m, 1000 + r, pilot).runToEnd();
        if (res.status === 'chegou') ok++;
        smooth += res.smooth; n++;
      }
      taxa[f.id][m.id] = ok / reps;
      if (ok / reps < 0.9) falhas.push({ robo: f.id, missao: m.id, taxa: ok / reps });
      worst = Math.min(worst, ok / reps);
      okAll += ok;
      line += pad(pct(ok / reps), 6);
    }
    okTot += okAll;
    console.log(line + ' ' + pct(okAll / (reps * MISSIONS.length)) + '  ' + (smooth / n).toFixed(3));
  }
  const geral = okTot / (reps * MISSIONS.length * FLEET.length);
  console.log(`
Pior combinação robô × missão: ${pct(worst)}. Geral: ${pct(geral)}. ` +
    `Cumpre a regra (nenhuma combinação abaixo de 90%): ${falhas.length ? 'NÃO' : 'SIM'}
`);
  verdade[name] = { reps, cumpre: falhas.length === 0, geral, taxa, falhas };
}

if (args.gravar && names.every(n => BRAIN_NAMES.includes(n))) {
  const url = new URL('../docs/model/brains.json', import.meta.url);
  const model = JSON.parse(fs.readFileSync(url, 'utf8'));
  model.verdade = { ...(model.verdade || {}), ...verdade };
  fs.writeFileSync(url, JSON.stringify(model));
  console.log('Tabela de verdade gravada em docs/model/brains.json');
}
