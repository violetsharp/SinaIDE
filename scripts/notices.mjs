import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
const destination = path.resolve("THIRD_PARTY_NOTICES");
await fs.mkdir(destination, { recursive: true });
const lock = JSON.parse(await fs.readFile("package-lock.json", "utf8"));
const rows = [];
for (const [directory, pkg] of Object.entries(lock.packages)) {
  if (!directory || pkg.dev || pkg.optional) continue;
  const full = path.resolve(directory);
  const name = directory.split("node_modules/").at(-1);
  const out = path.join(
    destination,
    "npm",
    `${name.replaceAll("/", "__")}-${pkg.version}`,
  );
  await fs.mkdir(out, { recursive: true });
  for (const file of await fs.readdir(full))
    if (
      /^(licen[cs]e|copying|copyright|notice|ofl|thirdpartynotices)/i.test(
        file,
      ) &&
      (await fs.stat(path.join(full, file))).isFile()
    )
      await fs.copyFile(path.join(full, file), path.join(out, file));
  rows.push({
    ecosystem: "npm",
    name,
    version: pkg.version,
    license: pkg.license ?? "See upstream notices",
  });
}
const metadata = JSON.parse(
  execFileSync(
    "cargo",
    [
      "metadata",
      "--locked",
      "--format-version",
      "1",
      "--manifest-path",
      "src-tauri/Cargo.toml",
    ],
    { maxBuffer: 30 * 1024 * 1024, encoding: "utf8", windowsHide: true },
  ),
);
for (const pkg of metadata.packages) {
  if (!pkg.source) continue;
  const root = path.dirname(pkg.manifest_path),
    out = path.join(destination, "cargo", `${pkg.name}-${pkg.version}`);
  await fs.mkdir(out, { recursive: true });
  let count = 0;
  for (const file of await fs.readdir(root))
    if (
      /^(licen[cs]e|copying|copyright|notice|ofl)/i.test(file) &&
      (await fs.stat(path.join(root, file))).isFile()
    ) {
      await fs.copyFile(path.join(root, file), path.join(out, file));
      count++;
    }
  rows.push({
    ecosystem: "cargo",
    name: pkg.name,
    version: pkg.version,
    license: pkg.license ?? pkg.license_file ?? "See upstream",
    noticeFiles: count,
  });
}
rows.sort((a, b) =>
  `${a.ecosystem}/${a.name}`.localeCompare(`${b.ecosystem}/${b.name}`),
);
await fs.writeFile(
  path.join(destination, "DEPENDENCIES.json"),
  JSON.stringify(rows, null, 2) + "\n",
);
await fs.writeFile(
  path.join(destination, "README.txt"),
  "SinaIDE third-party notices. Generated from package-lock.json and Cargo.lock. Includes direct and transitive Rust dependencies for supported targets. SinaIDE itself has not selected a project license. See DEPENDENCIES.md for the reuse register.\n",
);
console.log(
  `Preserved dependency license records and upstream notices for ${rows.length} packages.`,
);
