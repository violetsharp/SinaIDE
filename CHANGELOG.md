# Changelog

## 0.5.1 — 2026-10-22 (pending CI and merge)

- Retain macOS app alongside DMG, validate universal executable/plist and inspect app archive before upload.
- Correct the lipo argument order found by hosted macOS CI and normalize CRLF archive listings found by hosted Windows CI. The first PR #4 run failed; neither failure is counted as a pass.
- Add archive regression tests, release-gate evidence audit, installation guidance and repository rules requiring documentation and a version bump for every completed change set.
- Publish versioned unsigned development installers from the source repository after both main-branch platform jobs pass; signed updater publication remains separately gated.
- Keep the Cargo.lock local package version synchronized in the version script.
- Validation: earlier Linux run passed 13 frontend tests, 4 archive tests and frontend-only typecheck/build. Full build was blocked by unavailable Cargo. Follow-up local test results are recorded in PR #4. Corrected Windows/macOS CI, PHP/Xdebug, installed-version upgrade and physical Mac launches remain pending.

## 0.5.0 — historical baseline

PR #3 added workspace, signed-updater foundations, debugging and saved task recipes. Detailed local claims and limitations are in docs/VERIFICATION.md; commit-specific CI evidence is in docs/RELEASE_GATE_AUDIT.md. This entry does not establish that 0.5.0 was published.
