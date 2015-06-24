/**
 * Created by toby on 24/06/15.
 */

"use strict";

module.exports = (function() {
  var log = require("debug")("domain/datasetRow");
  var Entity = require("./entity");
  var util = require("util");
  var _ = require("lodash");

  function DatasetRow() {
    this.__deleted = false;
    this.__created = Date.now();
    this.__modified = Date.now();
    Entity.apply(this, arguments);
  }

  util.inherits(DatasetRow, Entity);

  DatasetRow.prototype.create = function(params) {
    log("create with %j", params);
    params.__created = Date.now();
    this.applyEvent("created",params);
  };

  DatasetRow.prototype.update = function(params) {
    log("update with %j", params);
    params.__modified = Date.now();
    this.applyEvent("updated",params);
  };

  DatasetRow.prototype.delete = function(params) {
    log("delete with %j", params);
    params.__modified = Date.now();
    this.applyEvent("deleted",params);
  };

  var mergeParams = function(params) {
    _.forEach(params, function(v,k) {
      this[k] = v;
    }, this);
  };

  DatasetRow.prototype._createdEventHandler = function(params) {
    mergeParams.call(this, params);
  };

  DatasetRow.prototype._updatedEventHandler = function(params) {
    mergeParams.call(this, params);
  };

  DatasetRow.prototype._deletedEventHandler = function(params) {
    this.__modified = params.modified;
    this.__deleted = true;
  };

  return DatasetRow;
}());

