// Optional real Firefox smoke: set FIREFOX_BINARY and optionally WEB_EXT_BIN.
import { createServer } from "node:http";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
const dir = await mkdtemp("/tmp/wonder-firefox-");
await cp("dist/firefox", dir + "/extension", { recursive: true });
let resolveReport;
const report = new Promise((r) => (resolveReport = r));
const reports = {};
const server = createServer((req, res) => {
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => {
    res.end("ok");
    try {
      const value = JSON.parse(data);
      reports[value.kind] = value;
      if (Object.keys(reports).length === pages.length + 1) resolveReport(reports);
    } catch (error) {
      resolveReport({ failure: { errors: [String(error)] } });
    }
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const endpoint = `http://127.0.0.1:${server.address().port}/report`;
const manifest = JSON.parse(
  await readFile(dir + "/extension/manifest.json", "utf8"),
);
manifest.background.scripts.unshift("capture.js");
manifest.background.scripts.push("probe.js");
await writeFile(dir + "/extension/manifest.json", JSON.stringify(manifest));
await writeFile(
  dir + "/extension/capture.js",
  `globalThis.smokeErrors=[];addEventListener('error',e=>smokeErrors.push(e.error?.stack || e.message));addEventListener('unhandledrejection',e=>smokeErrors.push(e.reason?.stack || String(e.reason)));`,
);
const pages = [
  "options/options.html",
  "popup/popup.html",
];
for (const file of pages) {
  const html = await readFile(`${dir}/extension/${file}`, "utf8");
  await writeFile(
    `${dir}/extension/${file}`,
    html
      .replace(
        "<script src=",
        '<script src="/capture.js"></script><script src=',
      )
      .replace("</body>", '<script src="/ui-probe.js"></script></body>'),
  );
}
await writeFile(
  dir + "/extension/probe.js",
  `setTimeout(async()=>{let values,error;try{values=await browser.storage.local.get(null);}catch(e){error=String(e);}await fetch(${JSON.stringify(endpoint)},{method:'POST',body:JSON.stringify({kind:'background',values,error,errors:smokeErrors})});for(const page of ${JSON.stringify(pages)})await browser.tabs.create({url:browser.runtime.getURL(page),active:false});},2000);`,
);
await writeFile(
  dir + "/extension/ui-probe.js",
  `(async()=>{let rendered=false;for(let i=0;i<100;i++){if(document.querySelector('h1')){rendered=true;break;}await new Promise(r=>setTimeout(r,100));}const switches=document.querySelectorAll('[role=switch]').length;let settingSaved=false;if(location.pathname.includes('options')){const toggle=document.querySelector('[role=switch]');const before=(await browser.storage.local.get('isShowDualLanguage')).isShowDualLanguage;toggle?.click();for(let i=0;i<30;i++){if((await browser.storage.local.get('isShowDualLanguage')).isShowDualLanguage!==before){settingSaved=true;break;}await new Promise(r=>setTimeout(r,100));}}await new Promise(r=>setTimeout(r,300));await fetch(${JSON.stringify(endpoint)},{method:'POST',body:JSON.stringify({kind:location.pathname,rendered,switches,settingSaved,errors:smokeErrors})});})().catch(async error=>{await fetch(${JSON.stringify(endpoint)},{method:'POST',body:JSON.stringify({kind:location.pathname,errors:[String(error)]})});});`,
);
const bin = process.env.WEB_EXT_BIN;
const child = spawn(
  bin ? process.execPath : "web-ext",
  [
    ...(bin ? [bin] : []),
    "run",
    "--source-dir",
    dir + "/extension",
    "--firefox",
    process.env.FIREFOX_BINARY || "firefox",
    "--args=-headless",
    "--no-reload",
    "--no-input",
  ],
  { detached: true, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
child.on("error", (error) => {
  logs += String(error);
  resolveReport({ failure: { errors: [String(error)] } });
});
child.stdout.on("data", (c) => (logs += c));
child.stderr.on("data", (c) => (logs += c));
let timer;
try {
  const result = await Promise.race([
    report,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(logs + "\n" + JSON.stringify(reports))),
        45000,
      );
    }),
  ]);
  console.log(JSON.stringify(result));
  await writeFile(
    "artifacts/firefox-smoke.json",
    JSON.stringify(result, null, 2),
  );
  if (
    !result.background?.values?.targetLanguage ||
    Object.values(result).some((item) => item.error || item.errors.length) ||
    pages.some((page) => !result["/" + page]?.rendered) ||
    !result["/options/options.html"]?.settingSaved
  )
    process.exitCode = 1;
} finally {
  clearTimeout(timer);
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
  server.close();
  await new Promise((r) => setTimeout(r, 300));
  await rm(dir, { recursive: true, force: true });
}
