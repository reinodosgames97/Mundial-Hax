# Mundial Hax

Futebol **11 contra 11** visto de cima, com os elencos dos clubes e **modo carreira**. Você escolhe um clube, escala o time, joga cada partida (passe, chute, bote, corrida) e atravessa temporadas inteiras: estadual, Brasileirão, copas, competições continentais e mundiais — com acesso, rebaixamento, vagas, títulos, artilharia e estatísticas salvos no aparelho.

Funciona no **celular** (toque), no **computador** (teclado ou controle) e no **Xbox** (controle; veja [`xbox/`](xbox/README.md)). Não tem instalação nem etapa de build: é HTML, CSS e JavaScript puro.

## Como jogar

| Ação | Toque | Controle (Xbox, padrão FIFA) | Teclado |
| --- | --- | --- | --- |
| Mover | Analógico fixo à esquerda | Analógico esquerdo / direcional | Setas ou WASD |
| Passe rasteiro (segurar = mais forte e mais longe) | `PASSE` | A | J |
| Bola alta / cruzamento | segure `PASSE` | X | H |
| Enfiada (bola no espaço) | `ENFIADA` | Y · LB+Y por cima | U |
| Chute (segurar = mais força, carga cheia em ~0,4 s) | `CHUTE` | B | K |
| Chute colocado (com curva) | — | RB+B | E+K |
| Correr | `CORRER` | RT | Shift |
| Proteger a bola | — | LT | Q |
| Condução colada | — | RB | E |
| Sem a bola: trocar de jogador | `PASSE` (vira `TROCAR`) | toque em A ou LB · analógico direito na direção | C |
| Sem a bola: conter o atacante | — | segure A | segure J |
| Sem a bola: companheiro pressiona | — | RB | E |
| Sem a bola: acompanhar de frente | — | LT | Q |
| Sem a bola: bote | `CHUTE` (vira `BOTE`) | B ou X | K |
| Pausar | ❚❚ | Menu (Start) | P ou Esc |

- **Passe semi-assistido:** a bola vai para o companheiro que está na direção apontada, já com a força certa e antecipando a corrida dele; a sua mira ainda puxa um pouco a direção. Sem ninguém na direção, o passe sai livre.
- **Chute:** quanto mais tempo segurando, mais forte (e mais alto — força demais isola). Apontar para o gol escolhe o canto; a precisão depende do jogador, da pressão e da força.
- Ao passar, o controle vai para quem recebe; sem mexer no analógico ele domina a bola sozinho.
- **Toque de primeira:** aperte passe, enfiada ou chute enquanto a bola ainda está indo para o companheiro. A ação fica guardada (aparece "1º TOQUE" em cima dele) e sai assim que ele dominar, um pouco menos precisa que um passe com a bola dominada.
- **Enfiada:** a bola vai para o espaço à frente do companheiro escolhido, no tempo da corrida dele. Segurar mais deixa a bola mais longa. A IA também usa.
- **Troca de jogador:** sem a bola, LB (ou A) assume quem está em melhor posição para defender, chegando na frente do adversário pelo lado do nosso gol; a seta branca mostra quem será. Apertando de novo em seguida passa para o próximo. O analógico direito troca para o jogador naquela direção.
- **Defesa:** segurar A faz o seu jogador conter o atacante, ficando entre ele e o gol e acompanhando a corrida. RB chama mais um companheiro para pressionar o portador. LT acompanha de frente, mais devagar e com bote mais eficiente. Se você perde a bola e fica caído ou para trás, o controle passa sozinho para quem está na frente da jogada (sem passar por cima de uma troca feita na mão).
- **Proteção e condução:** LT com a bola protege, mais devagar e com a bola do lado oposto ao marcador, muito mais difícil de desarmar. RB com a bola conduz com a bola colada ao pé e vira mais rápido.
- **Chute colocado (RB+B):** mais fraco e mais preciso. Sai por fora do alvo e curva de volta para dentro, e o goleiro lê a linha reta.
- **Cruzamento e cabeceio:** pelo lado, perto da área, o passe alto (X) vai para a cabeça de quem está na área. A bola alta pode ser cabeceada por qualquer jogador perto dela: no ataque, para o gol; na defesa, para longe. A IA também cruza.
- O goleiro é automático. Há lateral, escanteio e tiro de meta. Mata-mata empatado: prorrogação com **gol de ouro** e depois **pênaltis**.
- Nos menus, o controle também funciona: direcional navega, A confirma, B volta, LB/RB trocam de aba.

