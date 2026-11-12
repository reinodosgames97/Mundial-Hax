# Mundial Hax no Xbox (UWP, modo desenvolvedor)

Este projeto é uma casca UWP em C# com um **WebView2** em tela cheia. Ele empacota os arquivos do jogo (`index.html`, `css/`, `js/`) que estão na raiz do repositório e os mostra dentro do aplicativo. O controle funciona direto: o jogo lê o gamepad (menus e partida) e o botão B não fecha o aplicativo.

> **Aviso:** o projeto foi escrito sem um Windows à mão, então **ainda não foi compilado nem testado em um console**. O jogo em si foi testado com um controle simulado no navegador (menus e partida). Se o Visual Studio reclamar de algo no `.csproj`, use o "Plano B" abaixo, que recria o projeto pelo assistente e só copia quatro arquivos.

## O que você precisa

- Um PC com Windows 10/11 e **Visual Studio 2022** com a carga de trabalho *Desenvolvimento para a Plataforma Universal do Windows*.
- O Xbox Series S em **modo desenvolvedor** (aplicativo *Dev Home* / *Xbox Dev Mode*), na mesma rede do PC.

## Passo a passo

1. Clone o repositório no PC e abra `xbox/MundialHax.sln` no Visual Studio. Aguarde a restauração dos pacotes NuGet (`Microsoft.UI.Xaml`, que traz o WebView2).
2. Na barra de ferramentas, escolha **Debug** (ou Release) e **x64**.
3. No destino de depuração, troque *Máquina Local* por **Computador Remoto**. Em *Propriedades do projeto → Depurar*, informe o **IP do Xbox** (aparece no Dev Home) e autenticação **Universal (Protocolo Não Criptografado)**.
4. Pressione **F5**. Na primeira vez o Visual Studio pede o **PIN de pareamento**: no Xbox, Dev Home → *Show Visual Studio pin*.
5. O jogo instala e abre no console. Depois disso ele fica na lista de jogos e aplicativos do modo desenvolvedor e abre sem o PC.

Para testar antes no próprio PC, use *Máquina Local* e F5 com um controle conectado.

### Alternativa: instalar pelo Device Portal

*Projeto → Publicar → Criar Pacotes de Aplicativo → Sideload*. O assistente gera um `.msix`/`.appx` assinado com um certificado de teste. No navegador do PC, abra o **Device Portal** do Xbox (endereço mostrado no Dev Home), vá em *My games & apps → Add* e envie o pacote (e as dependências da pasta `Dependencies/x64`).

## Controles

| Ação | Controle |
| --- | --- |
| Mover | Analógico esquerdo ou direcional |
| Passe (segure para passe alto) / trocar de jogador sem a bola | A |
| Chute (segure para dar força) / bote sem a bola | X ou B |
| Correr | RT (ou RB) |
| Trocar de jogador | LB (ou Y) |
| Pausar | Menu (Start) |
| Menus | Direcional navega, A confirma, B volta, LB/RB trocam de aba |

## Plano B (se o projeto não abrir)

1. No Visual Studio: *Novo projeto → Aplicativo em Branco (Universal do Windows) C#*, nome `MundialHax`.
2. *Gerenciar Pacotes NuGet* → instale **Microsoft.UI.Xaml** (2.8 ou mais novo).
3. Substitua `App.xaml`, `App.xaml.cs`, `MainPage.xaml` e `MainPage.xaml.cs` pelos desta pasta.
4. Crie no projeto uma pasta `www` e copie para ela `index.html`, `icon.svg`, `css/` e `js/` da raiz do repositório. Selecione os arquivos e marque *Ação de Compilação = Conteúdo*.
5. No `Package.appxmanifest`, deixe marcada a capacidade *Internet (Cliente)* (usada só para baixar os escudos).

## Notas

- O jogo salva o progresso no armazenamento do WebView2 dentro do aplicativo; desinstalar o aplicativo apaga o save.
- Os escudos são baixados da internet; sem conexão aparecem os emblemas com as cores do clube.
- Sem pacote nenhum, também dá para jogar abrindo o endereço do GitHub Pages no **Microsoft Edge do Xbox**: o jogo reconhece o controle da mesma forma.
