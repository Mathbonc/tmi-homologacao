# Licenciador de cérebros de robô

**Abrir o licenciador:** https://mathbonc.github.io/tmi-homologacao/licenca.html

**O experimento que originou o projeto:** https://mathbonc.github.io/tmi-homologacao/

Projeto final de CIN0055 Tendências em Mídia e Interação (CIn/UFPE, 2026.2).

## O que é

Uma ferramenta de homologação para robôs pilotados por redes neurais. Você escolhe um "cérebro"
(uma rede que pilota qualquer robô da frota de um galpão) e recebe a **licença de operação**
dele, gerada a partir de milhares de corridas simuladas e com a evidência por trás de cada linha.

A ferramenta não responde "aprovado ou reprovado". Ela entrega três coisas:

1. **Uma licença com limites:** para quais robôs e missões o cérebro está liberado, e até que
   nível de perturbação (saída virada, empurrão, ruído de sensor, atraso de comando, obstáculo
   que surge no caminho). Em carro autônomo, a ideia equivalente se chama ODD, o domínio de
   projeto operacional.
2. **A lista de testes físicos obrigatórios:** os casos na fronteira, ordenados por risco, para
   gastar teste com robô de verdade só onde importa.
3. **O que falta treinar:** cada bloqueio é traduzido na situação que o cérebro não domina
   ("robôs puxados por roda direcional", "meia-volta com carro e empilhadeira", "atraso acima de
   0,1 s").

## A pergunta

O experimento perguntava: quando robôs forem pilotados por redes neurais que ninguém consegue
abrir, uma ferramenta de testes automáticos ajuda as pessoas a decidir se liberam o robô, ou só dá
a elas uma confiança que não deveriam ter?

Ela vem do mapa de tendência *Agentes corporificados, IA física e modelos de mundo* (horizonte
2035). O efeito de confiança alta do mapa é "a verificabilidade vira o obstáculo central de
homologação", e o mapa prevê que surge uma engenharia de interpretabilidade para sistemas físicos,
com ferramentas próprias e papel formal na certificação. Este projeto é uma dessas ferramentas,
desenhada a partir do que a turma fez no experimento.

## O que o experimento mostrou

Seis pessoas avaliaram quatro cérebros cada uma (24 decisões), metade testando na mão e metade com
um relatório automático de 40 corridas. A regra da fábrica era: só libera se pilotar todos os
robôs, em todas as missões.

| | Resultado |
|---|---|
| Acerto testando na mão | 9 de 12 |
| Acerto com o relatório automático | 8 de 12 |
| Erros | 7, **todos** liberando cérebro com defeito; ninguém reprovou o cérebro bom |
| Erros cometidos **depois de ver a falha** | **6 de 7** |

As justificativas explicam o padrão: *"acho que é seguro exceto empilhadeira"*, *"definitivamente
devem ser excluídos o Omni de 3 rodas e o Mecanum 4×4"*. O problema não era achar a falha. As
pessoas queriam **liberar com restrições**, e o site só aceitava sim ou não. Com seis pessoas, isso
é o que apareceu, não o que ficou provado.

O que a turma pediu nas respostas abertas virou requisito do projeto: gravidade (*"o do mecanum é
de outro nível"*), ver qualquer caso e vários rastros de uma vez, testes físicos depois do virtual,
assinatura em camadas (certificadora, empresa, fábrica), comparar robôs na mesma missão e
adicionar imprevisibilidades. O registro completo do que mudou e por quê está em
[REGISTRO.md](REGISTRO.md).

## A tecnologia emergente, e por que não dá com tecnologia madura

O que se licencia é uma **política de controle aprendida e condicionada ao corpo**: a mesma rede
recebe a descrição das rodas de qualquer robô e devolve o comando de cada roda (linha de pesquisa
*cross-embodiment*: *One Policy to Control Them All*, *MetaMorph*, Open X-Embodiment, π0, GR00T).

Na pilha madura, com controle escrito à mão para cada robô, a homologação é feita módulo por
módulo, e cada falha tem um módulo responsável. Uma rede que não se decompõe não deixa fazer isso:
só resta mapear empiricamente onde ela é confiável, e é isso que a ferramenta faz. O planejador de
rota (A*) e o piloto especialista são tecnologia madura e aqui servem de instrumento, não de objeto.

## Como usar

1. Abra o link num notebook (no celular funciona, mas é apertado).
2. **Escolha o cérebro** no topo (1 a 4 são os do experimento; 3v2 é o cérebro 3 retreinado).
   O resumo em uma linha diz para quantos robôs ele está liberado.
3. **Leia a grade robô × missão.** Verde é liberado; amarelo, liberado mas com teste físico
   obrigatório; vermelho, defeito do cérebro (o piloto de referência consegue e o cérebro não);
   cinza, limite físico (nem a referência consegue, não conta contra o cérebro). O ícone mostra o
   pior caso: ✸ colisão grave, ≈ raspão, ◷ travou, ◌ quase-acidente.
4. **Clique numa célula** para ver as 6 corridas lado a lado com a referência, assistir ao replay
   de qualquer uma ou ver os rastros do robô nas 7 missões.
5. **Troque a condição** (saída virada, empurrão, ruído, atraso, obstáculo) para ver a grade sob
   aquela imprevisibilidade. O replay mostra a perturbação acontecendo. Os gráficos de
   **varredura** mostram até onde o cérebro aguenta cada uma.
6. **Monte um robô** fora da frota no montador e calcule a licença dele ao vivo.
7. **Ajuste as camadas:** a certificadora (tolerância, gravidade proibida, níveis mínimos), o
   fabricante do cérebro (que tipos de robô ele se propõe a pilotar) e a fábrica (a frota e as
   missões que usa). A licença é a interseção das três, e cada parte assina.
8. **Compare versões** ("comparar com") e **imprima o cartão** da licença, ou exporte em JSON.

## O que a ferramenta encontra

Cada cérebro do experimento tem uma lacuna de treino plantada de propósito. Elas são o gabarito da
ferramenta, e a ferramenta reencontra as quatro sem bloquear nada a mais:

| Cérebro | Lacuna plantada | Bloqueado na licença | Limites de operação que a varredura achou |
|---|---|---|---|
| 1 | nenhuma | nada | atraso até 0,1 s (a referência aguenta 0,2 s); saída virada até 135° |
| 2 | nunca viu robôs puxados por roda direcional | Empilhadeira, todas as missões | atraso até 0,1 s |
| 3 | nunca viu o alvo a mais de 60° | Carro e Empilhadeira nas missões de costas (m6, m7) | saída virada até 45°; ruído até 30°; atraso até 0,1 s; **não desvia** de obstáculo que surge |
| 4 | nunca viu robôs holonômicos | Omni (raspão) e Mecanum (colisão grave) | saída virada até 90°; atraso até 0,1 s |

Três achados que eu não tinha planejado:

- **O cérebro 1, que passa em tudo no nominal, tem um ponto fraco próprio:** atraso de comando. A
  0,2 s ele já trava com o carrinho diferencial, onde a referência ainda chega.
- **O obstáculo surgindo expõe a lacuna do cérebro 3** por outro caminho: a rota replanejada põe o
  alvo atrás do robô, que é justamente o que ele nunca treinou.
- **O ciclo de melhoria funciona:** o cérebro 3 retreinado com o que a licença pediu (alvo atrás e
  atraso nos dados) passa a liberar as quatro células bloqueadas, e o limite de atraso sobe de
  0,1 s para 0,2 s, igual ao da referência. Nenhuma célula regrediu em nenhuma das 18 condições.
  Os limites de saída virada e de empurrão caem, mas só porque a licença nova cobre células que a
  antiga nem liberava; a comparação de versões explica isso na tela.

O retângulo com 1 roda direcional e 3 bobas, que ninguém consegue pilotar, sai cinza para todos os
cérebros: é limite físico, não culpa do cérebro.

## Como funciona

- **Cada célula** é robô × missão × condição, com 6 corridas nas mesmas sementes para o cérebro e
  para o piloto de referência (o controlador que gerou os dados de treino). A comparação com a
  referência é o que separa defeito do cérebro de limite do corpo.
- **Gravidade** vem da velocidade na batida (grave a partir de 0,3 m/s) e da menor folga até as
  prateleiras (quase-acidente abaixo de 3 cm). Risco é a média dos pesos (grave 10, raspão 3,
  travou 2, quase-acidente 1).
- **As perturbações** entram na camada da corrida, sem mexer na física, sorteadas a partir da
  semente: o replay repete a corrida exatamente. O cérebro e a referência recebem as mesmas.
- **O pré-cálculo** (5 pilotos e a referência, 18 condições, 10 robôs, 7 missões, 6 corridas) fica
  em `docs/model/licencas.json` (cerca de 1 MB), e a página não espera cálculo nenhum para abrir. Se o navegador reproduzir
  uma corrida com resultado diferente do pré-cálculo, a página avisa em vez de esconder.
- **O montador** calcula ao vivo num Web Worker, sem travar a página.

## Limitações

- Física 2D simplificada, com atrito "macio" (as rodas se arrastam mais do que num robô real). A
  carga não tem efeito nenhum: nesta física a massa se cancela. Por isso piso e carga não viraram
  eixos da licença.
- O piloto de referência é idealizado. No mundo real não existe especialista perfeito; ele faz o
  papel de "controlador de referência" ou de "versão certificada anterior".
- **6 corridas por célula** dão pouca resolução: 5 de 6 é 83%, então qualquer tolerância acima
  disso exige 6 de 6, e uma única falha da referência já torna a célula cinza.
- A varredura testa níveis fixos de cada perturbação, uma de cada vez, e não combinações.
- O cérebro não vê o mapa: percebe o obstáculo só pela rota replanejada.
- O experimento teve 6 participantes.

## O que eu faria com mais um semestre

- Física com carga, motores e piso reais, para que piso escorregadio e carga virem eixos da
  licença.
- Usar a lista de testes físicos numa bancada com robôs de verdade e comparar com o previsto.
- Busca automática de falhas: procurar ativamente a pior condição em vez de varrer uma grade.
- Licença viva, reavaliada automaticamente a cada versão nova do cérebro.
- Validar a ferramenta com quem homologa de verdade (certificadoras, indústria automotiva).

## Para quem quiser rodar ou mexer

- Site: `cd docs && python -m http.server 8000` → http://localhost:8000/licenca.html (módulos ES
  não abrem por `file://`).
- Pré-cálculo das licenças: `node train/licenciar.mjs` (alguns minutos; aceita rodadas parciais,
  por exemplo `--pilotos cerebro3v2` ou `--condicoes atraso`).
- Conferência do experimento: `node train/avaliar.mjs --piloto cerebros --reps 20` tem que repetir
  a tabela de `dados/verdade-antes.txt`.
- Cérebro 3v2: `node train/gerar_dados.mjs --atraso 0.3 --saida train/dados-atraso` e
  `python train/ajustar.py --dados train/dados-atraso --so cerebro3v2 --saida docs/model/cerebro3v2.json`
  (Python com numpy). Os quatro cérebros do experimento, em `docs/model/brains.json`, ficam
  congelados.
- O experimento original: `docs/index.html` (a banca), `docs/painel.html` (painel do apresentador)
  e a descrição completa em [docs/historico/CLAUDE-experimento.md](docs/historico/CLAUDE-experimento.md).
  As respostas da turma, anonimizadas, estão em `dados/respostas-turma.csv`.
