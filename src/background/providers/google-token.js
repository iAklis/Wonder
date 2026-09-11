
class GoogleHelper {
  static get googleTranslateTKK() {
    return "448487.932609646";
  }

  /**
   *
   * @param {number} num
   * @param {string} optString
   * @returns {number}
   */
  static shiftLeftOrRightThenSumOrXor(num, optString) {
    for (let i = 0; i < optString.length - 2; i += 3) {
      /** @type {string|number} */
      let acc = optString.charAt(i + 2);
      if ("a" <= acc) {
        acc = acc.charCodeAt(0) - 87;
      } else {
        acc = Number(acc);
      }
      if (optString.charAt(i + 1) == "+") {
        acc = num >>> acc;
      } else {
        acc = num << acc;
      }
      if (optString.charAt(i) == "+") {
        num += acc & 4294967295;
      } else {
        num ^= acc;
      }
    }
    return num;
  }

  /**
   *
   * @param {string} query
   * @returns {Array<number>}
   */
  static transformQuery(query) {
    /** @type {Array<number>} */
    const bytesArray = [];
    let idx = 0;
    for (let i = 0; i < query.length; i++) {
      let charCode = query.charCodeAt(i);

      if (128 > charCode) {
        bytesArray[idx++] = charCode;
      } else {
        if (2048 > charCode) {
          bytesArray[idx++] = (charCode >> 6) | 192;
        } else {
          if (
            55296 == (charCode & 64512) &&
            i + 1 < query.length &&
            56320 == (query.charCodeAt(i + 1) & 64512)
          ) {
            charCode =
              65536 +
              ((charCode & 1023) << 10) +
              (query.charCodeAt(++i) & 1023);
            bytesArray[idx++] = (charCode >> 18) | 240;
            bytesArray[idx++] = ((charCode >> 12) & 63) | 128;
          } else {
            bytesArray[idx++] = (charCode >> 12) | 224;
          }
          bytesArray[idx++] = ((charCode >> 6) & 63) | 128;
        }
        bytesArray[idx++] = (charCode & 63) | 128;
      }
    }
    return bytesArray;
  }

  /**
   * Calculates the hash (TK) of a query for google translator.
   * @param {string} query
   * @returns {string}
   */
  static calcHash(query) {
    const windowTkk = GoogleHelper.googleTranslateTKK;
    const tkkSplited = windowTkk.split(".");
    const tkkIndex = Number(tkkSplited[0]) || 0;
    const tkkKey = Number(tkkSplited[1]) || 0;

    const bytesArray = GoogleHelper.transformQuery(query);

    let encondingRound = tkkIndex;
    for (const item of bytesArray) {
      encondingRound += item;
      encondingRound = GoogleHelper.shiftLeftOrRightThenSumOrXor(
        encondingRound,
        "+-a^+6"
      );
    }
    encondingRound = GoogleHelper.shiftLeftOrRightThenSumOrXor(
      encondingRound,
      "+-3^+b+-f"
    );

    encondingRound ^= tkkKey;
    if (encondingRound <= 0) {
      encondingRound = (encondingRound & 2147483647) + 2147483648;
    }

    const normalizedResult = encondingRound % 1000000;
    return normalizedResult.toString() + "." + (normalizedResult ^ tkkIndex);
  }
}

export { GoogleHelper };
