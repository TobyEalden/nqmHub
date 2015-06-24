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
  var eventBus = require("./eventBus").EventBus;

  function Repository(entityType, options) {
    options = options || {};
    var self = this;

    var db = dbConnection.db();
    if (!db) {
      throw new Error('mongo has not been initialized. you must call require(\'mongoConnectionFactory\').commandDb.start(); before instantiating a Repository');
    }

    self.entityType = entityType;
    self.snapshotFrequency = options.snapshotFrequency || 10;
    self.singleSnapshot = (options.singleSnapshot === true);
    self.publishEvents = (options.publishEvents !== false);

    self.collectionBaseName = options.collectionBaseName || entityType.name;
    var snapshotCollectionName = util.format('%s.snapshots', self.collectionBaseName);
    var snapshots = db.collection(snapshotCollectionName);
    self.snapshots = snapshots;
    var eventCollectionName = util.format('%s.events', self.collectionBaseName);
    var events = db.collection(eventCollectionName);
    self.events = events;

    var indexCallback = function (err) {
      if (err) {
        log("failure creating indices - %s",err.message);
      }
    };

    // Create indices.
    if (!options.indices) {
      options.indices =  entityType.getKey();
    }
    if (options.indices.length > 0) {
      self.indices = _.union(options.indices, ['__version']);

      var compound = {};
      _.forEach(self.indices, function(idx) {
        compound[idx] = 1;
      });

      // Create compound index for entire key.
      events.createIndex(compound, indexCallback);
      snapshots.createIndex(compound, indexCallback);

      // Create single index for each key component.
      self.indices.forEach(function (index) {
        snapshots.createIndex(index, indexCallback);
        events.createIndex(index, indexCallback);
      });

      // Create version index for snapshots.
      snapshots.createIndex('__snapshotVersion', indexCallback);
    } else {
      self.indices = [];
    }

    log('initialized %s entity store', self.collectionBaseName);
  }

  Repository.prototype.factory = function factory(snapshot, events, key) {
    return new this.entityType(snapshot, events, key);
  };

  Repository.prototype.commit = function commit (entity, options) {
    options = options || {};
    var self = this;
    log('committing %s for key %j', this.collectionBaseName, entity.getKey(self.indices));

    return self._commitEvents(entity).then(function() {
      return self._commitSnapshots(entity, options).then(function() {
        self._emitEvents(entity);
      });
    });
  };

  Repository.prototype.commitAll = function commit (entities, options) {
    options = options || {};
    var self = this;
    log('committing %s for %d entities', this.collectionBaseName, entities.length);

    return this._commitAllEvents(entities).then(function() {
      return self._commitAllSnapshots(entities, options).then(function () {
        entities.forEach(function (entity) {
          self._emitEvents(entity);
        });
      });
    });
  };

  Repository.prototype.get = function(keyIn) {
    var self = this;
    var key;
    if (keyIn instanceof Array) {
      key = keyIn;
    } else {
      key = [keyIn];
    }

    // Generate lookup key.
    var lookup = {};
    var i = 0;
    _.forEach(key, function(k) {
      lookup[self.indices[i]] = k;
      i++;
    });
    log('getting %s for key %j', this.collectionBaseName, lookup);

    return this.snapshots
      .find(lookup)
      .sort({ __version: -1 })
      .limit(1)
      .toArrayAsync().then(function (snapshots) {
        var snapshot = snapshots[0];
        var criteria = _.cloneDeep(lookup,true);
        if (snapshot) {
          criteria.__version = { $gt: snapshot.__version }
        }
        return self.events.find(criteria)
          .sort({ __version: 1 })
          .toArrayAsync().then(function (events) {
            if (snapshot) {
              delete snapshot._id;
            }
            if (!snapshot && !events.length) {
              return null;
            }
            return self._deserialize(lookup, snapshot, events);
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

    if (entity.m_changes.length === 0) {
      return Promise.resolve();
    }

    var events = entity.m_changes;
    events.forEach(function (event) {
      if (event && event._id) {
        // mongo will blow up if we try to insert multiple _id keys
        delete event._id;
      }
      self.indices.forEach(function (index) {
        event[index] = entity[index];
        delete event.params[index];
      });
    });

    return self.events.insertManyAsync(events).then(function() {
      log('committed %s.events for key %j', self.collectionBaseName, entity.getKey(self.indices));
    });
  };

  Repository.prototype._commitAllEvents = function(entities) {
    var self = this;

    var events = [];
    entities.forEach(function (entity) {
      if (entity.m_changes.length > 0) {
        entity.m_changes.forEach(function _applyIndices(event) {
          if (event && event._id) {
            // mongo will blow up if we try to insert multiple _id keys
            delete event._id;
          }
          self.indices.forEach(function (index) {
            event[index] = entity[index];
          });
        });
        Array.prototype.unshift.apply(events, entity.m_changes);
      }
    });

    if (events.length === 0) {
      return Promise.resolve();
    }

    return self.events.insertManyAsync(events).then(function () {
      log('committed %s.events for %d entities', self.collectionBaseName, entities.length);
    });
  };

  Repository.prototype._commitSnapshots = function(entity, options) {
    var self = this;

    if (options.forceSnapshot || entity.__version >= entity.__snapshotVersion + self.snapshotFrequency) {
      var snapshot = entity.snapshot();
      if (snapshot && snapshot._id) {
        // mongo will blow up if we try to insert multiple _id keys
        delete snapshot._id;
      }
      var entityKey = entity.getKey(self.indices);
      if (self.singleSnapshot) {
        return self.snapshots.updateOneAsync(entityKey, snapshot, { upsert: true }).then(function() {
          log('committed %s.snapshot for key %j %j', self.collectionBaseName, entityKey, snapshot);
          return entity;
        });
      } else {
        return self.snapshots.insertOneAsync(snapshot).then(function() {
          log('committed %s.snapshot for key %j %j', self.collectionBaseName, entityKey, snapshot);
          return entity;
        });
      }
    } else {
      return Promise.resolve(entity);
    }
  };

  Repository.prototype._commitAllSnapshots = function _commitAllSnapshots (entities, options) {
    var self = this;

    var snapshots = [];
    entities.forEach(function (entity) {
      if (options.forceSnapshot || entity.__version >= entity.__snapshotVersion + self.snapshotFrequency) {
        var snapshot = entity.snapshot();
        if (snapshot) {
          if (snapshot._id) {
            // mongo will blow up if we try to insert multiple _id keys)
            delete snapshot._id;
          }
          snapshots.push(snapshot);
        }
      }
    });

    if (snapshots.length === 0) {
      return Promise.resolve();
    }

    return self.snapshots.insertManyAsync(snapshots).then(function() {
      log('committed %s.snapshot for %d entities %j', self.collectionBaseName, entities.length, snapshots);
      return entities;
    });
  };

  Repository.prototype._deserialize = function _deserialize (key, snapshot, events) {
    log('deserializing %s entity with key %j', this.collectionBaseName, key);
    return this.factory(snapshot, events, key);
  };

  Repository.prototype._emitEvents = function _emitEvents (entity) {
    var self = this;

    var eventsToEmit = entity.m_changes;
    entity.m_changes = [];

    eventsToEmit.forEach(function (eventToEmit) {
      eventBus.publish(self.collectionBaseName + eventBus.delimiter + eventToEmit.event, eventToEmit);
    });

    log('emitted events for key %j', entity.getKey(self.indices));
  };

  Repository.prototype._getAllSnapshots = function _getAllSnapshots (ids) {
    var self = this;

    var match = { $match: { id: { $in: ids } } };
    var group = { $group: { _id: '$id', __snapshotVersion: { $last: '$__snapshotVersion' } } };

    return self.snapshots.aggregateAsync([match, group]).then(function (idVersionPairs) {
      var criteria = {};
      if (idVersionPairs.length === 0) {
        return [];
      } else if (idVersionPairs.length === 1) {
        criteria = { id: idVersionPairs[0]._id, __snapshotVersion: idVersionPairs[0].__snapshotVersion };
      } else {
        criteria.$or = [];
        idVersionPairs.forEach(function (pair) {
          var cri = { id: pair._id, __snapshotVersion: pair.__snapshotVersion };
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
        criteria.$or.push({ id: snapshot.id, __version: { $gt: snapshot.__snapshotVersion } });
      }
    });

    return self.events.find(criteria)
      .sort({ id: 1, __version: 1 })
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