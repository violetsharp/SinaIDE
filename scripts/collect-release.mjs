import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const [input, output, version] = process.argv.slice(2);
if (!input || !output || !/^\d+\.\d+\.\d+$/.test(version ?? ""))
  throw Error("Expected input, output, version.");
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile()) files.push(p);
  }
}
walk(input);
// A reused output directory can otherwise publish stale assets alongside a new feed.
if (fs.existsSync(output) && fs.readdirSync(output).length !== 0)
  throw Error("Release output must be empty");
function one(suffix) {
  const found = files.filter((p) => p.endsWith(suffix));
  if (found.length !== 1)
    throw Error(`Expected one ${suffix}; found ${found.length}`);
  return found[0];
}
const windows = one("-setup.exe"),
  mac = one(".app.tar.gz"),
  dmg = one(".dmg");
const url = (name) =>
  `https://github.com/loveyydoll/SinaIDE-releases/releases/download/v${version}/${encodeURIComponent(name)}`;
function platform(file) {
  const signature = fs.readFileSync(`${file}.sig`, "utf8").trim();
  if (!signature) throw Error("Missing update signature");
  return { signature, url: url(path.basename(file)) };
}
const manifest = {
  version,
  notes: fs.readFileSync("docs/RELEASE_0.5.md", "utf8"),
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": platform(windows),
    "darwin-x86_64": platform(mac),
    "darwin-aarch64": platform(mac),
  },
};
const assets = [windows, `${windows}.sig`, mac, `${mac}.sig`, dmg];
for (const file of assets) {
  if (fs.statSync(file).size === 0) throw Error(`Empty release asset: ${file}`);
}
fs.mkdirSync(output, { recursive: true });
for (const file of assets)
  fs.copyFileSync(file, path.join(output, path.basename(file)));
fs.writeFileSync(
  path.join(output, "latest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
const sums = fs
  .readdirSync(output)
  .filter((n) => n !== "SHA256SUMS.txt")
  .sort()
  .map(
    (n) =>
      `${crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(output, n)))
        .digest("hex")}  ${n}`,
  )
  .join("\n");
fs.writeFileSync(path.join(output, "SHA256SUMS.txt"), sums + "\n");
console.log(
  `Prepared ${assets.length} assets and the signed-artifact manifest for ${version}.`,
);
