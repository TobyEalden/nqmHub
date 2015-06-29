/**
 * Created by toby on 28/06/15.
 */

"use strict";

module.exports = (function() {
  var randomId = function(length) {
    length = length || 6;
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var text = "";

    for( var i = 0; i < length; i++ ) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
  };


  return {
    randomTextId: randomId
  }
}());