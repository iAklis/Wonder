// Runs in the publishing job with Node built-ins only; no dependency installation.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  archiveName,
  browsers,
  digest,
  nightlyTag,
  validateVersion,
} from "./release-metadata.mjs";

export async function publishRelease({
  directory,
  repo,
  tag,
  commit,
  channel = "stable",
  run = (args) =>
    execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim(),
}) {
  assert.match(repo, /^[\w.-]+\/[\w.-]+$/, "Invalid GitHub repository");
  const metadataBytes = await readFile(resolve(directory, "release.json"));
  const metadata = JSON.parse(metadataBytes);
  assert.ok(["stable", "nightly"].includes(channel), "Invalid release channel");
  assert.equal(metadata.channel || "stable", channel);
  const nightly = channel === "nightly";
  validateVersion(metadata.version);
  assert.equal(
    metadata.dirty,
    false,
    "Cannot publish artifacts built from uncommitted changes",
  );
  assert.match(metadata.packageName, /^[a-z0-9][a-z0-9._-]*$/);
  assert.equal(tag, nightly ? nightlyTag(commit) : `v${metadata.version}`);
  assert.equal(metadata.tag, tag);
  assert.match(commit, /^[a-f0-9]{40}$/);
  assert.equal(
    metadata.commit,
    commit,
    "Artifact commit does not match the verified source",
  );
  assert.equal(metadata.assets.length, 2);
  const expected = [];
  for (const browser of browsers) {
    const name = archiveName(metadata, browser);
    const asset = metadata.assets.find((item) => item.browser === browser);
    assert.equal(asset?.name, name);
    const bytes = await readFile(resolve(directory, name));
    assert.equal(bytes.length, asset.size, `Size mismatch: ${name}`);
    assert.equal(digest(bytes), asset.sha256, `Checksum mismatch: ${name}`);
    expected.push({ name, size: bytes.length, sha256: digest(bytes) });
  }
  const checksum = await readFile(resolve(directory, "SHA256SUMS"));
  assert.equal(
    checksum.toString(),
    [
      ...expected.map((asset) => `${asset.sha256}  ${asset.name}`),
      `${digest(metadataBytes)}  release.json`,
    ].join("\n") + "\n",
  );
  expected.push(
    {
      name: "release.json",
      size: metadataBytes.length,
      sha256: digest(metadataBytes),
    },
    { name: "SHA256SUMS", size: checksum.length, sha256: digest(checksum) },
  );
  await readFile(resolve(directory, "RELEASE_NOTES.md"));
  if (nightly) {
    // Only successful verification may create a tag. A tag alone never marks
    // the nightly as published, so interrupted uploads can be retried.
    const refs = JSON.parse(
      run(["api", `repos/${repo}/git/matching-refs/tags/${tag}`]),
    );
    if (!refs.some((ref) => ref.ref === `refs/tags/${tag}`))
      run([
        "api",
        `repos/${repo}/git/refs`,
        "--method",
        "POST",
        "-f",
        `ref=refs/tags/${tag}`,
        "-f",
        `sha=${commit}`,
      ]);
  }
  const remote = JSON.parse(run(["api", `repos/${repo}/commits/${tag}`]));
  assert.equal(
    remote.sha,
    commit,
    "Remote tag moved after validation; refusing to publish",
  );
  // The releases-by-tag endpoint only finds published releases. Listing also
  // includes drafts for this job's contents:write token; paginate for older tags.
  const findRelease = () => {
    const matches = JSON.parse(
      run([
        "api",
        `repos/${repo}/releases?per_page=100`,
        "--paginate",
        "--slurp",
      ]),
    )
      .flat()
      .filter((release) => release.tag_name === tag);
    assert.ok(matches.length <= 1, "Multiple releases have the same tag");
    return matches[0];
  };
  const existing = findRelease();
  if (existing) {
    if (nightly)
      assert.equal(
        existing.prerelease,
        true,
        "Nightly tag belongs to a stable release",
      );
    assert.equal(
      existing.draft,
      true,
      "This release is already published; use a new version instead of overwriting it",
    );
  } else
    run([
      "release",
      "create",
      tag,
      "--repo",
      repo,
      "--verify-tag",
      "--draft",
      ...(nightly ? ["--prerelease", "--latest=false"] : []),
      "--title",
      tag,
      "--generate-notes",
      "--notes-file",
      resolve(directory, "RELEASE_NOTES.md"),
    ]);
  run([
    "release",
    "upload",
    tag,
    "--repo",
    repo,
    ...expected.map((asset) => resolve(directory, asset.name)),
    "--clobber",
  ]);
  const uploaded = findRelease();
  assert.ok(uploaded, "Draft release is missing after upload");
  assert.equal(
    uploaded.draft,
    true,
    "Release was published before upload verification",
  );
  for (const expectedAsset of expected) {
    const asset = uploaded.assets.find(
      (item) => item.name === expectedAsset.name,
    );
    assert.equal(
      asset?.size,
      expectedAsset.size,
      `Upload incomplete: ${expectedAsset.name}`,
    );
    if (asset.digest)
      assert.equal(
        asset.digest,
        `sha256:${expectedAsset.sha256}`,
        `Remote digest mismatch: ${expectedAsset.name}`,
      );
  }
  const currentTag = JSON.parse(run(["api", `repos/${repo}/commits/${tag}`]));
  assert.equal(
    currentTag.sha,
    commit,
    "Remote tag moved during upload; refusing to publish",
  );
  // Keep a draft if any upload or verification fails. Never expose a partial release.
  run([
    "release",
    "edit",
    tag,
    "--repo",
    repo,
    "--draft=false",
    ...(nightly ? ["--prerelease", "--latest=false"] : ["--latest"]),
  ]);
  console.log(`Published ${repo} ${tag}`);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await publishRelease({
    directory: resolve("release-assets"),
    repo: process.env.GH_REPO,
    tag: process.env.RELEASE_TAG,
    commit: process.env.RELEASE_COMMIT,
    channel: process.env.RELEASE_CHANNEL || "stable",
  });
}
