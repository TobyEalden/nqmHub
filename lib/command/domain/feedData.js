"use strict";

module.exports = (function() {
  var log = require("debug")("domain/feedData");
  var Entity = require("./entity");
  var util = require("util");

  function FeedData() {
    Entity.apply(this, arguments);
  }

  util.inherits(FeedData, Entity);

  FeedData.prototype.feedData = function(params) {
    log("feedData with %j", params);
    this.applyEvent("feedData",params);
  };

  FeedData.prototype._feedDataEventHandler = function(params) {
    this.datum = params;
  };

  return FeedData;
}());

