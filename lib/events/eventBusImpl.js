"use strict";

exports.EventBusImpl = (function() {
  var log = require("debug")("eventBus");
  var util = require("util");
  var EventEmitter = require("eventemitter2").EventEmitter2;

  function EventBus() {
    EventEmitter.call(this, { wildcard: true, delimiter: "." });
  }

  util.inherits(EventBus, EventEmitter);

  EventBus.prototype.publish = function() {
    log("publishing %s",this.event);
    EventEmitter.prototype.emit.apply(this, arguments);
  };

  return EventBus;
}());
