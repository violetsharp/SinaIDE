# 0.5 release-gate audit — 2026-10-22

**Release gate remains unmet.** PR #3 was merged on 2026-10-21; it is no longer open. Audited PR head: `ff765c77bf42dfd48c0db8e04ac952aa5981ba86`. Current main at audit: `f2245230e415d87b0129b006b399563a5c7dba5d`.

## Evidence and its limits

| Area | Evidence inspected | Conclusion |
|---|---|---|
| PR-head Windows CI | [Run 39673855603](https://github.com/violetsharp/SinaIDE/actions/runs/39673855603), Windows job succeeded | Frontend tests/build, Rust fmt/Clippy/tests, browser checks and unsigned NSIS build passed on the hosted Windows runner. Installer execution is not covered. |
| PR-head macOS CI | Same run, macOS job cancelled | No completed macOS release gate for that commit. Earlier successful runs cannot substitute for this head. |
| Latest main Windows CI | [Run 39677462641](https://github.com/violetsharp/SinaIDE/actions/runs/39677462641), Windows job succeeded | Same hosted checks and unsigned installer build passed for main at audit. |
| Latest main macOS CI | Same run, macOS job failed during app preservation | Tests, frontend build, Rust checks and universal DMG build passed. Logs show Tauri cleaning `SinaIDE.app`, then `tar` failing because the app is missing. No successful artifact upload. |
| Signed-release automation | [Run 39677462441](https://github.com/violetsharp/SinaIDE/actions/runs/39677462441): gate succeeded; build and publish skipped | Green workflow status is only the disabled-publishing gate, not signed build, feed or release evidence. |
| Real workspace/PHP/PostgreSQL/terminal workflows | PR description and `VERIFICATION.md` report local Windows runs, including a disposable PHP→PostgreSQL query and PTY workflows | Recorded local evidence, not independently rerun in this audit. Hosted browser mocks do not prove native workflows. |
| DAP | Local record reports debugpy launch/attach, breakpoints, watches, evaluation and stepping | Python adapter evidence only; PHP/Xdebug remains unverified. |
| Updater | Local record reports version-bound signature verification, tamper rejection, dirty-document guards and tool shutdown | No installed-version upgrade, installation/relaunch or public-feed verification established by this audit. |
| Physical Mac | No recorded physical launch test | Apple Silicon and Intel launch, Gatekeeper behavior and usability remain unverified. Universal compilation does not establish either launch result. |
| OS publisher signing | Release documents explicitly state no publisher certificates/notarization | Updater signatures do not establish Authenticode or Developer ID/notarization. |

The source repository was publicly readable during this audit. Historical statements that source stays private are not evidence of current repository visibility.

## Repository fix

The desktop workflow now explicitly requests `dmg,app` on macOS so Tauri retains the app. Before upload, it verifies arm64 and x86_64 executable slices with `lipo`, validates the plist, and uses `scripts/archive-macos-app.mjs` to reject missing/empty required app files and inspect the completed archive. Both workflows run four archive regression tests. Test fixtures contain dummy files; they prove archive handling only.

Local audit validation is performed on Linux with Node 24. The new archive regression tests and existing frontend tests pass. The full `npm run build` stopped in dependency-notice generation because Cargo is unavailable; this is not a successful full build. A separate frontend-only build bypasses that prebuild hook, with results recorded in the follow-up PR. No native Windows/macOS build or physical-device test was run locally in this audit. The amended workflow still needs a successful hosted run; this fix alone does not close the release gate.

## Remaining acceptance work

1. Obtain successful Windows and macOS jobs, including artifact preservation, for the final release commit. Check that the unsigned installer, universal DMG and app archive are actually downloadable. Repository workflows cannot by themselves enforce branch protection; no protection setting is claimed here.
2. Exercise a real PHP/Xdebug adapter against a disposable PHP target: connection, breakpoint, stack/scopes, watch/evaluate, stepping and disconnect. Record adapter/PHP/Xdebug versions and failures.
3. On a disposable installed older updater-enabled version (not 0.2), verify download/signature/version, unsaved-edit blocking, owned-process shutdown, install, relaunch, version and settings/project preservation. Check failure/cancel paths. Signature-only and browser-mock tests do not close this item.
4. Launch the packaged app on physical Apple Silicon and Intel Macs, recording OS/architecture, install warnings, save, PHP preview and terminal behavior. Record signing/notarization accurately.
5. Before publishing, verify the feed and downloadable bytes. Keep the existing signing-key authorization gate; no secrets, certificates or publishing were configured by this audit.
