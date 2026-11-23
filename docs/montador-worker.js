// Web Worker do montador: calcula a licença do robô montado sem travar a aba.
// Recebe { spec, conds, reps }; manda { tipo: 'progresso', feitas, total }, depois { tipo: 'fim', res }
// ou { tipo: 'erro', msg }.
import { calcularMontagem } from './core/montador.js';

self.onmessage = async ({ data }) => {
  try {
    const res = await calcularMontagem({ ...data, aoProgresso: (feitas, total) => self.postMessage({ tipo: 'progresso', feitas, total }) });
    self.postMessage({ tipo: 'fim', res });
  } catch (e) {
    self.postMessage({ tipo: 'erro', msg: e.message });
  }
};
