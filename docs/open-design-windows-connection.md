# Connect the Windows Open Design installation

The Windows app is installed, but this task runs in a separate Linux cloud
workspace. Installing the app on Windows does not register its local connection
inside the cloud machine. No Open Design generation/review is claimed here.

Open Design's plugin requires an independently registered local `open-design`
MCP server. Use the signed installation's registration command on the Windows
computer where Codex can access it:

1. Open PowerShell on Windows. Use Open Design 0.17.0 or newer.
2. If that installation supplies the `od` command, run:

   ```powershell
   od mcp install codex
   codex mcp get open-design --json
   ```

   If `od` is not on PATH, use the installation's **resolved signed packaged
   executable** with `--headless --mcp-install codex`. Obtain its actual location
   from the installed app; do not use an arbitrary executable or guessed path.
3. Confirm the second command shows the `open-design` registration. Preserve
   unrelated MCP registrations.
4. Open a Codex task on that Windows/local environment with this repository and
   the Open Design connection. Start one new task if the existing task cannot
   load newly registered tools. A Windows registration alone cannot hot-load a
   local Windows runtime into this Linux cloud task.

The app window need not stay open; its registered signed runtime can start
headlessly. Open Design Cloud remains the default design-generation mode; no
mode was switched or generation started while the connection is unavailable.
