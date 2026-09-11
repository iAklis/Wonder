import { request } from "../../core/http.ts";
class BingHelper {
  /** @type {number} */
  static #lastRequestSidTime = null;
  /** @type {string} */
  static #translateSid = null;
  /** @type {string} */
  static #translate_IID_IG = null;
  /** @type {boolean} */
  static #SIDNotFound = false;
  /** @type {Promise<void>} */
  static #sidPromise = null;

  static get translateSid() {
    return BingHelper.#translateSid;
  }

  static get translate_IID_IG() {
    return BingHelper.#translate_IID_IG;
  }
  /**
   * Find the SID (IID and IG) of Bing Translator. The SID value is used in translation requests.
   * @returns {Promise<void>}
   */
  static async findSID() {
    if (BingHelper.#sidPromise) return await BingHelper.#sidPromise;
    BingHelper.#sidPromise = new Promise(async (resolve) => {
      let updateBingSid = false;
      if (BingHelper.#lastRequestSidTime) {
        const date = new Date();
        if (BingHelper.#translateSid) {
          date.setHours(date.getHours() - 12);
        } else if (BingHelper.#SIDNotFound) {
          date.setMinutes(date.getMinutes() - 30);
        } else {
          date.setMinutes(date.getMinutes() - 2);
        }
        if (date.getTime() > BingHelper.#lastRequestSidTime) {
          updateBingSid = true;
        }
      } else {
        updateBingSid = true;
      }

      if (updateBingSid) {
        BingHelper.#lastRequestSidTime = Date.now();

        try{
          const response = await request("https://www.bing.com/translator")
          const text = await response.text()
          const result = text.match(
            /params_RichTranslateHelper\s=\s\[[^\]]+/
          );
          const data_iid_r = text.match(
            /data-iid\=\"[a-zA-Z0-9\.]+/
          );
          const IG_r = text.match(/IG\:\"[a-zA-Z0-9\.]+/);
          if (
            result &&
            result[0] &&
            result[0].length > 50 &&
            data_iid_r &&
            data_iid_r[0] &&
            IG_r &&
            IG_r[0]
          ) {
            const params_RichTranslateHelper = result[0]
              .substring("params_RichTranslateHelper = [".length)
              .split(",");
            const data_iid = data_iid_r[0].substring('data-iid="'.length);
            const IG = IG_r[0].substring('IG:"'.length);
            if (
              params_RichTranslateHelper &&
              params_RichTranslateHelper[0] &&
              params_RichTranslateHelper[1] &&
              parseInt(params_RichTranslateHelper[0]) &&
              data_iid &&
              IG
            ) {
              BingHelper.#translateSid = `&token=${params_RichTranslateHelper[1].substring(
                1,
                params_RichTranslateHelper[1].length - 1
              )}&key=${parseInt(params_RichTranslateHelper[0])}`;
              BingHelper.#translate_IID_IG = `IG=${IG}&IID=${data_iid}`;
              BingHelper.#SIDNotFound = false;
            } else {
              BingHelper.#SIDNotFound = true;
            }
          } else {
            BingHelper.#SIDNotFound = true;
          }
          resolve();
        }catch(e){
          console.warn('fetch bing sid failed',e)
          resolve()
        }

      } else {
        resolve();
      }
    });

    BingHelper.#sidPromise.finally(() => {
      BingHelper.#sidPromise = null;
    });

    return await BingHelper.#sidPromise;
  }
}

/**
 * Base class to create new translation services.
 */
export { BingHelper };
