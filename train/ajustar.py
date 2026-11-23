"""Ajusta os 4 cérebros por mínimos quadrados com regularização (ridge).

    python train/ajustar.py [--lam 1e-3] [--na 40] [--nb 22]
    python train/ajustar.py --dados train/dados-atraso --so cerebro3v2 --saida docs/model/cerebro3v2.json

Lê train/dados/ (gerado por gerar_dados.mjs) e grava docs/model/brains.json.
Com --so, ajusta um cérebro só e grava no arquivo de --saida (nunca em brains.json, que guarda
os 4 cérebros congelados do experimento).
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
ap.add_argument('--dados', default=os.path.join(HERE, 'dados'), help='pasta(s) de amostras, separadas por vírgula')
ap.add_argument('--so', default=None, help='ajusta um cérebro só (ex.: cerebro3v2); exige --saida')
ap.add_argument('--saida', default=None, help='arquivo de saída do --so')
args = ap.parse_args()

BRAINS_JSON = os.path.join(ROOT, 'docs', 'model', 'brains.json')
if args.so:
    if not args.saida:
        sys.exit('--so exige --saida')
    if os.path.abspath(args.saida) == os.path.abspath(BRAINS_JSON):
        sys.exit('recusado: brains.json guarda os cérebros congelados do experimento; escolha outro arquivo')

pastas = [p.strip() for p in args.dados.split(',') if p.strip()]
metas, partes = [], []
for p in pastas:
    m = json.load(open(os.path.join(p, 'meta.json')))
    metas.append(m)
    partes.append(np.fromfile(os.path.join(p, 'amostras.f32'), dtype=np.float32).reshape(m['n'], m['row']))
    if m['row'] != metas[0]['row'] or m['classes'] != metas[0]['classes']:
        sys.exit(f'formato diferente em {p}')
meta = dict(metas[0], n=sum(m['n'] for m in metas))
data = np.concatenate(partes) if len(partes) > 1 else partes[0]
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
# Cérebros novos, ajustados um de cada vez com --so (não entram em brains.json).
LACUNAS_NOVOS = {
    'cerebro3v2': np.zeros(len(cls), bool),                             # o 3 retreinado: sem o corte
}
DESCRICAO_NOVOS = {
    'cerebro3v2': 'O cérebro 3 retreinado com o que a licença dele pediu: alvo atrás (sem o corte de 60°) '
                  'e atraso de comando nos dados.',
}

if args.so:
    todas = {**LACUNAS, **LACUNAS_NOVOS}
    if args.so not in todas:
        sys.exit(f'cérebro desconhecido: {args.so}')
    lac = todas[args.so]
    brain = {}
    for key, mask, y in (('W', driven, y_speed), ('V', steer, y_steer)):
        t0 = time.time()
        idx = np.nonzero(mask & ~lac)[0]
        G = np.zeros((D, D)); r = np.zeros(D)
        for k in range(0, len(idx), 6000):
            j = idx[k:k + 6000]
            X = (phi(S[j], BD[j])[:, :, None] * psi(WR[j])[:, None, :]).reshape(len(j), D).astype(np.float32)
            G += (X.T @ X).astype(np.float64)
            r += X.T.astype(np.float64) @ y[j]
        lam = args.lam * np.trace(G) / D
        brain[key] = np.round(np.linalg.solve(G + lam * np.eye(D), r).reshape(nPhi, nPsi), 6).tolist()
        print(f'{args.so} {key}: {len(idx)} amostras, {time.time() - t0:.0f} s')
        del G, r
    out = {
        'versao': time.strftime('%Y-%m-%d %H:%M'),
        'features': feat, 'lowpass': args.lowpass, 'lam': args.lam,
        'lacunas': {args.so: {**DESCRICAO, **DESCRICAO_NOVOS}[args.so]},
        'dados': [{'pasta': os.path.relpath(p, ROOT).replace(os.sep, '/'), 'n': m['n'], 'stats': m.get('stats')} for p, m in zip(pastas, metas)],
        'brains': {args.so: brain},
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.saida)), exist_ok=True)
    json.dump(out, open(args.saida, 'w'), separators=(',', ':'))
    print(f'gravado {args.saida} ({os.path.getsize(args.saida) / 1e6:.1f} MB)')
    sys.exit(0)

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
path = BRAINS_JSON
# preserva a tabela de verdade se já existir (avaliar.mjs a regrava depois)
if os.path.exists(path):
    try:
        old = json.load(open(path))
        if 'verdade' in old: out['verdade'] = old['verdade']
    except Exception:
        pass
json.dump(out, open(path, 'w'), separators=(',', ':'))
print(f'gravado {path} ({os.path.getsize(path) / 1e6:.1f} MB)')
