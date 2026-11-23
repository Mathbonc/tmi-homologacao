# Licenciador de cérebros de robô — projeto final de CIN0055

> **Status:** Etapas 0 a 8 concluídas; próxima: etapa 9 · **95% concluído** · última atualização: 22/11/2026
> *(O assistente atualiza esta linha e a tabela da seção 6 ao fim de cada etapa aceita.)*

Projeto final de CIN0055 Tendências em Mídia e Interação (CIn/UFPE, 2026.2), aluno Matheus
(`mjbo`). Este arquivo substitui o `CLAUDE.md` do experimento. O código do experimento continua
no repositório e é a base deste projeto.

---

## 0. Como trabalhar neste repositório (instruções para o assistente)

- **Idioma:** interface, README, REGISTRO e comentários em português do Brasil. Nomes no código
  podem ser em inglês.
- **Sem dependências no site.** JavaScript puro, módulos ES, nada de framework, CDN ou build. O
  site tem que abrir no GitHub Pages servindo `docs/` como está.
- **Fonte única de código.** Tudo que simula fica em `docs/core/` e é importado pela página e
  pelos scripts em Node. Nunca duplicar lógica.
- **Não quebrar o experimento.** `docs/index.html` (a banca) e `docs/model/brains.json` são o
  registro do que a turma usou em 02 e 03/11. Os 4 cérebros ficam **congelados**: não retreinar,
  não sobrescrever `brains.json`. Mudanças em `docs/core/` têm que ser **aditivas** (medir mais
  coisas, aceitar opções novas), sem mudar o resultado de uma corrida sem opções. Conferência
  obrigatória depois de mexer no core:
  `node train/avaliar.mjs --piloto cerebros --reps 20` tem que repetir a tabela de verdade que
  está em `brains.json` (cérebro 1 em 100% em tudo; 2 em 0% na empilhadeira; 3 em 0% em carro e
  empilhadeira nas missões m6 e m7; 4 em 0% no omni3 e no mecanum).
- **Física intocada.** Não mexer em atrito, massa ou força de motor (seção 3.3 explica por quê).
- **Seguir as etapas da seção 6 em ordem.** Cada etapa termina com um teste de aceitação. Não
  começar a próxima com o teste da anterior falhando: parar e relatar. **Ao aceitar uma etapa,
  marcar a caixa na tabela da seção 6 e atualizar a linha de status do topo.**
- **Cada etapa termina demonstrável.** Ao fim de qualquer etapa a partir da 2, o site publicado
  tem que abrir e mostrar algo que funciona. Nada de etapa que deixa a página quebrada.
- **Medir em vez de supor.** Qualquer afirmação sobre um cérebro vem de script, não de olhar.
- **Não mudar o desenho do projeto** (seções 2 e 4) sem perguntar ao Matheus. Implementação é
  livre.
- **Prazo de ~2 dias.** Entre bonito e funcionando, funcionando. Se uma etapa estourar o tempo
  estimado em mais de 50%, avisar e propor corte (seção 6.2).
- **Comandos:**
  - site: `cd docs && python -m http.server 8000` → `http://localhost:8000`
  - verdade do experimento: `node train/avaliar.mjs --piloto cerebros --reps 20`
  - licenças pré-calculadas: `node train/licenciar.mjs` (criado na etapa 1)
  - treino: `node train/gerar_dados.mjs` → `python train/ajustar.py`

---

## 1. De onde veio este projeto

### 1.1 A cadeia: mapa → experimento → projeto

- **Mapa de tendência** (*Agentes corporificados, IA física e modelos de mundo*, horizonte
  2035). Efeito **e4.1**, o único do mapa em confiança alta: *"a verificabilidade vira o
  obstáculo central de homologação"*. Efeito **e4.1.1**: *"consolida-se uma engenharia de
  interpretabilidade aplicada a sistemas físicos, com ferramentas próprias e papel formal no
  processo de certificação"*. **Este projeto é uma dessas ferramentas.**
- **Experimento** (testado com a turma em 02 e 03/11): uma banca de homologação simulada. Cada
  pessoa avaliou 4 cérebros (redes neurais que pilotam qualquer robô da frota num galpão), 2
  testando na mão e 2 com um relatório automático de 40 corridas sorteadas, e decidiu liberar ou
  não. Regra da fábrica: só libera se pilotar todos os robôs, em todas as missões.
- **Projeto:** a ferramenta de homologação que o experimento mostrou ser necessária.

### 1.2 O que o experimento mostrou

6 pessoas, 24 decisões, comparadas com a verdade medida:

| | Resultado |
|---|---|
| Acerto na bancada (testar na mão) | 9 de 12 |
| Acerto com o relatório automático | 8 de 12 (empate, com 6 pessoas) |
| Erros | 7, **todos** liberando cérebro com defeito; ninguém reprovou o cérebro bom |
| Erros cometidos **depois de ver a falha** | **6 de 7** |
| Cérebro 3 (relatório mostrava 90 a 95% de sucesso) | liberado por 4 de 6 |
| Cérebro 4 (relatório mostrava 70 a 75%) | liberado por 1 de 6 |

