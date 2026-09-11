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
import { publishRelease } from "../scripts/publish-release.mjs";

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
function mockGitHub(
  metadata,
  assets,
  {
    existing = false,
    failure,
    remoteCommit = metadata.commit,
    published = false,
  } = {},
) {
  const calls = [];
  let gets = 0;
  const run = (args) => {
    calls.push(args);
    if (args[0] === "api" && args[1].includes("/commits/"))
      return JSON.stringify({ sha: remoteCommit });
    if (args[0] === "api") {
      gets++;
      assert.deepEqual(args, [
        "api",
        "repos/owner/repository/releases?per_page=100",
        "--paginate",
        "--slurp",
      ]);
      const unrelated = [{ tag_name: "v9.0.0", draft: false, assets: [] }];
      if (gets === 1 && !existing) return JSON.stringify([unrelated]);
      return JSON.stringify([
        unrelated,
        [
          {
            tag_name: metadata.tag,
            draft: !published,
            assets: failure === "incomplete" ? [] : assets,
          },
        ],
      ]);
    }
    if (args[1] === failure) throw new Error("simulated GitHub failure");
    return "";
  };
  return { run, calls };
}
async function publicationFixture(t) {
  const { root, git } = await fixture(t);
  const metadata = await prepareRelease(root, "v0.1.0");
  const directory = resolve(root, "dist/release");
  const assets = [];
  for (const name of [
    ...metadata.assets.map((asset) => asset.name),
    "SHA256SUMS",
    "release.json",
  ]) {
    const bytes = await readFile(resolve(directory, name));
    assets.push({
      name,
      size: bytes.length,
      digest: `sha256:${digest(bytes)}`,
    });
  }
  return {
    root,
    git,
    metadata,
    directory,
    assets,
    options: {
      directory,
      repo: "owner/repository",
      tag: "v0.1.0",
      commit: metadata.commit,
    },
  };
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
  const { metadata, directory } = await publicationFixture(t);
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

test("publication uploads and verifies all assets before making a new draft public", async (t) => {
  const data = await publicationFixture(t);
  const mock = mockGitHub(data.metadata, data.assets);
  await publishRelease({ ...data.options, run: mock.run });
  assert.deepEqual(
    mock.calls.filter((args) => args[0] === "release").map((args) => args[1]),
    ["create", "upload", "edit"],
  );
  assert.ok(
    mock.calls.find((args) => args[1] === "create").includes("--draft"),
  );
  assert.ok(mock.calls.at(-1).includes("--draft=false"));
});

test("publication finds a draft on a later page but never replaces an already public release", async (t) => {
  const data = await publicationFixture(t);
  const draft = mockGitHub(data.metadata, data.assets, { existing: true });
  await publishRelease({ ...data.options, run: draft.run });
  assert.equal(
    draft.calls.some((args) => args[1] === "create"),
    false,
  );
  const published = mockGitHub(data.metadata, data.assets, {
    existing: true,
    published: true,
  });
  await assert.rejects(
    publishRelease({ ...data.options, run: published.run }),
    /already published/,
  );
  assert.equal(
    published.calls.some((args) => args[0] === "release"),
    false,
  );
});

test("failed or incomplete uploads leave the release as a draft", async (t) => {
  const data = await publicationFixture(t);
  for (const failure of ["upload", "incomplete"]) {
    const mock = mockGitHub(data.metadata, data.assets, { failure });
    await assert.rejects(publishRelease({ ...data.options, run: mock.run }));
    assert.equal(
      mock.calls.some((args) => args[1] === "edit"),
      false,
    );
  }
});

test("publication rejects moved tags and tampered artifacts before any release mutation", async (t) => {
  const data = await publicationFixture(t);
  const moved = mockGitHub(data.metadata, data.assets, {
    remoteCommit: "f".repeat(40),
  });
  await assert.rejects(
    publishRelease({ ...data.options, run: moved.run }),
    /Remote tag moved/,
  );
  assert.equal(
    moved.calls.some((args) => args[0] === "release"),
    false,
  );
  await writeFile(
    resolve(data.directory, archiveName(data.metadata, "chrome")),
    "tampered",
  );
  const tampered = mockGitHub(data.metadata, data.assets);
  await assert.rejects(
    publishRelease({ ...data.options, run: tampered.run }),
    /Size mismatch/,
  );
  assert.equal(tampered.calls.length, 0);
});

test("GitHub authentication and network errors do not get mistaken for a missing release", async (t) => {
  const data = await publicationFixture(t);
  const calls = [];
  await assert.rejects(
    publishRelease({
      ...data.options,
      run: (args) => {
        calls.push(args);
        if (args[1].includes("/commits/"))
          return JSON.stringify({ sha: data.metadata.commit });
        throw new Error("HTTP 403");
      },
    }),
    /HTTP 403/,
  );
  assert.equal(
    calls.some((args) => args[0] === "release"),
    false,
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

test("a tag moved during upload leaves the release unpublished", async (t) => {
  const data = await publicationFixture(t);
  const mock = mockGitHub(data.metadata, data.assets);
  let reads = 0;
  await assert.rejects(
    publishRelease({
      ...data.options,
      run: (args) => {
        if (args[0] === "api" && args[1].includes("/commits/") && ++reads > 1)
          return JSON.stringify({ sha: "f".repeat(40) });
        return mock.run(args);
      },
    }),
    /moved during upload/,
  );
  assert.equal(
    mock.calls.some((args) => args[1] === "edit"),
    false,
  );
});
