# Development installers

This prerelease is built by GitHub Actions after both Windows and macOS desktop checks succeed. See the attached CHANGELOG.md for changes and SHA256SUMS.txt for downloaded-file checksums.

- Windows: download the x64 `-setup.exe` and run it.
- macOS: download the universal `.dmg`, open it and drag SinaIDE into Applications. The `.app.tar.gz` is an alternate app archive.

These are unsigned development installers: no Windows publisher certificate, Apple Developer ID/notarization or cryptographic updater signature is claimed. OS warnings can appear. No unsigned updater manifest is published. Install manually; in-app updates use a separate signed distribution channel.

Passing CI proves the checks and packaging that ran, not physical Mac launch, installer upgrade/relaunch or PHP/Xdebug compatibility. See docs/RELEASE_GATE_AUDIT.md for remaining verification work.
