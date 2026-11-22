# Banca de homologação de robôs com IA — contexto e plano

Experimento do movimento 3 de CIN0055 (CIn/UFPE, 2026.2). Este arquivo serve como `CLAUDE.md`:
coloque-o na raiz do repositório com esse nome e o Claude Code o carrega no começo de toda
sessão. Ele foi escrito para quem não acompanhou a conversa que o originou.

---

## 0. Como trabalhar neste repositório (instruções para o assistente)

- **Idioma:** interface, README, REGISTRO e comentários em português do Brasil. Nomes de
  variáveis e funções podem ser em inglês.
- **Sem dependências no site.** JavaScript puro, módulos ES, nada de framework, CDN ou build. O
  site tem que abrir no GitHub Pages servindo a pasta `docs/` como está.
- **Fonte única de código.** Física, planejador, especialista e cérebro ficam em `docs/core/` e
  são importados tanto pela página quanto pelos scripts de treino em Node. Nunca duplicar lógica
  entre os dois lados.
- **Treino:** Node gera dados com o mesmo código do site; Python + numpy ajusta os pesos. Não há
  PyTorch e não é necessário.
- **Seguir as fases da seção 7 em ordem.** Cada fase termina com um teste de aceitação. Não
  começar a fase seguinte com o teste da anterior falhando; se falhar, parar e relatar.
- **Medir em vez de supor.** Qualquer afirmação sobre o desempenho de um cérebro (inclusive
  "o defeito aparece") precisa vir de `node train/avaliar.mjs`, não de impressão visual.
- **Não mudar o desenho do experimento** (seção 3) sem perguntar ao Matheus. Mudanças de
  implementação são livres.
- **Comandos:**
  - servir o site: `cd docs && python -m http.server 8000` → `http://localhost:8000`
  - gerar dados: `node train/gerar_dados.mjs`
  - ajustar cérebros: `python train/ajustar.py`
  - medir a verdade: `node train/avaliar.mjs`
- **Prazo apertado** (seção 1). Ao escolher entre bonito e funcionando, escolher funcionando.

---

## 1. Situação

- **Disciplina:** CIN0055 Tendências em Mídia e Interação, prof. Giordano Cabral.
- **Aluno:** Matheus (login `mjbo`).
- **Etapa:** movimento 3, o projeto-experimento. Vale 4,0. Individual.
- **Prazo:** teste com a turma em ~03/11/2026 (confirmar). **O link precisa estar no ar com o
  `README.md` na véspera, até 23h59.** Atraso custa 0,3 por aula; sem link na véspera, o teste
  vai para a última vaga.
- **Máquina do aluno:** RTX 5060 8 GB, Windows 11 (há acesso a uma de 48 GB). Nada aqui precisa
  de GPU.

### Como é a aula de teste

- **5 a 6 pessoas**, presencial, no máximo ~1h. Cada um abre um link no próprio notebook.
- **5 min** de apresentação: o que é, que pergunta tenta responder. Sem slides de contexto.
- **25 min** da turma usando. **O aluno não conduz**: observa e anota. Se quebrar, deixa quebrar.
- **20 min** de conversa. O professor puxa as perguntas da seção 7 ("Contra o próprio mapa") do
  documento de tendência.

### As três exigências do enunciado

1. **Usa tecnologia emergente**, e o README explica por que não daria com tecnologia madura.
2. **Responde uma pergunta sobre o futuro**, escrita antes de construir.
3. **Acessível a quem não é da turma**: link que abre, com explicação de uso.

### Entregas e nota

| Entrega | Quando | Pontos |
|---|---|---|
| Experimento no ar + `README.md` | véspera do teste, 23h59 | 1,5 |
| Teste com a turma (aconteceu, conseguiram usar, o aluno observou em vez de conduzir) | dia do teste | 1,0 |
| `REGISTRO.md`: o que a turma fez que eu não esperava; o que mudei; o que decidi **não** mudar e por quê; e uma linha final: a pergunta ficou mais clara, mais confusa ou mudou? | entre o teste e a apresentação final | 1,0 |
| Apresentação final, 15 min | 17/11 ou 19/11 | 0,5 |

O README precisa ter: o que é (um parágrafo); a pergunta sobre o futuro; a tecnologia emergente
e por que não dá com tecnologia madura; como usar, passo a passo; **o que eu espero que
aconteça, escrito antes**. Não se avalia maturidade, acabamento visual nem viabilidade de negócio.

---

## 2. A lógica: pergunta do mapa → projeto → experimento

