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
  var EventEmitter = require('events').EventEmitter;
  var dbConnection = require("../mongoConnectionFactory").commandDb;
  var util = require('util');
  var _ = require('lodash');

  function Repository(entityType, options, eventBus) {
    options = options || {};
    EventEmitter.call(this);
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

    var error = function (err) {
      if (err) return self.emit('error', err);
    };

    self.indices.forEach(function (index) {
      snapshots.createIndex(index, error);
      events.createIndex(index, error);
    });
    events.createIndex({ id: 1, version: 1 }, error);
    snapshots.createIndex({ id: 1, version: 1 }, error);
    snapshots.createIndex('snapshotVersion', error);

    log('initialized %s entity store', self.collectionBaseName);

    self.emit('ready');
  }

  util.inherits(Repository, EventEmitter);

  Repository.prototype.factory = function factory(snapshot, events) {
    var self = this;
    var entity = new this.entityType(snapshot, events);
    if (this.eventBus) {
      entity.onAny(function(data) {
        //var args = Array.prototype.slice.call(arguments);
        //args.unshift(self.collectionBaseName + self.eventBus.delimiter + this.event);
        ////Array.prototype.unshift.call(arguments, self.collectionBaseName + self.eventBus.delimiter + this.event);
        var evt = {
          method: this.event,
          data: data
        };
        self.eventBus.publish(self.collectionBaseName + self.eventBus.delimiter + this.event, evt);
      });
    }
    return entity;
  };

  Repository.prototype.commit = function commit (entity, options, cb) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    var self = this;

    log('committing %s for id %s', this.collectionBaseName, entity.id);

    this._commitEvents(entity, function _afterCommitEvents (err) {
      if (err) return cb(err);
      self._commitSnapshots(entity, options, function _afterCommitSnapshots (err) {
        if (err) return cb(err);
        self._emitEvents(entity);
        return cb();
      });
    });

  };

  Repository.prototype.commitAll = function commit (entities, options, cb) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    var self = this;

    log('committing %s for id %j', this.collectionBaseName, _.pluck(entities, 'id'));

    this._commitAllEvents(entities, function _afterCommitEvents (err) {
      if (err) return cb(err);
      self._commitAllSnapshots(entities, options, function _afterCommitSnapshots (err) {
        if (err) return cb(err);
        var promises = [];
        entities.forEach(function (entity) {
          promises.push(self._emitEvents(entity));
        });
        return cb();
      });
    });

  };

  Repository.prototype.get = function get (id, cb) {
    var self = this;

    log('getting %s for id %s', this.collectionBaseName, id);

    this.snapshots
      .find({ id: id })
      .sort({ version: -1 })
      .limit(1)
      .toArray(function (err, snapshots) {
        if (err) return cb(err);
        var snapshot = snapshots[0];
        var criteria = (snapshot) ? { id: id, version: { $gt: snapshot.version } } : { id: id };
        self.events.find(criteria)
          .sort({ version: 1 })
          .toArray(function (err, events) {
            if (err) return cb(err);
            if (snapshot) delete snapshot._id;
            if ( ! snapshot && ! events.length) return cb(null, null);
            var entity = self._deserialize(id, snapshot, events);
            return cb(null, entity);
          });
      });
  };

  Repository.prototype.getAll = function getAll (ids, cb) {
    var self = this;

    log('getting %ss for ids %j', this.collectionBaseName, ids);

    this._getAllSnapshots(ids, function _afterGetAllSnapshots (err, snapshots) {
      if (err) return cb(err);
      self._getAllEvents(ids, snapshots, function (err, entities) {
        if (err) return cb(err);
        return cb(null, entities);
      });
    });
  };

  Repository.prototype._commitEvents = function _commitEvents (entity, cb) {
    var self = this;

    if (entity.newEvents.length === 0) return cb();

    var events = entity.newEvents;
    events.forEach(function (event) {
      if (event && event._id) delete event._id; // mongo will blow up if we try to insert multiple _id keys
      self.indices.forEach(function (index) {
        event[index] = entity[index];
      });
    });
    self.events.insertMany(events, function (err) {
      if (err) return cb(err);
      log('committed %s.events for id %s', self.collectionBaseName, entity.id);
      entity.eventsToEmit = entity.newEvents;
      entity.newEvents = [];
      return cb();
    });

  };

  Repository.prototype._commitAllEvents = function _commitEvents (entities, cb) {
    var self = this;

    var events = [];
    entities.forEach(function (entity) {
      if (entity.newEvents.length === 0) return;
      var evnts = entity.newEvents;
      evnts.forEach(function _applyIndices (event) {
        if (event && event._id) delete event._id; // mongo will blow up if we try to insert multiple _id keys
        self.indices.forEach(function (index) {
          event[index] = entity[index];
        });
      });
      Array.prototype.unshift.apply(events, evnts);
    });

    if (events.length === 0) return cb();

    self.events.insertMany(events, function (err) {
      if (err) return cb(err);
      log('committed %s.events for ids %j', self.collectionBaseName, _.pluck(entities, 'id'));
      entities.forEach(function (entity) {
        entity.eventsToEmit = entity.newEvents;
        entity.newEvents = [];
      });
      return cb();
    });

  };

  Repository.prototype._commitSnapshots = function _commitSnapshots (entity, options, cb) {
    var self = this;

    if (options.forceSnapshot || entity.version >= entity.snapshotVersion + self.snapshotFrequency) {
      var snapshot = entity.snapshot();
      if (snapshot && snapshot._id) delete snapshot._id; // mongo will blow up if we try to insert multiple _id keys
      self.snapshots.insertOne(snapshot, function (err) {
        if (err) return cb(err);
        log('committed %s.snapshot for id %s %j', self.collectionBaseName, entity.id, snapshot);
        return cb(null, entity);
      });
    } else {
      return cb(null, entity);
    }

  };

  Repository.prototype._commitAllSnapshots = function _commitAllSnapshots (entities, options, cb) {
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

    if (snapshots.length === 0) return cb();

    self.snapshots.insertMany(snapshots, function (err) {
      if (err) return cb(err);
      log('committed %s.snapshot for ids %s %j', self.collectionBaseName, _.pluck(entities, 'id'), snapshots);
      return cb(null, entities);
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

    var eventsToEmit = entity.eventsToEmit;
    entity.eventsToEmit = [];
    eventsToEmit.forEach(function (eventToEmit) {
      entity.emit(eventToEmit.method, eventToEmit.data);
      //var args = Array.prototype.slice.call(eventToEmit);
      //self.entityType.prototype.emit.apply(entity, args);
    });

    log('emitted local events for id %s', entity.id);

  };

  Repository.prototype._getAllSnapshots = function _getAllSnapshots (ids, cb) {
    var self = this;

    var match = { $match: { id: { $in: ids } } };
    var group = { $group: { _id: '$id', snapshotVersion: { $last: '$snapshotVersion' } } };

    self.snapshots.aggregate([match, group], function (err, idVersionPairs) {
      if (err) return cb(err);
      var criteria = {};
      if (idVersionPairs.length === 0) {
        return cb(null, []);
      } else if (idVersionPairs.length === 1) {
        criteria = { id: idVersionPairs[0]._id, snapshotVersion: idVersionPairs[0].snapshotVersion };
      } else {
        criteria.$or = [];
        idVersionPairs.forEach(function (pair) {
          var cri = { id: pair._id, snapshotVersion: pair.snapshotVersion };
          criteria.$or.push(cri);
        });
      }
      self.snapshots
        .find(criteria)
        .toArray(function (err, snapshots) {
          if (err) cb(err);
          return cb(null, snapshots);
        });
    });

  };

  Repository.prototype._getAllEvents = function _getAllEvents (ids, snapshots, cb) {
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

    self.events.find(criteria)
      .sort({ id: 1, version: 1 })
      .toArray(function (err, events) {
        if (err) return cb(err);
        if ( ! snapshots.length && ! events.length) return cb(null, null);
        var results = [];
        ids.forEach(function (id) {
          var snapshot = _.find(snapshots, function (snapshot) {
            return snapshot.id === id;
          });
          if (snapshot) delete snapshot._id;
          var evnts = _.filter(events, function (event) {
            return event.id === id;
          });
          var entity = self._deserialize(id, snapshot, evnts);
          results.push(entity);
        });
        return cb(null, results);
      });

  };

  return Repository;
}());