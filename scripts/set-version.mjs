import fs from "node:fs";
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? ""))
  throw Error("Expected a stable x.y.z version.");
for (const file of [
  "package.json",
  "package-lock.json",
  "src-tauri/tauri.conf.json",
]) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.version = version;
  if (data.packages?.[""]) data.packages[""].version = version;
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}
const cargo = "src-tauri/Cargo.toml";
fs.writeFileSync(
  cargo,
  fs
    .readFileSync(cargo, "utf8")
    .replace(/^(version = ")[^"]+/m, `$1${version}`),
);

// Keep the local package lock entry in sync without needing Cargo installed.
const cargoLock = "src-tauri/Cargo.lock";
const lock = fs.readFileSync(cargoLock, "utf8");
const updatedLock = lock.replace(
  /(\[\[package\]\]\nname = "sinaide"\nversion = ")[^"]+("\n)/,
  `$1${version}$2`,
);
if (!updatedLock.includes(`name = "sinaide"\nversion = "${version}"`))
  throw Error("Cannot locate SinaIDE's Cargo.lock package entry");
fs.writeFileSync(cargoLock, updatedLock);
