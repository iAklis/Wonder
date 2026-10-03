import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const commit = "a".repeat(40);
const otherCommit = "b".repeat(40);
const nightlyTag = `nightly-${commit}`;
const release = (draft) => ({ tag_name: nightlyTag, draft, prerelease: true });

async function workflowStep(workflow, id) {
  const lines = (
    await readFile(
      new URL(`../.github/workflows/${workflow}.yml`, import.meta.url),
      "utf8",
    )
  ).split("\n");
  const step = lines.findIndex((line) => line.trim() === `id: ${id}`);
  assert.ok(step >= 0, `Missing ${id} step`);
  const start = lines.findIndex(
    (line, index) => index > step && line.trim() === "run: |",
  );
  assert.ok(start >= 0, `Missing ${id} script`);
  const indent = lines[start].indexOf("run:") + 2;
  let end = start + 1;
  while (
    end < lines.length &&
    (!lines[end].trim() || lines[end].startsWith(" ".repeat(indent)))
  )
    end++;
  return lines
    .slice(start + 1, end)
    .map((line) => line.slice(indent))
    .join("\n");
}

// Replace only the network command. Execute the workflow's real Bash and jq.
const stub = `gh() {
  printf '%s\\n' "$*" >> "$GH_CALLS"
  if [[ -n "$GH_FAIL" && "$*" == *"$GH_FAIL"* ]]; then echo 'HTTP 403 or upload failure' >&2; return 1; fi
  case "$1:$2" in
    api:*/git/ref/heads/*) printf '%s\\n' "$GH_HEAD" ;;
    api:*/commits/*)
      if [[ "$GH_MOVED" == true && -f "$GH_UPLOADED" ]]; then printf '%s\\n' '${otherCommit}'; else printf '%s\\n' "$GH_COMMIT"; fi ;;
    api:*/releases\\?*) printf '%s\\n' "$GH_PAGES" ;;
    api:*/git/matching-refs/*) printf '%s\\n' "$GH_REFS" ;;
    api:*/git/refs) printf '{}\\n' ;;
    release:upload) touch "$GH_UPLOADED" ;;
    release:create|release:edit) ;;
    *) echo "Unexpected gh command: $*" >&2; return 99 ;;
  esac
}
`;

async function runWorkflow(t, workflow, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "wonder-workflow-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const prerelease = options.prerelease !== false;
  const tag = prerelease ? nightlyTag : "v0.1.0";
  const files = {
    "chrome.zip": "chrome package",
    "firefox.zip": "firefox package",
    "release.json": JSON.stringify({
      tag,
      commit: options.wrongMetadata ? otherCommit : commit,
      dirty: false,
      ...(prerelease ? { channel: "nightly" } : {}),
    }),
  };
  const checksums =
    Object.entries(files)
      .map(
        ([name, bytes]) =>
          `${createHash("sha256").update(bytes).digest("hex")}  ${name}`,
      )
      .join("\n") + "\n";
  await Promise.all(
    Object.entries({
      ...files,
      SHA256SUMS: checksums,
      "RELEASE_NOTES.md": "Release notes",
      calls: "",
      output: "",
      summary: "",
    }).map(([name, bytes]) => writeFile(join(directory, name), bytes)),
  );
  if (options.tamper)
    await writeFile(join(directory, "chrome.zip"), "tampered");
  const result = spawnSync(
    "bash",
    [
      "-euo",
      "pipefail",
      "-c",
      stub +
        (await workflowStep(
          workflow,
          workflow === "nightly" ? "check" : "publish",
        )),
    ],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        GH_TOKEN: "test",
        GH_REPO: "owner/repository",
        BRANCH: "main",
        TAG: tag,
        COMMIT: commit,
        PRERELEASE: String(prerelease),
        GITHUB_OUTPUT: join(directory, "output"),
        GITHUB_STEP_SUMMARY: join(directory, "summary"),
        GH_CALLS: join(directory, "calls"),
        GH_UPLOADED: join(directory, "uploaded"),
        GH_HEAD: commit,
        GH_COMMIT: options.remote || commit,
        GH_MOVED: String(options.moveAfterUpload || false),
        GH_FAIL: options.failure || "",
        GH_PAGES: JSON.stringify(options.pages || [[]]),
        GH_REFS: JSON.stringify(
          options.missingTag ? [] : [{ ref: `refs/tags/${tag}` }],
        ),
      },
    },
  );
  assert.ifError(result.error);
  return {
    ...result,
    calls: (await readFile(join(directory, "calls"), "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean),
    output: await readFile(join(directory, "output"), "utf8"),
  };
}

for (const [name, options, build] of [
  ["first commit", {}, true],
  [
    "changed HEAD",
    { pages: [[{ ...release(false), tag_name: `nightly-${otherCommit}` }]] },
    true,
  ],
  ["unchanged HEAD", { pages: [[], [release(false)]] }, false],
  ["unfinished draft", { pages: [[release(true)]] }, true],
  ["API failure", { failure: "/releases?" }, null],
  [
    "moved published tag",
    { pages: [[release(false)]], remote: otherCommit },
    null,
  ],
]) {
  test(`nightly workflow: ${name}`, async (t) => {
    const result = await runWorkflow(t, "nightly", options);
    assert.equal(result.status === 0, build !== null, result.stderr);
    assert.equal(
      result.output,
      build === null ? "" : `commit=${commit}\nbuild=${build}\n`,
    );
    assert.ok(
      result.calls.every(
        (call) => call.startsWith("api ") && !call.includes("POST"),
      ),
    );
  });
}

for (const [name, options, success, actions] of [
  ["new nightly", { missingTag: true }, true, ["create", "upload", "edit"]],
  [
    "new stable release",
    { prerelease: false },
    true,
    ["create", "upload", "edit"],
  ],
  ["resume draft", { pages: [[release(true)]] }, true, ["upload", "edit"]],
  ["refuse published release", { pages: [[release(false)]] }, false, []],
  [
    "upload failure",
    { failure: "release upload" },
    false,
    ["create", "upload"],
  ],
  ["API failure", { failure: "/releases?" }, false, []],
  ["wrong metadata", { wrongMetadata: true }, false, []],
  ["bad checksum", { tamper: true }, false, []],
  ["moved tag", { remote: otherCommit }, false, []],
  [
    "tag moved during upload",
    { moveAfterUpload: true },
    false,
    ["create", "upload"],
  ],
]) {
  test(`publish workflow: ${name}`, async (t) => {
    const result = await runWorkflow(t, "publish", options);
    assert.equal(result.status === 0, success, result.stderr);
    const mutations = result.calls.filter((call) =>
      call.startsWith("release "),
    );
    assert.deepEqual(
      mutations.map((call) => call.split(" ")[1]),
      actions,
    );
    if (options.wrongMetadata || options.tamper)
      assert.equal(result.calls.length, 0);
    for (const call of mutations.filter((call) =>
      /^release (create|edit) /.test(call),
    )) {
      assert.ok(call.includes(`--prerelease=${options.prerelease !== false}`));
      assert.ok(call.includes(`--latest=${options.prerelease === false}`));
    }
    if (options.missingTag)
      assert.ok(
        result.calls.some(
          (call) =>
            call.includes("--method POST") && call.includes(`sha=${commit}`),
        ),
      );
  });
}
