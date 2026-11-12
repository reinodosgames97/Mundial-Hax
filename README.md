# Mundial Hax

Futebol arcade de física (visão de cima, jogadores em disco, bola que bate na parede) com **modo carreira de clubes**. Você escolhe um clube, joga cada partida no campinho e atravessa temporadas inteiras: estadual, Brasileirão, copas, competições continentais e mundiais — com acesso, rebaixamento, vagas, títulos e estatísticas salvos no aparelho.

Feito para **celular** (toque), mas também funciona no computador (teclado). Não tem instalação nem etapa de build: é HTML, CSS e JavaScript puro.

## Como jogar

- **Mover:** arraste o dedo no lado esquerdo da tela (joystick flutuante).
- **Chutar:** segure `CHUTE`; o chute sai quando o jogador encosta na bola, na direção jogador → bola.
- **Trocar:** `TROCAR` passa o controle para o companheiro mais perto da bola. O goleiro é sempre automático. A troca automática pode ser desligada nas opções.
- Não há lateral, escanteio nem falta: a bola quica nas paredes e o jogo não para.
- Mata-mata empatado: prorrogação de 1 minuto com **gol de ouro** e, se ninguém marcar, **pênaltis** (toque no canto para bater ou para pular).
- Em pé o campo fica vertical (você ataca para cima); deitado o campo fica maior.
- Teclado: setas ou WASD para mover, espaço ou X para chutar, C para trocar, P/Esc para pausar.

Cada jogo pode ser **jogado** ou **simulado**. Nas opções dá para mudar dificuldade (Fácil, Normal, Difícil, Lendário), duração da partida (2 a 6 minutos), tamanho dos times (3×3, 4×4, 5×5) e simular o resto da temporada. Ao fim de cada temporada você pode continuar no clube ou **trocar de clube**.

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
| Ligas europeias | Inglaterra, Espanha, Itália, Alemanha e França (simuladas rodada a rodada; também dá para treinar um clube delas) |
| Copa Intercontinental | Anual: Dérbi das Américas, Copa Challenger e final contra o campeão europeu |
| Copa do Mundo de Clubes | 32 clubes, a cada 4 anos (2029, 2033…), com vagas pelos campeões continentais do ciclo |

Vagas do Brasil na Libertadores (4 primeiros + campeão da Copa do Brasil na fase de grupos; 5º e vice da Copa do Brasil na preliminar), Sul-Americana (seis seguintes), acesso/descenso entre as séries e a entrada na Série D pelos estaduais são recalculados a cada virada de ano. A força dos clubes muda com o tempo (quem sobe se reforça, quem cai enfraquece, e o seu clube cresce com títulos e acessos).

A aba **Títulos** mostra a sala de troféus do clube (histórico real até 2025 + o que você conquistar), o ranking de maiores campeões de cada competição, os campeões de cada temporada e a carreira do treinador.

## Rodar

Abra pelo celular qualquer endereço que sirva estes arquivos. Opções:

- **GitHub Pages:** no repositório, *Settings → Pages → Deploy from a branch*, escolha o branch e a pasta `/ (root)`. O jogo fica em `https://<usuário>.github.io/Mundial-Hax/`. No celular, use "Adicionar à tela inicial" para abrir em tela cheia.
- **No computador:** `node tools/serve.mjs` e abra `http://localhost:8080` (o jogo usa módulos ES, então precisa de um servidor; abrir o `index.html` direto do disco não funciona).

O progresso é salvo automaticamente no `localStorage` do navegador daquele aparelho.

## Estrutura

```
index.html, css/style.css      página e estilos
js/data/                       base de clubes e títulos (gerada)
js/core/                       motor da carreira: fases, competições, calendário, temporada, save
js/game/                       partida: física, IA, controlador, tela/controles/pênaltis
js/ui/app.js                   menus, tabelas, estatísticas
tools/                         servidor de desenvolvimento, testes e gerador de dados
```

Testes:

```
npm test                                   # simula 6 temporadas completas e confere invariantes
node tools/test-match.mjs                  # partidas IA × IA (equilíbrio)
node tools/test-levels.mjs 150             # efeito do nível da IA
node tools/serve.mjs 8123 &                # e, com o servidor no ar:
node tools/e2e.cjs                         # carreira ponta a ponta no navegador (Playwright)
node tools/e2e-match.cjs                   # toque, pausa, prorrogação
node tools/e2e-pens.cjs                    # disputa de pênaltis
```

## Dados e escudos

- A lista de clubes (659), divisões de 2026, participantes dos estaduais e das copas continentais, cores e histórico de títulos foram montados a partir da **Wikipédia** e do **Wikidata** com os scripts de `tools/data/` (`step1` a `step4`). Para atualizar, rode-os em ordem e o `step4` regrava `js/data/`.
- Os **escudos** não ficam no repositório: são carregados em tempo de execução do CDN de imagens do **Transfermarkt**, pelo id do clube (obtido no Wikidata), com imagem reserva da Wikipédia e, por último, um emblema gerado com as cores do clube. O Transfermarkt não oferece API pública e bloqueia leitura automática das páginas, por isso só as imagens são usadas. Se o CDN mudar ou sair do ar, o jogo continua funcionando com os emblemas gerados.
- Nomes e escudos pertencem aos respectivos clubes; este é um projeto de fã, sem vínculo com clubes, federações, Transfermarkt ou qualquer outro jogo.

## Simplificações conhecidas

- Não há elencos nem jogadores com nome: a força do clube define a qualidade da IA, do goleiro e dos companheiros.
- As ligas europeias e a Champions correm dentro do ano-calendário do jogo (a "temporada 2026" europeia equivale a 2026-27).
- Estaduais usam um formato-padrão por número de clubes (liga + mata-mata), não o regulamento específico de cada federação; a segunda divisão estadual é representada só pela troca dos últimos colocados por clubes de divisão nacional que estejam fora.
- Países sul-americanos fora do Brasil não têm liga simulada: as vagas saem de um ranking anual por força. Copa do Nordeste, Copa Verde e Copa Sul-Sudeste não estão no jogo.
- O formato da Série C com 24/28 clubes (2027 em diante) é uma projeção, já que o regulamento ainda não foi publicado.
- Em alguns estados a Wikipédia não tinha a página de 2026; nesses casos a lista de participantes vem da edição mais recente disponível, e a contagem de títulos de poucos estados (MS, TO, RO) está incompleta.
