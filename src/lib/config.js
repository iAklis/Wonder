import { asyncApi } from './browser.js';
import { languages } from './languages.js';
import { defaults, SettingsStore } from '../core/settings.ts';
const storage = {
  read: () => asyncApi.storage.local.get(null),
  write: values => asyncApi.storage.local.set(values),
  subscribe: listener => chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local') listener(changes); }),
};
const store = new SettingsStore(storage, async store => {
  const accepted = await asyncApi.i18n.getAcceptLanguages();
  let targets = store.get('targetLanguages').map(languages.normalizeTargetLanguageCode).filter(Boolean);
  if (!targets.length) targets = [accepted.map(languages.normalizeTargetLanguageCode).find(Boolean) || 'zh-CN'];
  store.set('targetLanguages', targets.slice(0, 1));
  for (const key of ['targetLanguage', 'targetLanguageTextTranslation']) {
    const lang = languages.normalizeTargetLanguageCode(store.get(key));
    store.set(key, targets.includes(lang) ? lang : targets[0]);
  }
  for (const key of ['neverTranslateLangs', 'alwaysTranslateLangs']) store.set(key, store.get(key).map(languages.normalizeTargetLanguageCode).filter(Boolean));
  if (chrome.commands) {
    const commands = await asyncApi.commands.getAll();
    store.set('hotkeys', Object.fromEntries(commands.map(c => [c.name, c.shortcut])));
  }
  await store.flush();
});
export const config = {
  get: store.get.bind(store), set: store.set.bind(store), onReady: store.onReady.bind(store),
  onChanged: store.onChanged.bind(store), flush: store.flush.bind(store),
  export: () => store.export(chrome.runtime.getManifest().version),
  async import(json) {
    await store.import(json);
    if (typeof browser !== 'undefined' && browser.commands?.update) {
      await Promise.all(Object.entries(store.get('hotkeys')).map(([name,shortcut]) => browser.commands.update({name,shortcut})));
    }
    chrome.runtime.reload();
  },
  async restoreToDefault() {
    if (typeof browser !== 'undefined' && browser.commands?.reset) {
      await Promise.all(Object.keys(chrome.runtime.getManifest().commands || {}).map(name => browser.commands.reset(name)));
    }
    await store.import(JSON.stringify(defaults, (key,value) => value instanceof Map ? Object.fromEntries(value) : value));
    chrome.runtime.reload();
  },
};
  function addInArray(configName, value) {
    const array = config.get(configName);
    if (array.indexOf(value) === -1) {
      array.push(value);
      config.set(configName, array);
    }
  }

  function addInMap(configName, key, value) {
    let map = config.get(configName);
    if (typeof map.get(key) === "undefined") {
      map.set(key, value);
      config.set(configName, map);
    }
  }

  function removeFromArray(configName, value) {
    const array = config.get(configName);
    const index = array.indexOf(value);
    if (index > -1) {
      array.splice(index, 1);
      config.set(configName, array);
    }
  }

  function removeFromMap(configName, key) {
    const map = config.get(configName);
    if (typeof map.get(key) !== "undefined") {
      map.delete(key);
      config.set(configName, map);
    }
  }

  config.addSiteToTranslateWhenHovering = function (hostname) {
    addInArray("sitesToTranslateWhenHovering", hostname);
  };

  config.removeSiteFromTranslateWhenHovering = function (hostname) {
    removeFromArray("sitesToTranslateWhenHovering", hostname);
  };

  config.addLangToTranslateWhenHovering = function (lang) {
    addInArray("langsToTranslateWhenHovering", lang);
  };

  config.removeLangFromTranslateWhenHovering = function (lang) {
    removeFromArray("langsToTranslateWhenHovering", lang);
  };

  config.addSiteToAlwaysTranslate = function (hostname) {
    addInArray("alwaysTranslateSites", hostname);
    removeFromArray("neverTranslateSites", hostname);
  };
  config.removeSiteFromAlwaysTranslate = function (hostname) {
    removeFromArray("alwaysTranslateSites", hostname);
  };
  config.addSiteToNeverTranslate = function (hostname) {
    addInArray("neverTranslateSites", hostname);
    removeFromArray("alwaysTranslateSites", hostname);
    removeFromArray("sitesToTranslateWhenHovering", hostname);
  };
  config.addRuleToSpecialRules = function (hostname) {
    addInArray("specialRules", hostname);
  };
  config.addKeyWordTocustomDictionary = function (key, value) {
    addInMap("customDictionary", key, value);
  };
  config.removeSiteFromNeverTranslate = function (hostname) {
    removeFromArray("neverTranslateSites", hostname);
  };
  config.removeRuleFromSpecialRules = function (hostname) {
    removeFromArray("specialRules", hostname);
  };
  config.removeKeyWordFromcustomDictionary = function (keyWord) {
    removeFromMap("customDictionary", keyWord);
  };
  config.addLangToAlwaysTranslate = function (lang, hostname) {
    addInArray("alwaysTranslateLangs", lang);
    removeFromArray("neverTranslateLangs", lang);

    if (hostname) {
      removeFromArray("neverTranslateSites", hostname);
    }
  };
  config.removeLangFromAlwaysTranslate = function (lang) {
    removeFromArray("alwaysTranslateLangs", lang);
  };
  config.addLangToNeverTranslate = function (lang, hostname) {
    addInArray("neverTranslateLangs", lang);
    removeFromArray("alwaysTranslateLangs", lang);
    removeFromArray("langsToTranslateWhenHovering", lang);

    if (hostname) {
      removeFromArray("alwaysTranslateSites", hostname);
    }
  };
  config.removeLangFromNeverTranslate = function (lang) {
    removeFromArray("neverTranslateLangs", lang);
  };

  /**
   * Add a new lang to the targetLanguages and remove the last target language. If the language is already in the targetLanguages then move it to the first position
   * @example
   * addTargetLanguage("de")
   * @param {string} lang - langCode
   * @returns
   */
  function addTargetLanguage(lang) {
    const targetLanguages = config.get("targetLanguages");
    lang = languages.normalizeTargetLanguageCode(lang);
    if (!lang) return;

    const index = targetLanguages.indexOf(lang);
    if (index === -1) {
      targetLanguages.unshift(lang);
      targetLanguages.pop();
    } else {
      targetLanguages.splice(index, 1);
      targetLanguages.unshift(lang);
    }

    config.set("targetLanguages", targetLanguages);
  }

  /**
   * set lang as target language for page translation only (not text translation)
   *
   * if the lang in not in targetLanguages then call addTargetLanguage
   * @example
   * config.setTargetLanguage("de",  true)
   * @param {string} lang - langCode
   * @param {boolean} forTextToo - also call setTargetLanguageTextTranslation
   * @returns
   */
  config.setTargetLanguage = function (lang, forTextToo = false) {
    const targetLanguages = config.get("targetLanguages");
    lang = languages.normalizeTargetLanguageCode(lang);
    if (!lang) return;

    if (targetLanguages.indexOf(lang) === -1 || forTextToo) {
      addTargetLanguage(lang);
    }

    config.set("targetLanguage", lang);

    if (forTextToo) {
      config.setTargetLanguageTextTranslation(lang);
    }
  };

  /**
   * set lang as target language for text translation only (not page translation)
   * @example
   * config.setTargetLanguage("de")
   * @param {string} lang - langCode
   * @returns
   */
  config.setTargetLanguageTextTranslation = function (lang) {
    lang = languages.normalizeTargetLanguageCode(lang);
    if (!lang) return;

    config.set("targetLanguageTextTranslation", lang);
  };

