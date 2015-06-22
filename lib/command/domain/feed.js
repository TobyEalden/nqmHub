"use strict";

module.exports = (function() {
  var log = require("debug")("domain/feed");
  var Entity = require("./entity");
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
    this.applyEvent("created",params);
  };

  Feed.prototype.rename = function(params) {
    if (this.name !== params.name) {
      log("rename to %s", params.name);
      this.applyEvent("renamed");
    }
  };

  Feed.prototype._createdEventHandler = function(params) {
    this.id = params.id;
    this.hubId = params.hubId;
    this.name = params.name;
    this.schema = params.schema;
  };

  Feed.prototype._renamedEventHandler = function(params) {
    this.name = params.name;
    this.digest("rename", params);
    this.enqueue("renamed", params, this);
  };

  return Feed;
}());