As justificativas dos erros explicam o padrão: *"acho que é seguro exceto empilhadeira"*,
*"definitivamente devem ser excluídos o Omni de 3 rodas e o Mecanum 4×4"*, *"problema estaria se
tivesse que se mover de costas, mas isso poderia ser resolvido"*. **O problema não era achar a
falha; a ferramenta achava. As pessoas queriam liberar com restrições, e o site só aceitava sim
ou não.**

Pedidos e críticas registrados nas respostas abertas, que viram requisitos (seção 4):

- **Gravidade importa:** *"os erros do omni foram compreensíveis, o do mecanum é de outro
  nível"*; *"o quão desastroso e a frequência com que o problema acontece"*.
- **Ver qualquer caso**, não só os 3 piores; *"rodar tudo automático mas permitir auditoria
  humana"*; *"vários rastros visíveis de uma vez"*.
- **O virtual não basta:** *"se passar em todos no mundo virtual, aí faz uma nova bateria de
  testes físicos"*.
- **Assinatura em camadas:** *"um nível básico, de agência certificadora independente, outorgado
  pelo governo; a empresa deve ter seu próprio nível de exigência; e a fábrica vai ver no seu
  caso específico"*.
- **Variar o robô mantendo a missão** foi mais útil do que o contrário.
- Sugestão da turma: **adicionar imprevisibilidades**.
- Quem deveria assinar (questão 4): fábrica que vai usar 3, governo 1, certificadora 1, empresa
  do cérebro 1.

Com 6 pessoas, falar em "o que apareceu", não em "o que ficou provado".

### 1.3 A utilidade real da ferramenta

Teste físico de robô é caro, lento e perigoso; simulação é barata. A ferramenta não decide
aprovado ou reprovado. Ela entrega:

1. **Uma licença com limites:** "este cérebro está liberado para estes robôs, nestas missões,
   até estes níveis de perturbação". É o que a turma tentou fazer de cabeça. Em carro autônomo,
   o conceito equivalente é o **ODD** (domínio de projeto operacional): o conjunto de condições
   em que o sistema foi validado para operar.
2. **A lista de testes físicos:** os casos na fronteira, para gastar teste real só onde importa.
3. **O que falta treinar:** cada bloqueio diz qual situação o cérebro não domina.

---

## 2. O que o projeto é

Uma página, `docs/licenca.html`, onde se escolhe um cérebro e se obtém a licença de operação
dele, com a evidência por trás de cada linha. Seis capacidades:

1. **Matriz de cobertura:** robô × missão, em grade colorida. Cada célula abre o replay de
   qualquer corrida, ou todos os rastros da célula sobrepostos.
2. **Piloto de referência:** cada célula é comparada com o especialista (o controlador
   cinemático que gerou os dados de treino). Isso separa **defeito do cérebro** de **limite do
   corpo ou da condição** (seção 3.2).
3. **Imprevisibilidades com varredura:** saída em qualquer direção, empurrão, ruído de sensor,
   atraso de comando, obstáculo surgindo. Para cada eixo, a ferramenta acha até onde o cérebro
   aguenta.
4. **Gravidade:** colisão forte, raspão, travou, quase-acidente. Risco = frequência × gravidade.
5. **Licença em camadas:** certificadora (mínimo obrigatório), fabricante do cérebro (escopo
   declarado) e fábrica usuária (frota e tolerância dela). A licença é a interseção, com as três
   assinaturas, e sai impressa ou em PDF.
6. **Ciclo de melhoria e comparação de versões:** a licença aponta o que falta treinar; o
   cérebro é retreinado; a ferramenta compara a licença da versão nova com a antiga.

Mais um montador de robôs fora da frota, com cálculo ao vivo (etapa 8).

### Tecnologia emergente, e por que não dá com tecnologia madura

O que se licencia é uma **política de controle aprendida e condicionada ao corpo** (a mesma rede
pilota qualquer robô a partir da descrição das rodas; linha *cross-embodiment*: *One Policy to
Control Them All*, *MetaMorph*, Open X-Embodiment, π0, GR00T). Na pilha madura, com controle
escrito à mão para cada robô, a homologação é feita módulo por módulo, e cada falha tem um
responsável. Com uma rede que não se decompõe, só resta mapear empiricamente onde ela é
confiável: é isso que a ferramenta faz. O planejador A* e o especialista são maduros e servem de
instrumento, não de objeto.

---

## 3. Decisões técnicas já tomadas (e testadas)

### 3.1 Os cérebros

