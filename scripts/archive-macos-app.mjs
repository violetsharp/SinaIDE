import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Keep app creation explicit in the Tauri --bundles list: DMG-only builds
// clean the staging .app before this step runs.
const [bundleRoot, archive] = process.argv.slice(2);
if (!bundleRoot || !archive)
  throw Error("Expected bundle root and archive path");
const { productName } = JSON.parse(
  fs.readFileSync("src-tauri/tauri.conf.json", "utf8"),
);
const app = `${productName}.app`;
const required = [
  `${app}/Contents/Info.plist`,
  `${app}/Contents/MacOS/sinaide`,
];
for (const entry of required) {
  const stat = fs.statSync(path.join(bundleRoot, entry));
  if (!stat.isFile() || stat.size === 0)
    throw Error(`Missing or empty app file: ${entry}`);
}
if (fs.existsSync(archive))
  throw Error(`Refusing to overwrite archive: ${archive}`);
try {
  execFileSync("tar", ["-czf", path.resolve(archive), "-C", bundleRoot, app]);
  const entries = new Set(
    execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).split(/\r?\n/),
  );
  for (const entry of required) {
    if (!entries.has(entry)) throw Error(`Archive is missing ${entry}`);
  }
} catch (error) {
  fs.rmSync(archive, { force: true });
  throw error;
}
console.log(
  `Verified app archive: ${archive}. This does not test application launch.`,
);
