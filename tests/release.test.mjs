import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import JSZip from "jszip";
import {
  archiveName,
  digest,
  readReleaseMetadata,
  validateVersion,
} from "../scripts/release-metadata.mjs";
import {
  prepareRelease,
  validateArchive,
} from "../scripts/prepare-release.mjs";

async function fixture(t) {
  const root = await mkdtemp("/tmp/extension-release-test-");
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync(
      "git",
      [
        "-c",
        "commit.gpgsign=false",
        "-c",
        "tag.gpgsign=false",
        "-c",
        "core.hooksPath=/dev/null",
        ...args,
      ],
      {
        timeout: 10000,
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).trim();
  await writeFile(
    resolve(root, "package.json"),
    JSON.stringify({ name: "test-extension", version: "0.1.0" }),
  );
  await writeFile(
    resolve(root, "manifest.json"),
    JSON.stringify({ version: "0.1.0" }),
  );
  await writeFile(resolve(root, ".gitignore"), "dist/\n");
  git("init", "--quiet");
  git("add", ".");
  git(
    "-c",
    "user.name=Release test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  );
  git("tag", "v0.1.0");
  await mkdir(resolve(root, "dist"));
  for (const browser of ["chrome", "firefox"])
    await writeFile(
      resolve(root, `dist/${browser}.zip`),
      await archive(browser),
    );
  return { root, git };
}
async function archive(browser, mutate = () => {}) {
  const zip = new JSZip();
  zip.file(
    "manifest.json",
    JSON.stringify({
      version: "0.1.0",
      manifest_version: browser === "chrome" ? 3 : 2,
      background:
        browser === "chrome"
          ? { service_worker: "background.js" }
          : { scripts: ["background.js"] },
      icons: { 32: "icon.png" },
      content_scripts: [{ js: ["content.js"] }],
      options_ui: { page: "/options.html" },
      [browser === "chrome" ? "action" : "browser_action"]: {
        default_popup: "popup.html",
      },
    }),
  );
  for (const name of [
    "background.js",
    "content.js",
    "icon.png",
    "LICENSE",
    "NOTICE.md",
    "PRIVACY",
    "THIRD_PARTY_NOTICES.txt",
  ])
    zip.file(name, "fixture");
  for (const name of ["options.html", "popup.html"])
    zip.file(
      name,
      '<link href="/ui/styles.css"><script src="/background.js"></script>',
    );
  zip.file("ui/styles.css", "body{font-family:system-ui,sans-serif}");
  await mutate(zip);
  return zip.generateAsync({ type: "nodebuffer" });
}
async function preparationFixture(t, channel = "stable") {
  const { root } = await fixture(t);
  const metadata = await prepareRelease(
    root,
    channel === "nightly" ? "" : "v0.1.0",
    channel,
  );
  return { root, metadata, directory: resolve(root, "dist/release") };
}

test("release versions reject mismatches, prereleases, invalid components and tags at a different commit", async (t) => {
  for (const value of [
    "0.0.0",
    "01.2.3",
    "1.2",
    "1.2.3-beta.1",
    "65536.0.0",
    "v1.2.3",
  ])
    assert.throws(() => validateVersion(value));
  validateVersion("0.1.0");
  const { root, git } = await fixture(t);
  assert.equal((await readReleaseMetadata(root, "v0.1.0")).version, "0.1.0");
  await assert.rejects(readReleaseMetadata(root, "v0.2.0"), /tag must equal/);
  await writeFile(resolve(root, "manifest.json"), "{}");
  await assert.rejects(readReleaseMetadata(root), /versions must match/);
  git("checkout", "--", "manifest.json");
  git(
    "-c",
    "user.name=Release test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    "next",
  );
  await assert.rejects(
    readReleaseMetadata(root, "v0.1.0"),
    /checked-out commit/,
  );
});

test("release archives must have matching versions, browser manifests, resources and no development files", async () => {
  await validateArchive(await archive("chrome"), "chrome", "0.1.0");
  for (const file of ["PRIVACY", "THIRD_PARTY_NOTICES.txt"]) {
    await assert.rejects(
      validateArchive(
        await archive("chrome", (zip) => zip.remove(file)),
        "chrome",
        "0.1.0",
      ),
      /Missing packaged resource/,
    );
  }
  await assert.rejects(
    validateArchive(await archive("chrome"), "chrome", "0.2.0"),
    /stale version/,
  );
  await assert.rejects(
    validateArchive(await archive("chrome"), "firefox", "0.1.0"),
  );
  await assert.rejects(
    validateArchive(
      await archive("chrome", (zip) => zip.remove("ui/styles.css")),
      "chrome",
      "0.1.0",
    ),
    /Missing packaged resource/,
  );
  await assert.rejects(
    validateArchive(
      await archive("chrome", (zip) => zip.file("source.js.map", "{}")),
      "chrome",
      "0.1.0",
    ),
    /Development file/,
  );
  await assert.rejects(
    validateArchive(
      await archive("chrome", (zip) => zip.file("../outside.txt", "bad")),
      "chrome",
      "0.1.0",
    ),
    /unsafe path|Unexpected archive path/,
  );
});

test("release archives reject case-insensitive map filenames and embedded source map references", async () => {
  for (const [name, content] of [
    ["debug.JS.MAP", "{}"],
    [
      "background.js",
      "console.log('debug');\n//# sourceMappingURL=data:application/json;base64,e30=",
    ],
    [
      "background.js",
      "console.log('debug');\n//# sourceMappingURL=background.js.map",
    ],
    [
      "ui/styles.css",
      "body{color:red}/*# sourceMappingURL=data:application/json;base64,e30= */",
    ],
  ]) {
    await assert.rejects(
      validateArchive(
        await archive("chrome", (zip) => zip.file(name, content)),
        "chrome",
        "0.1.0",
      ),
      /Development file|Source map reference/,
    );
  }
});

test("preparation produces versioned archives, truthful unsigned Firefox notes and verifiable checksums", async (t) => {
  const { metadata, directory } = await preparationFixture(t);
  assert.deepEqual(
    metadata.assets.map((asset) => asset.name),
    ["test-extension-0.1.0-chrome.zip", "test-extension-0.1.0-firefox.zip"],
  );
  assert.equal(metadata.firefoxSigned, false);
  for (const line of (await readFile(resolve(directory, "SHA256SUMS"), "utf8"))
    .trim()
    .split("\n")) {
    const [hash, name] = line.split("  ");
    assert.equal(digest(await readFile(resolve(directory, name))), hash);
  }
  assert.match(
    await readFile(resolve(directory, "RELEASE_NOTES.md"), "utf8"),
    /未签名/,
  );
});

test("tagged releases reject uncommitted changes while local previews record them", async (t) => {
  const { root } = await fixture(t);
  await writeFile(resolve(root, "uncommitted.txt"), "pending");
  assert.equal((await readReleaseMetadata(root)).dirty, true);
  await assert.rejects(
    readReleaseMetadata(root, "v0.1.0"),
    /clean working tree/,
  );
});

test("nightly packaging keeps a numeric manifest version and records the source SHA", async (t) => {
  const data = await preparationFixture(t, "nightly");
  assert.equal(data.metadata.channel, "nightly");
  assert.equal(data.metadata.tag, `nightly-${data.metadata.commit}`);
  for (const browser of ["chrome", "firefox"]) {
    const name = archiveName(data.metadata, browser);
    assert.equal(
      name,
      `test-extension-0.1.0-nightly-${data.metadata.commit.slice(0, 12)}-${browser}.zip`,
    );
    await validateArchive(
      await readFile(resolve(data.directory, name)),
      browser,
      "0.1.0",
    );
  }
  await assert.rejects(
    readReleaseMetadata(data.root, "v0.1.0", "nightly"),
    /do not accept a stable release tag/,
  );
  await writeFile(resolve(data.root, "pending.txt"), "dirty");
  await assert.rejects(
    readReleaseMetadata(data.root, "", "nightly"),
    /clean working tree/,
  );
});
