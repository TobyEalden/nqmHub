/* jslint node: true */

"use strict";

module.exports = (function() {
  var clone = require('lodash').cloneDeep,
    EventEmitter = require('eventemitter2').EventEmitter2,
    log = require('debug')('entity'),
    util = require('util');

  function Entity (/*snapshot, evnts*/) {
    this.eventsToEmit = [];
    this.newEvents = [];
    this.replaying = false;
    this.snapshotVersion = 0;
    this.timestamp = Date.now();
    this.version = 0;
    EventEmitter.call(this, {
      wildcard: true,
      delimiter: '.',
      maxListeners: 20
    });
    var args = Array.prototype.slice.call(arguments);
    if (args[0]){
      var snapshot = args[0];
      this.merge(snapshot);
    }
    if (args[1]){
      var evnts = args[1];
      this.replay(evnts);
    }
  }

  util.inherits(Entity, EventEmitter);

  Entity.prototype.applyEvent = function(event, params, version) {
    var eventHandler = "_" + event + "EventHandler";
    if (typeof this[eventHandler] === "function") {
      this[eventHandler](params);

      if (typeof version === "undefined") {
        this.newEvents.push({ event: event, params: params });
        this.version = this.version + 1;
      } else {
        this.version = version;
      }
    } else {
      log("no handler for event: %s" + event);
    }
  };

  Entity.prototype.emit = function emit () {
    if ( ! this.replaying) {
      EventEmitter.prototype.emit.apply(this, arguments);
    }
  };

  Entity.prototype.merge = function merge (snapshot) {
    log(util.format('merging snapshot %j', snapshot));
    for (var property in snapshot) {
      if (snapshot.hasOwnProperty(property))
        var value = clone(snapshot[property]);
      this.mergeProperty(property, value);
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
    return this.trimSnapshot(snap);
  };

  Entity.prototype.trimSnapshot = function trimSnapshot (snapshot) {
    delete snapshot.eventsToEmit;
    delete snapshot.newEvents;
    delete snapshot.replaying;
    delete snapshot._events;
    delete snapshot._maxListeners;
    delete snapshot.domain;

    // From EventEmitter2
    delete snapshot.delimiter;
    delete snapshot.listenerTree;
    delete snapshot.newListener;
    delete snapshot.wildcard;
    delete snapshot._all;
    delete snapshot._conf;
    delete snapshot.event;

    return snapshot;
  };

  return Entity;
}());

