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
    if (JSON.stringify(params.schema) !== JSON.stringify(this.schema)) {
      log("setting schema to %j",params);
      this.applyEvent("schemaSet",params);
    } else {
      log("setSchema ignored - schema not changed");
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

  Dataset.prototype._createdEventHandler = function(params) {
    this.id = params.id;
    this.name = params.name;
    this.schema = params.schema;
    this.uniqueIndex = params.uniqueIndex;
    this.store = params.store;
    this.__deleted = false;
    this.__created = params.__timestamp;
  };

  Dataset.prototype._schemaSetEventHandler = function(params) {
    this.schema = params.schema;
    this.uniqueIndex = params.uniqueIndex;
  };

  Dataset.prototype._renamedEventHandler = function(params) {
    this.name = params.name;
  };

  Dataset.prototype._deletedEventHandler = function(params) {
    this.__deleted = true;
  };

  return Dataset;
}());