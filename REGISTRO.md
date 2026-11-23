# Registro: do experimento ao projeto

> **Rascunho.** Escrito pelo assistente a partir das respostas da turma (`dados/respostas-turma.csv`)
> e das medições do projeto, para o Matheus reescrever com as palavras dele.

CIN0055 Tendências em Mídia e Interação (CIn/UFPE, 2026.2). Experimento testado com a turma em 02 e
03/11; projeto final construído depois, a partir do que o experimento mostrou.

## 1. O que eu esperava e o que aconteceu

Antes do teste, escrevi no README do experimento quatro expectativas. Seis pessoas avaliaram quatro
cérebros cada uma, 24 decisões no total, comparadas com a verdade medida (o cérebro 1 era bom; os
outros três tinham uma lacuna de treino).

| O que eu esperava | O que aconteceu |
|---|---|
| Na bancada, as pessoas testariam os casos óbvios e liberariam cérebros com defeito escondido. | Testaram bastante (de 4 a 58 corridas por cérebro; uma pessoa cobriu as 49 combinações). Os erros não vieram de não achar a falha. |
| O relatório melhoraria o acerto, mas aumentaria a confiança também nas decisões erradas. | O contrário. A bancada teve um pouco mais de acerto (9 de 12 contra 8 de 12) e também mais confiança: média 4,1 contra 3,3 no relatório. |
| Ninguém reprovaria sem ver uma falha acontecendo. | O problema foi o inverso: **6 dos 7 erros foram cometidos depois de ver a falha**. |
| Sobre quem assina, a turma não concordaria, e a maioria rejeitaria a própria empresa do cérebro. | Confirmado em parte: fábrica usuária 3, governo 1, certificadora 1, empresa do cérebro 1. |

## 2. O que a turma fez que eu não esperava

- **Todos os 7 erros foram liberar um cérebro com defeito.** Ninguém reprovou o cérebro bom.
- **Quase todos aconteceram depois de ver a falha.** As justificativas explicam por quê:
  *"acho que é seguro exceto empilhadeira"*; *"definitivamente devem ser excluídos o Omni de 3
  rodas e o Mecanum 4×4"*; *"problema estaria se tivesse que se mover de costas, mas isso poderia
  ser resolvido"*. As pessoas não deixaram de ver o defeito: elas queriam **liberar com
  restrições**, e o site só aceitava sim ou não.
- **O número do relatório pesou.** O cérebro 3, com 90 a 95% de sucesso no relatório, foi liberado
  por 4 de 6. O cérebro 4, com 70 a 75%, por 1 de 6. Os dois tinham defeito do mesmo tipo
  (um conjunto de robôs ou missões em 0%).
- **A gravidade foi julgada de cabeça.** *"Os erros do omni foram compreensíveis, o do mecanum é de
  outro nível."* Medido depois: no cérebro 4, o Omni só raspa e o Mecanum bate forte.
- **A turma desenhou sozinha uma licença em camadas:** *"um nível básico, de agência certificadora
  independente, outorgado pelo governo; a empresa deve ter seu próprio nível de exigência; e a
  fábrica vai ver no seu caso específico"*.

Com seis pessoas, isto é o que apareceu, não o que ficou provado.

## 3. O que mudei por causa disso

Cada parte do projeto saiu de uma observação do experimento:

| No projeto | Observação que originou |
|---|---|
| A licença com restrições, em vez de sim ou não: "liberado para estes robôs, nestas missões, exceto…" | 6 dos 7 erros depois de ver a falha; *"seguro exceto empilhadeira"* |
| Os robôs nas linhas da grade e as missões nas colunas | A turma achou mais útil variar o robô mantendo a missão |
| Ícone de gravidade, risco por célula e células amarelas | *"o do mecanum é de outro nível"*; *"o quão desastroso e a frequência com que o problema acontece"* |
| Replay de qualquer corrida e rastros do robô nas 7 missões | Pediram para ver qualquer caso, não só as 3 piores corridas; *"rodar tudo automático mas permitir auditoria humana"*; *"vários rastros visíveis de uma vez"* |
| A lista de testes físicos obrigatórios, ordenada por risco | *"se passar em todos no mundo virtual, aí faz uma nova bateria de testes físicos"* |
| Imprevisibilidades (saída virada, empurrão, ruído, atraso, obstáculo) e a varredura de cada uma | Sugestão direta da turma; *"cenários mais complexos com obstáculos ou situações adversas"* |
| As três camadas (certificadora, fabricante do cérebro, fábrica) com assinatura de cada uma | A resposta sobre os níveis de exigência; a divisão na pergunta sobre quem assina |
| "O que falta treinar" e o ciclo com o cérebro 3v2 | *"isso poderia ser resolvido"*: o cérebro 3 retreinado com o que a licença pediu passa a liberar as células que estavam bloqueadas |

Uma parte não veio de uma fala da turma, e sim de uma necessidade da licença com restrições: o
**piloto de referência**. Para uma restrição ser justa, é preciso saber se a falha é do cérebro ou
do corpo do robô. Por isso cada célula compara o cérebro com o controlador que gerou os dados de
treino, nas mesmas corridas. Se a referência também falha, a célula é limite físico e não conta
contra o cérebro.

## 4. O que decidi não mudar, e por quê

- **A física.** Testei piso escorregadio, carga e motor lento: o cérebro bom e a referência chegam
  em 100% em quase tudo, e a carga não tem efeito nenhum, porque nesta física a massa se cancela.
  Limitar a força do motor para a carga importar quebrou a frota em condições normais. Mexer na
  física teria criado um eixo de licença falso.
- **Os quatro cérebros do experimento.** Ficaram congelados e viraram o gabarito da ferramenta:
  ela tem que reencontrar as quatro lacunas plantadas, e reencontra, sem bloquear nada a mais.
- **A ferramenta não decide.** Ela não diz aprovado ou reprovado; entrega a licença com a evidência
  e deixa a decisão com as três camadas. O experimento mostrou que o veredito binário era
  justamente o que atrapalhava.
- **Não abrir a rede.** Uma pessoa pediu *"mais conhecimento dos modelos"*. A ferramenta explica
  pelo comportamento (em que situação o cérebro falha), não pelos pesos da rede. Com uma política
  que não se decompõe, é o que dá para garantir.
- **Divergências não ficam escondidas.** Se o navegador reproduzir uma corrida com resultado
  diferente do pré-cálculo, a página avisa.
- **6 corridas por célula.** Mais corridas deixariam o pré-cálculo muito maior e mais lento. O
  custo é a resolução: com 6 corridas, qualquer tolerância acima de 83% exige 6 de 6. A página
  mostra isso no seletor de tolerância em vez de fingir uma precisão que não existe.

## 5. A pergunta ficou mais clara, mais confusa ou mudou?

*Rascunho de resposta, para o Matheus reescrever:* mudou. Eu perguntava se uma ferramenta de testes
automáticos ajuda as pessoas a decidir ou só dá uma confiança que não deveriam ter. O experimento
mostrou que a ferramenta achava a falha e que as pessoas viam a falha; o que faltava era uma forma
de decidir que não fosse sim ou não. A pergunta passou a ser: **o que uma licença precisa dizer,
e quem precisa assinar cada parte dela, para que liberar com restrição seja seguro?**