O experimento é **uma etapa do projeto**: testa, barato, uma dúvida que decide como o projeto
deve ser. O exemplo de um colega serve de espelho:

| | Exemplo do colega | Este projeto |
|---|---|---|
| **Pergunta do mapa** | Quem deve limitar o uso de redes sociais, e como, sem a pessoa se sentir prejudicada? | Dá para liberar um robô cuja IA ninguém consegue abrir para conferir? |
| **Projeto** | Um limitador de tempo para apps | **Uma ferramenta de homologação para robôs com IA aprendida** |
| **Experimento** | Feed simples com dois grupos (com limite de tempo × livre) e questionário no fim ("quantos posts você viu?", "quais lembra?"), mais opinião sobre os métodos | A turma é a banca: avalia cérebros de robô testando na mão e usando a ferramenta, decide aprovar ou reprovar, responde um questionário |
| **O que o experimento decide** | Como o limitador deve agir | O que a ferramenta precisa mostrar para a pessoa decidir certo |

### De onde vem a pergunta

Mapa de tendência: *Agentes corporificados, IA física e modelos de mundo*, horizonte 2035,
tecno-otimista, público científico e mercado automotivo, recorte global. Três disrupções-raiz:
(1) mundos gerados viram a fonte dominante de treino; (2) políticas aprendidas transferem entre
corpos; (3) a navegação embarcada vira um modelo único fim a fim.

Os efeitos que sustentam o projeto, no ramo da disrupção 3:

- **e4.1 (2ª ordem):** *"A verificabilidade vira o obstáculo central de homologação"* — forte,
  2030, **confiança alta**. É o único efeito do mapa em confiança alta, porque já é observável:
  a homologação automotiva se apoia em decomposição modular e atribuição de falha, e um modelo
  fim a fim não tem módulo para apontar.
- **e4.1.1 (3ª ordem):** *"Consolida-se uma engenharia de interpretabilidade aplicada a sistemas
  físicos, com ferramentas próprias e papel formal no processo de certificação"* — fraco, 2034,
  baixa. **O projeto é uma dessas "ferramentas próprias".**

E a objeção da seção 7 do mapa: a navegação fim a fim pode não se concretizar justamente porque
não há caminho claro para resolver a verificabilidade.

---

## 3. O experimento

### O papel e a regra da fábrica

Texto mostrado na entrada:

> Você é da banca de homologação de uma fábrica. Quatro cérebros de robô pedem liberação para
> operar no galpão. Um cérebro é uma rede neural: você não consegue abrir para conferir, só
> pode testar.
>
> **Regra da fábrica:** um cérebro só pode ser liberado se pilotar **todos os robôs da frota**,
> em **todas as missões**, sem bater e dentro do tempo.

A regra explícita é o que torna "acertar" objetivo: dá para pontuar cada decisão contra a
verdade medida.

### O desenho

- **4 cérebros.** Um cumpre a regra. Os outros três têm cada um um defeito escondido, que vem de
  uma lacuna no treino (seção 5.5).
- **Dois modos de avaliação:**
  - **Bancada manual:** a pessoa escolhe um robô da frota (e, se der tempo de implementar, monta
    um), escolhe uma missão, roda, assiste. Repete quanto quiser. Depois decide.
  - **Relatório automático (a ferramenta):** um botão roda uma amostra de **40 corridas
    sorteadas** do mesmo espaço que a bancada oferece, e mostra: taxa de sucesso, tabela por robô
    e por missão, e as **3 piores corridas com replay**. A pessoa decide com base nisso.
- **A ferramenta é realista, não um oráculo.** Ela sorteia, não varre tudo. Assim ela pode ou não
  topar com o defeito, e o que interessa é como a pessoa lê o resultado (ver H2). As duas
  ferramentas veem o mesmo espaço: nenhum modo tem informação escondida do outro.
- **Cada pessoa faz os dois modos:** 2 cérebros na bancada, 2 no relatório. Com 5 ou 6 pessoas,
  dividir em dois grupos deixaria dados demais pobres.
- **Distribuição balanceada.** Na entrada, a pessoa digita o **número de participante** que o
  Matheus escreve no quadro (1 a 6). O número define quais cérebros vão em cada modo e a ordem.
  Com as 6 combinações abaixo, cada cérebro é avaliado 3 vezes em cada modo:

  | Participante | Relatório | Bancada | Começa por |
  |---|---|---|---|
  | 1 | 1, 2 | 3, 4 | bancada |
  | 2 | 3, 4 | 1, 2 | relatório |
  | 3 | 1, 3 | 2, 4 | bancada |
  | 4 | 2, 4 | 1, 3 | relatório |
  | 5 | 1, 4 | 2, 3 | bancada |
  | 6 | 2, 3 | 1, 4 | relatório |

  Dentro de cada modo, a ordem dos dois cérebros também alterna.
