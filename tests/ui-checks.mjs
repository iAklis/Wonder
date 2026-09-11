import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** Exercise real extension UI and storage, with no provider or UI state mocks. */
export async function checkSettingsUI({ options, popup, checks }) {
  assert.equal(await options.title(), "Wonder · Settings");
  assert.equal(await popup.title(), "Wonder");
  assert.equal(await options.locator(".brand strong").innerText(), "Wonder");
  assert.equal(await popup.locator(".brand strong").innerText(), "Wonder");
  assert.equal(
    await options.evaluate(() => chrome.runtime.getManifest().name),
    "Wonder",
  );
  await options.evaluate(() => document.fonts.ready);
  assert.match(
    await options.evaluate(() => getComputedStyle(document.body).fontFamily),
    /^(?:"Noto Sans"|Noto Sans), system-ui/,
    "Settings must prefer locally installed Noto Sans, then system fonts",
  );
  assert.equal(
    await options.evaluate(() => document.fonts.size),
    0,
    "The UI must not load bundled or remote web fonts",
  );
  const stored = (key) =>
    options.evaluate(
      async (key) => (await chrome.storage.local.get(key))[key],
      key,
    );
  const waitStored = (key, expected) =>
    options.waitForFunction(
      async ({ key, expected }) =>
        JSON.stringify((await chrome.storage.local.get(key))[key]) ===
        JSON.stringify(expected),
      { key, expected },
    );
  const navigate = async (id) => {
    const link = options.locator(`.sidebar a[href="#${id}"]`);
    const title = await link.innerText();
    await link.click();
    await options
      .getByRole("heading", { name: title, exact: true, level: 1 })
      .waitFor();
  };
  const choose = async (label, value) => {
    await options.getByRole("combobox", { name: label, exact: true }).click();
    await options.getByRole("option", { name: value, exact: true }).click();
  };
  await options
    .getByRole("switch", { name: "Bilingual reading", exact: true })
    .focus();
  await options.keyboard.press("Space");
  await waitStored("isShowDualLanguage", "yes");
  await popup.waitForFunction(
    () =>
      document.querySelector("#popup-dual")?.getAttribute("aria-checked") ===
      "true",
  );
  await choose("Target language", "German");
  await waitStored("targetLanguage", "de");
  assert.deepEqual(await stored("targetLanguages"), ["de"]);
  await popup.waitForFunction(() =>
    document
      .querySelector("#selectTargetLanguage")
      ?.textContent.includes("German"),
  );
  await choose("Target language", "Chinese (Simplified)");
  await waitStored("targetLanguage", "zh-CN");
  checks.push(
    "Radix select, keyboard switch, persisted settings and cross-page sync",
  );

  await navigate("rules");
  const section = (title) =>
    options.locator("section").filter({
      has: options.getByRole("heading", { name: title, exact: true }),
    });
  const always = section("Always translate these sites");
  await always.getByRole("button", { name: "Add", exact: true }).click();
  let dialog = options.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Hostname" }).fill("bad hostname");
  await dialog.getByRole("button", { name: "Add rule", exact: true }).click();
  await dialog.getByRole("alert").waitFor();
  await dialog
    .getByRole("textbox", { name: "Hostname" })
    .fill("https://Example.com/path");
  await dialog.getByRole("button", { name: "Add rule", exact: true }).click();
  await waitStored("alwaysTranslateSites", ["example.com"]);
  await always.getByRole("button", { name: "Add", exact: true }).click();
  await options.keyboard.press("Escape");
  await options.waitForFunction(
    () => document.activeElement?.textContent === "Add",
  );
  const never = section("Never translate these sites");
  await never.getByRole("button", { name: "Add", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Hostname" }).fill("example.com");
  await dialog.getByRole("button", { name: "Add rule", exact: true }).click();
  await waitStored("neverTranslateSites", ["example.com"]);
  await waitStored("alwaysTranslateSites", []);
  await never.getByRole("button", { name: "Remove example.com" }).click();
  await waitStored("neverTranslateSites", []);
  for (const [title, key] of [
    ["Always translate these languages", "alwaysTranslateLangs"],
    ["Never translate these languages", "neverTranslateLangs"],
  ]) {
    await section(title)
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await choose("Language", "French");
    await dialog.getByRole("button", { name: "Add rule", exact: true }).click();
    await waitStored(key, ["fr"]);
  }
  await waitStored("alwaysTranslateLangs", []);
  checks.push(
    "rule validation, hostname normalization, exclusivity and dialog focus restoration",
  );

  await navigate("translations");
  await options.getByRole("button", { name: "Add term", exact: true }).click();
  await dialog
    .getByRole("textbox", { name: "Original term", exact: true })
    .fill("TypeScript");
  await dialog.getByRole("button", { name: "Add term", exact: true }).click();
  await waitStored("customDictionary", { typescript: "" });
  await dialog.waitFor({ state: "hidden" });
  await options.getByRole("button", { name: "Add term", exact: true }).click();
  await dialog
    .getByRole("textbox", { name: "Original term", exact: true })
    .fill("typescript");
  await dialog.getByRole("button", { name: "Add term", exact: true }).click();
  assert.match(await dialog.getByRole("alert").innerText(), /already exists/);
  await options.keyboard.press("Escape");
  await options.getByRole("textbox", { name: "Rule JSON" }).fill("[]");
  await options.getByRole("button", { name: "Add rule", exact: true }).click();
  await options.getByRole("alert").waitFor();
  const rule = '{"hostname":"example.org","selectors":["article"]}';
  await options.getByRole("textbox", { name: "Rule JSON" }).fill(rule);
  await options.getByRole("button", { name: "Add rule", exact: true }).click();
  await waitStored("specialRules", [rule]);
  checks.push("dictionary validation and custom JSON rule persistence");

  await navigate("appearance");
  await choose("Color mode", "Dark");
  await options.waitForFunction(() =>
    document.documentElement.classList.contains("dark"),
  );
  await popup.waitForFunction(() =>
    document.documentElement.classList.contains("dark"),
  );
  await options.setViewportSize({ width: 1440, height: 1000 });
  await choose("Bilingual style", "Highlight");
  await options
    .getByRole("textbox", { name: "Custom translation CSS" })
    .fill("color: #2563eb;");
  await options.getByRole("button", { name: "Save style" }).click();
  await waitStored("customDualStyle", "color: #2563eb;");
  await options
    .getByRole("status")
    .filter({ hasText: "Changes saved" })
    .waitFor();
  await options.screenshot({
    path: "artifacts/options-dark.png",
    fullPage: true,
  });
  await choose("Color mode", "System");
  await options.emulateMedia({ colorScheme: "dark" });
  await options.waitForFunction(() =>
    document.documentElement.classList.contains("dark"),
  );
  await options.emulateMedia({ colorScheme: "light" });
  await options.waitForFunction(
    () => !document.documentElement.classList.contains("dark"),
  );
  await options.reload();
  await options
    .getByRole("textbox", { name: "Custom translation CSS" })
    .waitFor();
  assert.equal(
    await options
      .getByRole("textbox", { name: "Custom translation CSS" })
      .inputValue(),
    "color: #2563eb;",
  );
  checks.push(
    "shared dark and system themes, explicit CSS save and reload persistence",
  );

  await options.getByRole("textbox", { name: "Find settings" }).fill("cache");
  await options
    .locator(".search-results")
    .getByRole("link", { name: /Data & backup/ })
    .click();
  const downloading = options.waitForEvent("download");
  await options.getByRole("button", { name: "Export backup" }).click();
  const download = await downloading;
  assert.match(
    download.suggestedFilename(),
    /^wonder-backup_\d{4}-\d{2}-\d{2}\.json$/,
  );
  const backup = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(backup.customDictionary.typescript, "");
  assert.equal(backup.targetLanguage, "zh-CN");
  await options.getByLabel("Backup file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("not json"),
  });
  await options.getByRole("alert").waitFor();
  await options.getByLabel("Backup file").setInputFiles({
    name: "backup.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(JSON.stringify({ targetLanguage: "de" })),
  });
  await dialog.waitFor();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await waitStored("targetLanguage", "zh-CN");
  await options
    .getByRole("button", { name: "Reset settings", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await waitStored("customDictionary", { typescript: "" });
  checks.push(
    "search navigation, real backup download, invalid import and cancellation safety",
  );

  for (const item of [
    "main",
    "appearance",
    "rules",
    "translations",
    "hotkeys",
    "others",
    "storage",
    "donation",
  ]) {
    await navigate(item);
    assert.ok((await options.locator("main").innerText()).length > 100);
  }
  await navigate("main");
  await options.screenshot({ path: "artifacts/options.png", fullPage: true });
  await options.setViewportSize({ width: 390, height: 844 });
  await options.getByRole("button", { name: "Open navigation" }).click();
  await dialog.getByRole("link", { name: "Appearance", exact: true }).click();
  await options
    .getByRole("heading", { name: "Appearance", exact: true })
    .waitFor();
  assert.equal(
    await options.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await options.screenshot({
    path: "artifacts/options-mobile.png",
    fullPage: true,
  });
  await options.setViewportSize({ width: 1440, height: 1000 });
  await navigate("main");
  checks.push(
    "all settings routes and responsive mobile navigation without horizontal overflow",
  );
}

export async function checkPopupUI({
  context,
  extensionId,
  popup,
  page,
  checks,
}) {
  const viewport = popup.viewportSize();
  await popup.locator("#selectTargetLanguage").click();
  await popup.getByRole("listbox").waitFor();
  await popup.setViewportSize({
    width: viewport.width,
    height: viewport.height - 40,
  });
  await popup.waitForFunction(
    () =>
      document
        .querySelector("#selectTargetLanguage")
        ?.getAttribute("aria-expanded") === "false",
  );
  await popup.setViewportSize(viewport);
  await popup.locator("#btnRestore").click();
  await page.waitForFunction(
    () => !document.body.innerText.includes("你好世界"),
  );
  await popup.getByRole("button", { name: "More options" }).click();
  await popup
    .getByRole("menuitem", { name: "Never translate this site" })
    .waitFor();
  await popup.keyboard.press("Escape");
  await popup.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "More options",
  );
  await popup.locator("#popup-always").click();
  await popup.waitForFunction(async () =>
    (
      await chrome.storage.local.get("alwaysTranslateSites")
    ).alwaysTranslateSites.includes("127.0.0.1"),
  );
  await popup.locator("#popup-always").click();
  await popup.waitForFunction(
    async () =>
      !(
        await chrome.storage.local.get("alwaysTranslateSites")
      ).alwaysTranslateSites.includes("127.0.0.1"),
  );
  await popup.screenshot({ path: "artifacts/popup.png" });
  const unsupported = await context.newPage();
  await unsupported.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await unsupported
    .getByRole("status")
    .filter({ hasText: "This page cannot be translated" })
    .waitFor();
  assert.equal(await unsupported.locator("#btnTranslate").isDisabled(), true);
  await unsupported.close();
  checks.push(
    "popup restore, dropdown keyboard focus, site toggle and unavailable-page state",
  );

  // Select the UI language only for a Chinese screenshot; all state remains real storage.
  const chinese = await context.newPage();
  await chinese.addInitScript(() => {
    chrome.i18n.getUILanguage = () => "zh-CN";
    chrome.i18n.getMessage = () => "";
  });
  await chinese.goto(`chrome-extension://${extensionId}/options/options.html`);
  await chinese
    .getByRole("heading", { name: "翻译偏好", exact: true })
    .waitFor();
  await chinese.setViewportSize({ width: 1440, height: 1000 });
  await chinese.screenshot({
    path: "artifacts/options-zh.png",
    fullPage: true,
  });
  await chinese.close();
}
