"use strict";

exports.EventBus = (function() {
  var util = require("util");
  var EventEmitter = require("events").EventEmitter;

  function EventBus() {
    EventEmitter.call(this);
  }
  util.inherits(EventBus, EventEmitter);

  EventBus.prototype.publish = function(ev) {
    this.emit("event",ev);
  };

  return EventBus;
}());