- **Para cada cérebro**, a pessoa registra: **libero / não libero**, **confiança de 1 a 5** e
  **por quê** (texto curto). Registrar também, automaticamente: quantas corridas fez, quais robôs
  e missões testou, se viu replay, tempo gasto.
- **Questionário final:**
  1. Você liberaria algum destes cérebros para trabalhar ao lado de pessoas? Qual?
  2. Qual modo te deu mais segurança para decidir: bancada, relatório ou igual?
  3. O que te faria reprovar um robô na hora? (o número / ver a falha acontecendo / uma
     explicação do motivo / outro)
  4. Quem deveria assinar essa liberação? (empresa que fez o cérebro / fabricante do robô /
     órgão do governo / certificadora independente / a fábrica que vai usar)
  5. O que faltou para você decidir com segurança?

### A verdade (escondida da turma)

Antes da aula, cada cérebro é medido em todas as combinações robô × missão, várias vezes cada
(com pequena variação na posição de saída). Um cérebro **cumpre a regra** se nenhuma combinação
da frota ficar abaixo de 90% de sucesso. Isso define a resposta certa de cada decisão.

### O que se mede, e por que a resposta não é conhecida antes

| Pergunta | Como medir | Por que muda o projeto |
|---|---|---|
| **H1.** A ferramenta faz acertar mais? | Acerto das decisões contra a verdade, bancada × relatório | Se não ajuda, a ferramenta não se justifica |
| **H2.** Ou gera confiança demais? | Confiança média nas decisões **erradas**, por modo | "92% de sucesso" pode levar a aprovar justamente o que falha nos outros 8%. Se acontecer, o projeto esconde a porcentagem e mostra só as falhas |
| **H3.** O que faz alguém reprovar? | Respostas abertas, questão 3, se viu replay antes de reprovar | Se ninguém reprova sem ver a falha, o projeto é centrado em replay |
| **H4.** Quem deveria assinar? | Questão 4 | Define para quem a ferramenta é feita |

Qualquer resultado de H1 e H2 serve: nos dois casos a ferramenta final muda de desenho.

### A aula, minuto a minuto

- **0 a 5:** Matheus explica o papel e a regra da fábrica, escreve os números de participante no
  quadro, mostra o link.
- **5 a 30:** cada pessoa avalia os 4 cérebros na ordem que o site der, responde o questionário e
  envia. Matheus observa e anota.
- **30 a 50:** Matheus abre o painel: revela os defeitos, mostra acerto e confiança por modo,
  abre a conversa sobre quem deveria assinar.

---

## 4. O que deu errado na primeira versão (não repetir)

A versão anterior ("Um cérebro, muitos corpos": a pessoa montava um robô e uma rede o pilotava
numa arena) foi descartada por quatro motivos, que viraram requisitos desta:

1. **A turma era objeto de medição, não participante.** Tudo já tinha sido medido num script; a
   turma só acrescentava palpites, e nada do que fazia mudava o aparelho. → Aqui, as decisões da
   turma **são** o dado.
2. **O resultado ("uma rede pilota vários corpos") não era novidade para ninguém.**
3. **Os robôs se mexiam de forma quase aleatória.** O treino por estratégias evolutivas não
   aprende movimento suave, e o planejador por campo de forças fazia a direção pedida pular.
   Qualquer pessoa concluía "esse robô tem problema". **Para a homologação, isso é fatal:** se
   todo robô parece defeituoso, a banca reprova tudo e não há o que medir. O cérebro bom precisa
   parecer claramente bom; os ruins, bons quase sempre.
4. **A pista tinha espaço livre demais**, e o robô dava a volta por fora dos obstáculos. →
   Galpão com corredores, onde só existe uma rota sensata.

O que ela ensinou: o modelo de física das rodas (5.1) e o catálogo de peças (5.2) funcionam; e um
robô **puxado por uma única roda direcional, com o resto solto** (triciclo de tração dianteira) é
uma configuração comum, dirigível, e difícil para uma rede que nunca a viu.

---

## 5. Arquitetura técnica

### 5.1 Física (2D, corpo rígido)

