# SinaIDE 0.2 verification record

Recorded 2026-10-21 on Windows x64. This records actual local evidence, not every roadmap acceptance criterion.

| Check | Result |
|---|---|
| Original `npm ci` and frontend baseline build | Passed before implementation |
| `npm test` | 9 tests passed: document save snapshots, preference/argument validation, Git filenames, LSP/DAP response/error/close behavior |
| `npm run build` | Type checking and production frontend build passed; workers and local fonts bundled. Monaco's large-chunk size warning remains. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Passed |
| `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` | Passed |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 7 tests passed: traversal, Unicode atomic save, binary/size limits, external revision conflicts and protocol framing/output bounds |
| `npm run test:ui` | 8 checks passed in Edge at 1440×960 and 1000×700, including reduced motion, saved atmosphere/notebook, keyboard palette, corrupt and blocked storage |
| `npm run test:desktop` | 11 real Windows desktop workflow groups passed against disposable files. No page errors. |
| `node tests/postgres-smoke.mjs` | Passed: PHP PDO query returned 42 from an isolated PostgreSQL 18 test cluster; discovered psql terminal query returned its expected result. Test cluster shut down. System php.ini unchanged. |
| `npm audit --omit=dev` | 0 known vulnerabilities at check time; DOMPurify pinned to 3.4.17 |
| `npm run tauri build -- --bundles nsis` | Passed; unsigned SinaIDE_0.2.0_x64-setup.exe produced, approximately 5.70 MiB |
| Packaged release executable | Passed real keyboard editing/Ctrl+S, native save, PHP server and isolated website preview under the release CSP. No page or console errors after correcting the IPv6 CSP source. |

The desktop suite opens a folder and a real Monaco document, saves/compares disk bytes, preserves external edits and unsaved buffers, switches documents, cancels a close prompt, checks binary/traversal guards, creates/renames/recovers Unicode paths, searches, stages/diffs/commits Git changes, runs PHP lint/server, and exercises PTY input/output/resize. It does not touch the user's PAP files.

The first sandboxed Windows atomic-save test encountered filesystem virtualization restrictions. It passed outside that virtualization, and real desktop/release save tests passed. This was not treated as a successful test until rerun.

## Boundaries

The first macOS CI run passed frontend/Rust/browser checks but exhausted Node's default heap during the repeated production frontend build inside installer packaging. The build command now gives Vite a 6 GiB maximum heap on every platform. PR workflows cover feature branches; pushes to main cover merged code, avoiding duplicate push/PR installer jobs. Consult the latest PR-head run for the corrected packaging result.

- The NSIS package was built; installer execution and upgrade/uninstall behavior have not been tested.
- macOS native compilation/packaging is delegated to the repository workflow. Physical Intel/Apple Silicon launch tests are not performed locally. Consult the workflow for the exact commit; a configured workflow is not a passing run.
- No code signing, Apple notarization or update service is configured. No public release or main-branch merge is performed automatically.
- LSP/DAP transport and failure handling have unit coverage. Actual PHP language servers/Xdebug adapters, native LLDB adapters and all other third-party tool combinations remain unverified. These are explicit configurable foundations.
- The unseen PAP's schema, framework, routing, dependencies and deployment have not been validated. PHP built-in serving and real PHP→PostgreSQL queries were checked on a test project.
- Explicit save protection does not provide crash recovery for unsaved buffers. File saves do not lock out external editors; the final compare/replace interval remains a small race.
- No free panel dragging, database administration GUI, automatic file watching, universal debugger coverage or profiler is claimed.

Native debug connections are for development verification only. They are not enabled in installer configuration. Local test artifacts and generated dependency inventories are excluded from Git.
