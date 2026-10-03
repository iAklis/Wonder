import { test } from "node:test";
import assert from "node:assert/strict";
import { checkNightly } from "../scripts/nightly-release.mjs";

const commit = "a".repeat(40);
const tag = `nightly-${commit}`;
const options = { repo: "owner/repository", branch: "master" };

function mockGitHub({ pages = [[]], remoteCommit = commit, failure } = {}) {
  const calls = [];
  const run = (args) => {
    calls.push(args);
    const endpoint = args[1];
    if (endpoint.includes(failure)) throw new Error("HTTP 403");
    if (endpoint.includes("/git/ref/heads/")) {
      assert.deepEqual(args, [
        "api",
        "repos/owner/repository/git/ref/heads/master",
      ]);
      return JSON.stringify({
        ref: "refs/heads/master",
        object: { type: "commit", sha: commit },
      });
    }
    if (endpoint.includes("/commits/")) {
      assert.deepEqual(args, ["api", `repos/owner/repository/commits/${tag}`]);
      return JSON.stringify({ sha: remoteCommit });
    }
    assert.deepEqual(args, [
      "api",
      "repos/owner/repository/releases?per_page=100",
      "--paginate",
      "--slurp",
    ]);
    return JSON.stringify(pages);
  };
  return { run, calls };
}

test("first nightly builds the exact source branch commit", async () => {
  const mock = mockGitHub();
  assert.deepEqual(await checkNightly({ ...options, run: mock.run }), {
    build: true,
    commit,
    tag,
  });
  assert.equal(mock.calls.length, 2);
});

test("unchanged HEAD skips when its published prerelease is found on a later page", async () => {
  const mock = mockGitHub({
    pages: [
      [{ tag_name: "v0.1.0", draft: false, prerelease: false }],
      [{ tag_name: tag, draft: false, prerelease: true }],
    ],
  });
  assert.deepEqual(await checkNightly({ ...options, run: mock.run }), {
    build: false,
    commit,
    tag,
  });
  assert.equal(mock.calls.length, 3);
});

test("changed HEAD builds even when another nightly is published", async () => {
  const mock = mockGitHub({
    pages: [
      [
        {
          tag_name: `nightly-${"b".repeat(40)}`,
          draft: false,
          prerelease: true,
        },
      ],
    ],
  });
  assert.equal((await checkNightly({ ...options, run: mock.run })).build, true);
});

test("an unfinished draft retries without treating its tag as success", async () => {
  const mock = mockGitHub({
    pages: [[{ tag_name: tag, draft: true, prerelease: true }]],
  });
  assert.equal((await checkNightly({ ...options, run: mock.run })).build, true);
  assert.equal(mock.calls.length, 2);
});

test("API failures never become a missing release or successful skip", async () => {
  for (const failure of ["/git/ref/", "/releases?", "/commits/"]) {
    const mock = mockGitHub({
      pages: [[{ tag_name: tag, draft: false, prerelease: true }]],
      failure,
    });
    await assert.rejects(
      checkNightly({ ...options, run: mock.run }),
      /HTTP 403/,
    );
  }
});

test("a published nightly tag pointing to another commit fails", async () => {
  const mock = mockGitHub({
    pages: [[{ tag_name: tag, draft: false, prerelease: true }]],
    remoteCommit: "b".repeat(40),
  });
  await assert.rejects(
    checkNightly({ ...options, run: mock.run }),
    /different commit/,
  );
});

test("conflicting or malformed matching releases fail instead of building", async () => {
  for (const [pages, message] of [
    [[[{ tag_name: tag, draft: false, prerelease: false }]], /stable release/],
    [[[{ tag_name: tag, prerelease: true }]], /Invalid nightly release state/],
    [
      [
        [
          { tag_name: tag, draft: false, prerelease: true },
          { tag_name: tag, draft: true, prerelease: true },
        ],
      ],
      /Multiple releases/,
    ],
    [{ message: "API error" }, /Invalid release list response/],
  ]) {
    const mock = mockGitHub({ pages });
    await assert.rejects(checkNightly({ ...options, run: mock.run }), message);
  }
});
