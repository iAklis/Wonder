function checkedLastError() { return chrome.runtime.lastError; }
const deeplService = new (class {
  constructor() {
    this.DeepLTab = null;
  }
  /**
   *
   * @param {string} sourceLanguage - This parameter is not used
   * @param {*} targetLanguage
   * @param {*} sourceArray2d - Only the string `sourceArray2d[0][0]` will be translated.
   * @param {*} dontSaveInPersistentCache - This parameter is not used
   * @param {*} dontSortResults - This parameter is not used
   * @returns
   */
  async translate(
    sourceLanguage,
    targetLanguage,
    sourceArray2d,
    dontSaveInPersistentCache,
    dontSortResults = false
  ) {
    return await new Promise((resolve) => {
      const waitFirstTranslationResult = () => {
        const listener = (request, sender, sendResponse) => {
          if (request?.action === "DeepL_firstTranslationResult") {
            resolve([[request.result]]);
            chrome.runtime.onMessage.removeListener(listener);
          }
        };
        chrome.runtime.onMessage.addListener(listener);

        setTimeout(() => {
          chrome.runtime.onMessage.removeListener(listener);
          resolve([[""]]);
        }, 8000);
      };

      if (this.DeepLTab) {
        chrome.tabs.get(this.DeepLTab.id, (tab) => {
          checkedLastError();
          if (tab) {
            //chrome.tabs.update(tab.id, {active: true})
            chrome.tabs.sendMessage(
              tab.id,
              {
                action: "translateTextWithDeepL",
                text: sourceArray2d[0][0],
                targetLanguage,
              },
              {
                frameId: 0,
              },
              (response) => resolve([[response]])
            );
          } else {
            chrome.tabs.create(
              {
                url: `https://www.deepl.com/#!${targetLanguage}!#${encodeURIComponent(
                  sourceArray2d[0][0]
                )}`,
              },
              (tab) => {
                this.DeepLTab = tab;
                waitFirstTranslationResult();
              }
            );
            // resolve([[""]])
          }
        });
      } else {
        chrome.tabs.create(
          {
            url: `https://www.deepl.com/#!${targetLanguage}!#${encodeURIComponent(
              sourceArray2d[0][0]
            )}`,
          },
          (tab) => {
            this.DeepLTab = tab;
            waitFirstTranslationResult();
          }
        );
        // resolve([[""]])
      }
    });
  }
})();

export { deeplService };
