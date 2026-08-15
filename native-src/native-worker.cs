using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Management;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

class Program {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint procId);

  static void Main() {
    // Output only — requests from Node are always plain-ASCII command names,
    // so there's no need to touch Console.InputEncoding (which throws under
    // a redirected/piped stdin on some .NET versions since it tries to call
    // SetConsoleCP against a handle that isn't a real console).
    Console.OutputEncoding = Encoding.UTF8;
    var serializer = new JavaScriptSerializer();
    string line;
    while ((line = Console.In.ReadLine()) != null) {
      object id = null;
      try {
        var req = (Dictionary<string, object>)serializer.DeserializeObject(line);
        id = req["id"];
        var cmd = (string)req["cmd"];
        object result;
        switch (cmd) {
          case "foreground":    result = Foreground();    break;
          case "windows":       result = Windows();       break;
          case "processUsage":  result = ProcessUsage();  break;
          default: throw new Exception("unknown command: " + cmd);
        }
        WriteResponse(serializer, id, true, result, null);
      } catch (Exception ex) {
        // One bad/failing request must not kill the loop — every other
        // pending and future request still needs an answer.
        WriteResponse(serializer, id, false, null, ex.Message);
      }
    }
  }

  static void WriteResponse(JavaScriptSerializer s, object id, bool ok, object data, string error) {
    var resp = new Dictionary<string, object> { { "id", id }, { "ok", ok } };
    if (ok) resp["data"] = data; else resp["error"] = error;
    Console.WriteLine(s.Serialize(resp));
  }

  static object Foreground() {
    IntPtr h = GetForegroundWindow();
    uint pid;
    GetWindowThreadProcessId(h, out pid);
    return new Dictionary<string, object> { { "pid", (int)pid } };
  }

  // Same semantics as the PowerShell it replaces: one row per process that
  // has a non-empty *main* window (Process.MainWindowHandle/-Title — the one
  // window Windows itself designates per process), not every top-level
  // window via EnumWindows.
  static object Windows() {
    var list = new List<object>();
    foreach (var p in Process.GetProcesses()) {
      try {
        if (p.MainWindowHandle == IntPtr.Zero) continue;
        var title = p.MainWindowTitle;
        if (string.IsNullOrEmpty(title)) continue;
        string exePath = null;
        try { exePath = p.MainModule.FileName; } catch { /* denied/exited — leave null */ }
        list.Add(new Dictionary<string, object> {
          { "pid", p.Id }, { "processName", p.ProcessName }, { "title", title }, { "path", exePath }
        });
      } catch { /* process exited mid-enumeration, or access denied — skip it */ }
    }
    return list;
  }

  static object ProcessUsage() {
    int cpuCount = 0;
    foreach (ManagementObject mo in new ManagementObjectSearcher("SELECT NumberOfLogicalProcessors FROM Win32_Processor").Get()) {
      cpuCount += Convert.ToInt32(mo["NumberOfLogicalProcessors"]);
    }
    if (cpuCount <= 0) cpuCount = 1;

    var starts = new Dictionary<int, long>();
    foreach (var p in Process.GetProcesses()) {
      try {
        if (p.StartTime != DateTime.MinValue) {
          starts[p.Id] = new DateTimeOffset(p.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds();
        }
      } catch { /* protected/system processes can throw reading StartTime — skip */ }
    }

    var list = new List<object>();
    foreach (ManagementObject mo in new ManagementObjectSearcher("SELECT IDProcess,Name,PercentProcessorTime,WorkingSet FROM Win32_PerfFormattedData_PerfProc_Process").Get()) {
      int pid = Convert.ToInt32(mo["IDProcess"]);
      if (pid == 0) continue;
      // WMI's perf-counter instance names get a "#N" suffix for duplicate process names (e.g. "chrome#3")
      string name = Regex.Replace(Convert.ToString(mo["Name"]), "#\\\\d+$", "");
      double cpu = Math.Round(Convert.ToDouble(mo["PercentProcessorTime"]) / cpuCount, 1);
      double ram = Math.Round(Convert.ToDouble(mo["WorkingSet"]) / 1048576.0);
      object startTime = starts.ContainsKey(pid) ? (object)starts[pid] : null;
      list.Add(new Dictionary<string, object> { { "pid", pid }, { "name", name }, { "cpu", cpu }, { "ram", ram }, { "startTime", startTime } });
    }
    return list;
  }
}