Cada jogo pode ser **jogado** ou **simulado**. Nas opções: dificuldade (Fácil, Normal, Difícil, Lendário), duração (4 a 10 minutos), analógico fixo ou "onde tocar", troca automática de jogador e som. Ao fim de cada temporada você pode continuar ou **trocar de clube**.

## Elenco

A aba **Elenco** mostra os jogadores do clube, com nota geral e gols na temporada. Você escolhe a formação (4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2) e troca titulares e reservas. As notas vêm da força do clube e da posição; em campo elas viram velocidade, passe, finalização, desarme e, no goleiro, defesa.

444 clubes têm o **elenco real** (lido da Wikipédia); os demais, na maioria clubes pequenos dos estaduais, recebem um elenco gerado.

## O que tem na carreira

| Competição | Formato implementado (regulamentos de 2026) |
| --- | --- |
| Brasileirão Série A | 20 clubes, turno e returno; 4 rebaixados |
| Série B | 20 clubes; sobem os 2 primeiros e os vencedores do playoff (3º×6º, 4º×5º); 4 rebaixados |
| Série C | Turno único de 19 rodadas, quadrangulares com os 8 melhores, final; 4 sobem. Cresce para 24 clubes em 2027 e 28 a partir de 2028 |
| Série D | 96 clubes, 16 grupos regionais de 6, mata-mata com 64; sobem os 4 semifinalistas e 2 do playoff entre eliminados nas quartas |
| Estaduais | Os 27, com fase de liga e mata-mata; definem vagas na Copa do Brasil e na Série D |
| Copa do Brasil | 126 clubes, cinco fases iniciais (Série A entra na 5ª), final em jogo único |
| Supercopa Rei | Campeão brasileiro × campeão da Copa do Brasil |
| Libertadores | 47 clubes: três fases preliminares, 8 grupos, mata-mata, final única |
| Sul-Americana | Fase nacional, 8 grupos, playoffs contra os terceiros da Libertadores, mata-mata, final única |
| Recopa | Campeão da Libertadores × campeão da Sul-Americana |
| Liga dos Campeões | Fase de liga com 36 clubes e 8 rodadas, playoffs e mata-mata |
| Ligas europeias | Inglaterra, Espanha, Itália, Alemanha e França (também dá para treinar um clube delas) |
| Copa Intercontinental | Anual: Dérbi das Américas, Copa Challenger e final contra o campeão europeu |
| Copa do Mundo de Clubes | 32 clubes, a cada 4 anos (2029, 2033…), com vagas pelos campeões continentais do ciclo |

### Vagas que se acumulam

As vagas do Brasil são recalculadas com a tabela e os campeões das copas (`brContinental` em `js/core/season.js`, testado em `tools/test-vagas.mjs`):

- Libertadores, fase de grupos: 4 melhores do Brasileirão + campeão da Copa do Brasil. Preliminar: o seguinte da tabela + vice da Copa do Brasil. Sul-Americana: os 6 seguintes.
- Os campeões da **Libertadores** e da **Sul-Americana** ganham vaga extra na fase de grupos. Se já estavam na zona de classificação, **a vaga deles desce para o próximo da tabela** — o G4 vira G5, G6…
- O mesmo vale para o campeão e o vice da Copa do Brasil que já estejam classificados pelo Brasileirão.
- Exemplo do teste: campeão da Libertadores em 1º, da Sul-Americana em 3º, da Copa do Brasil em 2º e vice em 4º → grupos até o 7º, preliminar com 8º e 9º, Sul-Americana do 10º ao 15º.

A tabela da Série A mostra essas zonas ao vivo, e a força dos clubes muda com o tempo (quem sobe se reforça, quem cai enfraquece, e o seu clube cresce com títulos e acessos).

A aba **Títulos** mostra a sala de troféus (histórico real até 2025 + o que você conquistar), o ranking de maiores campeões de cada competição, os campeões de cada temporada e a carreira do treinador. Em **Tabelas** há a **artilharia** de cada competição.

## Rodar

