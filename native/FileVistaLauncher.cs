using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

class FileVistaLauncher
{
    [STAThread]
    static void Main()
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
        string electron = Path.Combine(baseDir, @"node_modules\electron\dist\electron.exe");
        string dist = Path.Combine(baseDir, @"dist\index.html");

        if (!File.Exists(electron) || !File.Exists(dist))
        {
            MessageBox.Show(
                "FileVista is not built yet.\n\nRun:\n  npm install\n  npm run build",
                "FileVista",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            return;
        }

        try
        {
            var info = new ProcessStartInfo(electron);
            info.WorkingDirectory = baseDir;
            info.Arguments = "\"" + baseDir + "\"";
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            Process.Start(info);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "Could not start FileVista:\n" + ex.Message,
                "FileVista",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }
}