Constantes: `VMAX = 1.0` m/s (velocidade máxima da superfície da roda), `DT = 0.05` s (passo de
controle), `SUB = 4` subpassos, `G = 9.81`, `MU = 0.9`, `MAX_STEER = 0.6` rad, `STEER_RATE = 3`
rad/s, tempo máximo por corrida 30 s (`MAX_STEPS = 600`).

Estado: `x, y, th, vx, vy, om` no mundo; por roda, velocidade atual `w[i]` e esterço `delta[i]`.

Por subpasso (`dts = DT/SUB`):

```
nC   = total de pontos de contato
mc   = massa / nC            # massa efetiva por contato
N    = massa * G / nC        # carga igual em todos os contatos
fmax = MU * N * dts          # impulso máximo de atrito por contato

para cada roda:
  se tem motor:  w += (cmd*VMAX - w) * min(1, dts/tau)
  se direcional: delta += clamp(steerCmd*MAX_STEER - delta, ±STEER_RATE*dts)

para cada contato p (posição no corpo) da roda:
  r   = rot(th) * p
  c   = (vx - om*r.y, vy + om*r.x)              # velocidade do ponto de contato
  e   = dir(th + ang + delta + phi)             # direção de tração
  n   = perp(e)                                 # direção lateral
  ve, vn = c·e, c·n
  se roda boba:  pe = -0.03*mc*ve ;  pn = -0.03*mc*vn
  senão:
    pe = motor ? 0.5*mc*(gain*w - ve) : -0.03*mc*ve
    pn = latFree ? -0.02*mc*vn : -0.8*mc*vn
  limita |(pe,pn)| ≤ fmax                       # círculo de atrito
  F = pe*e + pn*n ; P += F ; T += r × F

v += P / massa ; om += T / inércia ; integra posição e ângulo
```

Inércia: disco `0.5*m*R²`; retângulo `m*(L²+W²)/12`. **Colisão:** o robô é um círculo de raio
`colisao`; bate se encostar numa prateleira (retângulo), obstáculo (círculo ou retângulo) ou
parede. Distância círculo-retângulo: ponto mais próximo do retângulo ao centro do robô.

Conhecido: o atrito é "macio" e rodas conseguem se arrastar mais do que num robô real. Declarar
nas limitações do README.

### 5.2 Peças, bases e frota

| Peça | motor | escorrega de lado | vira | observação |
|---|---|---|---|---|
| Roda comum | sim | não | não | |
| Roda omni | sim | sim | não | |
| Roda direcional | sim | não | sim | esterço até ±0,6 rad |
| Roda boba | não | sim | — | só apoia; forças pequenas nas duas direções |
| Esteira | sim | não | não | 3 contatos ao longo de 0,36 m |
| Mecanum | sim | sim | não | tração girada ±45° (lado pelo sinal de x·y), ganho √½ |

Motor: `normal` (tau 0,10 s) e `lento` (tau 0,60 s).

| Base | Forma | Massa | Colisão | Encaixes (x, y em m; ângulo de rolamento) e o que aceitam |
|---|---|---|---|---|
| Retângulo | 0,50 × 0,36 | 4,5 | 0,31 | 4 cantos (±0,17, ±0,15), ang 0. Frente: comum, omni, direcional, mecanum, boba. Trás: comum, omni, mecanum, boba |
| Tanque | 0,50 × 0,42 | 5,0 | 0,32 | laterais (0, ±0,19): esteira ou comum; frente (0,21, 0) e trás (−0,21, 0): boba ou omni |
| Triciclo | 0,46 × 0,34 | 4,0 | 0,29 | frente (0,18, 0): direcional, comum, omni, boba; trás (−0,15, ±0,15): comum, omni, boba |
| Disco | raio 0,22 | 3,5 | 0,24 | rodas a 90°, 210°, 330°, raio 0,18, tangenciais: omni, comum, boba |

**A frota** (o que a regra da fábrica exige). Cada defeito precisa de pelo menos um robô que o
revele, e cada defeito precisa ser minoria do espaço:

| Robô da frota | Montagem | Classe (5.4) | Revela o defeito de |
|---|---|---|---|
| Carrinho diferencial | tanque: 2 comuns + 2 bobas | diferencial | — |
| Plataforma 4×4 | retângulo: 4 comuns | derrapante | — |
| Carro com direção | retângulo: 2 direcionais na frente + 2 comuns atrás | carro | — |
| Esteira de carga | tanque: 2 esteiras | derrapante | — |
| Empilhadeira | triciclo: direcional na frente + 2 bobas atrás | puxado | Cérebro 2 |
| Omni de 3 rodas | disco: 3 omni | holonômico | Cérebro 4 |
| Mecanum 4×4 | retângulo: 4 mecanum | holonômico | Cérebro 4 |

