// Licença ao vivo de um robô montado (CLAUDE.md, etapa 8): roda os pilotos num corpo qualquer,
// nas mesmas sementes e com as mesmas opções do pré-cálculo. Usado pelo Web Worker da página
// (montador-worker.js) e pelos testes em Node.
import { Run } from './episode.js';
import { MISSIONS } from './warehouse.js';
import { BASES, PARTS, buildBody, bodyClass } from './parts.js';
import { loadPilot, PILOTOS_LICENCA } from './pilots.js';
import { novaCelula, somarCorrida, celulaJSON, condById, SEED0 } from './licenca.js';

// Confere se a montagem faz sentido antes de gastar corridas.
export function conferirMontagem(spec) {
  const base = BASES[spec?.base];
  if (!base) return { ok: false, msg: 'base desconhecida' };
  const pecas = Object.entries(spec.pecas || {}).filter(([, t]) => t);
  for (const [slot, tipo] of pecas) {
    const s = base.slots.find(x => x.id === slot);
    if (!s) return { ok: false, msg: `a base ${base.nome} não tem o encaixe ${slot}` };
    if (!s.aceita.includes(tipo)) return { ok: false, msg: `o encaixe ${s.nome} não aceita ${PARTS[tipo]?.nome || tipo}` };
  }
  if (!pecas.length) return { ok: false, msg: 'ponha pelo menos uma roda' };
  const body = buildBody(spec);
  const aviso = body.wheels.some(w => w.driven) ? null : 'nenhuma roda tem motor: o robô não sai do lugar (deve dar limite físico em tudo)';
  return { ok: true, body, classe: bodyClass(body), aviso };
}

// conds: ids de condição (ex.: ['nominal', 'atraso:0.2']). aoProgresso(feitas, total) a cada
// célula; pausa(): se dada, é aguardada entre células (para não travar quando roda sem Worker).
export async function calcularMontagem({ spec, conds = ['nominal'], reps = 6, pilotos = PILOTOS_LICENCA, aoProgresso, pausa }) {
  const { ok, msg, body } = conferirMontagem(spec);
  if (!ok) throw new Error(msg);
  const total = pilotos.length * conds.length * MISSIONS.length * reps;
  let feitas = 0;
  const out = {};
  for (const p of pilotos) {
    const pilot = await loadPilot(p);
    for (const c of conds) {
      const opts = condById(c).opts;
      for (const m of MISSIONS) {
        const cel = novaCelula();
        for (let r = 0; r < reps; r++) { somarCorrida(cel, new Run(body, m, SEED0 + r, pilot, undefined, opts).runToEnd()); feitas++; }
        ((out[p] ||= {})[c] ||= {})[m.id] = celulaJSON(cel);
        aoProgresso?.(feitas, total);
        if (pausa) await pausa();
      }
    }
  }
  return out;
}
