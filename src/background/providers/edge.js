import { Service } from "./service.js";

const languageAliases = {
  auto: "", und: "", zh: "zh-Hans", "zh-CN": "zh-Hans",
  "zh-TW": "zh-Hant", "zh-HK": "zh-Hant", tl: "fil", hmn: "mww",
  ku: "kmr", ckb: "ku", mn: "mn-Cyrl", no: "nb", sr: "sr-Cyrl",
};

export const edgeService = new (class extends Service {
  constructor() {
    super(
      "edge",
      "https://edge.microsoft.com/translate/translatetext",
      "POST",
      // The API accepts plain strings; HTML escaping changes literal entities.
      ([text]) => text,
      response => {
        if (!Array.isArray(response)) throw new Error("Invalid Edge translation response");
        return response.map(item => {
          const text = item?.translations?.[0]?.text;
          if (typeof text !== "string") throw new Error("Missing Edge translation text");
          return { text, detectedLanguage: item.detectedLanguage?.language };
        });
      },
      text => [text],
      (sourceLanguage, targetLanguage) => `?${new URLSearchParams({
        from: sourceLanguage, to: targetLanguage, isEnterpriseClient: "false",
      })}`,
      (_sourceLanguage, _targetLanguage, requests) => JSON.stringify(requests.map(info => info.originalText)),
    );
    this.requestContentType = "application/json";
  }

  async makeRequest(sourceLanguage, targetLanguage, requests) {
    const response = await super.makeRequest(sourceLanguage, targetLanguage, requests);
    if (!Array.isArray(response) || response.length !== requests.length) {
      throw new Error("Incomplete Edge translation response");
    }
    return response;
  }

  async translate(sourceLanguage, targetLanguage, sourceArray2d, dontSaveInPersistentCache = false) {
    // Keep each DOM text node in its own array item; translated delimiters cannot
    // merge nodes or move text into a neighbouring link. Empty nodes stay local.
    const segments = sourceArray2d.flat().filter(text => text.trim()).map(text => [text]);
    const results = await super.translate(
      languageAliases[sourceLanguage] ?? sourceLanguage,
      languageAliases[targetLanguage] ?? targetLanguage,
      segments,
      dontSaveInPersistentCache,
    );
    let index = 0;
    return sourceArray2d.map(row => row.map(text => text.trim() ? results[index++][0] : text));
  }
})();
