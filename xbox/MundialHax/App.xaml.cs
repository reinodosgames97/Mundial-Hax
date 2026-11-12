using System;
using Windows.ApplicationModel;
using Windows.ApplicationModel.Activation;
using Windows.UI;
using Windows.UI.Core;
using Windows.UI.ViewManagement;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;
using Windows.UI.Xaml.Media;
using Windows.UI.Xaml.Navigation;

namespace MundialHax
{
    sealed partial class App : Application
    {
        public App()
        {
            this.InitializeComponent();
            // No Xbox o controle não deve virar um cursor de mouse: o jogo lê o gamepad diretamente.
            this.RequiresPointerMode = ApplicationRequiresPointerMode.WhenRequested;
            this.Suspending += OnSuspending;
            // Qualquer erro não tratado aparece na tela em vez de fechar o aplicativo em silêncio.
            this.UnhandledException += (s, e) =>
            {
                e.Handled = true;
                string txt = e.Exception != null ? e.Exception.ToString() : e.Message;
                Diag.Log("ERRO NÃO TRATADO: " + txt);
                ShowFatal("Erro não tratado:\n\n" + txt);
            };
        }

        protected override void OnLaunched(LaunchActivatedEventArgs e)
        {
            try
            {
                Diag.Log("Aplicativo iniciado (versão " + Package.Current.Id.Version.Major + "." + Package.Current.Id.Version.Minor + "." + Package.Current.Id.Version.Build + ")");

                // Ocupa a tela inteira da TV (sem as bordas de segurança padrão).
                ApplicationView.GetForCurrentView().SetDesiredBoundsMode(ApplicationViewBoundsMode.UseCoreWindow);
                // O botão B é tratado pelo jogo (voltar nos menus); não deve fechar o aplicativo.
                SystemNavigationManager.GetForCurrentView().BackRequested += (s, args) => { args.Handled = true; };

                Frame rootFrame = Window.Current.Content as Frame;
                if (rootFrame == null)
                {
                    rootFrame = new Frame();
                    rootFrame.NavigationFailed += OnNavigationFailed;
                    Window.Current.Content = rootFrame;
                }

                if (e.PrelaunchActivated == false)
                {
                    if (rootFrame.Content == null)
                    {
                        rootFrame.Navigate(typeof(MainPage), e.Arguments);
                    }
                    Window.Current.Activate();
                }
            }
            catch (Exception ex)
            {
                Diag.Log("Falha na inicialização: " + ex);
                ShowFatal("Falha na inicialização:\n\n" + ex);
            }
        }

        void OnNavigationFailed(object sender, NavigationFailedEventArgs e)
        {
            Diag.Log("Falha ao carregar a página: " + e.Exception);
            ShowFatal("Falha ao carregar a página " + e.SourcePageType.FullName + ":\n\n" + e.Exception);
        }

        // Mostra um texto selecionável em tela cheia (útil para ler o erro na TV).
        internal static void ShowFatal(string text)
        {
            try
            {
                Window.Current.Content = new ScrollViewer
                {
                    Background = new SolidColorBrush(Color.FromArgb(255, 14, 21, 18)),
                    Padding = new Thickness(48),
                    Content = new TextBlock
                    {
                        Text = text,
                        FontSize = 22,
                        TextWrapping = TextWrapping.Wrap,
                        IsTextSelectionEnabled = true,
                        Foreground = new SolidColorBrush(Colors.White)
                    }
                };
                Window.Current.Activate();
            }
            catch { /* sem mais o que fazer */ }
        }

        private void OnSuspending(object sender, SuspendingEventArgs e)
        {
            var deferral = e.SuspendingOperation.GetDeferral();
            deferral.Complete();
        }
    }
}
