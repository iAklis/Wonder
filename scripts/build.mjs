import { build, context } from "esbuild";
import { cp, mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { spawn } from "node:child_process";
import { writeLicenseNotices } from "./release-licenses.mjs";
const watch = process.argv.includes("--watch");
async function buildStyles(output, watching = false) {
  const child = spawn(
    process.execPath,
    [
      "node_modules/@tailwindcss/cli/dist/index.mjs",
      "-i",
      "src/ui/styles.css",
      "-o",
      output,
      ...(watching ? ["--watch=always"] : ["--minify"]),
    ],
    { stdio: "inherit" },
  );
  if (watching) {
    process.on("exit", () => child.kill());
    return;
  }
  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Tailwind exited with ${code}`)),
    );
  });
}
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const entryPoints = {
  "background/index": "src/background/index.ts",
  "contentScript/index": "src/entries/content.js",
  "popup/popup": "src/ui/popup.tsx",
  "options/options": "src/ui/options.tsx",
};
for (const browser of ["chrome", "firefox"]) {
  const outdir = `dist/${browser}`;
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  await cp("public", outdir, { recursive: true });
  await cp("LICENSE", `${outdir}/LICENSE`);
  await cp("NOTICE.md", `${outdir}/NOTICE.md`);
  await cp("PRIVACY", `${outdir}/PRIVACY`);
  const config = structuredClone(manifest);
  if (browser === "firefox") {
    // Firefox retains a background page; Chrome uses a service worker.
    config.manifest_version = 2;
    config.background = { scripts: ["background/index.js"], persistent: true };
    config.permissions.push(...config.host_permissions);
    delete config.host_permissions;
    config.browser_action = config.action;
    delete config.action;
    delete config.minimum_chrome_version;
    config.page_action = {
      default_icon: "/icons/icon-32.png",
      default_title: "__MSG_pageActionTitle__",
      default_popup: "popup/popup.html",
    };
    config.web_accessible_resources = config.web_accessible_resources.flatMap(
      (group) => group.resources,
    );
    config.browser_specific_settings = {
      gecko_android: { strict_min_version: "142.0" },
      gecko: {
        id: "wonder@local",
        strict_min_version: "140.0",
        data_collection_permissions: { required: ["websiteContent"] },
      },
    };
  }
  await writeFile(
    `${outdir}/manifest.json`,
    JSON.stringify(config, null, 2) + "\n",
  );
  for (const file of [
    "popup/popup.html",
    "options/options.html",
  ]) {
    const path = join(outdir, file);
    await writeFile(
      path,
      (await readFile(path, "utf8")).replaceAll(
        "__WONDER_VERSION__",
        manifest.version,
      ),
    );
  }
  await mkdir(`${outdir}/ui`, { recursive: true });
  await buildStyles(`${outdir}/ui/styles.css`);
  if (watch) await buildStyles(`${outdir}/ui/styles.css`, true);
  const options = {
    entryPoints: {
      ...entryPoints,
      "background/index":
        browser === "firefox"
          ? "src/background/firefox.js"
          : "src/background/index.ts",
    },
    outdir,
    bundle: true,
    format: "iife",
    target: ["chrome120", "firefox128"],
    sourcemap: watch ? "inline" : false,
    minify: !watch,
    legalComments: "eof",
    define: {
      __FIREFOX__: String(browser === "firefox"),
      "process.env.NODE_ENV": JSON.stringify(
        watch ? "development" : "production",
      ),
    },
    logLevel: "info",
  };
  if (watch) {
    const ctx = await context(options);
    await ctx.watch();
  } else {
    const result = await build({ ...options, metafile: true });
    await writeLicenseNotices(result.metafile, outdir);
    await writeFile(
      `dist/${browser}-meta.json`,
      JSON.stringify(result.metafile, null, 2),
    );
    const zip = new JSZip();
    async function add(dir, prefix = "") {
      for (const file of await readdir(dir, { withFileTypes: true })) {
        const name = prefix + file.name;
        if (file.isDirectory()) await add(join(dir, file.name), name + "/");
        else if (!/\.map$/i.test(name))
          zip.file(name, await readFile(join(dir, file.name)));
      }
    }
    await add(outdir);
    await writeFile(
      `dist/${browser}.zip`,
      await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
    );
  }
}
