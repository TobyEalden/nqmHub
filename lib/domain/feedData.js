"use strict";

module.exports = (function() {
  var console = process.console ? process.console : global.console;
  var assert = require("assert");
  var Entity = require("sourced").Entity;
  var util = require("util");

  function FeedData() {
    this.datum = {};

    Entity.apply(this, arguments);
  }

  util.inherits(FeedData, Entity);

  FeedData.prototype.create = function(datum) {
    this.id = datum.id;
    this.datum = datum;
    this.digest("create", datum);
    this.enqueue("create", datum, this);
  };

  return FeedData;
}());

