using System;
using System.IO;
using Microsoft.Web.WebView2.Core;
using Windows.ApplicationModel;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;

namespace MundialHax
{
    // Casca do jogo: um WebView2 em tela cheia mostrando os arquivos empacotados em "www".
    public sealed partial class MainPage : Page
    {
        // Nome de host virtual: os arquivos locais são servidos como https://mundialhax.app/...
        private const string Host = "mundialhax.app";
        private int attempt = 0;

        public MainPage()
        {
            this.InitializeComponent();
            this.Loaded += OnLoaded;
        }

        private void Say(string text)
        {
            Diag.Log(text);
            Status.Text = Diag.Text;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            try
            {
                Say("Iniciando o WebView2…");
                await Web.EnsureCoreWebView2Async();
                var core = Web.CoreWebView2;
                Say("WebView2 pronto (navegador " + CoreWebView2Environment.GetAvailableBrowserVersionString() + ").");

                core.NavigationCompleted += OnNavigationCompleted;
                core.ProcessFailed += (s, a) => Say("O processo do WebView2 falhou: " + a.ProcessFailedKind);

                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.IsZoomControlEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.AreBrowserAcceleratorKeysEnabled = false;
#if !DEBUG
                core.Settings.AreDevToolsEnabled = false;
#endif
                Navigate(core);
            }
            catch (Exception ex)
            {
                Say("Erro ao iniciar o WebView2:\n" + ex);
            }
        }

        // Tentativa 1: host virtual apontando para a pasta "www" do pacote.
        // Tentativa 2 (se a primeira falhar): esquema ms-appx-web, que lê direto do pacote.
        private void Navigate(CoreWebView2 core)
        {
            attempt++;
            try
            {
                if (attempt == 1)
                {
                    string folder = Path.Combine(Package.Current.InstalledLocation.Path, "www");
                    Say("Tentativa 1: host virtual -> " + folder + " (existe: " + Directory.Exists(folder) + ")");
                    core.SetVirtualHostNameToFolderMapping(Host, folder, CoreWebView2HostResourceAccessKind.Allow);
                    // "?tv=1" liga a margem de segurança para televisores (ver css/style.css).
                    core.Navigate("https://" + Host + "/index.html?tv=1");
                }
                else
                {
                    Say("Tentativa 2: ms-appx-web:///www/index.html");
                    core.Navigate("ms-appx-web:///www/index.html?tv=1");
                }
            }
            catch (Exception ex)
            {
                Say("Erro na tentativa " + attempt + ":\n" + ex);
                if (attempt < 2) Navigate(core);
            }
        }

        private void OnNavigationCompleted(CoreWebView2 sender, CoreWebView2NavigationCompletedEventArgs args)
        {
            if (args.IsSuccess)
            {
                Diag.Log("Página carregada (tentativa " + attempt + ").");
                Overlay.Visibility = Visibility.Collapsed;
                Web.Focus(FocusState.Programmatic);
            }
            else
            {
                Say("Falha ao carregar a página (tentativa " + attempt + "): " + args.WebErrorStatus);
                if (attempt < 2) Navigate(sender);
            }
        }
    }
}
