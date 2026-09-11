import { test } from "node:test";
import assert from "node:assert/strict";
import { languages } from "../src/lib/languages.js";

Object.assign(globalThis, {
  chrome: {
    i18n: {
      getUILanguage: () => "en-US",
      getMessage: (key: string) =>
        key === "msgUnknownLanguage" ? "Unknown" : "",
    },
  },
});

test("language tools preserve aliases and browser locale fallback", () => {
  for (const [input, expected] of [
    ["zh-Hans", "zh-CN"],
    ["zh-Hant", "zh-TW"],
    ["zh-HK", "zh-TW"],
    ["iw", "he"],
    ["jw", "jv"],
    ["en-US", "en"],
  ])
    assert.equal(languages.normalizeTargetLanguageCode(input), expected);
  assert.equal(languages.normalizeTargetLanguageCode("invalid"), undefined);
  assert.equal(languages.normalizeTargetLanguageCode(null), undefined);
  assert.equal(languages.normalizeUiLanguageCode("en-US"), "en");
  assert.equal(languages.getLanguageList().de, "German");
  assert.equal(languages.codeToLanguage("und"), "Unknown");
});

test("language tools keep page providers separate from text providers", () => {
  assert.equal(languages.getAlternativeService("en", "edge", true), "edge");
  assert.equal(languages.getAlternativeService("en", "bing", true), "google");
  assert.equal(languages.getAlternativeService("en", "bing", false), "bing");
  assert.equal(
    languages.getAlternativeService("en", "unknown", true),
    "google",
  );
});
