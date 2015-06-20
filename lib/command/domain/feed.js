"use strict";

module.exports = (function() {
  var console = process.console ? process.console : global.console;
  var assert = require("assert");
  var Entity = require("sourced").Entity;
  var util = require("util");

  function Feed() {
    this.id = "";
    this.hubId = "";
    this.name = "";
    this.schema = {};

    Entity.apply(this, arguments);
  }

  util.inherits(Feed, Entity);

  Feed.prototype.create = function(params) {
    this.id = params.id;
    this.hubId = params.hubId;
    this.name = params.name;
    this.schema = params.schema;

    this.digest("create", params);
    this.enqueue("created", params, this);
  };

  Feed.prototype.rename = function(newName) {
    if (newName !== this.name) {
      this.name = newName;

      this.digest("rename", newName);
      this.enqueue("renamed", newName, this);
    }
  };

  Feed.prototype.feedData = function(datum) {
    this.datum = datum;
    this.digest("feedData", datum);
    this.enqueue("feedData", datum, this);
  };

  return Feed;
}());