- **Os 4 cérebros do experimento ficam congelados** e viram o **gabarito** da ferramenta: cada
  um tem uma lacuna de treino conhecida, e o licenciador tem que reencontrá-la. Se não
  reencontrar, o erro é da ferramenta. Isso é demonstração de que ela funciona.

  | Cérebro | Lacuna plantada no treino | O que a licença tem que bloquear |
  |---|---|---|
  | 1 | nenhuma | nada na frota nominal |
  | 2 | nunca viu robôs puxados por roda direcional | Empilhadeira, todas as missões |
  | 3 | nunca viu o alvo a mais de 60° (sem meia-volta) | Carro e Empilhadeira em m6 e m7 |
  | 4 | nunca viu robôs holonômicos | Omni de 3 rodas e Mecanum 4×4 |

- **Um cérebro novo: `cerebro3v2`**, para demonstrar o ciclo (etapa 7). É o cérebro 3
  retreinado **com os dados que a licença disse que faltavam** (alvo atrás, sem o corte de 60°)
  e com **atraso de comando** nos dados. Vai num arquivo separado,
  `docs/model/cerebro3v2.json`, para não tocar em `brains.json`.
- **O especialista é o piloto de referência.** No mundo real não há especialista perfeito; na
  apresentação ele é "o controlador de referência" (um controlador clássico, ou a versão
  certificada anterior), que é como se faz teste de regressão.

### 3.2 Classificação de cada célula

Para cada célula (robô × missão × condição), com `b` = taxa de sucesso do cérebro e `e` = taxa
do especialista, nas mesmas sementes:

| Classe | Regra | Cor | Na licença |
|---|---|---|---|
| **Liberado** | `b ≥ tol` e nenhuma colisão grave | verde | dentro |
| **Testar fisicamente** | liberado, mas com falha leve, quase-acidente, ou é o último nível de varredura antes do limite | amarelo | dentro, na lista de testes físicos |
| **Defeito do cérebro** | `b < tol` e `e ≥ tol` | vermelho | bloqueado, e vai para "o que falta treinar" |
| **Limite físico** | `e < tol` | cinza | fora do envelope; não conta contra o cérebro |

`tol` vem da camada mais exigente (seção 4.5); padrão 0,9.

### 3.3 Imprevisibilidades: o que funciona e o que não funciona neste simulador

Testado em 22/11 numa cópia do repositório (2 repetições por combinação, números indicativos):

- **Física (piso, carga, motor) não serve.** Com atrito de 0,9 a 0,25, carga 2,5× ou motor
  lento, especialista e cérebro 1 chegam em 100%. A **carga não tem efeito nenhum, nem 10×**: na
  física atual a massa se cancela (todos os impulsos são proporcionais a ela). Só quebra em
  valores absurdos (atrito 0,03, motor com 2 s de atraso), e aí o especialista quebra igual.
  Limitar a força do motor para a carga importar **quebrou a frota em condições normais**
  (plataforma e esteira derrapam para virar e precisam de muita força). **Não tentar de novo.**
- **Perturbações de percepção e de situação funcionam**, porque testam o que o cérebro viu no
  treino:

  | Perturbação | Especialista | Cérebro 1 | Cérebro 3 |
  |---|---|---|---|
  | nominal | 100% | 100% | 92% |
  | saída virada em qualquer direção | 98% | 98% | 85% (carro 43%) |
  | atraso de 0,25 s nos comandos | 98% | 94% (diferencial 57%) | 84% |
  | empurrão lateral no meio do caminho | 100% | 100% | 92% |
  | ruído de ±25° na direção do alvo | 100% | 100% | 92% |

  O cérebro 1, que parece perfeito no nominal, tem um ponto fraco próprio: **atraso**. A saída
  em qualquer direção expõe o cérebro 3 muito mais do que as missões fixas.
- **Robôs fora da frota:** o retângulo com 1 direcional + 3 bobas e o disco com 2 omni + 1 boba
  ficam em 0% **também com o especialista**: são limite físico, e a ferramenta tem que
  classificá-los em cinza, não em vermelho.

### 3.4 Como implementar cada perturbação (sem tocar na física)

Tudo na camada de corrida (`episode.js`), como opções de `Run`, sorteadas com um gerador
derivado da semente da corrida (`mulberry32(seed * 7 + 3)`), para o replay repetir igual:

| Perturbação | Parâmetro | Implementação | Níveis da varredura |
|---|---|---|---|
| Saída em qualquer direção | `giro` (graus) | soma `U(−giro, +giro)` ao ângulo de saída da missão antes do `jitterStart` | 0, 45, 90, 135, 180 |
| Empurrão | `empurrao` (m/s) | no passo 60 (3 s), soma essa velocidade na lateral do robô e 1,5·(empurrao/0,6) rad/s de giro | 0, 0,3, 0,6, 0,9, 1,2 |
| Ruído de sensor | `ruido` (graus) | a cada passo, gira a direção do ponto-alvo (`tx, ty, alpha`) por `U(−ruido, +ruido)` antes de entregar ao piloto | 0, 10, 20, 30, 45 |
| Atraso de comando | `atraso` (s) | fila de `atraso/DT` comandos; a ação executada é a de N passos antes; comandos zero no começo | 0, 0,1, 0,2, 0,3, 0,5 |
| Obstáculo surgindo | `obstaculo` (sim/não) | no passo 80, um círculo de 0,25 m na rota ~1,2 m à frente; troca `world.map` por uma cópia do galpão com o obstáculo, replaneja do ponto atual e troca o `Follower`. Sem rota possível = `bloqueado` (limite) | só sim/não |

