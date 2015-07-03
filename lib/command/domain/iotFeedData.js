module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:domain/iotFeedData");
  var errLog = require("debug")("nqmHub:error");
  var Entity = require("./entity");
  var util = require("util");

  function IOTFeedData() {
    this.datum = {};
    Entity.apply(this, arguments);
  }
  util.inherits(IOTFeedData, Entity);

  // No key needed for feed data - i.e. it is not required to update or
  // delete a measurement - only add.
  IOTFeedData.getKey = function() {
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

