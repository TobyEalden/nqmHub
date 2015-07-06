module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:domain/iotFeedData");
  var errLog = require("debug")("nqmHub:error");
  var Entity = require("./entity");
  var util = require("util");
  var _ = require("lodash");

  function IOTFeedData() {
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

  var mergeParams = function(params) {
    _.forEach(params, function(v,k) {
      this[k] = v;
    }, this);
  };

  IOTFeedData.prototype._createdEventHandler = function(params) {
    mergeParams.call(this, params);
  };

  return IOTFeedData;
}());

