
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
    log("create with %j", params);
    this.applyEvent("created",params);
  };

  IOTHub.prototype.rename = function(params) {
    if (this.name !== params.name) {
      log("rename to %s", params.name);
      this.applyEvent("renamed",params);
    } else {
      log("rename ignored - name hasn't changed");
    }
  };

  IOTHub.prototype.setTags = function(params) {
    if (JSON.stringify(params.tags) !== JSON.stringify(this.tags)) {
      log("setting tags to %j", params);
      this.applyEvent("tagsChanged", params);
    } else {
      log("setTags ignored - tags haven't changed");
    }
  };

  IOTHub.prototype.setDescription = function(params) {
    if (this.description !== params.description) {
      log("changing description from %s to %s", this.description, params.description);
      this.applyEvent("descriptionChanged", params);
    } else {
      log("setDescription ignored - not changed");
    }
  };

  IOTHub.prototype.delete = function(params) {
    log("delete with %j", params);
    this.applyEvent("deleted", params);
  };

  IOTHub.prototype._createdEventHandler = function(params) {
    this.id = params.id;
    this.name = params.name;
    this.description = params.description;
    this.owner = params.owner;
    this.__deleted = false;
    this.__created = params.__timestamp;
  };

  IOTHub.prototype._renamedEventHandler = function(params) {
    this.name = params.name;
  };

  IOTHub.prototype._descriptionChangedEventHandler = function(params) {
    this.description = params.description;
  };

  IOTHub.prototype._tagsChangedEventHandler = function(params) {
    this.tags = params.tags;
  };

  IOTHub.prototype._deletedEventHandler = function(params) {
    this.__deleted = true;
  };

  return IOTHub;
}());
