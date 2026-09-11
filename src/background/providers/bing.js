import { Service } from "./service.js";
import { Utils } from "./encoding.js";
import { BingHelper } from "./bing-session.js";
const bingService = new (class extends Service {
  constructor() {
    super(
      "bing",
      "https://www.bing.com/ttranslatev3?isVertical=1",
      "POST",
      function cbTransformRequest(sourceArray) {
        return sourceArray
          .map((value) => Utils.escapeHTML(value))
          .join("<wbr>");
      },
      function cbParseResponse(response) {
        return [
          {
            text: response[0].translations[0].text,
            detectedLanguage: response[0].detectedLanguage.language,
          },
        ];
      },
      function cbTransformResponse(result, dontSortResults) {
        return [Utils.unescapeHTML(result)];
      },
      function cbGetExtraParameters(
        sourceLanguage,
        targetLanguage,
        requests
      ) {
        return `&${BingHelper.translate_IID_IG}`;
      },
      function cbGetRequestBody(sourceLanguage, targetLanguage, requests) {
        return `&fromLang=${sourceLanguage}${requests
          .map((info) => `&text=${encodeURIComponent(info.originalText)}`)
          .join("")}&to=${targetLanguage}${BingHelper.translateSid}`;
      }
    );
  }

  /**
   * @param {string[][]} sourceArray2d - Only the string `sourceArray2d[0][0]` will be translated.
   * @param {boolean} dontSortResults - This parameter is not needed in this translation service
   */
  async translate(
    sourceLanguage,
    targetLanguage,
    sourceArray2d,
    dontSaveInPersistentCache,
    dontSortResults = false
  ) {
    /** @type {{search: string, replace: string}[]} */
    const replacements = [
      {
        search: "auto",
        replace: "auto-detect",
      },
      {
        search: "zh-CN",
        replace: "zh-Hans",
      },
      {
        search: "zh-TW",
        replace: "zh-Hant",
      },
      {
        search: "tl",
        replace: "fil",
      },
      {
        search: "hmn",
        replace: "mww",
      },
      {
        search: "ckb",
        replace: "kmr",
      },
      {
        search: "mn",
        replace: "mn-Cyrl",
      },
      {
        search: "no",
        replace: "nb",
      },
      {
        search: "sr",
        replace: "sr-Cyrl",
      },
    ];
    replacements.forEach((r) => {
      if (targetLanguage === r.search) {
        targetLanguage = r.replace;
      }
      if (sourceLanguage === r.search) {
        sourceLanguage = r.replace;
      }
    });

    await BingHelper.findSID();
    if (!BingHelper.translate_IID_IG) return;

    return await super.translate(
      sourceLanguage,
      targetLanguage,
      sourceArray2d,
      dontSaveInPersistentCache,
      dontSortResults
    );
  }
})();

export { bingService };