### 5.3 Galpão, planejador e seguidor (tecnologia madura, não é o que se testa)

- **Mapa:** galpão de ~8 × 6 m, fileiras de prateleiras (retângulos) formando **corredores de
  1,1 a 1,4 m**. Docas de saída e estações de destino marcadas no chão.
- **Missões** (6 a 8, com nome, ex.: "Doca 1 → Estação C"). Pelo menos **duas começam de costas
  para o destino** (exigem meia-volta) e uma passa por **corredor estreito**. As que começam de
  costas devem ser minoria.
- **Variação:** cada corrida sorteia um pequeno deslocamento na posição e no ângulo de saída
  (±5 cm, ±5°), para "rodar de novo" não dar sempre exatamente o mesmo.
- **Planejador:** A* numa grade de 5 cm com obstáculos inflados pelo raio do robô + 8 cm de
  folga; depois encurtar por linha de visada (*string pulling*). A rota é desenhada na tela.
- **Seguidor:** *pure pursuit*, ponto-alvo ~0,5 m à frente na rota. Velocidade desejada menor
  perto do destino e em curvas fechadas.

### 5.4 Piloto especialista (gera os exemplos para os cérebros imitarem)

Controlador cinemático que conhece o corpo. Recebe o ponto-alvo no referencial do robô (direção
`(tx, ty)`, erro de direção `alpha`) e a velocidade desejada, e escolhe o modo pela classe:

| Classe | Como identificar | Comando de corpo |
|---|---|---|
| **Holonômico** | nenhuma roda de eixo fixo (comum/esteira) e nenhuma direcional | `v = vel·(tx,ty)`; `om = k·alpha` (vira aos poucos para a direção do movimento) |
| **Diferencial / derrapante** | tem roda de eixo fixo, nenhuma direcional | `vx = vel·max(0, cos alpha)²`; `vy = 0`; `om = k·alpha` (gira no lugar quando muito desalinhado) |
| **Carro** | tem direcional **e** roda de eixo fixo | *pure pursuit*: `vx = vel`, curvatura `2·sen(alpha)/L`, `om = vx·curvatura`; ré curta se `alpha` passar de ~100° |
| **Puxado** | tem direcional e **nenhuma** roda de eixo fixo | a direcional aponta para o alvo e puxa; o resto segue como reboque |

Cinemática inversa: para cada roda com motor, `c = v + om × r`; comando `= (c·e)/gain/VMAX`. Roda
direcional: esterço = ângulo de `c` relativo à roda, dobrado para ±90° (trocando o sinal da
velocidade) e limitado a ±0,6 rad; velocidade `= |c|·sinal`. Se algum comando passar de 1 em
módulo, escalar todos juntos.

### 5.5 Os cérebros (a tecnologia emergente)

Uma única rede **condicionada ao corpo**: recebe a descrição de cada roda e o estado da missão, e
devolve o comando de cada roda. Os mesmos pesos pilotam 2, 3 ou 4 rodas. Linha de pesquisa de
controle entre corpos (*cross-embodiment*): *One Policy to Control Them All* (Huang et al., 2020),
*MetaMorph* (Gupta et al., 2022), Open X-Embodiment, π0, GR00T.

**Formato** (treina em segundos, sem PyTorch):

```
psi(roda)   = [1, características da roda, tanh(B·roda + c)]                          # ~37
phi(estado) = [1, características do estado, média dos psi do corpo, tanh(A·estado + b)]  # ~90
comando_i   = phi(estado)ᵀ · W · psi(roda_i)      # velocidade da roda i
esterco_i   = phi(estado)ᵀ · V · psi(roda_i)      # esterço da roda i (usado se direcional)
```

`A, b, B, c` são aleatórios e fixos (gerados com semente, salvos com o modelo). Só `W` e `V` são
aprendidos, por **mínimos quadrados com regularização** (ridge): cada exemplo vira o vetor
`phi ⊗ psi_i`; acumular `XᵀX` e `Xᵀy` em lotes (dimensão ~3.300, cabe na memória) e resolver.
É uma rede neural de camada aleatória: é honesto chamar de rede neural.

- **Características da roda:** posição (x, y)/0,3; cos e sen do ângulo; direção de tração
  (ex, ey); ganho; braço de torque `(x·ey − y·ex)/0,3`; escorrega de lado; tem motor; vira;
  comprimento de contato/0,3; esterço atual; velocidade atual.
