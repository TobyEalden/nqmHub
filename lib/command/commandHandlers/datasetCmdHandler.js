/**
 * Created by toby on 24/06/15.
 */

"use strict";

module.exports = (function() {
  var log = require("debug")("DatasetCmdHandler");
  var Promise = require("bluebird");
  var _ = require("lodash");
  var Dataset = require("../domain/dataset");
  var DatasetRow = require("../domain/datasetRow");
  var Repository = require("../../events/eventRepository").Repository;

  function DatasetCmdHandler() {
    this._datasetRepo = new Repository(Dataset);
  }

  var createDataset = function(params) {
    var self = this;
    // Check the hub exists.
    return this._datasetRepo.get(params.id).then(function(dataset) {
      // Check that a dataset doesn't already exist with this id.
      if (dataset) {
        throw new Error("dataset already exists with id: " + params.id);
      }
      dataset = self._datasetRepo.factory();
      dataset.create(params);
      return self._datasetRepo.commit(dataset);
    });
  };

  var datasetMethod = function(method, params) {
    var self = this;
    return this._datasetRepo.get(params.id).then(function(dataset) {
      if (!dataset) {
        throw new Error("dataset not found with id %s",params.id);
      }
      dataset[method](params);
      return self._datasetRepo.commit(dataset);
    });
  };

  var renameDataset = function(params) {
    return datasetMethod.call(this, "rename", params);
  };

  var setSchema = function(params) {
    return datasetMethod.call(this, "setSchema", params);
  };

  var dataCreate = function(params) {
    return this._datasetRepo.get(params.id).then(function(dataset) {
      if (!dataset) {
        throw new Error("dataset not found with id %s",params.id);
      }
      var storeRepo = new Repository(DatasetRow, { collectionBaseName: dataset.store });
      var newRow = storeRepo.factory();
      newRow.create(params);
      return storeRepo.commit(newRow);
    });
  };

  var dataMethod = function(method, params) {
    return this._datasetRepo.get(params.id).then(function(dataset) {
      if (!dataset) {
        throw new Error("dataset not found with id %s",params.id);
      }
      var storeRepo = new Repository(DatasetRow, { collectionBaseName: dataset.store });
      return storeRepo.get(params.id).then(function(row) {
        if (!row) {
          throw new Error("no data found with id %s", params.id);
        }
        row[method](params);
        return storeRepo.commit(row);
      });
    });
  };

  var dataUpdate = function(params) {
    return dataMethod.call(this, "update", params);
  };

  var dataDelete = function(params) {
    return dataMethod.call(this, "delete", params);
  };

  DatasetCmdHandler.prototype.execute = function(cmd) {
    var promise;

    switch (cmd.command) {
      case "dataset/create":
        promise = createDataset.call(this, cmd.params);
        break;
      case "dataset/schema/set":
        promise = setSchema.call(this, cmd.params);
        break;
      case "dataset/rename":
        promise = renameDataset.call(this, cmd.params);
        break;
      case "dataset/data/create":
        promise = dataCreate.call(this, cmd.params);
        break;
      case "dataset/data/update":
        promise = dataUpdate.call(this, cmd.params);
        break;
      case "dataset/data/delete":
        promise = dataDelete.call(this, cmd.params);
        break;
      default:
        log("iot hub command handler - unknown command: %s", cmd.command);
        promise = Promise.reject(new Error("iot hub command handler - unknown command: " + cmd.command));
        break;
    }

    return promise;
  };

  return DatasetCmdHandler;
}());
