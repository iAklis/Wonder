import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { checkSettingsUI, checkPopupUI } from "./ui-checks.mjs";
import { checkActionPopup } from "./action-popup.mjs";
const fixture = `<!doctype html><html lang="en"><head><title>Translation fixture</title><style>body{font:18px/1.7 system-ui;margin:40px auto;max-width:760px} nav{font-size:14px} p{margin:24px 0}</style></head><body><nav>Navigation <a href="/next">Next article</a></nav><article><h1>Learning across languages</h1><p id="first">Hello world. This is a long paragraph about reading foreign languages and understanding new ideas.</p><p id="second">A second paragraph contains <a href="https://example.com">a useful link</a> and <strong>important words</strong> in the same sentence.</p><pre id="code">const example = 42;</pre><p class="notranslate" id="ignored">Keep this protected paragraph unchanged.</p><input value="User input must be preserved"></article></body></html>`;
const server = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(fixture);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/article`;
const profile = await mkdtemp(`${tmpdir()}/wonder-e2e-`);
await mkdir("artifacts", { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  args: [
    `--disable-extensions-except=${resolve("dist/chrome")}`,
    `--load-extension=${resolve("dist/chrome")}`,
  ],
  viewport: { width: 1000, height: 900 },
});
const errors = [];
const checks = [];
context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const extensionId = new URL(worker.url()).host;
  await worker.evaluate(async () => {
    while (!(await chrome.storage.local.get("hotkeys")).hotkeys)
      await new Promise((r) => setTimeout(r, 10));
    await chrome.storage.local.set({
      targetLanguages: ["zh-CN"],
      targetLanguage: "zh-CN",
      targetLanguageTextTranslation: "zh-CN",
      alwaysTranslateLangs: [],
      alwaysTranslateSites: [],
      translateTag_pre: "no",
    });
  });
  async function mockProvider(worker) {
    await worker.evaluate(() => {
      const nativeFetch = globalThis.fetch;
      globalThis.providerRequests = [];
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        if (url.startsWith("https://edge.microsoft.com/translate/translatetext")) {
          globalThis.providerRequests.push(String(init?.body));
          return Response.json(JSON.parse(init.body).map(text => ({
            translations: [{text: text
              .replace(/Hello world/g, "Edge 你好世界")
              .replace(/a useful link/g, "Edge 有用链接")
              .replace(/important words/g, "Edge 重要文字")}],
          })));
        }
        if (!url.startsWith("https://translate.googleapis.com/"))
          return nativeFetch(input, init);
        globalThis.providerRequests.push(String(init?.body));
        if (globalThis.failNextTranslation) {
          globalThis.failNextTranslation = false;
          return new Response("retry", { status: 503 });
        }
        const texts = new URLSearchParams(init?.body).getAll("q");
        return Response.json(
          texts.map((text) => [
            text
              .replace(/Hello world/g, "你好世界")
              .replace(/This is a long paragraph/g, "这是一段长文字")
              .replace(/A second paragraph/g, "第二段文字")
              .replace(/Dynamic paragraph/g, "动态段落")
              .replace(/Learning across languages/g, "跨语言学习"),
            "en",
          ]),
        );
      };
    });
  }
  await mockProvider(worker);
  const page = await context.newPage();
  await page.goto(url);
  const tabId = await worker.evaluate(
    async (url) => (await chrome.tabs.query({})).find((t) => t.url === url)?.id,
    url,
  );
  assert.equal(typeof tabId, "number");
  async function command(action, fields = {}) {
    return worker.evaluate(
      async ({ id, action, fields }) =>
        chrome.tabs.sendMessage(id, { action, ...fields }, { frameId: 0 }),
      { id: tabId, action, fields },
    );
  }
  await page.waitForTimeout(500);
  assert.equal(await command("getCurrentPageLanguageState"), "original");
  checks.push("content startup and URL messaging");
  const original = await page.locator("article").innerHTML();
  await command("translatePage", { targetLanguage: "zh-CN" });
  await page.waitForFunction(
    () => document.body.innerText.includes("你好世界"),
    { timeout: 15000 },
  );
  assert.match(await page.locator("body").innerText(), /Hello world/);
  assert.equal(
    await page.locator("#ignored").innerText(),
    "Keep this protected paragraph unchanged.",
  );
  assert.ok(
    (await page.locator("#code").allInnerTexts()).every(
      (text) => text === "const example = 42;",
    ),
  );
  assert.equal(
    await page.locator("input").inputValue(),
    "User input must be preserved",
  );
  checks.push("bilingual paragraphs, inline links, code and protected content");
  await page.screenshot({ path: "artifacts/bilingual.png", fullPage: true });
  await command("restorePage");
  assert.equal(
    (await page.locator("article").innerHTML()).replaceAll(' style=""', ""),
    original,
  );
  checks.push("DOM and original text restoration");
  await command("swapTranslationService");
  await command("translatePage", { targetLanguage: "zh-CN" });
  await page.waitForFunction(() => document.body.innerText.includes("Edge 你好世界"));
  assert.equal((await page.locator('#second a').last().innerText()).trim(), "Edge 有用链接");
  assert.equal(await page.locator('#second a').last().getAttribute('href'), "https://example.com");
  assert.equal((await page.locator('#second strong').last().innerText()).trim(), "Edge 重要文字");
  await command("restorePage");
  assert.equal(
    (await page.locator("article").innerHTML()).replaceAll(' style=""', ""),
    original,
  );
  await command("swapTranslationService");
  checks.push("Edge translation preserves inline links, emphasis and original DOM restoration");
  await command("translatePage", { targetLanguage: "zh-CN" });
  await page.waitForFunction(() =>
    document.body.innerText.includes("你好世界"),
  );
  await page.evaluate(() => {
    const p = document.createElement("p");
    p.textContent =
      "Dynamic paragraph describing a newly loaded article with enough words to be translated.";
    document.querySelector("article").append(p);
  });
  await page.waitForFunction(
    () => document.body.innerText.includes("动态段落"),
    { timeout: 15000 },
  );
  checks.push("dynamic content translation");
  await worker.evaluate(() =>
    chrome.storage.local.set({ isShowDualLanguage: "no" }),
  );
  await page.waitForTimeout(150);
  await command("refresh-dual-language");
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("你好世界") &&
      !document.body.innerText.includes("Hello world"),
  );
  checks.push("translation-only display");
  await command("restorePage");
  // Popup remains a real extension document. Point its active-tab lookup to the article,
  // because a test tab is not the native action popup and would otherwise select itself.
  const popup = await context.newPage();
  await popup.addInitScript((id) => {
    const query = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (options, callback) => {
      if (options.active) {
        if (callback) {
          chrome.tabs.get(id, (tab) => callback([tab]));
          return;
        }
        return chrome.tabs.get(id).then((tab) => [tab]);
      }
      return query(options, callback);
    };
  }, tabId);
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await popup.locator("#selectTargetLanguage").waitFor();
  assert.match(
    await popup.locator("#selectTargetLanguage").innerText(),
    /Chinese|中文|简体/,
  );
  await popup.waitForFunction(
    () => !document.querySelector("#btnTranslate")?.disabled,
  );
  await popup.setViewportSize({ width: 380, height: 600 });
  await popup.screenshot({ path: "artifacts/popup.png" });
  await popup.locator("#btnTranslate").click();
  await page.waitForFunction(() =>
    document.body.innerText.includes("你好世界"),
  );
  checks.push("popup target language and translate action");
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options/options.html`);
  await options
    .getByRole("heading", { name: "Translation", exact: true })
    .waitFor();
  assert.ok((await options.locator("body").innerText()).length > 200);
  await options.screenshot({ path: "artifacts/options.png", fullPage: true });
  checks.push("options page renders");
  await checkSettingsUI({ options, popup, checks });
  // Persistent cache is exercised without the remote provider on a second request.
  const cached = await options.evaluate(async () =>
    chrome.runtime.sendMessage({ action: "getCacheSize" }),
  );
  assert.notEqual(cached, "0 B");
  checks.push("persistent translation cache");
  // Stop and reawaken the service worker using Chrome's own lifecycle.
  const internals = await context.newPage();
  await internals.goto("chrome://serviceworker-internals");
  const registration = internals
    .locator(".serviceworker-item")
    .filter({ hasText: extensionId });
  await registration.locator('[data-command="stop"]').click();
  await internals.waitForFunction(
    (id) =>
      [...document.querySelectorAll(".serviceworker-item")].some(
        (el) =>
          el.textContent.includes(id) &&
          el.querySelector(".serviceworker-running-status .value")
            ?.textContent === "STOPPED",
      ),
    extensionId,
  );
  // Playwright reuses its Worker object when Chrome restarts the same registration.
  // Observe the real STOPPED -> RUNNING transition and a response from the new runtime.
  const cacheAfterWake = await options.evaluate(() =>
    chrome.runtime.sendMessage({ action: "getCacheSize" }),
  );
  assert.notEqual(cacheAfterWake, "0 B");
  await internals.waitForFunction(
    (id) =>
      [...document.querySelectorAll(".serviceworker-item")].some(
        (el) =>
          el.textContent.includes(id) &&
          el.querySelector(".serviceworker-running-status .value")
            ?.textContent === "RUNNING",
      ),
    extensionId,
  );
  const restoredState = await options.evaluate(
    (id) => chrome.storage.session.get(`tab:${id}`),
    tabId,
  );
  assert.ok(restoredState[`tab:${tabId}`]);
  const language = await options.evaluate(
    (id) =>
      chrome.tabs.sendMessage(
        id,
        { action: "getCurrentPageLanguageState" },
        { frameId: 0 },
      ),
    tabId,
  );
  assert.equal(language, "translated");
  assert.notEqual(
    await options.evaluate(() =>
      chrome.runtime.sendMessage({ action: "getCacheSize" }),
    ),
    "0 B",
  );
  checks.push("service worker stop, wake, session state and persistent cache");
  await checkPopupUI({
    context,
    extensionId,
    popup,
    page,
    checks,
  });
  await checkActionPopup({ context, page, extensionId, checks });
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/browser-results.json",
    JSON.stringify(
      {
        checks,
        errors,
        provider:
          "deterministic Google and Edge protocol fixtures; no live translation traffic",
      },
      null,
      2,
    ),
  );
  console.log(`PASS ${checks.length} browser checks: ${checks.join("; ")}`);
} catch (error) {
  console.error("Page errors:", errors);
  for (const p of context.pages()) {
    console.error(
      p.url(),
      (
        await p
          .locator("body")
          .innerText()
          .catch(() => "")
      ).slice(0, 500),
    );
    if (p.url().includes("popup"))
      await p.screenshot({ path: "artifacts/popup-failure.png" });
  }
  throw error;
} finally {
  await context.close();
  server.close();
  await rm(profile, { recursive: true, force: true });
}
