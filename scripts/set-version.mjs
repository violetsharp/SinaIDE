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
