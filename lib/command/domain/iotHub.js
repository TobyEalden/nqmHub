
module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:domain/iotHub");
  var errLog = require("debug")("nqmHub:error");
  var Entity = require("./entity");
  var util = require("util");

  function IOTHub() {
    this.id = "";
    this.name = "";
    this.owner = "";

    Entity.apply(this, arguments);
  }
  util.inherits(IOTHub, Entity);

  IOTHub.getKey = function() {
    return ["id"];
  };

  IOTHub.prototype.create = function(params) {
    log("create with %js", params);
    this.applyEvent("created",params);
  };

  IOTHub.prototype.rename = function(params) {
    if (this.name !== params.name) {
      log("rename to %s", params.name);
      this.applyEvent("renamed",params);
    }
  };

  IOTHub.prototype._createdEventHandler = function(params) {
    this.id = params.id;
    this.name = params.name;
    this.owner = params.owner;
  };

  IOTHub.prototype._renamedEventHandler = function(params) {
    this.name = params.name;
  };

  return IOTHub;
}());
