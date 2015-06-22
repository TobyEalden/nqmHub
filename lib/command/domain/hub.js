"use strict";

module.exports = (function() {
  var log = require("debug")("domain/hub");
  var Entity = require("sourced").Entity;
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
    this.id = params.id;
    this.name = params.name;
    this.owner = params.owner;

    this.digest("create",params);
    this.enqueue("created", params, this);
  };

  Hub.prototype.rename = function(newName) {
    log("rename to %s", newName);
    if (this.name !== newName) {
      this.name = newName;
      this.digest("rename",newName);
      this.enqueue("renamed", newName, this);
    }
  };

  return Hub;
}());
