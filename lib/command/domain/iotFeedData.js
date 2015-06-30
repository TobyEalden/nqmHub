"use strict";

module.exports = (function() {
  var log = require("debug")("nqmHub:domain/iotFeedData");
  var errLog = require("debug")("nqmHub:error");
  var Entity = require("./entity");
  var util = require("util");

  function IOTFeedData() {
    Entity.apply(this, arguments);
  }
  util.inherits(IOTFeedData, Entity);

  IOTFeedData.getKey = function() {
    // No key needed for feed data.
    return [];
  };

  IOTFeedData.prototype.create = function(params) {
    log("create with %j", params);
    this.applyEvent("created",params);
  };

  IOTFeedData.prototype._createdEventHandler = function(params) {
    this.datum = params;
  };

  return IOTFeedData;
}());

