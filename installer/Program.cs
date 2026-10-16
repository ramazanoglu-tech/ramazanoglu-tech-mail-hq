namespace RamazanogluTech.Installer;

internal static class Program
{
    [STAThread]
    static void Main()
    {
        try
        {
            ApplicationConfiguration.Initialize();
            Application.Run(new InstallerForm());
        }
        catch (Exception ex)
        {
            string logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "installer_debug.log");
            File.WriteAllText(logPath, ex.ToString());
            MessageBox.Show(ex.ToString(), "Ramazanoglu Tech Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
