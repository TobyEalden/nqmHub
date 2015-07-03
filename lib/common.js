/**
 * Created by toby on 28/06/15.
 */

module.exports = (function () {
  "use strict";

  var errLog = require("debug")("nqmHub:error");

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

  /*
   * Extract property value from object, where property may be in path
   * form, e.g. person.address.postcode.
   *
   * n.b. doesn't support arrays.
   */
  var extractKeyDataUsingPath = function (obj, targetProperty) {
    var value, i, len, property;
    var components = targetProperty.split(".");
    for (i = 0, len = components.length; i < len; i = i + 1) {
      property = components[i];
      if (Object(obj[property]) !== obj[property]) {
        // Not an object => this should be the end value.
        if (i !== components.length - 1) {
          errLog("expected end of property path: %s", property);
        }
        value = obj[property];
        break;
      }
      if (Array.isArray(obj[property])) {
        errLog("unique index cannot be an array");
      } else {
        obj = obj[property];
      }
    }
    return value;
  };


  return {
    randomTextId: randomId,
    extractKeyDataUsingPath: extractKeyDataUsingPath
  };
}());