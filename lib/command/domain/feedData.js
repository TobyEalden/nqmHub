"use strict";

module.exports = (function() {
  var console = process.console ? process.console : global.console;
  var assert = require("assert");
  var Entity = require("sourced").Entity;
  var util = require("util");

  function FeedData() {
    Entity.apply(this, arguments);
  }

  util.inherits(FeedData, Entity);

  FeedData.prototype.feedData = function(params) {
    this.id = params.id;
    this.hubId = params.hubId;
    this.datum = params.datum;
    this.digest("feedData", params);
    this.enqueue("feedData", params, this);
  };

  return FeedData;
}());

