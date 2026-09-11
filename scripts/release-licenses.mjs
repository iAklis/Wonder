import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// Include full license texts for shipped JS, generated UI components and CSS.
export async function writeLicenseNotices(metafile, outdir) {
  const roots = new Set([
    "node_modules/shadcn",
    "node_modules/tailwindcss",
    "node_modules/tw-animate-css",
  ]);
  for (const output of Object.values(metafile.outputs)) {
    for (const [input, info] of Object.entries(output.inputs)) {
      if (!info.bytesInOutput || !input.includes("node_modules/")) continue;
      let root = dirname(input);
      while (!existsSync(join(root, "package.json"))) {
        assert.notEqual(root, ".", `Missing package metadata: ${input}`);
        root = dirname(root);
      }
      roots.add(root);
    }
  }
  const notices = new Map();
  for (const root of roots) {
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const files = (await readdir(root))
      .filter((file) => /^(?:licen[cs]e|copying|notice)(?:\.|$)/i.test(file))
      .sort();
    const texts = await Promise.all(
      files.map((file) => readFile(join(root, file), "utf8")),
    );
    // This npm tarball omits its upstream LICENSE; keep a reviewed local copy.
    if (
      pkg.name === "react-remove-scroll-bar" &&
      pkg.version === "2.3.8" &&
      !texts.length
    ) {
      texts.push(
        await readFile(
          "public/licenses/react-remove-scroll-bar-2.3.8-LICENSE.txt",
          "utf8",
        ),
      );
    }
    assert.ok(
      texts.length,
      `Missing license text for ${pkg.name}@${pkg.version}`,
    );
    notices.set(`${pkg.name}@${pkg.version}`, texts.join("\n\n"));
  }
  const text = [...notices]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, license]) => `## ${name}\n\n${license.trim()}\n`)
    .join("\n");
  await writeFile(
    join(outdir, "THIRD_PARTY_NOTICES.txt"),
    `Third-party software notices\n\n${text}`,
  );
}
