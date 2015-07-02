"use strict";

module.exports = (function() {
  var log = require("debug")("nqmHub:domain/iotFeed");
  var errLog = require("debug")("nqmHub:error");
  var Entity = require("./entity");
  var util = require("util");
  var common = require("../../common");

  function IOTFeed() {
    this.id = "";
    this.hubId = "";
    this.name = "";
    this.description = "";
    this.schema = {};
    this.tags = [];

    Entity.apply(this, arguments);
  }
  util.inherits(IOTFeed, Entity);

  IOTFeed.getKey = function() {
    return ["hubId","id"];
  };

  IOTFeed.prototype.create = function(params) {
    log("creating with %j", params);
    params.store = params.store || ("iotFeed." + common.randomTextId());
    this.applyEvent("created", params);
  };

  IOTFeed.prototype.rename = function(params) {
    if (this.name !== params.name) {
      log("rename to %s", params.name);
      this.applyEvent("renamed", params);
    }
  };

  IOTFeed.prototype.setSchema = function(params) {
    if (JSON.stringify(params.schema) !== JSON.stringify(this.schema)) {
      log("setting schema to %j",params);
      this.applyEvent("schemaSet",params);
    } else {
      log("setSchema ignored - schema not changed");
    }
  };

  IOTFeed.prototype.setTags = function(params) {
    if (JSON.stringify(params.tags) !== JSON.stringify(this.tags)) {
      log("setting tags to %j", params);
      this.applyEvent("tagsChanged", params);
    } else {
      log("setTags ignored - tags haven't changed");
    }
  };

  IOTFeed.prototype.setDescription = function(params) {
    if (this.description !== params.description) {
      log("changing description from %s to %s", this.description, params.description);
      this.applyEvent("descriptionChanged", params);
    } else {
      log("setDescription ignored - not changed");
    }
  };

  IOTFeed.prototype._createdEventHandler = function(params) {
    this.id = params.id;
    this.hubId = params.hubId;
    this.name = params.name;
    this.schema = params.schema;
    this.store = params.store;
    this.__created = params.__timestamp;
  };

  IOTFeed.prototype._renamedEventHandler = function(params) {
    this.name = params.name;
  };

  IOTFeed.prototype._schemaSetEventHandler = function(params) {
    this.schema = params.schema;
  };

  IOTFeed.prototype._descriptionChangedEventHandler = function(params) {
    this.description = params.description;
  }

  IOTFeed.prototype._tagsChangedEventHandler = function(params) {
    this.tags = params.tags;
  };

  return IOTFeed;
}());
