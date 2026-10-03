import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import {
  archiveName,
  browsers,
  digest,
  readReleaseMetadata,
} from "./release-metadata.mjs";

export async function validateArchive(bytes, browser, version) {
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  for (const [name, entry] of Object.entries(zip.files)) {
    assert.equal(
      entry.unsafeOriginalName || name,
      name,
      "Archive contains an unsafe path",
    );
    assert.ok(
      !name.startsWith("/") &&
        !name
          .split("/")
          .some((part) => ["..", ".git", "node_modules"].includes(part)),
      `Unexpected archive path: ${name}`,
    );
    assert.ok(
      !/\.map$|(?:^|\/)\.env(?:\.|$)/i.test(name),
      `Development file in archive: ${name}`,
    );
    if (!entry.dir && /\.(?:[cm]?js|css|html)$/i.test(name)) {
      const source = await entry.async("string");
      assert.ok(
        !/(?:\/\/[#@]|\/\*[#@])\s*sourceMappingURL\s*=/i.test(source),
        `Source map reference in archive: ${name}`,
      );
    }
  }
  const requireFile = (name, from = "") => {
    const local = posix.normalize(
      posix.join(posix.dirname(from || "."), name.replace(/^\//, "")),
    );
    const path = name.startsWith("/") ? name.slice(1) : local;
    assert.ok(zip.file(path), `Missing packaged resource: ${path}`);
    return zip.file(path);
  };
  const manifest = JSON.parse(
    await requireFile("manifest.json").async("string"),
  );
  assert.equal(
    manifest.version,
    version,
    `${browser} archive has a stale version`,
  );
  assert.equal(manifest.manifest_version, browser === "chrome" ? 3 : 2);
  const background =
    browser === "chrome"
      ? [manifest.background.service_worker]
      : manifest.background.scripts;
  const pages = [
    manifest.options_ui.page,
    (manifest.action || manifest.browser_action).default_popup,
  ];
  if (manifest.page_action?.default_popup)
    pages.push(manifest.page_action.default_popup);
  for (const file of [
    ...background,
    ...Object.values(manifest.icons),
    ...manifest.content_scripts.flatMap((item) => [
      ...(item.js || []),
      ...(item.css || []),
    ]),
    "LICENSE",
    "NOTICE.md",
    "PRIVACY",
    "THIRD_PARTY_NOTICES.txt",
  ])
    requireFile(file);
  for (const page of new Set(pages)) {
    const html = await requireFile(page).async("string");
    for (const match of html.matchAll(
      /<(?:script|link)\b[^>]*?(?:src|href)=["']([^"']+)["']/g,
    ))
      requireFile(match[1], page.replace(/^\//, ""));
  }
  const css = await requireFile("ui/styles.css").async("string");
  for (const match of css.matchAll(/url\(["']?([^\s)"']+)["']?\)/g)) {
    if (!match[1].startsWith("data:")) requireFile(match[1], "ui/styles.css");
  }
  return manifest;
}
export async function prepareRelease(
  cwd = process.cwd(),
  tag = "",
  channel = "stable",
) {
  const metadata = await readReleaseMetadata(cwd, tag, channel);
  // Validate both packages before replacing any previous prepared output.
  const packages = await Promise.all(
    browsers.map(async (browser) => {
      const bytes = await readFile(resolve(cwd, `dist/${browser}.zip`));
      await validateArchive(bytes, browser, metadata.version);
      return { browser, bytes, name: archiveName(metadata, browser) };
    }),
  );
  const output = resolve(cwd, "dist/release");
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const assets = [];
  for (const { browser, bytes, name } of packages) {
    await writeFile(resolve(output, name), bytes);
    assets.push({ browser, name, size: bytes.length, sha256: digest(bytes) });
  }
  const release = { ...metadata, assets, firefoxSigned: false };
  const releaseJSON = Buffer.from(JSON.stringify(release, null, 2) + "\n");
  await writeFile(resolve(output, "release.json"), releaseJSON);
  const checksum =
    [
      ...assets.map((asset) => `${asset.sha256}  ${asset.name}`),
      `${digest(releaseJSON)}  release.json`,
    ].join("\n") + "\n";
  await writeFile(resolve(output, "SHA256SUMS"), checksum);
  await writeFile(
    resolve(output, "RELEASE_NOTES.md"),
    `## 扩展下载\n\n- Chrome / Edge：下载 \`${archiveName(metadata, "chrome")}\`，解压后在扩展管理页选择“加载已解压的扩展程序”。\n- Firefox：\`${archiveName(metadata, "firefox")}\` 是未签名构建。解压后可在 \`about:debugging\` 临时加载 \`manifest.json\`；长期安装需要 Mozilla 签名。\n- 下载 ZIP、\`release.json\` 和 \`SHA256SUMS\` 后可使用 \`sha256sum -c SHA256SUMS\`（macOS：\`shasum -a 256 -c SHA256SUMS\`）校验。\n\n版本：${metadata.tag}；源码提交：${metadata.commit}。\n\n`,
  );
  console.log(
    `Prepared ${metadata.tag}: ${assets.map((asset) => asset.name).join(", ")}`,
  );
  return release;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await prepareRelease(
    process.cwd(),
    process.env.RELEASE_TAG || "",
    process.env.RELEASE_CHANNEL || "stable",
  );
}
