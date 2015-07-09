/**
 * Created by toby on 28/06/15.
 */

module.exports = (function () {
  "use strict";

  var errLog = require("debug")("nqmHub:error:common");
  var jsonPointer = require("json-pointer");

  var randomId = function (length) {
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var text = "";
    var i;
    length = length || 6;

    for (i = 0; i < length; i = i + 1) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
  };

  function dotNotationToJSONPointer(k) {
    // ToDo - review. Need to translate from dot notation to jsonpointer.
    return "/" + k.replace(/\./gi, "/");
  }
  return {
    randomTextId: randomId,
    dotNotationToJSONPointer: dotNotationToJSONPointer
  };
}());