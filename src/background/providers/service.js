import { request, RequestQueue } from "../../core/http.ts";
import { translationCache } from "../translationCache.ts";
const providerQueue = new RequestQueue(4);
class Service {
  /**
   * Returns a string with additional parameters to be concatenated to the request URL.
   * @callback callback_cbParameters
   * @param {string} sourceLanguage
   * @param {string} targetLanguage
   * @param {Array<TranslationInfo>} requests
   * @returns {string}
   */

  /**
   * Takes `sourceArray` and returns a request string to the translation service.
   * @callback callback_cbTransformRequest
   * @param {string[]} sourceArray
   * @returns {string}
   */

  /**
   * @typedef {{text: string, detectedLanguage: string}} Service_Single_Result_Response
   */

  /**
   * Receives the response from the *http request* and returns `Service_Single_Result_Response[]`.
   *
   * Returns a string with the body of a request of type **POST**.
   * @callback callback_cbParseResponse
   * @param {Object} response
   * @returns {Array<Service_Single_Result_Response>}
   */

  /**
   * Takes a string formatted with the translated text and returns a `resultArray`.
   * @callback callback_cbTransformResponse
   * @param {String} response
   * @param {boolean} dontSortResults
   * @returns {string[]} resultArray
   */

  /** @typedef {"complete" | "translating" | "error"} TranslationStatus */
  /**
   * @typedef {Object} TranslationInfo
   * @property {String} originalText
   * @property {String} translatedText
   * @property {String} detectedLanguage
   * @property {TranslationStatus} status
   * @property {Promise<void>} waitTranlate
   */

  /**
   * Initializes the **Service** class with information about the new translation service.
   * @param {string} serviceName
   * @param {string} baseURL
   * @param {"GET" | "POST"} xhrMethod
   * @param {callback_cbTransformRequest} cbTransformRequest Takes `sourceArray` and returns a request string to the translation service.
   * @param {callback_cbParseResponse} cbParseResponse Receives the response from the *http request* and returns `Service_Single_Result_Response[]`.
   * @param {callback_cbTransformResponse} cbTransformResponse Takes a string formatted with the translated text and returns a `resultArray`.
   * @param {callback_cbParameters} cbGetExtraParameters Returns a string with additional parameters to be concatenated to the request URL.
   * @param {callback_cbParameters} cbGetRequestBody Returns a string with the body of a request of type **POST**.
   */
  constructor(
    serviceName,
    baseURL,
    xhrMethod = "GET",
    cbTransformRequest,
    cbParseResponse,
    cbTransformResponse,
    cbGetExtraParameters = null,
    cbGetRequestBody = null
  ) {
    this.serviceName = serviceName;
    this.baseURL = baseURL;
    this.xhrMethod = xhrMethod;
    this.cbTransformRequest = cbTransformRequest;
    this.cbParseResponse = cbParseResponse;
    this.cbTransformResponse = cbTransformResponse;
    this.cbGetExtraParameters = cbGetExtraParameters;
    this.cbGetRequestBody = cbGetRequestBody;
    this.requestContentType = 'application/x-www-form-urlencoded';
    /** @type {Map<string, TranslationInfo>} */
    this.translationsInProgress = new Map();
  }

  /**
   * Receives the `sourceArray2d` parameter and prepares the requests.
   * Calls `cbTransformRequest` for each `sourceArray` of `sourceArray2d`.
   * The `currentTranslationsInProgress` array will be the **final result** with requests already completed or in progress. And the `requests` array will only contain the new requests that need to be made.
   *
   * Checks if there is already an identical request in progress or if it is already in the translation cache.
   * If it doesn't exist, add it to `requests` to make a new *http request*.
   *
   * Requests longer than **800 characters** will be split into new requests.
   * @param {string} sourceLanguage
   * @param {string} targetLanguage
   * @param {Array<string[]>} sourceArray2d
   * @returns {Promise<[Array<TranslationInfo[]>, TranslationInfo[]]>} `requests`, `currentTranslationsInProgress`
   */
  async getRequests(sourceLanguage, targetLanguage, sourceArray2d, privateRequest = false) {
    /** @type {Array<TranslationInfo[]>} */
    const requests = [];
    /** @type {TranslationInfo[]} */
    const currentTranslationsInProgress = [];

    let currentRequest = [];
    let currentSize = 0;

    for (const sourceArray of sourceArray2d) {
      const requestString = this.fixString(
        this.cbTransformRequest(sourceArray)
      );
      const requestHash = [
        privateRequest,
        sourceLanguage,
        targetLanguage,
        requestString,
      ];
      const requestKey = JSON.stringify(requestHash);

      const progressInfo = this.translationsInProgress.get(requestKey);
      if (progressInfo) {
        currentTranslationsInProgress.push(progressInfo);
      } else {
        /** @type {TranslationStatus} */
        let status = "translating";
        /** @type {() => void} */
        let promise_resolve = null;

        /** @type {TranslationInfo} */
        const progressInfo = {
          originalText: requestString,
          translatedText: null,
          detectedLanguage: null,
          get status() {
            return status;
          },
          set status(_status) {
            status = _status;
            promise_resolve();
          },
          waitTranlate: new Promise((resolve) => (promise_resolve = resolve)),
        };

        currentTranslationsInProgress.push(progressInfo);
        this.translationsInProgress.set(requestKey, progressInfo);

        //cast
        const cacheEntry = privateRequest ? undefined : await translationCache.get(
          this.serviceName,
          sourceLanguage,
          targetLanguage,
          requestString
        );
        if (cacheEntry) {
          progressInfo.translatedText = cacheEntry.translatedText;
          progressInfo.detectedLanguage = cacheEntry.detectedLanguage;
          progressInfo.status = "complete";
          //this.translationsInProgress.delete([sourceLanguage, targetLanguage, requestString])
        } else {
          currentRequest.push(progressInfo);
          currentSize += progressInfo.originalText.length;
          if (currentSize > 800) {
            requests.push(currentRequest);
            currentSize = 0;
            currentRequest = [];
          }
        }
      }
    }

    if (currentRequest.length > 0) {
      requests.push(currentRequest);
    }

    return [requests, currentTranslationsInProgress];
  }

