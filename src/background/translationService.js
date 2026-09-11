import { languages } from '../lib/languages.js';
import { googleService } from './providers/google.js';
import { edgeService } from './providers/edge.js';
import { bingService } from './providers/bing.js';
import { deeplService } from './providers/deepl.js';
export const translationService = {};
/** @type {Map<string, Service>} */
const serviceList = new Map();

serviceList.set("google", googleService);
serviceList.set("edge", edgeService);
serviceList.set("bing", bingService);
serviceList.set(
  "deepl",
  /** @type {Service} */ /** @type {?} */ (deeplService)
);

translationService.translateHTML = async (
  serviceName,
  sourceLanguage,
  targetLanguage,
  sourceArray2d,
  dontSaveInPersistentCache = false,
  dontSortResults = false
) => {
  serviceName = languages.getAlternativeService(
    targetLanguage,
    serviceName,
    true
  );
  const service = serviceList.get(serviceName) || serviceList.get("google");
  return await service.translate(
    sourceLanguage,
    targetLanguage,
    sourceArray2d,
    dontSaveInPersistentCache,
    dontSortResults
  );
};

translationService.translateText = async (
  serviceName,
  sourceLanguage,
  targetLanguage,
  sourceArray,
  dontSaveInPersistentCache = false
) => {
  serviceName = languages.getAlternativeService(
    targetLanguage,
    serviceName,
    false
  );
  const service = serviceList.get(serviceName) || serviceList.get("google");
  return (
    await service.translate(
      sourceLanguage,
      targetLanguage,
      [sourceArray],
      dontSaveInPersistentCache
    )
  )[0];
};

translationService.translateSingleText = async (
  serviceName,
  sourceLanguage,
  targetLanguage,
  originalText,
  dontSaveInPersistentCache = false
) => {
  serviceName = languages.getAlternativeService(
    targetLanguage,
    serviceName,
    false
  );
  const service = serviceList.get(serviceName) || serviceList.get("google");
  return (
    await service.translate(
      sourceLanguage,
      targetLanguage,
      [[originalText]],
      dontSaveInPersistentCache
    )
  )[0][0];
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // If the translation request came from an incognito window, the translation should not be cached on disk.
  const dontSaveInPersistentCache = sender.tab ? sender.tab.incognito : false;
  if (request?.action === "translateHTML") {
    translationService
      .translateHTML(
        request.translationService,
        "auto",
        request.targetLanguage,
        request.sourceArray2d,
        dontSaveInPersistentCache,
        request.dontSortResults
      )
      .then((results) => sendResponse(results))
      .catch((e) => {
        sendResponse();
        console.error(e);
      });

    return true;
  } else if (request?.action === "translateText") {
    translationService
      .translateText(
        request.translationService,
        "auto",
        request.targetLanguage,
        request.sourceArray,
        dontSaveInPersistentCache
      )
      .then((results) => sendResponse(results))
      .catch((e) => {
        sendResponse();
        console.error(e);
      });

    return true;
  } else if (request?.action === "translateSingleText") {
    translationService
      .translateSingleText(
        request.translationService,
        "auto",
        request.targetLanguage,
        request.source,
        dontSaveInPersistentCache
      )
      .then((results) => sendResponse(results))
      .catch((e) => {
        sendResponse();
        console.error(e);
      });

    return true;
  }
});

