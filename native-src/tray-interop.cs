using System;
using System.Drawing;
using System.Windows.Forms;

namespace HandyMonTray {
  public static class Api {
    public static void Run(string iconPath) {
      Application.EnableVisualStyles();

      var tray = new NotifyIcon();
      using (var bmp = new Bitmap(iconPath)) {
        tray.Icon = Icon.FromHandle(bmp.GetHicon());
      }
      tray.Text = "HandyMon";
      tray.Visible = true;

      var menu = new ContextMenuStrip();
      menu.Items.Add("Open UI", null, (s, e) => Console.WriteLine("OPEN_UI"));
      menu.Items.Add("Pair new device", null, (s, e) => Console.WriteLine("PAIR"));
      menu.Items.Add("Open config folder", null, (s, e) => Console.WriteLine("OPEN_CONFIG"));
      menu.Items.Add("Help", null, (s, e) => Console.WriteLine("HELP"));
      menu.Items.Add(new ToolStripSeparator());
      menu.Items.Add("Quit", null, (s, e) => { Console.WriteLine("QUIT"); Application.Exit(); });
      tray.ContextMenuStrip = menu;

      tray.MouseUp += (s, e) => {
        if (e.Button == MouseButtons.Left) Console.WriteLine("OPEN_UI");
      };

      Application.Run();

      tray.Visible = false;
      tray.Dispose();
    }
  }
}
