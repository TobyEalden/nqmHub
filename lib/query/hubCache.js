/**
 * Created by toby on 23/06/15.
 */

"use strict";

module.exports = (function() {
  var log = require("debug")("HubCache");
  var HubNormaliser = require("./normalisers/IOTHubNormaliser").Normaliser;

  log("initialising");

  var normaliser = new HubNormaliser();

  return {
    getHub: normaliser.get.bind(normaliser),
    start: normaliser.start.bind(normaliser)
  };
}());