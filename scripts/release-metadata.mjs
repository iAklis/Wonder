import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const browsers = ["chrome", "firefox"];
export const digest = (data) => createHash("sha256").update(data).digest("hex");
export function validateVersion(version) {
  assert.match(
    version,
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
    "Use a stable three-part version, e.g. 0.2.0",
  );
  const parts = version.split(".").map(Number);
  assert.ok(
    parts.every((part) => part <= 65535) && parts.some(Boolean),
    "Version components must fit the extension manifest format",
  );
}
export function archiveName(metadata, browser) {
  assert.ok(browsers.includes(browser), "Unsupported browser");
  return `${metadata.packageName}-${metadata.version}-${browser}.zip`;
}
export async function readReleaseMetadata(cwd = process.cwd(), tag = "") {
  const pkg = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8"));
  const manifest = JSON.parse(
    await readFile(resolve(cwd, "manifest.json"), "utf8"),
  );
  validateVersion(pkg.version);
  assert.equal(
    manifest.version,
    pkg.version,
    "package.json and manifest.json versions must match",
  );
  const packageName = pkg.name.replace(/^@/, "").replace("/", "-");
  assert.match(
    packageName,
    /^[a-z0-9][a-z0-9._-]*$/,
    "Package name must produce a safe release filename",
  );
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
  }).trim();
  const dirty =
    execFileSync("git", ["status", "--porcelain"], {
      cwd,
      encoding: "utf8",
    }).trim() !== "";
  if (tag) {
    assert.equal(dirty, false, "Tagged releases require a clean working tree");
    assert.equal(
      tag,
      `v${pkg.version}`,
      "Release tag must equal v<package.json version>",
    );
    const taggedCommit = execFileSync(
      "git",
      ["rev-parse", `refs/tags/${tag}^{commit}`],
      { cwd, encoding: "utf8" },
    ).trim();
    assert.equal(
      taggedCommit,
      commit,
      "The release tag must point to the checked-out commit",
    );
  }
  return {
    packageName,
    version: pkg.version,
    tag: `v${pkg.version}`,
    commit,
    dirty,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const metadata = await readReleaseMetadata(
    process.cwd(),
    process.env.RELEASE_TAG || "",
  );
  console.log(
    `Release metadata verified: ${metadata.tag} (${metadata.commit})`,
  );
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      Object.entries(metadata)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(""),
    );
  }
}
