/**
 * Created by toby on 24/06/15.
 */

"use strict";

exports.Normaliser = (function() {
  var log = require("debug")("DatasetNormaliser");
  var Promise = require("bluebird");
  var mongo = require('../../mongoConnectionFactory');
  var eventBus = require("../../events/eventBus").EventBus;
  var Repository = require("../../events/eventRepository").Repository;
  var Dataset = require("../../command/domain/dataset");
  var DatasetRow = require("../../command/domain/datasetRow");
  var _ = require("lodash");
  var datasetCollection = "read.dataset";

  function DatasetNormaliser() {
    log("constructor");
    this._datasetRepo = null;
    this._datasetCache = {};
  }

  DatasetNormaliser.prototype.start = function() {
    var self = this;
    log("starting");

    // Listen for dataset related events.
    eventBus.on("dataset.*", function(evt) {
      dataHandler.call(self, this.event, evt);
    });

    // Get repositories to access command-side dataset data.
    self._datasetRepo = new Repository(Dataset);

    // Re-create query-side dataset collection and index.
    var db = mongo.queryDb.db();
    self.datasets = db.collection(datasetCollection);
    if (self.datasets) {
      self.datasets.drop();
    }
    return self.datasets.createIndexAsync({ id: 1 }).bind(this).then(primeCache);
  };

  var errorCheck = function(err) {
    if (err) {
      log("failure writing to %s [%s]",datasetCollection,err.message);
    }
  };

  var getDataRepository = function(dataset) {
    var indices = dataset.schema.keys.slice();
    indices.unshift("datasetId");
    return {
      indices: indices,
      repo: new Repository(DatasetRow, { indices: indices, collectionBaseName: dataset.store })
    };
  };

  var dataHandler = function(eventName, evt) {
    var self = this;
    log("received data event %s",eventName);

    // Data events are of the form dataset.<collectionId>.<event>
    var lookup = eventName.split(".");
    if (lookup.length > 2) {
      var repo = new Repository(DatasetRow);
      var dataset = getFromCache.call(this, evt.datasetId);
      if (dataset) {
        var dataEventName = lookup[2];
        switch (dataEventName) {
          case "created":
            self.feeds.insertOne({id: lookup[1], hubId: lookup[0], datum: evt.params }, errorCheck);
            break;
          case "updated":
            addToCache.call(self, evt.params.id).bind(this).then(saveCache, errorCheck);
            break;
          case "deleted":
            var dataset = getFromCache.call(self, evt.params.id);
            dataset.replay([evt]);
            saveCache.call(self, dataset).then(null, errorCheck);
            break;
          default:
            log("ignoring unknown dataset data event %s",dataEventName);
            break;
        }
      } else {
        log("failed to get dataset for id %s",evt.datasetId);
      }
    }
  };

  var trimForCache = function(ent) {
    var cloned = _.clone(ent, true);
    delete cloned._id;
    delete cloned.version;
    delete cloned.timestamp;
    delete cloned.snapshotVersion;
    return cloned;
  };

  var saveCache = function(dataset) {
    log("saving dataset %s to db",dataset.id);
    var cleanDataset = trimForCache(dataset);
    return this.datasets.updateOneAsync({ id: dataset.id }, cleanDataset, { upsert: true });
  };

  var addToCache = function(id) {
    var self = this;

    return this._datasetRepo.get(id).then(function(dataset) {
      if (!dataset || dataset.deleted) {
        var err = new Error("not found");
        log("failed to get dataset %s from db [%s]",id, err.message);
        throw err;
      }
      log("adding %s [%s] to cache", dataset.id, dataset.name);
      // Store a snapshot in the cache.
      self._datasetCache[id] = dataset.snapshot();
      return self._datasetCache[id];
    });
  };

  var loadDataset = function(d) {
    return addToCache.call(this, d.id).bind(this).then(saveCache);
  };

  var loadDatasets = function(ds) {
    var promises = [];
    _.each(ds, function(d) {
      promises.push(loadDataset.call(this, d));
    }, this);
    return Promise.all(promises).then(function() { log("all datasets loaded"); });
  };

  var primeCache = function() {
    var self = this;
    log("priming dataset cache");

    // Get all Dataset.created events from command database.
    var ds = mongo.commandDb.db().collection("Dataset.events");
    return ds.find({ event: "created" }).toArrayAsync().bind(self).then(loadDatasets);
  };

  var getFromCache = function(id) {
    if (!this._datasetCache.hasOwnProperty(id)) {
      log("dataset %s not found in cache", id);
    }
    return this._datasetCache[id];
  };

  var deleteFromCache = function(id) {
    var self = this;
    log("deleting %s from cache", id);
    return self.datasets.deleteOneAsync({id: id }).then(function() {
      delete self._datasetCache[id];
    }, function(err) {
      log("failed to delete dataset %d [%s]",id, err.message);
    });
  };

  DatasetNormaliser.prototype.getByUser = function(userId) {
    // Get all datasets for the user.
  };

  DatasetNormaliser.prototype.get = function(datasetId) {
    return getFromCache.call(this, datasetId);
  };

  return DatasetNormaliser;
}());
