/**
 * Created by toby on 24/06/15.
 */

module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:DatasetCmdHandler");
  var errLog = require("debug")("nqmHub:error");
  var Promise = require("bluebird");
  var _ = require("lodash");
  var jsonPointer = require("json-pointer");
  var Dataset = require("../domain/dataset");
  var DatasetDoc = require("../domain/datasetDoc");
  var Repository = require("../../events/eventRepository").Repository;
  var util = require("util");
  var common = require("../../common");

  function DatasetCmdHandler() {
    this._datasetRepo = new Repository(Dataset);
  }

  var createDataset = function(params) {
    var self = this;
    params.id = params.id || util.format("dataset-%s",common.randomTextId(6));
    return this._datasetRepo.get(params.id).then(function(dataset) {
      // Check that a dataset doesn't already exist with this id.
      if (dataset && !dataset.__deleted) {
        throw new Error(util.format("dataset already exists with key %j", params.id));
      }
      if (!dataset) {
        dataset = self._datasetRepo.factory();
      }
      dataset.create(params);
      return self._datasetRepo.commit(dataset);
    });
  };

  var updateDataset = function(params) {
    var self = this;
    // Check that a dataset exists with this name.
    return self._datasetRepo.get(params.id).then(function(dataset) {
      if (!dataset || dataset.__deleted) {
        throw new Error("dataset doesn't exist with id: " + params.id);
      } else {
        dataset.rename(params);
        dataset.setTags(params);
        dataset.setDescription(params);
        dataset.setSchema(params);
        return self._datasetRepo.commit(dataset);
      }
    });
  };

  var datasetMethod = function(method, params) {
    var self = this;
    return this._datasetRepo.get(params.id).then(function(dataset) {
      if (!dataset || dataset.__deleted) {
        throw new Error(util.format("dataset not found with id '%s'",params.id));
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

  var setDatasetShareMode = function(params) {
    return datasetMethod.call(this, "setShareMode", params);
  };

  var deleteDataset = function(params) {
    return datasetMethod.call(this, "delete", params);
  };

  var getDataRepository = function(dataset) {
    // Get indices of dataset schema as array of field names.
    var uniqueKeys = [];
    if (dataset.uniqueIndex) {
      _.forEach(dataset.uniqueIndex, function(i) {
        uniqueKeys.push(i.asc ? i.asc : i.desc);
      });
    }
    return {
      indices: uniqueKeys,
      repo: new Repository(DatasetDoc, { indices: uniqueKeys, collectionBaseName: dataset.store })
    };
  };

  /*
   * Get array of values corresponding to the given array of field names,
   * where field names can be in dot-notation form, e.g. company.address.postcode
   */
  var getDataKey = function(fieldPaths, params) {
    var key = [];
    _.forEach(fieldPaths, function(k) {
      // ToDo - review. Need to translate from mongoose index format to jsonpointer.
      var lookup = common.dotNotationToJSONPointer(k);
      var keyVal = jsonPointer.get(params, lookup);
      if (keyVal === undefined) {
        errLog("getDataKey - undefined key value for %s", k);
      }
      key.push(keyVal);
    });
    return key;
  };

  var doCreate = function(storeRepo, params, keyCache) {
    var key = getDataKey(storeRepo.indices, params);
    return storeRepo.repo.get(key).then(function(row) {
      if ((row && row.__deleted !== true) || (keyCache && keyCache.hasOwnProperty(key.join("-")))) {
        throw new Error(util.format("data already exists with key %j",key));
      }
      if (keyCache) {
        keyCache[key.join("-")] = true;
      }
      if (!row) {
        row = storeRepo.repo.factory();
      }
      row.create(params);
      return row;
    });
  };

  var dataCreate = function(params) {
    return this._datasetRepo.get(params.datasetId).then(function(dataset) {
      if (!dataset || dataset.__deleted) {
        throw new Error(util.format("dataset not found with id %s",params.datasetId));
      }
      var storeRepo = getDataRepository(dataset);
      doCreate(storeRepo, params)
        .then(function(row) {
          return storeRepo.repo.commit(row);
        })
        .catch(function(err) {
          return Promise.resolve(err.message);
        });
    });
  };

  var dataCreateMany = function(params) {
    return this._datasetRepo.get(params.datasetId).then(function(dataset) {
      if (!dataset || dataset.__deleted) {
        throw new Error(util.format("dataset not found with id %s",params.datasetId));
      }
      var storeRepo = getDataRepository(dataset);
      var createdKeys = {};
      var promises = [];
      _.forEach(params.payload, function(data) {
        var promise = doCreate(storeRepo, data, createdKeys);
        promises.push(promise);
      });
      return Promise.settle(promises).then(function(results) {
        var commitList = [];
        var errorList = [];
        _.forEach(results, function(r) {
          if (r.isFulfilled()) {
            commitList.push(r.value());
          } else {
            errorList.push(r.reason().message);
            errLog("failed to save data: %s", r.reason());
          }
        });
        return storeRepo.repo.commitAll(commitList).then(function() { return errorList; });
      });
    });
  };

  var doUpsert = function(storeRepo, params) {
    var key = getDataKey(storeRepo.indices, params);
    return storeRepo.repo.get(key).then(function(doc) {
      if (!doc || doc.__deleted) {
        log("dataUpsert - creating document for key %j",key);
        if (!doc) {
          // Create document if one doesn't exist.
          doc = storeRepo.repo.factory();
          // ToDo - review this.
          var createParams = _.cloneDeep(params);
          delete createParams.datasetId;
          delete createParams.update;
          doc.create(createParams);
        }
      } else {
        log("dataUpsert - updating document for key %j", key);
      }
      doc.upsert(params);
      return doc;
    });
  };

  var dataUpsertMany = function(params) {
    return this._datasetRepo.get(params.datasetId).then(function(dataset) {
      if (!dataset || dataset.__deleted) {
        throw new Error(util.format("dataset not found with id %s",params.datasetId));
      }
      var storeRepo = getDataRepository(dataset);
      var promises = [];
      _.forEach(params.payload, function(data) {
        var promise = doUpsert(storeRepo, data);
        promises.push(promise);
      });
      return Promise.settle(promises).then(function(results) {
        var commitList = [];
        var errorList = [];
        _.forEach(results, function(r) {
          if (r.isFulfilled()) {
            commitList.push(r.value());
          } else {
            errorList.push(r.reason().message);
            errLog("failed to save data: %s", r.reason());
          }
        });
        return storeRepo.repo.commitAll(commitList).then(function() { return errorList; });
      });
    });
  };

  var dataUpsert = function(params) {
    return this._datasetRepo.get(params.datasetId).then(function(dataset) {
      if (!dataset || dataset.__deleted) {
        throw new Error(util.format("dataset not found with id %s", params.datasetId));
      }
      var storeRepo = getDataRepository(dataset);
      var key = getDataKey(storeRepo.indices, params);
      return storeRepo.repo.get(key).then(function(doc) {
        if (!doc || doc.__deleted) {
          log("dataUpsert - creating document for key %j",key);
          if (!doc) {
            // Create document if one doesn't exist.
            doc = storeRepo.repo.factory();
            // ToDo - review this.
            var createParams = _.cloneDeep(params);
            delete createParams.datasetId;
            delete createParams.update;
            doc.create(createParams);
          }
        } else {
          log("dataUpsert - updating document for key %j", key);
        }
        doc.upsert(params);
        return storeRepo.repo.commit(doc);
      });
    });
  };

  var dataMethod = function(method, params) {
    return this._datasetRepo.get(params.datasetId).then(function(dataset) {
      if (!dataset || dataset.__deleted) {
        throw new Error(util.format("dataset not found with id %s", params.datasetId));
      }
      var storeRepo = getDataRepository(dataset);
      var key = getDataKey(storeRepo.indices, params);
      return storeRepo.repo.get(key).then(function(row) {
        if (!row || row.__deleted) {
          throw new Error(util.format("no data found with key %j", key));
        }
        row[method](params);
        return storeRepo.repo.commit(row);
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
      case "dataset/update":
        promise = updateDataset.call(this, cmd.params);
        break;
      case "dataset/setShareMode":
        promise = setDatasetShareMode.call(this, cmd.params);
        break;
      case "dataset/delete":
        promise = deleteDataset.call(this, cmd.params);
        break;
      case "dataset/data/create":
        promise = dataCreate.call(this, cmd.params);
        break;
      case "dataset/data/createMany":
        promise = dataCreateMany.call(this, cmd.params);
        break;
      case "dataset/data/update":
        promise = dataUpdate.call(this, cmd.params);
        break;
      case "dataset/data/upsert":
        promise = dataUpsert.call(this, cmd.params);
        break;
      case "dataset/data/upsertMany":
        promise = dataUpsertMany.call(this, cmd.params);
        break;
      case "dataset/data/delete":
        promise = dataDelete.call(this, cmd.params);
        break;
      default:
        errLog("dataset command handler - unknown command: %s", cmd.command);
        promise = Promise.reject(new Error("dataset command handler - unknown command: " + cmd.command));
        break;
    }

    return promise;
  };

  return DatasetCmdHandler;
}());
