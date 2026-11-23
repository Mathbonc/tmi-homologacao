// Pilotos disponíveis, pelo nome. Mesmo ponto de entrada no site e nos scripts em Node.
import { expertPilot } from './expert.js';
import { brainPilot } from './brain.js';

export const BRAIN_NAMES = ['cerebro1', 'cerebro2', 'cerebro3', 'cerebro4'];
export const PILOT_NAMES = ['especialista', ...BRAIN_NAMES];
// Cérebros do projeto final, cada um no seu arquivo (brains.json fica congelado com os 4 do
// experimento). Não entram em BRAIN_NAMES/PILOT_NAMES, que a banca e a conferência de verdade usam.
export const NOVOS = ['cerebro3v2'];
export const TODOS_CEREBROS = [...BRAIN_NAMES, ...NOVOS];
export const PILOTOS_LICENCA = ['especialista', ...TODOS_CEREBROS];

const MODEL_URL = new URL('../model/brains.json', import.meta.url);
let modelPromise = null;

export function loadModel() {
  if (!modelPromise) {
    modelPromise = MODEL_URL.protocol === 'file:'
      ? import('node:fs').then(fs => JSON.parse(fs.readFileSync(MODEL_URL, 'utf8')))
      : fetch(MODEL_URL).then(r => { if (!r.ok) throw new Error('não achei model/brains.json'); return r.json(); });
  }
  return modelPromise;
}

const novos = {};
export function loadModelNovo(name) {
  if (!novos[name]) {
    const url = new URL(`../model/${name}.json`, import.meta.url);
    novos[name] = url.protocol === 'file:'
      ? import('node:fs').then(fs => JSON.parse(fs.readFileSync(url, 'utf8')))
      : fetch(url).then(r => { if (!r.ok) throw new Error(`não achei model/${name}.json`); return r.json(); });
  }
  return novos[name];
}

export async function loadPilot(name) {
  if (name === 'especialista') return expertPilot;
  if (BRAIN_NAMES.includes(name)) {
    const model = await loadModel();
    return brainPilot(model, model.brains[name]);
  }
  if (NOVOS.includes(name)) {
    const model = await loadModelNovo(name);
    return brainPilot(model, model.brains[name]);
  }
  throw new Error(`piloto desconhecido: ${name}`);
}
