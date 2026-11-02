// Pilotos disponíveis, pelo nome. Mesmo ponto de entrada no site e nos scripts em Node.
import { expertPilot } from './expert.js';
import { brainPilot } from './brain.js';

export const BRAIN_NAMES = ['cerebro1', 'cerebro2', 'cerebro3', 'cerebro4'];
export const PILOT_NAMES = ['especialista', ...BRAIN_NAMES];

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

export async function loadPilot(name) {
  if (name === 'especialista') return expertPilot;
  if (BRAIN_NAMES.includes(name)) {
    const model = await loadModel();
    return brainPilot(model, model.brains[name]);
  }
  throw new Error(`piloto desconhecido: ${name}`);
}
