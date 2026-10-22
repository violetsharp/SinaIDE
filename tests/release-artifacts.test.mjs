import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sinaide-release-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const app = path.join(root, "macos/SinaIDE.app/Contents");
  fs.mkdirSync(path.join(app, "MacOS"), { recursive: true });
  fs.writeFileSync(path.join(app, "Info.plist"), "fixture plist");
  fs.writeFileSync(path.join(app, "MacOS/sinaide"), "fixture executable");
  return { root, app, archive: path.join(root, "SinaIDE.app.tar.gz") };
}
function run(f) {
  return spawnSync(
    process.execPath,
    ["scripts/archive-macos-app.mjs", path.join(f.root, "macos"), f.archive],
    { encoding: "utf8" },
  );
}
test("archives the app with the updater-required root and files", (t) => {
  const f = fixture(t);
  const result = run(f);
  assert.equal(result.status, 0, result.stderr);
  const listing = execFileSync("tar", ["-tzf", f.archive], {
    encoding: "utf8",
  });
  assert.ok(listing.includes("SinaIDE.app/Contents/MacOS/sinaide"));
});
test("refuses a DMG-only staging directory with no retained app", (t) => {
  const f = fixture(t);
  fs.rmSync(path.dirname(f.app), { recursive: true });
  assert.notEqual(run(f).status, 0);
  assert.equal(fs.existsSync(f.archive), false);
});
test("refuses an empty executable before creating an archive", (t) => {
  const f = fixture(t);
  fs.truncateSync(path.join(f.app, "MacOS/sinaide"));
  assert.notEqual(run(f).status, 0);
  assert.equal(fs.existsSync(f.archive), false);
});
test("does not overwrite a previous archive", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.archive, "previous archive");
  assert.notEqual(run(f).status, 0);
  assert.equal(fs.readFileSync(f.archive, "utf8"), "previous archive");
});