- **GitHub Pages:** no repositório, *Settings → Pages → Deploy from a branch*, escolha o branch e a pasta `/ (root)`. O jogo fica em `https://<usuário>.github.io/Mundial-Hax/`. No celular, use "Adicionar à tela inicial" para abrir em tela cheia.
- **No computador:** `node tools/serve.mjs` e abra `http://localhost:8080` (o jogo usa módulos ES, então precisa de um servidor; abrir o `index.html` direto do disco não funciona). Um controle USB/Bluetooth é reconhecido pelo navegador.
- **Xbox Series S/X (modo desenvolvedor):** projeto UWP em [`xbox/`](xbox/README.md). Também dá para abrir o endereço do GitHub Pages no Edge do console.

O progresso é salvo automaticamente no armazenamento do navegador/aplicativo daquele aparelho.

## Estrutura

```
index.html, css/style.css      página e estilos
js/data/                       clubes, títulos e elencos (gerados)
js/core/                       carreira: fases, competições, calendário, temporada, elencos, save
js/game/engine.js              partida 11x11: física, posse, passe/chute/bote, goleiros, bola parada, IA
js/game/view.js                câmera, desenho, radar, toque/teclado/controle, pênaltis
js/ui/                         menus, tabelas, estatísticas, navegação por controle
xbox/                          projeto UWP (C# + WebView2) para o Xbox
tools/                         servidor de desenvolvimento, testes e gerador de dados
```

Testes:

```
npm test                                   # simula 6 temporadas completas e confere invariantes
node tools/test-vagas.mjs                  # acúmulo de vagas (G4 -> G5...)
node tools/test-match.mjs 20               # partidas IA x IA: placares, passes, efeito de elenco e dificuldade
node tools/test-controls.mjs               # controles: toque de primeira, enfiada, trocas, recepção, conter, pressão, proteção, chute colocado, cruzamento
node tools/serve.mjs 8123 &                # e, com o servidor no ar:
node tools/e2e.cjs                         # carreira ponta a ponta no navegador (Playwright)
node tools/e2e-match.cjs                   # toque, controle (gamepad simulado), pausa
node tools/e2e-pens.cjs                    # disputa de pênaltis
```

## Dados e escudos

- Clubes (659), divisões de 2026, participantes, cores, títulos e **elencos** foram montados a partir da **Wikipédia** e do **Wikidata** com os scripts de `tools/data/` (`step1` a `step6`). Para atualizar, rode-os em ordem; `step4` e `step6` regravam `js/data/`.
- Os **escudos** não ficam no repositório: são carregados em tempo de execução do CDN de imagens do **Transfermarkt**, pelo id do clube (obtido no Wikidata), com imagem reserva da Wikipédia e, por último, um emblema gerado com as cores do clube. O Transfermarkt não oferece API pública e bloqueia leitura automática das páginas, por isso só as imagens são usadas.
- Nomes de clubes e jogadores e os escudos pertencem aos respectivos donos; este é um projeto de fã, sem vínculo com clubes, federações, Transfermarkt ou qualquer outro jogo.

## Simplificações conhecidas

- **Sem impedimento, faltas, cartões nem substituições durante o jogo.** Os atacantes da IA respeitam a linha do último defensor, mas a regra não é apitada.
- As notas dos jogadores não são reais: saem da força do clube com variação por jogador. Não há transferências, envelhecimento nem lesões; o elenco é o mesmo a cada temporada.
- Artilharia: gols das partidas jogadas são dos jogadores que marcaram; nas simuladas são sorteados com peso por posição. Só as competições principais e as do seu clube são contabilizadas.
- As ligas europeias e a Champions correm dentro do ano-calendário do jogo (a "temporada 2026" europeia equivale a 2026-27).
- Estaduais usam um formato-padrão por número de clubes, não o regulamento de cada federação. Países sul-americanos fora do Brasil não têm liga simulada. Copa do Nordeste, Copa Verde e Copa Sul-Sudeste não estão no jogo.
- O formato da Série C com 24/28 clubes (2027 em diante) é uma projeção.
- Em alguns estados a Wikipédia não tinha a página de 2026; nesses casos a lista vem da edição mais recente disponível, e a contagem de títulos de poucos estados (MS, TO, RO) está incompleta.
- O projeto do Xbox ainda não foi compilado nem testado em console (veja `xbox/README.md`).
