/**
 * Created by toby on 24/06/15.
 */

module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:domain/datasetDoc");
  var errLog = require("debug")("nqmHub:error:domain/datasetDoc");
  var Entity = require("./entity");
  var util = require("util");
  var _ = require("lodash");
  var jsonPointer = require("json-pointer");

  function DatasetDoc() {
    Entity.apply(this, arguments);
  }

  util.inherits(DatasetDoc, Entity);

  DatasetDoc.prototype.create = function(params) {
    log("create with %j", params);
    this.applyEvent("created",params);
  };

  DatasetDoc.prototype.update = function(params) {
    log("update with %j", params);
    this.applyEvent("updated",params);
  };

  DatasetDoc.prototype.upsert = function(params) {
    log("upsert with %j", params);
    this.applyEvent("upsert", params);
  };

  DatasetDoc.prototype.delete = function(params) {
    log("delete with %j", params);
    this.applyEvent("deleted",params);
  };

  var mergeParams = function(params) {
    _.forEach(params, function(v,k) {
      this[k] = v;
    }, this);
  };

  DatasetDoc.prototype._createdEventHandler = function(params) {
    mergeParams.call(this, params);
    this.__created = params.__timestamp;
    this.__deleted = false;
  };

  DatasetDoc.prototype._updatedEventHandler = function(params) {
    mergeParams.call(this, params);
  };

  DatasetDoc.prototype._deletedEventHandler = function(/* params */) {
    this.__deleted = true;
  };

  var applyUpdate = function(update) {
    var tmp;
    switch (update.method) {
      case "add":
        jsonPointer.set(this, update.pointer, update.value);
        break;
      case "replace":
        jsonPointer.set(this, update.pointer, update.value);
        break;
      case "remove":
        jsonPointer.remove(this, update.pointer);
        break;
      case "move":
        tmp = jsonPointer.get(this, update.pointer);
        jsonPointer.remove(this, update.pointer);
        jsonPointer.set(this, update.value, tmp);
        break;
      case "copy":
        tmp = jsonPointer.get(this, update.pointer);
        jsonPointer.set(this, update.value, tmp);
        break;
      default:
        errLog("unrecognised update method '%s'", update.method);
        break;
    }
  };

  DatasetDoc.prototype._upsertEventHandler = function(params) {
    _.forEach(params.update, function(update) {
      applyUpdate.call(this, update);
    },this);

    this.__deleted = false;
  };

  return DatasetDoc;
}());

