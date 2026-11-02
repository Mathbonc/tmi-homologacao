// O galpão: 8 × 6 m. Embaixo, a área das docas (2 m); no meio, cinco blocos de prateleiras
// formando quatro corredores; em cima, um corredor transversal. Origem no canto inferior esquerdo.

const ZONE = 2.0;    // fim da área das docas
const TOP = 4.8;     // começo do corredor de cima

export const WAREHOUSE = {
  W: 8, H: 6, zone: ZONE, top: TOP,
  shelves: [
    { id: 'P0', x0: 0.0, y0: ZONE, x1: 0.4, y1: TOP },
    { id: 'P1', x0: 1.7, y0: ZONE, x1: 2.2, y1: TOP },
    { id: 'P2', x0: 3.5, y0: ZONE, x1: 4.0, y1: TOP },
    { id: 'P3', x0: 5.1, y0: ZONE, x1: 5.6, y1: TOP },
    { id: 'P4', x0: 6.9, y0: ZONE, x1: 8.0, y1: TOP }
  ],
  // corredores entre as prateleiras (só para desenho e relatório)
  aisles: [
    { id: 'C1', x0: 0.4, x1: 1.7 },
    { id: 'C2', x0: 2.2, x1: 3.5 },
    { id: 'C3', x0: 4.0, x1: 5.1, estreito: true },
    { id: 'C4', x0: 5.6, x1: 6.9 }
  ],
  obstacles: [],
  docks: [
    { id: '1', nome: 'Doca 1', x: 1.05 },
    { id: '2', nome: 'Doca 2', x: 4.55 },
    { id: '3', nome: 'Doca 3', x: 6.25 }
  ],
  stations: {
    A: { x: 1.05, y: 5.4 },
    B: { x: 4.55, y: 3.4 },
    C: { x: 7.4, y: 5.4 },
    D: { x: 2.85, y: 3.6 },
    E: { x: 6.25, y: 3.2 }
  }
};

const DEG = Math.PI / 180, DOCK_Y = 1.0;
const dock = (id, deg, y = DOCK_Y) => ({ x: WAREHOUSE.docks.find(d => d.id === id).x, y, th: deg * DEG });
const st = k => WAREHOUSE.stations[k];

// Nas missões normais o robô sai apontado para o começo da rota. Nas de costas ele sai virado
// ~150° em relação à rota (exige meia-volta), do lado em que a curva tem espaço.
export const MISSIONS = [
  { id: 'm1', nome: 'Doca 1 → Estação A', start: dock('1', 90), goal: st('A') },
  { id: 'm2', nome: 'Doca 3 → Estação B', start: dock('3', 160), goal: st('B'), estreito: true },
  { id: 'm3', nome: 'Doca 2 → Estação C', start: dock('2', 20), goal: st('C') },
  { id: 'm4', nome: 'Doca 1 → Estação E', start: dock('1', 5), goal: st('E') },
  { id: 'm5', nome: 'Doca 3 → Estação D', start: dock('3', 170), goal: st('D') },
  { id: 'm6', nome: 'Doca 2 → Estação A (de costas)', start: dock('2', 15, 0.8), goal: st('A'), costas: true },
  { id: 'm7', nome: 'Doca 1 → Estação D (de costas)', start: dock('1', 169, 0.9), goal: st('D'), costas: true }
];

export const missionById = id => MISSIONS.find(m => m.id === id);

// Saída com pequena variação (±5 cm, ±5°), para "rodar de novo" não dar sempre igual.
export function jitterStart(start, rng) {
  return {
    x: start.x + (rng() * 2 - 1) * 0.05,
    y: start.y + (rng() * 2 - 1) * 0.05,
    th: start.th + (rng() * 2 - 1) * 5 * Math.PI / 180
  };
}