- **Características do estado:** direção do ponto-alvo no referencial do robô; erro de direção
  (sen, cos); velocidade desejada; velocidade atual (frente, lado, giro).
- **Dados:** rodar o especialista em muitos corpos sorteados (a frota + variações aleatórias de
  rodas e posições) e missões. **Executar a ação com ruído e gravar a ação limpa** do especialista,
  para o cérebro aprender a se recuperar. Se der tempo, uma rodada de DAgger.
- **Suavidade:** se o movimento sair tremido, aplicar um filtro passa-baixa no comando
  (`cmd = 0.7·anterior + 0.3·novo`) igual para os 4 cérebros. Isso é parte normal de qualquer
  controlador embarcado.

**Os 4 cérebros** (na interface, só "Cérebro 1, 2, 3, 4"; os defeitos só aparecem no painel):

| Cérebro | Treino | Defeito esperado |
|---|---|---|
| **1** | todos os corpos e situações | nenhum relevante: deve cumprir a regra |
| **2** | nunca viu corpos **puxados** | falha na Empilhadeira, que parece um carro comum |
| **3** | só viu o alvo **à frente** (erro de direção < 90°) | falha nas missões que começam de costas |
| **4** | nunca viu corpos **holonômicos** | deriva de lado no Omni e no Mecanum |

**Os defeitos precisam ser medidos.** Ver o teste de aceitação da fase 3. Se um defeito não
aparecer, trocar a lacuna; se o cérebro 1 não cumprir a regra, mais dados ou DAgger.

### 5.6 O site

1. **Entrada:** apelido + número de participante (1 a 6) + o texto do papel e da regra da
   fábrica (3).
2. **Para cada cérebro** (indicador "cérebro 2 de 4", tempo sugerido ~5 min):
   - **Bancada manual:** escolher robô da frota e missão; rodar; ver a rota planejada, o rastro e
     o resultado (chegou / bateu / tempo esgotado). Repetir à vontade. Lista das corridas feitas
     com este cérebro.
   - **Relatório automático:** botão "rodar avaliação" → 40 corridas sorteadas, rodadas sem
     desenhar, com barra de progresso → taxa de sucesso, tabela por robô e por missão, 3 piores
     corridas com replay.
   - **Decisão:** libero / não libero, confiança 1 a 5, por quê. Só segue com tudo preenchido.
3. **Questionário** (3).
4. **Envio** para a planilha; tela de obrigado. Guardar também em `localStorage` e oferecer
   "baixar minhas respostas" como reserva.

Visual: parecer um galpão. Prateleiras com caixas, faixas no chão, docas, robô em escala.
Animação em tempo real com 1×/2×/4×. Notebook é obrigatório; celular, desejável.

### 5.7 Painel do apresentador (`painel.html`)

Lê as respostas e mostra, para os 20 minutos de conversa:

- a **verdade** de cada cérebro (defeito, robôs e missões em que falha, taxa medida);
- por cérebro: quantos liberaram na bancada e quantos no relatório;
- **acerto por modo** e **confiança média nas decisões erradas por modo** (H1, H2);
- se as pessoas que reprovaram tinham visto uma falha antes (H3);
- contagem de "quem deveria assinar" (H4) e as respostas abertas.

### 5.8 Coleta das respostas (Google Apps Script)

O site faz `POST` com `mode: 'no-cors'` e `Content-Type: text/plain`; o painel faz `GET`. Criar
uma Planilha Google → Extensões → Apps Script → colar → Implantar como App da Web (executar como
você; acesso: qualquer pessoa) → copiar a URL `/exec` para `docs/config.js`.

```js
function doPost(e) {
  const sh = sheet_();
  if (sh.getLastRow() === 0) sh.appendRow(['quando', 'json']);
  sh.appendRow([new Date(), e.postData.contents]);
  return ContentService.createTextOutput('ok');
}
function doGet() {
  const rows = sheet_().getDataRange().getValues().slice(1).map(r => JSON.parse(r[1]));
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('respostas') || ss.insertSheet('respostas');
}
```

### 5.9 Publicação

Repositório público, site em `/docs`; GitHub → Settings → Pages → *Deploy from a branch*, `main`,
`/docs`. Módulos ES não carregam por `file://`: testar sempre pelo servidor local.

---

## 6. Começar do zero ou reaproveitar

