# Banca de homologação de robôs com IA

**Link do experimento:** https://SEU-USUARIO.github.io/banca-homologacao-robos/

Experimento do movimento 3 de CIN0055 Tendências em Mídia e Interação (CIn/UFPE, 2026.2).

## O que é

Uma banca de homologação simulada. Você avalia quatro "cérebros" de robô (redes neurais que
pilotam qualquer robô da frota num galpão) e decide quais liberaria para operar. Em metade dos
cérebros você testa sozinho, escolhendo robôs e missões; na outra metade, usa um relatório
automático que roda 40 corridas sorteadas. No fim, revelo quais cérebros tinham defeito.

## A pergunta sobre o futuro

Quando robôs forem pilotados por redes neurais que ninguém consegue abrir, uma ferramenta de
testes automáticos ajuda as pessoas a decidir se liberam o robô, ou só dá a elas uma confiança
que não deveriam ter?

Ela vem do mapa de tendência *Agentes corporificados, IA física e modelos de mundo* (horizonte
2035): o efeito "a verificabilidade vira o obstáculo central de homologação" e a previsão de que
surgem ferramentas próprias de interpretabilidade para sistemas físicos. Este experimento testa
uma dessas ferramentas antes de construí-la.

## A tecnologia emergente, e por que não dá com tecnologia madura

O que se homologa é uma **política de controle aprendida e condicionada ao corpo**: a mesma rede
recebe a descrição das rodas de qualquer robô e devolve o comando de cada roda (linha de pesquisa
*cross-embodiment*: *One Policy to Control Them All*, *MetaMorph*, Open X-Embodiment, π0, GR00T).
Aqui ela é uma rede de camada aleatória treinada por imitação de um piloto especialista.

Na pilha madura, com controle modular escrito à mão para cada robô, a homologação é feita módulo
por módulo, e cada falha tem um módulo responsável. O problema que este experimento estuda,
decidir sobre um sistema que não se decompõe, não existe na pilha madura. O planejador de rota
(A* no mapa do galpão) é tecnologia madura e não está sendo testado.

## Como usar

1. Abra o link num notebook (no celular funciona, mas é apertado).
2. Escreva um apelido e o **número de participante** (na aula, o que está no quadro; de fora da
   turma, qualquer número de 1 a 6). O número define a ordem dos cérebros e o modo de cada um.
3. Para cada um dos 4 cérebros (uns 5 minutos cada):
   - **Bancada:** escolha um robô e uma missão e clique em *Rodar*. Repita quanto quiser.
   - **Relatório automático:** clique em *Rodar avaliação*; veja a taxa de sucesso, as tabelas
     por robô e por missão, e assista ao replay das 3 piores corridas.
   - Decida: **libero / não libero**, sua confiança (1 a 5) e por quê.
4. Responda o questionário final e clique em *Enviar*. Se o envio falhar, use
   *Baixar minhas respostas* e me mande o arquivo.

A regra da fábrica: um cérebro só pode ser liberado se pilotar **todos os robôs da frota**, em
**todas as missões**, sem bater e dentro do tempo.

## O que eu espero que aconteça (escrito antes do teste)

- Na bancada, as pessoas vão testar os robôs e missões mais óbvios e vão liberar cérebros com
  defeito escondido.
- O relatório vai melhorar o acerto, mas vai aumentar a confiança também nas decisões erradas.
- Ninguém vai reprovar sem ver uma falha acontecendo: número sozinho não convence.
- Sobre quem deve assinar, a turma não vai concordar, e a maioria vai rejeitar que seja a
  própria empresa que fez o cérebro.

## Limitações

Física 2D simplificada, com carga igual em todas as rodas e atrito "macio" (as rodas se arrastam
mais do que num robô real). O planejador conhece o mapa exato. Os defeitos vêm de lacunas de
treino escolhidas por mim, que é como esse tipo de defeito aparece em sistemas reais, mas aqui em
escala muito menor.

## Para quem quiser rodar ou mexer

- Site: `cd docs && python -m http.server 8000` → http://localhost:8000 (módulos ES não abrem
  por `file://`). `docs/sandbox.html` é a página de depuração; `docs/painel.html`, o painel do
  apresentador.
- Treino (Node + Python com numpy):
  `node train/gerar_dados.mjs` → `python train/ajustar.py` →
  `node train/avaliar.mjs --piloto cerebros --reps 20 --gravar` (mede e grava a tabela de verdade).
- Coleta: `extras/coletar-respostas.gs` (Google Apps Script); a URL vai em `docs/config.js`.
