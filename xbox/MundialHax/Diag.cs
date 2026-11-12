using System;
using System.Threading.Tasks;
using Windows.Storage;

namespace MundialHax
{
    // Registro simples de diagnóstico. Fica em LocalState\log.txt do aplicativo
    // (visível no Device Portal: File explorer -> LocalAppData -> MundialHax.Game_...).
    internal static class Diag
    {
        public static string Text = "";

        public static void Log(string line)
        {
            string row = DateTime.Now.ToString("HH:mm:ss") + "  " + line;
            lock (typeof(Diag)) { Text += row + "\n"; }
            var _ = Write(row + "\r\n");
        }

        private static async Task Write(string row)
        {
            try
            {
                var file = await ApplicationData.Current.LocalFolder.CreateFileAsync("log.txt", CreationCollisionOption.OpenIfExists);
                await FileIO.AppendTextAsync(file, row);
            }
            catch { /* o log nunca pode derrubar o aplicativo */ }
        }
    }
}