**Decisão: repositório novo, começando do zero.** Quase tudo da versão anterior muda: o mundo
(arena → galpão), o planejador (campo de forças → A*), o cérebro (estratégias evolutivas →
imitação), o fluxo do site (montar e palpitar → banca com dois modos). Adaptar custaria mais do
que reescrever e arrastaria decisões que deram errado.

Se o zip `um-cerebro-muitos-corpos.zip` estiver à mão, dá para **copiar como ponto de partida**:

| Arquivo antigo | O que fazer |
|---|---|
| `docs/core/physics.js` | **Reaproveitar** a física; trocar obstáculos e colisão para retângulos, `MAX_STEPS` para 600, remover lidar, cenários e percursos |
| `docs/core/parts.js` | **Reaproveitar** `PARTS`, `MOTORS`, `BASES`, `buildBody`, `makeWheel`; remover `randomTrainingBody` e `novidades`; acrescentar a frota (5.2) |
| `docs/core/draw.js` | **Reaproveitar** `drawWheel`, `drawBase`, `drawRobot`; reescrever o desenho da arena como galpão |
| `planner.js`, `policy.js`, `episode.js`, `train/*`, `app.js`, `index.html` | **Descartar** |

Sem o zip, a seção 5 tem tudo para reescrever.

---

## 7. Plano de implementação

Estimativa total: **12 a 15 horas de trabalho**, cabendo no prazo com folga pequena. As fases
estão na ordem em que dependem umas das outras. Cada uma termina com um teste de aceitação.

### Fase 0 — Preparar (30 min)

- Criar o repositório `banca-homologacao-robos` com a estrutura da seção 8; este arquivo como
  `CLAUDE.md`.
- Copiar os arquivos reaproveitáveis (seção 6), se houver.
- Criar a Planilha Google e implantar o Apps Script (5.8); colar a URL em `docs/config.js`.
- **Aceite:** `python -m http.server` serve uma página em branco sem erro no console; um `POST` de
  teste aparece na planilha.

### Fase 1 — Galpão, física e rota (2 a 3 h)

- `physics.js` com colisão em retângulos; `warehouse.js` com o mapa e as missões;
  `planner.js` com A*, encurtamento e *pure pursuit*.
- `docs/sandbox.html`: página de depuração que desenha o galpão, a rota de cada missão e um
  **robô ideal** (segue o ponto-alvo sem física).
- **Aceite:** o robô ideal chega em **100% das missões**; as rotas passam pelos corredores, não
  "por fora"; nenhuma rota encosta em prateleira.

### Fase 2 — Especialista e frota (2 h)

- `parts.js` com a frota; `expert.js` com as quatro classes e a cinemática inversa.
- `train/avaliar.mjs` aceitando `--piloto especialista`: roda cada robô da frota em cada missão,
  5 vezes, e imprime chegou / bateu / tempo e uma **medida de suavidade** (variação média do
  comando entre passos).
- No sandbox, poder escolher robô e piloto e assistir.
- **Aceite:** o especialista chega em **≥ 95% de cada combinação robô × missão** da frota, e o
  movimento parece intencional a olho (sem zigue-zague, sem girar à toa).

### Fase 3 — Os 4 cérebros (2 a 3 h)

- `brain.js` (features + forward); `train/gerar_dados.mjs` (especialista + ruído, grava
  `Float32`); `train/ajustar.py` (ridge → `docs/model/brains.json`).
- Gerar um conjunto completo e filtrar as lacunas para os cérebros 2, 3 e 4.
- `avaliar.mjs --piloto cerebro1..4` gera a **tabela de verdade** e a grava no modelo.
- **Aceite:**
  1. Cérebro 1 cumpre a regra (nenhuma combinação da frota abaixo de 90%) e tem suavidade
     comparável à do especialista.
  2. Cérebros 2, 3 e 4 ficam **≥ 90% fora da sua lacuna** e **≤ 50% dentro dela**.
  3. Rodando o "Carrinho diferencial" na primeira missão, os 4 cérebros parecem igualmente
     competentes. Se algum defeito for óbvio de cara, o experimento perde a graça.

### Fase 4 — Site da banca (3 a 4 h)

- `index.html` + `app.js` + `draw.js`: entrada, distribuição pelo número de participante,
  bancada manual, relatório automático com replay, decisão, questionário, envio.
- **Aceite:** abrir o site como participante 1 e como participante 2 em duas abas, completar os
  dois do começo ao fim em menos de 25 minutos cada, e ver as duas respostas na planilha com
  todos os campos.

### Fase 5 — Painel, README e publicação (1 a 2 h)

