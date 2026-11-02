"""Ajusta os 4 cérebros por mínimos quadrados com regularização (ridge).

    python train/ajustar.py [--lam 1e-3] [--na 40] [--nb 22]

Lê train/dados/ (gerado por gerar_dados.mjs) e grava docs/model/brains.json.
A expansão em características repete makeExpander() de docs/core/brain.js.
Cada cérebro vê um subconjunto dos dados; a lacuna de cada um está em LACUNAS.
"""
import argparse, json, os, time
import numpy as np
import sys
sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

ap = argparse.ArgumentParser()
ap.add_argument('--lam', type=float, default=1e-3)
ap.add_argument('--na', type=int, default=60)
ap.add_argument('--nb', type=int, default=22)
ap.add_argument('--semente', type=int, default=12345)
ap.add_argument('--lowpass', type=float, default=1.0)
ap.add_argument('--corte3', type=float, default=60, help='cérebro 3 não vê |alfa| acima disto (graus)')
args = ap.parse_args()

meta = json.load(open(os.path.join(HERE, 'dados', 'meta.json')))
data = np.fromfile(os.path.join(HERE, 'dados', 'amostras.f32'), dtype=np.float32).reshape(meta['n'], meta['row'])
nS, nBd, nW = meta['nState'], meta['nBody'], meta['nWheel']
CLASSES = meta['classes']
S = data[:, :nS].astype(np.float64)
BD = data[:, nS:nS + nBd].astype(np.float64)
WR = data[:, nS + nBd:nS + nBd + nW].astype(np.float64)
o = nS + nBd + nW
y_speed, y_steer = data[:, o], data[:, o + 1]
driven, steer = data[:, o + 2] > 0.5, data[:, o + 3] > 0.5
cls, alpha = data[:, o + 4].astype(int), data[:, o + 5]
print(f'{meta["n"]} amostras; motorizadas {driven.sum()}, direcionais {steer.sum()}')

rng = np.random.default_rng(args.semente)
feat = {
    'A': (rng.normal(size=(args.na, nS + nBd)) * 0.9).tolist(),
    'b': rng.uniform(-1, 1, size=args.na).tolist(),
    'B': (rng.normal(size=(args.nb, nW)) * 0.7).tolist(),
    'c': rng.uniform(-1, 1, size=args.nb).tolist(),
}
A, b, B, c = (np.array(feat[k]) for k in 'AbBc')


def phi(s, bd):
    cross = (s[:, :, None] * bd[:, None, :]).reshape(len(s), -1)
    rnd = np.tanh(np.concatenate([s, bd], 1) @ A.T + b)
    return np.concatenate([np.ones((len(s), 1)), s, bd, cross, rnd], 1)


def psi(w):
    return np.concatenate([np.ones((len(w), 1)), w, np.tanh(w @ B.T + c)], 1)


nPhi = 1 + nS + nBd + nS * nBd + args.na
nPsi = 1 + nW + args.nb
D = nPhi * nPsi
print(f'phi {nPhi} × psi {nPsi} = {D} parâmetros por saída')

# Lacunas: o que cada cérebro NÃO vê (máscara por amostra). Alfa > 0 = alvo à esquerda.
C = {k: i for i, k in enumerate(CLASSES)}
rad = np.radians
LACUNAS = {
    'cerebro1': np.zeros(len(cls), bool),                               # vê tudo
    'cerebro2': cls == C['puxado'],                                     # nunca viu corpos puxados
    'cerebro3': np.abs(alpha) >= rad(args.corte3),                      # só viu o alvo à frente
    'cerebro4': cls == C['holonomico'],                                 # nunca viu holonômicos
}
# Para o painel do apresentador (revelado só depois da avaliação).
DESCRICAO = {
    'cerebro1': 'Treinado com todos os corpos e situações.',
    'cerebro2': 'Nunca viu robôs puxados por uma roda direcional (como a Empilhadeira).',
    'cerebro3': f'Só viu o destino à frente (erro de direção abaixo de {args.corte3:.0f}°): nunca treinou meia-volta.',
    'cerebro4': 'Nunca viu robôs holonômicos (rodas omni ou mecanum, que andam de lado).',
}
# Grupos = padrões de exclusão; cada cérebro soma os grupos que pode ver.
pattern = sum(m.astype(int) << i for i, m in enumerate(LACUNAS.values()))
groups = sorted(set(pattern.tolist()))
gid = np.searchsorted(groups, pattern)


def grams(mask, y):
    G = np.zeros((len(groups), D, D)); r = np.zeros((len(groups), D)); cnt = np.zeros(len(groups), int)
    idx_all = np.nonzero(mask)[0]
    for g in range(len(groups)):
        idx = idx_all[gid[idx_all] == g]
        cnt[g] = len(idx)
        for k in range(0, len(idx), 6000):
            j = idx[k:k + 6000]
            X = (phi(S[j], BD[j])[:, :, None] * psi(WR[j])[:, None, :]).reshape(len(j), D).astype(np.float32)
            G[g] += (X.T @ X).astype(np.float64)
            r[g] += X.T.astype(np.float64) @ y[j]
    return G, r, cnt


def solve(G, r, bit):
    sel = [i for i, g in enumerate(groups) if not (g >> bit) & 1]
    GG = G[sel].sum(0); rr = r[sel].sum(0)
    lam = args.lam * np.trace(GG) / D
    w = np.linalg.solve(GG + lam * np.eye(D), rr)
    return w.reshape(nPhi, nPsi)


brains = {name: {} for name in LACUNAS}
for key, mask, y in (('W', driven, y_speed), ('V', steer, y_steer)):
    t0 = time.time()
    G, r, cnt = grams(mask, y)
    print(f'XᵀX {key}: {time.time() - t0:.0f} s, amostras por grupo {dict(zip(map(str, groups), cnt.tolist()))}')
    for bit, name in enumerate(LACUNAS):
        brains[name][key] = np.round(solve(G, r, bit), 6).tolist()
    del G, r

out = {
    'versao': time.strftime('%Y-%m-%d %H:%M'),
    'features': feat,
    'lowpass': args.lowpass,
    'lam': args.lam,
    'lacunas': DESCRICAO,
    'brains': brains,
}
path = os.path.join(ROOT, 'docs', 'model', 'brains.json')
# preserva a tabela de verdade se já existir (avaliar.mjs a regrava depois)
if os.path.exists(path):
    try:
        old = json.load(open(path))
        if 'verdade' in old: out['verdade'] = old['verdade']
    except Exception:
        pass
json.dump(out, open(path, 'w'), separators=(',', ':'))
print(f'gravado {path} ({os.path.getsize(path) / 1e6:.1f} MB)')
