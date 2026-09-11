import { Service } from "./service.js";
import { Utils } from "./encoding.js";
import { GoogleHelper } from "./google-token.js";
const googleService = new (class extends Service {
  constructor() {
    super(
      "google",
      "https://translate.googleapis.com/translate_a/t?anno=3&client=te&v=1.0&format=html",
      "POST",
      function cbTransformRequest(sourceArray) {
        sourceArray = sourceArray.map((text) => Utils.escapeHTML(text));
        if (sourceArray.length > 1) {
          sourceArray = sourceArray.map(
            (text, index) => `<a i=${index}>${text}</a>`
          );
        }
        // the <pre> tag is to preserve the text formating
        return `<pre>${sourceArray.join("")}</pre>`;
      },
      function cbParseResponse(response) {
        /** @type {[Service_Single_Result_Response]} */
        let responseJson;
        if (typeof response === "string") {
          responseJson = [{ text: response, detectedLanguage: null }];
        } else if (typeof response[0] === "string") {
          responseJson = response.map(
            /** @returns {Service_Single_Result_Response} */ (
              /** @type {string} */ value
            ) => ({ text: value, detectedLanguage: null })
          );
        } else {
          responseJson = response.map(
            /** @returns {Service_Single_Result_Response} */ (
              /** @type {[string, string]} */ value
            ) => ({ text: value[0], detectedLanguage: value[1] })
          );
        }
        return responseJson;
      },
      function cbTransformResponse(result, dontSortResults) {
        // remove the <pre> tag from the response
        if (result.indexOf("<pre") !== -1) {
          result = result.replace("</pre>", "");
          const index = result.indexOf(">");
          result = result.slice(index + 1);
        }

        /** @type {string[]} */
        const sentences = []; // each translated sentence is inside of <b> tag

        // The main objective is to remove the original text of each sentense that is inside the <i> tags.
        // Keeping only the <a> tags
        let idx = 0;
        while (true) {
          // each translated sentence is inside of <b> tag
          const sentenceStartIndex = result.indexOf("<b>", idx);
          if (sentenceStartIndex === -1) break;

          // the <i> tag is the original text in each sentence
          const sentenceFinalIndex = result.indexOf(
            "<i>",
            sentenceStartIndex
          );

          if (sentenceFinalIndex === -1) {
            sentences.push(result.slice(sentenceStartIndex + 3));
            break;
          } else {
            sentences.push(
              result.slice(sentenceStartIndex + 3, sentenceFinalIndex)
            );
          }
          idx = sentenceFinalIndex;
        }

        // maybe the response don't have any sentence (does not have <i> and <b> tags), is this case just use de result
        result = sentences.length > 0 ? sentences.join(" ") : result;
        // Remove the remaining </b> tags (usually the last)
        result = result.replace(/\<\/b\>/g, "");
        // Capture each <a i={number}> and put it in an array, the </a> will be ignored
        // maybe the same index appears several times
        // maybe some text will be outside of <a i={number}> (Usually text before the first <a> tag, and some whitespace between the <a> tags),
        // in this case, The outside text will be placed inside the <a i={number}> closer
        // https://github.com/FilipePS/Traduzir-paginas-web/issues/449
        // TODO lidar com tags dentro de tags e tags vazias
        // https://de.wikipedia.org/wiki/Wikipedia:Hauptseite
        // "{\"originalText\":\"<pre><a i=0>\\nFür den </a><a i=1>37. Schreib­wettbewerb</a><a i=2> und den </a><a i=3>18. Miniaturwettbewerb</a><a i=4> können ab sofort Artikel nominiert werden.</a></pre>\",\"translatedText\":\"<pre><a i=0>\\n</a>Artigos já podem ser indicados <a i=0>para o</a> <a i=1>37º Concurso de Redação <a i=2>e</a></a> <a i=3><a i=4>18º</a> Concurso de Miniaturas</a> .</pre>\",\"detectedLanguage\":\"de\",\"status\":\"complete\",\"waitTranlate\":{}}"
        let resultArray = [];
        let lastEndPos = 0;
        for (const r of result.matchAll(
          /(\<a\si\=[0-9]+\>)([^\<\>]*(?=\<\/a\>))*/g
        )) {
          const fullText = r[0];
          const fullLength = r[0].length;
          const pos = r.index;
          // if it is bigger then it has text outside the tags
          if (pos > lastEndPos) {
            const aTag = r[1];
            const insideText = r[2] || "";
            const outsideText = result
              .slice(lastEndPos, pos)
              .replace(/\<\/a\>/g, "");
            resultArray.push(aTag + outsideText + insideText);
          } else {
            resultArray.push(fullText);
          }
          lastEndPos = pos + fullLength;
        }
        // captures the final text outside the <a> tag
        {
          const lastOutsideText = result
            .slice(lastEndPos)
            .replace(/\<\/a\>/g, "");
          if (resultArray.length > 0) {
            resultArray[resultArray.length - 1] += lastOutsideText;
          }
        }
        // this is the old method, don't capture text outside of <a> tags
        // let resultArray = result.match(
        //   /\<a\si\=[0-9]+\>[^\<\>]*(?=\<\/a\>)/g
        // );

        if (dontSortResults) {
          // Should not sort the <a i={number}> of Google Translate result
          // Instead of it, join the texts without sorting
          // https://github.com/FilipePS/Traduzir-paginas-web/issues/163

          if (resultArray && resultArray.length > 0) {
            // get the text inside of <a i={number}>
            // the indexes is not needed in this case
            resultArray = resultArray.map((value) => {
              const resultStartAtIndex = value.indexOf(">");
              return value.slice(resultStartAtIndex + 1);
            });
          } else {
            // maybe the response don't have any <a i={number}>
            resultArray = [result];
          }

          // unescapeHTML
          resultArray = resultArray.map((value) => Utils.unescapeHTML(value));

          return resultArray;
        } else {
          // Sort Google translate results to keep the links with the correct name
          // Note: the links may also disappear; http://web.archive.org/web/20220919162911/https://de.wikipedia.org/wiki/Wikipedia:Hauptseite
          // each inline tag has a index starting with 0 <a i={number}>
          let indexes;
          if (resultArray && resultArray.length > 0) {
            // get the indexed of <a i={number}>
            indexes = resultArray
              .map((value) => parseInt(value.match(/[0-9]+(?=\>)/g)[0]))
              .filter((value) => !isNaN(value));
            // get the text inside of <a i={number}>
            resultArray = resultArray.map((value) => {
              const resultStartAtIndex = value.indexOf(">");
              return value.slice(resultStartAtIndex + 1);
            });
          } else {
            // maybe the response don't have any <a i={number}>
            resultArray = [result];
            indexes = [0];
          }

          // unescapeHTML
          resultArray = resultArray.map((value) => Utils.unescapeHTML(value));

          /** @type {string[]} */
          const finalResulArray = [];
          // sorte de results and put in finalResulArray
          for (const j in indexes) {
            if (finalResulArray[indexes[j]]) {
              finalResulArray[indexes[j]] += " " + resultArray[j];
            } else {
              finalResulArray[indexes[j]] = resultArray[j];
            }
          }

          return finalResulArray;
        }
      },
      function cbGetExtraParameters(
        sourceLanguage,
        targetLanguage,
        requests
      ) {
        return `&sl=${sourceLanguage}&tl=${targetLanguage}&tk=${GoogleHelper.calcHash(
          requests.map((info) => info.originalText).join("")
        )}`;
      },
      function cbGetRequestBody(sourceLanguage, targetLanguage, requests) {
        return requests
          .map((info) => `&q=${encodeURIComponent(info.originalText)}`)
          .join("");
      }
    );
  }
})();

export { googleService };
