import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sinaide-collect-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = path.join(root, "input"),
    output = path.join(root, "output");
  fs.mkdirSync(input);
  for (const name of [
    "SinaIDE_0.5.2_x64-setup.exe",
    "SinaIDE.app.tar.gz",
    "SinaIDE_0.5.2_universal.dmg",
  ])
    fs.writeFileSync(path.join(input, name), "fixture bytes");
  for (const name of [
    "SinaIDE_0.5.2_x64-setup.exe.sig",
    "SinaIDE.app.tar.gz.sig",
  ])
    fs.writeFileSync(path.join(input, name), "fixture signature");
  return { input, output };
}
function run(f) {
  return spawnSync(
    process.execPath,
    ["scripts/collect-release.mjs", f.input, f.output, "0.5.2"],
    { encoding: "utf8" },
  );
}
test("collects a complete set into a new output directory", (t) => {
  const f = fixture(t),
    r = run(f);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(f.output, "latest.json"))).version,
    "0.5.2",
  );
  assert.equal(fs.readdirSync(f.output).length, 7);
});
test("rejects stale output without changing existing bytes", (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.output);
  fs.writeFileSync(path.join(f.output, "old.exe"), "preserve");
  assert.notEqual(run(f).status, 0);
  assert.deepEqual(fs.readdirSync(f.output), ["old.exe"]);
  assert.equal(
    fs.readFileSync(path.join(f.output, "old.exe"), "utf8"),
    "preserve",
  );
});
test("rejects empty installers before creating output", (t) => {
  const f = fixture(t);
  fs.truncateSync(path.join(f.input, "SinaIDE_0.5.2_x64-setup.exe"));
  assert.notEqual(run(f).status, 0);
  assert.equal(fs.existsSync(f.output), false);
});
test("missing signatures leave no partial release output", (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.input, "SinaIDE.app.tar.gz.sig"));
  assert.notEqual(run(f).status, 0);
  assert.equal(fs.existsSync(f.output), false);
});
