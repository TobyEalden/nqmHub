/*
The MIT License (MIT)

Copyright (c) 2014 Matt Walters & 2015 Toby Ealden

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

"use strict";

exports.Repository = (function() {
  var log = require('debug')('eventRepository');
  var Promise = require("bluebird");
  var dbConnection = require("../mongoConnectionFactory").commandDb;
  var util = require('util');
  var _ = require('lodash');

  function Repository(entityType, options, eventBus) {
    options = options || {};
    var db = dbConnection.db();
    if (!db) {
      throw new Error('mongo has not been initialized. you must call require(\'mongoConnectionFactory\').commandDb.start(); before instantiating a Repository');
    }
    var indices = _.union(options.indices, ['id', 'version']);
    var self = this;
    self.entityType = entityType;
    self.indices = indices;
    self.snapshotFrequency = options.snapshotFrequency || 10;

    self.collectionBaseName = options.collectionBaseName || entityType.name;
    var snapshotCollectionName = util.format('%s.snapshots', self.collectionBaseName);
    var snapshots = db.collection(snapshotCollectionName);
    self.snapshots = snapshots;
    var eventCollectionName = util.format('%s.events', self.collectionBaseName);
    var events = db.collection(eventCollectionName);
    self.events = events;

    self.eventBus = eventBus;

    var indexCallback = function (err) {
      if (err) {
        log("failure creating indices - %s",err.message);
      }
    };

    self.indices.forEach(function (index) {
      snapshots.createIndex(index, indexCallback);
      events.createIndex(index, indexCallback);
    });
    events.createIndex({ id: 1, version: 1 }, indexCallback);
    snapshots.createIndex({ id: 1, version: 1 }, indexCallback);
    snapshots.createIndex('snapshotVersion', indexCallback);

    log('initialized %s entity store', self.collectionBaseName);
  }

  Repository.prototype.factory = function factory(snapshot, events) {
    return new this.entityType(snapshot, events);
  };

  Repository.prototype.commit = function commit (entity, options) {
    var self = this;
    options = options || {};
    log('committing %s for id %s', this.collectionBaseName, entity.id);

    return self._commitEvents(entity).then(function() {
      return self._commitSnapshots(entity, options).then(function() {
        self._emitEvents(entity);
      });
    });
  };

  Repository.prototype.commitAll = function commit (entities, options) {
    options = options || {};

    var self = this;

    log('committing %s for id %j', this.collectionBaseName, _.pluck(entities, 'id'));

    return this._commitAllEvents(entities).then(function() {
      return self._commitAllSnapshots(entities, options).then(function () {
        entities.forEach(function (entity) {
          self._emitEvents(entity);
        });
      });
    });
  };

  Repository.prototype.get = function get (id) {
    var self = this;

    log('getting %s for id %s', this.collectionBaseName, id);

    return this.snapshots
      .find({ id: id })
      .sort({ version: -1 })
      .limit(1)
      .toArrayAsync().then(function (snapshots) {
        var snapshot = snapshots[0];
        var criteria = (snapshot) ? { id: id, version: { $gt: snapshot.version } } : { id: id };
        return self.events.find(criteria)
          .sort({ version: 1 })
          .toArrayAsync().then(function (events) {
            if (snapshot) delete snapshot._id;
            if ( ! snapshot && ! events.length) {
              return null;
            }
            var entity = self._deserialize(id, snapshot, events);
            return entity;
          });
      });
  };

  Repository.prototype.getAll = function getAll (ids) {
    var self = this;

    log('getting %ss for ids %j', this.collectionBaseName, ids);

    return this._getAllSnapshots(ids).then(function (snapshots) {
      return self._getAllEvents(ids, snapshots).then(function (entities) {
        return entities;
      });
    });
  };

  Repository.prototype._commitEvents = function(entity) {
    var self = this;

    if (entity.changes.length === 0) {
      return Promise.resolve();
    }

    var events = entity.changes;
    events.forEach(function (event) {
      if (event && event._id) {
        // mongo will blow up if we try to insert multiple _id keys
        delete event._id;
      }
      self.indices.forEach(function (index) {
        event[index] = entity[index];
      });
    });

    return self.events.insertManyAsync(events).then(function() {
      log('committed %s.events for id %s', self.collectionBaseName, entity.id);
    });
  };

  Repository.prototype._commitAllEvents = function(entities) {
    var self = this;

    var events = [];
    entities.forEach(function (entity) {
      if (entity.changes.length > 0) {
        entity.changes.forEach(function _applyIndices(event) {
          if (event && event._id) {
            // mongo will blow up if we try to insert multiple _id keys
            delete event._id;
          }
          self.indices.forEach(function (index) {
            event[index] = entity[index];
          });
        });
        Array.prototype.unshift.apply(events, entity.changes);
      }
    });

    if (events.length === 0) {
      return Promise.resolve();
    }

    return self.events.insertManyAsync(events).then(function () {
      log('committed %s.events for ids %j', self.collectionBaseName, _.pluck(entities, 'id'));
    });
  };

  Repository.prototype._commitSnapshots = function(entity, options) {
    var self = this;

    if (options.forceSnapshot || entity.version >= entity.snapshotVersion + self.snapshotFrequency) {
      var snapshot = entity.snapshot();
      if (snapshot && snapshot._id) {
        // mongo will blow up if we try to insert multiple _id keys
        delete snapshot._id;
      }
      return self.snapshots.insertOneAsync(snapshot).then(function() {
        log('committed %s.snapshot for id %s %j', self.collectionBaseName, entity.id, snapshot);
        return entity;
      });
    } else {
      return Promise.resolve(entity);
    }
  };

  Repository.prototype._commitAllSnapshots = function _commitAllSnapshots (entities, options) {
    var self = this;

    var snapshots = [];
    entities.forEach(function (entity) {
      if (options.forceSnapshot || entity.version >= entity.snapshotVersion + self.snapshotFrequency) {
        var snapshot = entity.snapshot();
        if (snapshot) {
          if (snapshot._id) delete snapshot._id; // mongo will blow up if we try to insert multiple _id keys)
          snapshots.push(snapshot);
        }
      }
    });

    if (snapshots.length === 0) {
      return Promise.resolve();
    }

    return self.snapshots.insertManyAsync(snapshots).then(function() {
      log('committed %s.snapshot for ids %s %j', self.collectionBaseName, _.pluck(entities, 'id'), snapshots);
      return entities;
    });
  };

  Repository.prototype._deserialize = function _deserialize (id, snapshot, events) {
    log('deserializing %s entity ', this.collectionBaseName);
    var entity = this.factory(snapshot, events);
    entity.id = id;
    return entity;
  };

  Repository.prototype._emitEvents = function _emitEvents (entity) {
    var self = this;

    var eventsToEmit = entity.changes;
    entity.changes = [];

    if (this.eventBus) {
      eventsToEmit.forEach(function (eventToEmit) {
        self.eventBus.publish(self.collectionBaseName + self.eventBus.delimiter + eventToEmit.event, eventToEmit);
      });
    }

    log('emitted events for id %s', entity.id);
  };

  Repository.prototype._getAllSnapshots = function _getAllSnapshots (ids) {
    var self = this;

    var match = { $match: { id: { $in: ids } } };
    var group = { $group: { _id: '$id', snapshotVersion: { $last: '$snapshotVersion' } } };

    return self.snapshots.aggregateAsync([match, group]).then(function (idVersionPairs) {
      var criteria = {};
      if (idVersionPairs.length === 0) {
        return [];
      } else if (idVersionPairs.length === 1) {
        criteria = { id: idVersionPairs[0]._id, snapshotVersion: idVersionPairs[0].snapshotVersion };
      } else {
        criteria.$or = [];
        idVersionPairs.forEach(function (pair) {
          var cri = { id: pair._id, snapshotVersion: pair.snapshotVersion };
          criteria.$or.push(cri);
        });
      }
      return self.snapshots.find(criteria).toArrayAsync();
    });
  };

  Repository.prototype._getAllEvents = function _getAllEvents (ids, snapshots) {
    var self = this;

    var criteria = { $or: [] };
    ids.forEach(function (id) {
      var snapshot;
      if ( ! (snapshot = _.find(snapshots, function (snapshot) {
          return id === snapshot.id;
        }))) {
        criteria.$or.push({ id: id });
      } else {
        criteria.$or.push({ id: snapshot.id, version: { $gt: snapshot.snapshotVersion } });
      }
    });

    return self.events.find(criteria)
      .sort({ id: 1, version: 1 })
      .toArrayAsync().then(function (events) {
        if ( ! snapshots.length && ! events.length) {
          return null;
        }
        var results = [];
        ids.forEach(function (id) {
          var snapshot = _.find(snapshots, function (snapshot) {
            return snapshot.id === id;
          });
          if (snapshot) {
            delete snapshot._id;
          }
          var evnts = _.filter(events, function (event) {
            return event.id === id;
          });
          var entity = self._deserialize(id, snapshot, evnts);
          results.push(entity);
        });
        return results;
      });
  };

  return Repository;
}());