# SinaIDE 0.5 · a little room that keeps growing

SinaIDE remains your comfy personal studio: the File Garden, Workbench, Notebook, Observatory and Basement keep their existing identity.

- **Signed app updates:** background checks after startup and every four hours, download progress, signature and version verification, retry/offline states and an opt-out in World. Updates install only after you choose to continue and save or close unsaved documents. Source pushes do not execute code on your machine.
- **Debugging:** external DAP launch and attach/listen configurations, watches refreshed on pause/frame selection, debug-console evaluation, conditional/hit-count breakpoints and logpoints when the adapter supports them. Adapter verification is visible. Reverse requests cannot run a terminal command. Expressions can execute code inside your debug target.
- **Little routines:** save, load and forget up to 20 task recipes per project on this computer. Loading never starts a process. Keep secrets out of saved arguments.
- **Daily foundations:** Monaco editing, guarded saves, real filesystem/search/Git, interactive terminals, PHP/PostgreSQL tool checks, PHP server/lint presets and local web preview remain available.

## Downloads and updates

Windows: x64 setup EXE. macOS: universal DMG for Apple Silicon and Intel, macOS 12 or later. Install 0.5 manually if you have 0.2; that earlier build has no updater. After 0.5, use World’s update letterbox.

These builds carry cryptographic **updater signatures**, but have **no Windows publisher certificate and no Apple Developer ID notarization**. Operating-system install warnings remain. Do not equate an updater signature with publisher verification. Physical Mac launch and an installed-version upgrade still require validation.

Source stays private. Public binaries and the update manifest live in `loveyydoll/SinaIDE-releases`. Future automated publishing is gated until the owner configures a scoped downloads token and explicitly authorizes uploading the updater signing key to Actions. A manual signed release remains possible.

This is an early personal IDE, not completion of every roadmap item. PHP/Xdebug adapter setup is separate. Crash recovery, file watching, full LSP editing/references, freely floating objects and broader debugger compatibility remain future work.
