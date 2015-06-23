"use strict";

module.exports = (function() {
  var log = require("debug")("domain/hub");
  var Entity = require("./entity");
  var util = require("util");

  function Hub() {
    this.id = "";
    this.name = "";
    this.owner = "";

    Entity.apply(this, arguments);
  }

  util.inherits(Hub, Entity);

  Hub.prototype.create = function(params) {
    log("create with %js", params);
    this.applyEvent("created",params);
  };

  Hub.prototype.rename = function(params) {
    if (this.name !== params.name) {
      log("rename to %s", params.name);
      this.applyEvent("renamed",params);
    }
  };

  Hub.prototype._createdEventHandler = function(params) {
    this.id = params.id;
    this.name = params.name;
    this.owner = params.owner;
  };

  Hub.prototype._renamedEventHandler = function(params) {
    this.name = params.name;
  };

  return Hub;
}());
