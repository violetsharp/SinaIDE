# SinaIDE verification record

## 0.5 local checkpoint

On Windows x64, 13 frontend tests, 8 native tests, type checking, native format/Clippy and 12 browser checks passed. Browser tests include mocked-native update confirmation, cancellation, unsaved-document blocking, invalid-signature state and editing recovery after a failed install; these are not proof of an actual installer upgrade. Production frontend builds pass. The 11 native workflow groups also pass. A real external debugpy 1.8.22 adapter exercised launch, a conditional breakpoint, stack/scopes/variables, a watch result, console evaluation, step-over, attach/listen and disconnect against a disposable Python program. Saving/loading a task recipe also passed. No page errors were observed in that workflow. This does not validate a PHP/Xdebug adapter.

Reproduce the adapter test against a dedicated `tauri dev` window with `SINAIDE_PYTHON` pointing to Python and `SINAIDE_DEBUGPY_ADAPTER` to an installed debugpy adapter directory: `node tests/debug-smoke.mjs`. Do not run against a window containing personal documents. The adapter is an external test tool, not bundled with SinaIDE.

The first attach test used debugpy's connect configuration with a separately started stdio adapter, which is not that adapter's supported connection arrangement. Retesting with the adapter's listen configuration and a connecting debug target passed. No failure is counted as a passed test.

Update signatures are distinct from OS publisher signing. The updater key stays local; Actions publishing is gated. Windows installer build, final cross-platform CI and published-feed checks are recorded with the release artifacts when completed. An actual installed-version upgrade and physical Mac launch remain unverified.

## 0.2 baseline evidence

Recorded 2026-10-21 on Windows x64. This records actual local evidence, not every roadmap acceptance criterion.

| Check | Result |
|---|---|
| Original `npm ci` and frontend baseline build | Passed before implementation |
| `npm test` | 9 tests passed: document save snapshots, preference/argument validation, Git filenames, LSP/DAP response/error/close behavior |
| `npm run build` | Type checking and production frontend build passed; workers and local fonts bundled. Monaco's large-chunk size warning remains. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Passed |
| `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` | Passed |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 8 tests passed: traversal, Unicode atomic save, binary/size limits, external revision conflicts and protocol framing/output bounds, and Windows junction mutation/search safety |
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
- Symbolic-link/junction rename and removal are intentionally refused. Unix and Windows tests cover refusing redirected entries without altering their original target; project search also skips reparse points. Other Windows reparse-point mutation is conservatively unsupported.

Native debug connections are for development verification only. They are not enabled in installer configuration. Local test artifacts and generated dependency inventories are excluded from Git.
