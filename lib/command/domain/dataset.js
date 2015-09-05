/**
 * Created by toby on 24/06/15.
 */

module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:domain/dataset");
  var errLog = require("debug")("nqmHub:error");
  var Entity = require("./entity");
  var util = require("util");
  var _ = require("lodash");
  var common = require("../../common");

  function Dataset() {
    this.id = "";
    this.name = "";
    this.schema = {};
    this.uniqueIndex = [];
    this.shareMode = "public";

    Entity.apply(this, arguments);
  }
  util.inherits(Dataset, Entity);

  // Static method specifying the unique indices for Dataset.
  Dataset.getKey = function() {
    return [ "id" ];
  };

  Dataset.prototype.create = function(params) {
    log("creating with %j",params);
    params.store = params.store || ("dataset." + common.randomTextId());
    this.applyEvent("created",params);
  };

  Dataset.prototype.setSchema = function(params) {
    if ((params.schema && JSON.stringify(params.schema) !== JSON.stringify(this.schema)) ||
      (params.uniqueIndex && JSON.stringify(params.uniqueIndex) !== JSON.stringify(this.uniqueIndex))) {
      log("setting schema to %j",params);
      this.applyEvent("schemaSet",params);
    } else {
      log("setSchema ignored - schema not changed");
    }
  };

  Dataset.prototype.setShareMode = function(params) {
    if (params.shareMode !== this.shareMode) {
      log("setting share mode from %s to %s",this.shareMode, params.shareMode);
      this.applyEvent("shareModeSet", params);
    } else {
      log("setShareMode ignored => no change");
    }
  };

  Dataset.prototype.rename = function(params) {
    if (this.name !== params.name) {
      log("rename to %s", params.name);
      this.applyEvent("renamed", params);
    }
  };

  Dataset.prototype.delete = function(params) {
    log("delete with %j", params);
    this.applyEvent("deleted", params);
  };

  Dataset.prototype.setTags = function(params) {
    if (JSON.stringify(params.tags) !== JSON.stringify(this.tags)) {
      log("setting tags to %j", params);
      this.applyEvent("tagsChanged", params);
    } else {
      log("setTags ignored - tags haven't changed");
    }
  };

  Dataset.prototype.setDescription = function(params) {
    if (this.description !== params.description) {
      log("changing description from %s to %s", this.description, params.description);
      this.applyEvent("descriptionChanged", params);
    } else {
      log("setDescription ignored - not changed");
    }
  };

  Dataset.prototype._createdEventHandler = function(params) {
    this.id = params.id;
    this.owner = params.owner;
    this.name = params.name;
    this.description = params.description;
    this.tags = params.tags;
    this.schema = params.schema;
    this.uniqueIndex = params.uniqueIndex;
    this.store = params.store;
    this.shareMode = params.shareMode;
    this.__deleted = false;
    this.__created = params.__timestamp;
  };

  Dataset.prototype._schemaSetEventHandler = function(params) {
    if (params.schema) {
      this.schema = params.schema;
    }
    if (params.uniqueIndex) {
      this.uniqueIndex = params.uniqueIndex;
    }
  };

  Dataset.prototype._descriptionChangedEventHandler = function(params) {
    this.description = params.description;
  };

  Dataset.prototype._tagsChangedEventHandler = function(params) {
    this.tags = params.tags;
  };

  Dataset.prototype._renamedEventHandler = function(params) {
    this.name = params.name;
  };

  Dataset.prototype._shareModeSetEventHandler = function(params) {
    this.shareMode = params.shareMode;
  };

  Dataset.prototype._deletedEventHandler = function(params) {
    this.__deleted = true;
  };

  return Dataset;
}());