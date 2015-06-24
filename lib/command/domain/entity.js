/* jslint node: true */

"use strict";

module.exports = (function() {
  var log = require('debug')('domain/entity');
  var clone = require('lodash').cloneDeep;
  var util = require('util');

  function Entity (/*snapshot, evnts*/) {
    this.changes = [];
    this.replaying = false;
    this.snapshotVersion = 0;
    this.timestamp = Date.now();
    this.version = 0;

    var args = Array.prototype.slice.call(arguments);
    if (args[0]) {
      var snapshot = args[0];
      this.merge(snapshot);
    }
    if (args[1]) {
      var replay = args[1];
      this.replay(replay);
    }
  }

  Entity.prototype.applyEvent = function(event, params, version) {
    // Find handler for the event.
    var eventHandler = "_" + event + "EventHandler";
    if (typeof this[eventHandler] === "function") {
      // Call handler.
      this[eventHandler](params);

      // If no version was received, assume this is a new event (i.e. we are not replaying a previous event)
      if (typeof version === "undefined") {
        // Add event to list of changes.
        this.changes.push({ event: event, params: params });
        // Bump entity version number.
        this.version = this.version + 1;
      } else {
        // Set version number to that of the event.
        this.version = version;
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

    this.replaying = true;

    log(util.format('replaying events %j', events));
    events.forEach(function (event) {
      self.applyEvent(event.event, event.params, event.version);
    });

    this.replaying = false;
  };

  Entity.prototype.snapshot = function snapshot () {
    this.snapshotVersion = this.version;
    var snap = clone(this, true);
    snap.timestamp = Date.now();
    return this.trimSnapshot(snap);
  };

  Entity.prototype.trimSnapshot = function trimSnapshot (snapshot) {
    delete snapshot.changes;
    delete snapshot.replaying;
    return snapshot;
  };

  return Entity;
}());