O especialista recebe as mesmas perturbações: é isso que torna a comparação justa.

*Obstáculo, como ficou (etapa 4, 22/11): raio de 0,25 m; se o ponto 1,2 m à frente na rota estiver
a menos de 0,5 m da borda do robô em linha reta (curva fechada), ele anda pela rota até ficar longe; se o
robô já está perto do destino no passo 80, o obstáculo não surge. Medido com o especialista em 420
corridas: sempre houve rota (às vezes por outro corredor) e em 22 o obstáculo não surgiu. "Sem
rota" conta como `travou`. O piloto não vê o mapa: percebe o obstáculo só pela rota nova.*

### 3.5 Gravidade

Medição aditiva em `World` (não muda o resultado da corrida):

- `impact`: velocidade do robô no passo em que bateu (`hypot(vx, vy)`).
- `minClear`: menor folga (`clearance − colR`) ao longo da corrida.

| Gravidade | Regra |
|---|---|
| **Grave** | bateu com `impact ≥ 0,3 m/s` |
| **Raspão** | bateu com `impact < 0,3 m/s` |
| **Travou** | tempo esgotado (não chegou, não bateu) |
| **Quase-acidente** | chegou, mas com `minClear < 0,03 m` |

Pesos para o risco: grave 10, raspão 3, travou 2, quase-acidente 1. Risco da célula = média dos
pesos sobre as corridas.

### 3.6 Pré-cálculo, para a demonstração não esperar

A matriz completa é grande: 6 pilotos (especialista, cérebros 1 a 4, 3v2) × (nominal + 4 eixos ×
4 níveis + obstáculo = 18 condições) × 49 células × 6 repetições ≈ 32 mil corridas. Em Node isso
leva uns 10 a 20 minutos; no navegador, ao vivo, seria inviável.

- `train/licenciar.mjs` roda tudo e grava **`docs/model/licencas.json`** com, por piloto e
  condição e célula: `n`, `ok`, contagem por gravidade, `minClear` mínimo, `risco`, e a semente
  de cada corrida que falhou (para o replay).
- A página lê esse arquivo e abre em segundos. O replay roda ao vivo a partir da semente e das
  opções: mesma semente, mesma corrida.
- **Determinismo:** `Math.tanh`/`cos` podem diferir minimamente entre navegadores. Se o replay
  de uma corrida pré-calculada terminar diferente, mostrar o resultado do replay com um aviso
  discreto ("este navegador reproduziu com outro resultado"). Não esconder.
- Corridas ao vivo (montador, etapa 8) rodam num **Web Worker** para não travar a aba.

---

## 4. Especificação da página `docs/licenca.html`

Página nova. `docs/index.html` (o experimento) continua igual, só ganha no topo um link "Projeto
final: licenciador →". `licenca.html` ganha um link de volta "O experimento que originou isto".

### 4.1 Layout