- `painel.html`: lê o `GET` do Apps Script e mostra o que pede a seção 5.7.
- `README.md` a partir do rascunho da seção 9, com as minhas palavras.
- Publicar no GitHub Pages e repetir o teste da fase 4 **pelo link público**, de outro
  computador ou do celular.
- **Aceite:** o link abre fora da minha máquina; o painel mostra as respostas de teste. Apagar as
  respostas de teste da planilha antes da aula.

### Se o tempo acabar, cortar nesta ordem

1. Painel → usar a própria planilha na conversa.
2. Montador livre de robôs → só a frota.
3. Variação de motor lento, caixa caída, polimento visual.
4. DAgger → só a injeção de ruído.

**Não cortar:** o relatório automático (sem ele não há comparação) e a medição dos defeitos.

### Riscos e o que fazer

| Risco | Sinal | Saída |
|---|---|---|
| O cérebro 1 não fica suave | treme ou zigue-zagueia | filtro passa-baixa no comando; mais dados com ruído; DAgger |
| Um defeito não aparece | o cérebro passa mesmo dentro da lacuna | lacuna mais radical (ex.: tirar também as direcionais do treino do cérebro 2) |
| Um defeito é óbvio demais | falha no primeiro robô que todo mundo testa | lacuna mais estreita, ou missão que revela o defeito menos comum |
| Robô do especialista falha numa combinação | < 95% | ajustar folga do A* ou a velocidade em curva; se o corpo for fisicamente ruim, tirar da frota |
| Apps Script não recebe | planilha vazia | conferir "qualquer pessoa" na implantação; usar o "baixar minhas respostas" como reserva |

---

## 8. Estrutura de arquivos

```
CLAUDE.md               este arquivo
README.md
REGISTRO.md             depois do teste
docs/
  index.html            o experimento (banca)
  painel.html           painel do apresentador
  sandbox.html          depuração (galpão, rotas, pilotos)
  app.js, painel.js
  config.js             URL do Apps Script
  core/
    parts.js            peças, bases, frota, montagem do corpo
    physics.js          física (5.1), colisão com retângulos e círculos
    warehouse.js        mapa do galpão e missões
    planner.js          A*, encurtamento, pure pursuit
    expert.js           piloto especialista (5.4)
    brain.js            features + forward do cérebro (5.5)
    draw.js             galpão, robôs, rota, rastro
  model/
    brains.json         4 cérebros + features aleatórias + tabela de verdade
train/
  gerar_dados.mjs
  ajustar.py
  avaliar.mjs
extras/
  coletar-respostas.gs
```

---

## 9. Rascunho do README (reescrever com as minhas palavras)

**O que é.** Uma banca de homologação simulada. A pessoa avalia quatro "cérebros" de robô (redes
neurais que pilotam qualquer robô da frota num galpão) e decide quais liberaria. Em metade dos
cérebros ela testa sozinha; na outra metade, usa um relatório automático. No fim, eu revelo quais
cérebros tinham defeito.

**Pergunta sobre o futuro.** Quando robôs forem pilotados por redes neurais que ninguém consegue
abrir, uma ferramenta de testes automáticos ajuda as pessoas a decidir se liberam o robô, ou só
dá a elas uma confiança que não deveriam ter?

**Tecnologia emergente, e por que não dá com tecnologia madura.** O que se homologa é uma
política de controle aprendida, condicionada ao corpo. Na pilha madura (controle modular escrito
à mão para cada robô), a homologação é feita módulo por módulo, e cada falha tem um responsável.
O problema que este experimento estuda, decidir sobre um sistema que não se decompõe, não existe
na pilha madura. O planejador de rota é maduro e não está sendo testado.

**O que eu espero que aconteça (escrito antes).**
- Na bancada, as pessoas vão testar os robôs e missões mais óbvios e vão liberar cérebros com
  defeito escondido.
- O relatório vai melhorar o acerto, mas vai aumentar a confiança também nas decisões erradas.
- Ninguém vai reprovar sem ver uma falha acontecendo: número sozinho não convence.
- Sobre quem deve assinar, a turma não vai concordar, e a maioria vai rejeitar que seja a
  própria empresa que fez o cérebro.

**Limitações.** Física 2D simplificada, com carga igual em todas as rodas e atrito "macio"; o
planejador conhece o mapa exato; os defeitos vêm de lacunas de treino escolhidas por mim, que é
como esse tipo de defeito aparece em sistemas reais, mas aqui em escala muito menor.
