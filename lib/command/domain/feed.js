"use strict";

module.exports = (function() {
  var log = require("debug")("domain/feed");
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
    log("creating with %j", params);
    this.id = params.id;
    this.hubId = params.hubId;
    this.name = params.name;
    this.schema = params.schema;

    this.digest("create", params);
    this.enqueue("created", params, this);
  };

  Feed.prototype.rename = function(newName) {
    log("rename to %s", newName);
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

