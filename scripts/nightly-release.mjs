import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { nightlyTag } from "./release-metadata.mjs";

export async function checkNightly({
  repo,
  branch,
  run = (args) =>
    execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim(),
}) {
  assert.match(repo, /^[\w.-]+\/[\w.-]+$/, "Invalid GitHub repository");
  assert.ok(
    typeof branch === "string" && branch.length > 0,
    "Missing source branch",
  );
  const ref = JSON.parse(
    run(["api", `repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`]),
  );
  assert.equal(ref.ref, `refs/heads/${branch}`, "Unexpected source branch");
  assert.equal(
    ref.object?.type,
    "commit",
    "Source branch must point to a commit",
  );
  const commit = ref.object.sha;
  const tag = nightlyTag(commit);
  // Published releases are the durable success marker. Drafts and failed runs
  // must remain retryable, even if they have already created a tag.
  const pages = JSON.parse(
    run([
      "api",
      `repos/${repo}/releases?per_page=100`,
      "--paginate",
      "--slurp",
    ]),
  );
  assert.ok(
    Array.isArray(pages) && pages.every(Array.isArray),
    "Invalid release list response",
  );
  const matches = pages.flat().filter((release) => release.tag_name === tag);
  assert.ok(matches.length <= 1, "Multiple releases have the same nightly tag");
  const existing = matches[0];
  if (existing) {
    assert.equal(
      existing.prerelease,
      true,
      "Nightly tag belongs to a stable release",
    );
    assert.equal(
      typeof existing.draft,
      "boolean",
      "Invalid nightly release state",
    );
    if (!existing.draft) {
      const remote = JSON.parse(run(["api", `repos/${repo}/commits/${tag}`]));
      assert.equal(
        remote.sha,
        commit,
        "Published nightly tag points to a different commit",
      );
      return { build: false, commit, tag };
    }
  }
  return { build: true, commit, tag };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = await checkNightly({
    repo: process.env.GH_REPO,
    branch: process.env.NIGHTLY_BRANCH,
  });
  const summary = result.build
    ? `Nightly build required for ${result.commit}.`
    : `Skipped nightly build: ${result.commit} already has a published prerelease.`;
  console.log(summary);
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      Object.entries(result)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(""),
    );
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
