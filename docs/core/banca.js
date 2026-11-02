// Desenho da sessão (seção 3): ordem dos cérebros por participante e o relatório automático.
// Usado pelo site (app.js), pelo painel (painel.js) e pelos testes em Node.
import { FLEET, fleetBody } from './parts.js';
import { MISSIONS, missionById } from './warehouse.js';
import { Run } from './episode.js';

export const N_RELATORIO = 40;
export const N_PARTICIPANTES = 6;

// Quais cérebros cada participante avalia em cada modo (tabela da seção 3) e em que ordem.
// Dentro de cada modo a ordem alterna entre participantes, para nenhum cérebro vir sempre primeiro.
const PLANO = {
  1: { comeca: 'bancada',   bancada: [3, 4], relatorio: [1, 2] },
  2: { comeca: 'relatorio', relatorio: [3, 4], bancada: [1, 2] },
  3: { comeca: 'bancada',   bancada: [4, 2], relatorio: [3, 1] },
  4: { comeca: 'relatorio', relatorio: [2, 4], bancada: [3, 1] },
  5: { comeca: 'bancada',   bancada: [2, 3], relatorio: [4, 1] },
  6: { comeca: 'relatorio', relatorio: [2, 3], bancada: [1, 4] }
};

// Número fora de 1..6 (alguém de fora da turma) cai num dos seis planos, em ciclo.
export const planoDe = n => ((Math.max(1, Math.floor(n)) - 1) % N_PARTICIPANTES) + 1;

// [{ modo: 'bancada' | 'relatorio', cerebro: 1..4 }] na ordem em que a pessoa os vê.
export function sequencia(participante) {
  const p = PLANO[planoDe(participante)];
  const outro = p.comeca === 'bancada' ? 'relatorio' : 'bancada';
  return [p.comeca, outro].flatMap(modo => p[modo].map(cerebro => ({ modo, cerebro })));
}

// 40 corridas sorteadas do mesmo espaço que a bancada oferece: robô e missão uniformes,
// posição de saída com a variação normal (semente).
export function sortearRelatorio(rand = Math.random) {
  const out = [];
  for (let k = 0; k < N_RELATORIO; k++) {
    out.push({
      robo: FLEET[Math.floor(rand() * FLEET.length)].id,
      missao: MISSIONS[Math.floor(rand() * MISSIONS.length)].id,
      seed: Math.floor(rand() * 1e9)
    });
  }
  return out;
}

// A corrida de um item (para rodar sem desenhar ou para o replay: mesma semente, mesmo resultado).
export const novaCorrida = (item, pilot) => new Run(fleetBody(item.robo), missionById(item.missao), item.seed, pilot);

// As n piores: primeiro as que bateram, depois as de tempo esgotado, depois as mais lentas.
export function piores(resultados, n = 3) {
  const peso = { bateu: 0, tempo: 1, chegou: 2 };
  return [...resultados]
    .sort((a, b) => peso[a.status] - peso[b.status] || b.t - a.t)
    .slice(0, n);
}

// Contagem por chave (robô ou missão): { id: { n, ok } }
export function agrupar(resultados, chave) {
  const g = {};
  for (const r of resultados) {
    const k = r[chave];
    g[k] ||= { n: 0, ok: 0 };
    g[k].n++;
    if (r.status === 'chegou') g[k].ok++;
  }
  return g;
}

export const STATUS_TEXTO = { chegou: 'chegou', bateu: 'bateu', tempo: 'tempo esgotado', interrompida: 'interrompida' };