  /**
   * Makes a request using the fetch API. Returns a promise that will be resolved with the result of the request. If the request fails, the promise will be rejected.
   * @param {string} sourceLanguage
   * @param {string} targetLanguage
   * @param {Array<TranslationInfo>} requests
   * @returns {Promise<*>}
   */

  async makeRequest(sourceLanguage, targetLanguage, requests) {
    const url = this.baseURL + (this.cbGetExtraParameters?.(sourceLanguage, targetLanguage, requests) || '');
    const options = { method: this.xhrMethod };
    if (this.xhrMethod !== 'GET' && this.cbGetRequestBody) {
      options.headers = { 'Content-Type': this.requestContentType };
      options.body = this.cbGetRequestBody(sourceLanguage, targetLanguage, requests);
    }
    return providerQueue.run(async () => (await request(url, options)).json());
  }
  /**
   * Translates the `sourceArray2d`.
   *
   * If `dontSaveInPersistentCache` is **true** then the translation result will not be saved in the on-disk translation cache, only in the in-memory cache.
   *
   * The `dontSortResults` parameter is only valid when using the ***google*** translation service, if its value is **true** then the translation result will not be sorted.
   * @param {string} sourceLanguage
   * @param {string} targetLanguage
   * @param {Array<string[]>} sourceArray2d
   * @param {boolean} dontSaveInPersistentCache
   * @param {boolean} dontSortResults
   * @returns {Promise<string[][]>}
   */
  async translate(
    sourceLanguage,
    targetLanguage,
    sourceArray2d,
    dontSaveInPersistentCache = false,
    dontSortResults = false
  ) {
    const [requests, currentTranslationsInProgress] = await this.getRequests(
      sourceLanguage,
      targetLanguage,
      sourceArray2d,
      dontSaveInPersistentCache
    );
    /** @type {Promise<void>[]} */
    const promises = [];

    for (const request of requests) {
      promises.push(
        this.makeRequest(sourceLanguage, targetLanguage, request)
          .then(async (response) => {
            const results = this.cbParseResponse(response);
            for (const idx in request) {
              const result = results[idx];
              this.cbTransformResponse(result.text, dontSortResults); // apenas para gerar error
              const transInfo = request[idx];
              transInfo.detectedLanguage = result.detectedLanguage || "und";
              transInfo.translatedText = result.text;
              transInfo.status = "complete";
              //this.translationsInProgress.delete([sourceLanguage, targetLanguage, transInfo.originalText])
              if (dontSaveInPersistentCache === false) {
                await translationCache.set(
                  this.serviceName,
                  sourceLanguage,
                  targetLanguage,
                  transInfo.originalText,
                  transInfo.translatedText,
                  transInfo.detectedLanguage
                );
              }
            }
          })
          .catch((e) => {
            console.error(e);
            for (const transInfo of request) {
              transInfo.status = "error";
              //this.translationsInProgress.delete([sourceLanguage, targetLanguage, transInfo.originalText])
            }
          })
      );
    }
    try {
      await Promise.all(promises);
      await Promise.all(currentTranslationsInProgress.map(info => info.waitTranlate));
      if (currentTranslationsInProgress.some(info => info.status === 'error')) throw new Error('Translation failed');
      return currentTranslationsInProgress.map(info => this.cbTransformResponse(info.translatedText, dontSortResults));
    } finally {
      for (const [key, info] of this.translationsInProgress) {
        if (info.status !== 'translating') this.translationsInProgress.delete(key);
      }
    }
  }

  /**
   * https://github.com/FilipePS/Traduzir-paginas-web/issues/484
   * @param {string} str
   * @returns {string} fixedStr
   */
  fixString(str) {
    return str.replace(/\u200b/g, " ");
  }
}

export { Service };
