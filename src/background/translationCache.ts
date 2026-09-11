import { TranslationCache } from '../core/cache';
const cache = new TranslationCache();
export const translationCache = {
  get: cache.get.bind(cache), set: cache.set.bind(cache),
  async deleteTranslationCache(reload = false) { await cache.clear(); if (reload) chrome.runtime.reload(); },
};
chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (request?.action === 'getCacheSize') { void cache.size().then(respond, () => respond('0 B')); return true; }
  if (request?.action === 'deleteTranslationCache') { void translationCache.deleteTranslationCache(request.reload).then(() => respond(true), () => respond(false)); return true; }
});