- **Topo:** seletor de cérebro (1, 2, 3, 4, 3v2), seletor de condição (nominal / cada eixo com
  seu nível / obstáculo) e o resumo em uma linha ("Liberado para 6 de 7 robôs em todas as
  missões; bloqueado: Empilhadeira").
- **Centro:** a grade robô × missão. Linhas = robôs, colunas = missões. Cor pela classe (3.2);
  ícone pela pior gravidade; tooltip com `b`, `e`, risco. **Robôs nas linhas** porque a turma
  achou mais útil comparar robôs na mesma missão.
- **Lateral:** painel da célula clicada: tabela das corridas (semente, resultado, gravidade,
  tempo), botão de replay de qualquer uma, botão "todos os rastros", e a mesma célula com o
  especialista lado a lado.
- **Abaixo:** o cartão da licença (4.4) e as camadas (4.5).
- Legenda sempre visível. Funciona em notebook e projetor (1366×768 no mínimo); celular é
  desejável.

### 4.2 Replay e rastros

- Replay: canvas do galpão com o robô andando em tempo real (1×/2×/4×), rota planejada, rastro,
  e a perturbação visível (seta no empurrão, obstáculo aparecendo, ponto-alvo tremendo no ruído,
  rótulo "atraso 0,2 s").
- Rastros nas 7 missões: o robô da célula clicada em todas as missões, uma corrida por missão,
  desenhadas juntas com cor por resultado; numa missão cujas corridas terminam diferente
  (chegou / bateu / travou), aparecem todas as corridas dela. É a "auditoria humana" pedida pela
  turma. *(Decidido pelo Matheus em 22/11: as corridas de uma mesma célula são quase idênticas e
  não mostravam nada; ver o robô em todas as rotas mostra mais.)*

### 4.3 Varredura

Para cada eixo de imprevisibilidade, um gráfico simples (barras ou linha) com o nível no eixo x e
a fração de células liberadas no y, cérebro e especialista juntos. O **limite** é o maior nível
em que o cérebro mantém todas as células onde o especialista se mantém. Vira uma linha da
licença: "liberado até atraso de 0,1 s".

### 4.4 O cartão da licença

Gerado, nunca escrito à mão:

- **Liberado para:** robôs × missões (agrupado quando possível: "todos os robôs, todas as
  missões, exceto...").
- **Limites de operação:** um por eixo (saída até X°, ruído até Y°, atraso até Z s, empurrão até
  W m/s, obstáculo surgindo: sim ou não).
- **Bloqueado (defeito do cérebro):** cada célula vermelha, com a gravidade.
- **Fora do envelope (limite físico):** cada célula cinza, explicando que nenhum piloto conseguiu.
- **Testes físicos obrigatórios:** as células amarelas, ordenadas por risco.
- **O que falta treinar:** cada bloqueio traduzido em situação ("robôs puxados por roda
  direcional", "meia-volta com carro e empilhadeira", "atraso acima de 0,1 s").
- **Assinaturas** (4.5), data, versão do cérebro e versão da ferramenta.
- Botão **Imprimir / salvar PDF** (`window.print()` com CSS de impressão que mostra só o cartão).

### 4.5 As camadas

Três painéis lado a lado, cada um com o que aquela parte decide e um botão "assinar" (nome +
data, guardado no `localStorage`; exportável em JSON):

| Camada | Decide | Padrão |
|---|---|---|
| **Certificadora** (outorgada pelo governo) | o mínimo: tolerância, gravidade proibida, níveis mínimos que todo cérebro tem que aguentar | `tol` 0,9; nenhuma colisão grave; ruído ≥ 10° e atraso ≥ 0,1 s |
| **Fabricante do cérebro** | o escopo declarado: quais tipos de robô o cérebro se propõe a pilotar | todos |
| **Fábrica usuária** | a frota e as missões que ela usa de verdade, e se quer ser mais exigente | toda a frota, todas as missões |

**A licença é a interseção.** Isso permite os dois casos que a turma levantou:

- **Limitação declarada não é defeito.** Se o fabricante do cérebro 4 declara "não pilota
  holonômicos", omni e mecanum saem do escopo, e o resto pode ser licenciado. A mesma falha,
  escondida, é reprovação; declarada, é escopo.
- **A fábrica sem empilhadeira** pode licenciar o cérebro 2 para a frota dela.

O cartão mostra de onde veio cada restrição (certificadora, fabricante ou fábrica).

*Como ficou (etapa 6, 22/11), três decisões de implementação:*
- *Com 6 corridas por célula, tolerância 0,9 e 1,0 são iguais (5/6 = 83%): as duas exigem 6/6. O
  seletor mostra isso ("nenhuma falha em 6"). Para haver exigência maior de verdade, a gravidade
  proibida tem um degrau a mais: grave < qualquer colisão < qualquer colisão ou quase-acidente.*
- *A fábrica é "mais exigente" pela gravidade proibida (nunca menos que a da certificadora), não
  pela tolerância, pelo motivo acima.*
- *Os níveis mínimos valem por célula: uma célula que tem defeito em algum nível até o mínimo sai
  da licença como bloqueio da certificadora (onde a referência também falha, é limite físico e
  fica). A licença encolhe em vez de só reprovar o cérebro inteiro, coerente com "liberar com
  restrição". Com os mínimos padrão (ruído 10°, atraso 0,1 s) nenhum cérebro perde célula.*

### 4.6 Comparação de versões

Seletor "comparar com": mostra a grade como diferença entre duas versões (verde = passou a
liberar, vermelho = regrediu, cinza = igual) e as duas licenças lado a lado.

---

## 5. Roteiro da demonstração (o professor exige que seja demonstrável)

**Definição de demonstrável:** o link abre em qualquer notebook sem instalar nada; a primeira
licença aparece em menos de 5 segundos; o roteiro abaixo roda inteiro em até 6 minutos; existe
um vídeo de reserva caso a internet da sala falhe.

A apresentação final tem 15 minutos: o experimento como ficou, o registro do que mudou, a
resposta à pergunta, e o que faria com mais um semestre. A demonstração ocupa uns 6.

1. **Gancho (30 s):** "6 dos 7 erros da banca foram liberar um cérebro com defeito depois de ver
   o defeito. As pessoas queriam liberar com restrição. Esta ferramenta faz isso."
2. **Cérebro 1, nominal (30 s):** tudo verde. "Este passa."
3. **Cérebro 2 (1 min):** a linha da Empilhadeira em vermelho. Clica: o especialista consegue,
   o cérebro não. Replay. "Defeito do cérebro, não do robô."
4. **Limite físico (30 s):** no montador, retângulo com 1 direcional + 3 bobas: cinza. "Ninguém
   pilota isto; não é culpa do cérebro." *(Se a etapa 8 não ficar pronta, mostrar o caso pelo
   pré-cálculo.)*
5. **Varredura (1 min):** cérebro 1, eixo de atraso. "O cérebro que passava em tudo aguenta até
   0,1 s de atraso; a licença diz isso."
6. **Camadas (1 min):** fábrica desmarca a Empilhadeira → o cérebro 2 é licenciado para ela.
   Fabricante do cérebro 4 declara "não holonômicos" → licenciável.
7. **Ciclo (1 min):** cérebro 3 → "o que falta treinar: meia-volta" → compara com o 3v2.
8. **Imprime a licença (30 s).**

---

## 6. Etapas de implementação

### 6.1 Progresso

O peso é a parte do projeto que a etapa representa. Ao aceitar uma etapa, marcar e somar.

| | Etapa | Peso | Tempo | Ao terminar, dá para demonstrar... |
|---|---|---|---|---|
| ☑ | 0. Preparar | 2% | 30 min | — |
| ☑ | 1. Medição: gravidade, perturbações, pré-cálculo | 15% | 3 h | tabelas no terminal |
| ☑ | 2. Página da licença: grade, replay, cartão | 20% | 3 a 4 h | **já é apresentável (ponto de segurança)** |
| ☑ | 3. Publicar e ensaiar o mínimo | 5% | 45 min | link público + vídeo de reserva v1 |
| ☑ | 4. Imprevisibilidades e varredura | 15% | 2 a 3 h | limites de operação na licença |
| ☑ | 5. Gravidade e testes físicos | 8% | 1 h | risco, amarelos, lista de testes |
| ☑ | 6. Camadas e assinaturas | 12% | 2 h | licença em camadas, impressa |
| ☑ | 7. Ciclo: cérebro 3v2 e comparação | 10% | 1,5 h | antes/depois de retreinar |
| ☑ | 8. Montador e cálculo ao vivo | 8% | 2 a 3 h | licença de robô fora da frota |
| ☐ | 9. Fechamento: README, REGISTRO, roteiro, vídeo | 5% | 1,5 h | entrega final |
| | **Total** | 100% | ~18 a 22 h | |

O **obstáculo surgindo** é parte da etapa 4, mas é o item mais caro (replanejamento). Se ele
travar, segue sem ele e volta só se sobrar tempo.

### 6.2 Se o tempo acabar, cortar nesta ordem

1. Obstáculo surgindo (etapa 4).
2. Montador e cálculo ao vivo (etapa 8): o caso do limite físico aparece pelo pré-cálculo.
3. Comparação de versões (etapa 7): fica só "o que falta treinar" na licença.
4. Camadas viram só a camada da fábrica (etapa 6).

**Nunca cortar:** etapas 1, 2, 3 e 9. A partir da etapa 3 o projeto está sempre apresentável.

### Etapa 0 — Preparar (30 min)

- Criar o branch `licenciador`. Guardar o `CLAUDE.md` antigo como `docs/historico/CLAUDE-experimento.md`.
- **Dados da turma:** o CSV das respostas tem apelidos de colegas e texto livre, e o repositório é
  público. Antes de versionar, trocar apelidos por P1 a P6 e salvar em `dados/respostas-turma.csv`.
- Rodar `node train/avaliar.mjs --piloto cerebros --reps 20` e guardar a saída em
  `dados/verdade-antes.txt` (base para a conferência de regressão).
- **Aceite:** branch criado; CSV anonimizado; saída de referência guardada.

### Etapa 1 — Medição: gravidade, perturbações e pré-cálculo (3 h)

- `physics.js`: `World` passa a registrar `impact` e `minClear` (3.5). Só medição.
- `episode.js`: `Run` aceita um último argumento `opts = { giro, empurrao, ruido, atraso, obstaculo }`
  (3.4); sem `opts`, comportamento idêntico ao atual. `result()` devolve também `impact`,
  `minClear` e `gravidade`.
- Novo `docs/core/licenca.js`: classificação de célula (3.2), risco (3.5), limite de varredura
  (4.3), montagem do cartão (4.4). Funções puras, usadas pela página e pelo Node.
- Novo `train/licenciar.mjs`: roda a matriz (3.6) e grava `docs/model/licencas.json`. Aceita
  `--pilotos`, `--reps`, `--condicoes` para rodar parcial durante o desenvolvimento. Imprime, por
  cérebro, a licença em texto.
- **Aceite:**
  1. A conferência de regressão (seção 0) dá igual a `dados/verdade-antes.txt`.
  2. Nominal: a licença em texto de cada cérebro bloqueia **exatamente** o que a tabela da
     seção 3.1 manda, e nada mais.
  3. Com o montador via script, retângulo 1 direcional + 3 bobas sai como **limite físico** para
     todos os cérebros.
  4. A varredura de atraso mostra o cérebro 1 caindo antes do especialista (3.3).

### Etapa 2 — Página da licença: grade, replay, cartão (3 a 4 h)

- `docs/licenca.html` + `docs/licenca.js`, reaproveitando `style.css` e `draw.js`
  (`viewFor`, `drawWarehouse`, `drawPath`, `drawTrail`, `drawRobotAt`).
- Seletor de cérebro, grade nominal colorida (4.1), painel da célula com replay e todos os
  rastros (4.2), cartão da licença nominal com impressão (4.4).
- Links cruzados com `index.html`.
- **Aceite:** abrir pelo servidor local; cada um dos 4 cérebros mostra a grade esperada; clicar
  na Empilhadeira do cérebro 2 mostra especialista em verde e cérebro em vermelho, e o replay
  termina como o pré-cálculo diz; imprimir gera uma página só com o cartão.

### Etapa 3 — Publicar e ensaiar o mínimo (45 min)

- Merge no `main` (ou Pages apontando para o branch), conferir o link público no celular e em
  outro computador. Atualizar o link no README.
- Gravar um vídeo de tela de 1 a 2 minutos dos passos 1 a 3 do roteiro (seção 5): é a reserva v1.
- **Aceite:** link público abre fora da máquina do Matheus e mostra a licença em menos de 5 s.
- *Aceita em 22/11: link aberto pelo Matheus em outra rede. O vídeo de reserva v1 foi para o
  backlog por decisão dele; fica só o vídeo final da etapa 9.*

### Etapa 4 — Imprevisibilidades e varredura (2 a 3 h)

- Seletor de condição na página; grade por condição; gráficos de varredura (4.3); linhas
  "limites de operação" no cartão.
- Replay mostrando a perturbação (4.2).
- Obstáculo surgindo por último (ver 6.2).
- **Aceite:** o cartão do cérebro 1 traz um limite de atraso menor que o do especialista; o do
  cérebro 3 traz um limite de saída em qualquer direção; em toda condição, células onde o
  especialista falha aparecem cinza, não vermelhas.

### Etapa 5 — Gravidade e testes físicos (1 h)

- Ícone de gravidade na grade; risco no tooltip e no painel; células amarelas; lista "testes
  físicos obrigatórios" ordenada por risco no cartão.
- *Como ficou (22/11): os testes físicos são as células amarelas do nominal mais, em cada eixo
  com limite, as células que ficam amarelas num nível até o limite ou que viram defeito logo no
  nível seguinte ("passam raspando"); o risco de uma entrada de borda é o do nível seguinte.*
- **Aceite:** no cérebro 4, Mecanum aparece com colisões graves e Omni com gravidade menor (é a
  distinção que a turma fez de cabeça); a lista de testes físicos do cérebro 1 não fica vazia nem
  enorme (entre 3 e 15 itens).

### Etapa 6 — Camadas e assinaturas (2 h)

- Os três painéis (4.5), a interseção, a origem de cada restrição no cartão, assinatura com nome
  e data, exportar JSON, e as assinaturas no impresso.
- **Aceite:** desmarcar a Empilhadeira na camada da fábrica torna o cérebro 2 licenciável; o
  fabricante do cérebro 4 declarar "não holonômicos" torna o cérebro 4 licenciável, com a
  exclusão marcada como "declarada pelo fabricante"; aumentar a exigência da certificadora
  encolhe todas as licenças.

### Etapa 7 — Ciclo: cérebro 3v2 e comparação (1,5 h)

- `gerar_dados.mjs`: opção `--atraso` (atraso de 0 a 0,3 s sorteado por episódio na ação
  executada; o rótulo continua sendo a ação limpa do especialista) e saída em pasta separada.
- `ajustar.py`: opções `--dados`, `--so` (ajustar um cérebro só) e `--saida`, gravando
  `docs/model/cerebro3v2.json` **sem tocar em `brains.json`**. O 3v2 é ajustado **sem o corte de
  60°**.
- `pilots.js`: carregar o 3v2 do arquivo dele. Pré-calcular o 3v2 em `licencas.json`.
- Comparação de versões na página (4.6).
- **Aceite:** a licença do 3v2 libera Carro e Empilhadeira em m6 e m7; a comparação 3 → 3v2 não
  mostra regressão em nenhuma célula nominal. Se o atraso não melhorar no 3v2, registrar isso no
  README como achado ("dados de atraso sozinhos não ensinam a compensar atraso, porque o
  especialista também não compensa") em vez de forçar.
- *Como ficou (22/11): dados novos com `--atraso 0.3` (média de 0,15 s por episódio, 426 mil
  amostras), ajuste sem corte. O 3v2 libera tudo no nominal (as 4 células da lacuna do 3) e, ao
  contrário do que se temia, o atraso melhorou: limite de 0,1 s (cérebros 1 a 4) para 0,2 s, igual
  ao da referência. Nenhuma célula regrediu em nenhuma das 18 condições. Os limites de saída
  (45° para "não tolera") e de empurrão (1,2 para 0,9 m/s) caem só porque a licença nova cobre
  células que a do 3 nem liberava (Empilhadeira m7, Carro m7), e a comparação diz isso. Conferido
  que o caminho `--so` de `ajustar.py` reproduz o cérebro 3 do `brains.json` (diferença até 2e-4,
  ordem de soma) e que `gerar_dados.mjs` sem `--atraso` gera os mesmos bytes de antes.*

### Etapa 8 — Montador e cálculo ao vivo (2 a 3 h)

- Montador de robô na página (bases e encaixes de `parts.js`); cálculo da licença do robô montado
  ao vivo num Web Worker, só nas condições nominal e numa condição escolhida, com barra de
  progresso.
- **Aceite:** montar o retângulo 1 direcional + 3 bobas dá cinza em tudo para todos os cérebros;
  montar o triciclo com direcional + 2 comuns dá verde no cérebro 1 e mostra diferença no
  cérebro 3; a aba não trava durante o cálculo.
- *Como ficou (22/11): `docs/core/montador.js` calcula; `docs/montador-worker.js` roda num Web
  Worker de módulo (sem suporte, cai para o cálculo na própria página, em pedaços). 6 pilotos × 2
  condições × 7 missões × 6 corridas = 504 corridas, de 4 a 6 s. Para os robôs que também estão no
  pré-cálculo, o cálculo ao vivo dá as mesmas células (84 de 84).*

### Etapa 9 — Fechamento (1,5 h)

- **README.md** reescrito para o projeto: o que é; a pergunta; a tecnologia emergente; como usar;
  o que o experimento mostrou (seção 1.2); limitações (física 2D, atrito "macio", carga sem
  efeito, especialista como referência idealizada, 6 participantes); o que faria com mais um
  semestre (seção 7).
- **REGISTRO.md** (vale 1,0 e é separado do projeto, mas usa os mesmos dados): o que a turma fez
  que eu não esperava (fatos da seção 1.2); o que mudei por causa disso (cada requisito da
  seção 4 ligado à observação que o originou); o que decidi **não** mudar, e por quê; e a linha
  final: a pergunta ficou mais clara, mais confusa ou mudou? *Rascunho do assistente, mas o
  Matheus reescreve com as palavras dele.*
- Ensaiar o roteiro da seção 5 cronometrado; gravar o vídeo de reserva final.
- **Aceite:** README e REGISTRO no repositório; roteiro em menos de 6 minutos; vídeo salvo.

---

## 7. O que fica para "mais um semestre" (para a apresentação final)

- Física com carga, motores e piso reais, para que piso escorregadio e carga virem eixos da
  licença.
- Robôs reais: usar a lista de testes físicos numa bancada de verdade e comparar com o previsto.
- Busca automática de falhas (procurar ativamente a pior condição em vez de varrer uma grade).
- Licença viva: reavaliar automaticamente a cada nova versão do cérebro.
- Validar com quem homologa de verdade (certificadoras, indústria automotiva).

---

## 8. Estrutura de arquivos

```
CLAUDE.md                 este arquivo
README.md                 reescrito na etapa 9
REGISTRO.md               etapa 9
dados/
  respostas-turma.csv     anonimizado (etapa 0)
  verdade-antes.txt       referência de regressão (etapa 0)
docs/
  index.html, app.js      o experimento (congelado; só ganha um link)
  licenca.html            o projeto (novo)
  licenca.js              página do projeto (novo)
  painel.html, painel.js  painel do experimento (congelado)
  sandbox.html            depuração
  style.css               compartilhado
  core/
    physics.js            + impact, minClear (aditivo)
    episode.js            + opts de perturbação (aditivo)
    licenca.js            classificação, risco, varredura, cartão (novo)
    worker.js             corridas ao vivo (etapa 8, novo)
    parts.js, warehouse.js, planner.js, expert.js, brain.js, pilots.js, draw.js, banca.js
  model/
    brains.json           os 4 cérebros do experimento (congelado)
    cerebro3v2.json       etapa 7 (novo)
    licencas.json         pré-cálculo (novo)
  historico/
    CLAUDE-experimento.md
train/
  avaliar.mjs             verdade do experimento
  licenciar.mjs           pré-cálculo das licenças (novo)
  gerar_dados.mjs         + --atraso, saída separada
  ajustar.py              + --dados, --so, --saida
extras/
  coletar-respostas.gs
```
