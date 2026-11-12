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

        public MainPage()
        {
            this.InitializeComponent();
            this.Loaded += OnLoaded;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            await Web.EnsureCoreWebView2Async();
            var core = Web.CoreWebView2;

            string folder = Path.Combine(Package.Current.InstalledLocation.Path, "www");
            core.SetVirtualHostNameToFolderMapping(Host, folder, CoreWebView2HostResourceAccessKind.Allow);

            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreBrowserAcceleratorKeysEnabled = false;
#if !DEBUG
            core.Settings.AreDevToolsEnabled = false;
#endif

            // "?tv=1" liga a margem de segurança para televisores (ver css/style.css).
            Web.Source = new Uri("https://" + Host + "/index.html?tv=1");
            Web.Focus(FocusState.Programmatic);
        }
    }
}
