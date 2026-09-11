import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
test("content UI, icons and Wonder localizations match the approved baseline", async () => {
  const baseline = JSON.parse(
    await readFile("tests/fixtures/ui-baseline.json", "utf8"),
  ) as Record<string, string>;
  // Locale hashes include the intentional Wonder titles and updated rule help.
  // Settings and extension popups are intentionally replaced by shadcn/ui.
  const redesigned = new Set(["options/options.html", "popup/popup.html"]);
  for (const [path, expected] of Object.entries(baseline)) {
    if (redesigned.has(path)) continue;
    let data = await readFile(`public/${path}`);
    if (path.endsWith(".html"))
      data = Buffer.from(
        data
          .toString()
          .replace(/<script\b[^>]*>.*?<\/script>/gs, "")
          .replace(/\s+/g, " "),
      );
    assert.equal(
      createHash("sha256").update(data).digest("hex"),
      expected,
      path,
    );
  }
});
