# Repository work and releases

- Document every change, including small fixes, styling, CI and documentation changes, in CHANGELOG.md with a date, version, purpose and validation result. Link detailed evidence when needed. Record failures and unverified coverage explicitly.
- Every completed change set must advance the version; patch bumps are the minimum even for documentation-only changes. Use `node scripts/set-version.mjs X.Y.Z` and commit all affected manifests/lockfiles. Never reuse or overwrite a published version.
- A completed change set means one reviewable PR or direct main update, not each intermediate edit. Further completed updates after a published release require a new version.
- Main pushes automatically publish an unsigned development prerelease only after both desktop matrix jobs succeed and all three expected install assets exist. A failed gate means release pending, never released.
- Keep development releases distinct from signed updater releases. Do not bypass signature verification or publish an unsigned update manifest. Retain the existing authorization requirement for uploading the private updater key.
- Include test results, remaining gaps, release status and installation links in handoffs. Never claim installer execution, hardware launch or platform testing from packaging or mocked tests alone.
