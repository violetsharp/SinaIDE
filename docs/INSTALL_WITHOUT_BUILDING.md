# Install without building

## Windows download available at the 2026-10-22 audit

[Download the prebuilt Windows artifact](https://github.com/violetsharp/SinaIDE/actions/runs/39677462641/artifacts/12383156080) while signed into GitHub. Unzip the artifact, find `SinaIDE_0.5.0_x64-setup.exe` in the extracted bundle/nsis directory and run it. No Rust, Node or local compilation is needed. The unsigned Windows job passed; the same run failed on macOS, so this is a development artifact, not a cross-platform release. Installer execution/upgrade has not been validated by this audit. Artifacts expire.

## Versioned releases going forward

Version [0.5.1 is now available](https://github.com/violetsharp/SinaIDE/releases/tag/v0.5.1): both hosted platform jobs and development publication passed. Future versions appear at [repository releases](https://github.com/violetsharp/SinaIDE/releases) after merging and passing the same checks. Download `-setup.exe` for Windows or universal `.dmg` for macOS. Do not download the automatically generated source-code archives to install the app. Use checksums from the same release to check downloaded bytes.

At this audit, the separate [signed downloads channel](https://github.com/loveyydoll/SinaIDE-releases/releases) has no published releases. Its updater feed is not a working installation path yet. Development prereleases do not enable in-app updates. OS publisher signing and notarization are not configured.

## Update priorities

1. Complete corrected platform CI and make versioned installers easy to download.
2. Add crash recovery/autosave and external-file change detection to protect editing work.
3. Verify real PHP/Xdebug and add reproducible adapter setup instructions.
4. Expand LSP navigation/editing and project diagnostics.
5. Test actual installed upgrades and physical Mac launches before claiming those workflows.

Each completed change set receives a version, dated changelog, validation evidence and a release after the platform gate passes. Failed checks leave the release pending.
