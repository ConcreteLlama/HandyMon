# node.exe is a console-subsystem executable — launched directly (e.g. from a
# Scheduled Task action), Windows gives it a visible console window, and
# closing that window kills the process (unlike the old Electron build,
# which never had a console at all since Electron.exe is a GUI-subsystem
# exe). Start-Process -WindowStyle Hidden suppresses that window entirely.
# Kept as its own file (rather than an inline -Command string on the task
# action) to avoid nested command-line quoting.
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Start-Process -FilePath (Join-Path $dir "node.exe") -ArgumentList "tray-main.js" -WorkingDirectory $dir -WindowStyle Hidden
