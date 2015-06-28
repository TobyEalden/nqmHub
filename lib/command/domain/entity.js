/* jslint node: true */

"use strict";

module.exports = (function() {
  var log = require('debug')('domain/entity');
  var clone = require('lodash').cloneDeep;
  var util = require('util');
  var _ = require("lodash");

  function Entity (/* snapshot, events, key */) {
    this.m_changes = [];
    this.m_replaying = false;
    this.__snapshotVersion = 0;
    this.__version = 0;
    this.__deleted = false;
    this.__created = Date.now();
    this.__modified = Date.now();

    var args = Array.prototype.slice.call(arguments);
    if (args[0]) {
      // Merge snapshot.
      this.merge(args[0]);
    }
    if (args[1]) {
      // Replay events.
      this.replay(args[1]);
    }
    if (args[2]) {
      // Set key.
      this.setKey(args[2]);
    }
  }

  Entity.prototype.buildKey = function(indices) {
    var key = {};

    _.forEach(indices, function (i) {
      key[i] = this[i];
    },this);

    delete key.__version;

    return key;
  };

  Entity.prototype.setKey = function(key) {
    _.forEach(key, function(v,k) {
      this[k] = v;
    }, this);
  };

  Entity.prototype.applyEvent = function(event, params, version) {
    // Find handler for the event.
    var eventHandler = "_" + event + "EventHandler";
    if (typeof this[eventHandler] === "function") {

      if (params.modified) {
        this.__modified = params.modified;
      }

      // Call handler.
      this[eventHandler](params);

      // If no version was received, assume this is a new event (i.e. we are not replaying a previous event)
      if (typeof version === "undefined") {
        // Add event to list of changes.
        params.__timestamp = Date.now();
        this.m_changes.push({ event: event, params: params });
        // Bump entity version number.
        this.__version = this.__version + 1;
      } else {
        // Set version number to that of the event.
        this.__version = version;
      }
    } else {
      log("no handler for event: %s", event);
    }
  };

  Entity.prototype.merge = function merge (snapshot) {
    log(util.format('merging snapshot %j', snapshot));
    for (var property in snapshot) {
      if (snapshot.hasOwnProperty(property)) {
        var value = clone(snapshot[property]);
        this.mergeProperty(property, value);
      }
    }
    return this;
  };

  Entity.prototype.mergeProperty = function mergeProperty (name, value) {
    this[name] = value;
  };

  Entity.prototype.replay = function replay (events) {
    var self = this;

    this.m_replaying = true;

    log(util.format('replaying events %j', events));
    events.forEach(function (event) {
      self.applyEvent(event.event, event.params, event.version);
    });

    this.m_replaying = false;
  };

  Entity.prototype.snapshot = function snapshot () {
    this.__snapshotVersion = this.__version;
    var snap = clone(this, true);
    return this.trimSnapshot(snap);
  };

  Entity.prototype.trimSnapshot = function trimSnapshot (snapshot) {
    delete snapshot.m_changes;
    delete snapshot.m_replaying;
    return snapshot;
  };

  return Entity;
}());

