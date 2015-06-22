"use strict";

module.exports = (function() {
  var log = require("debug")("domain/feedData");
  var Entity = require("sourced").Entity;
  var util = require("util");

  function FeedData() {
    Entity.apply(this, arguments);
  }

  util.inherits(FeedData, Entity);

  FeedData.prototype.feedData = function(params) {
    log("feedData with %j", params);
    this.id = params.id;
    this.hubId = params.hubId;
    this.datum = params.datum;
    this.digest("feedData", params);
    this.enqueue("feedData", params, this);
  };

  return FeedData;
}());

