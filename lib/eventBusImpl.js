"use strict";

exports.EventBusImpl = (function() {
  var util = require("util");
  var EventEmitter = require("eventemitter2").EventEmitter2;

  function EventBus() {
    EventEmitter.call(this, { wildcard: true, delimiter: "." });
  }

  util.inherits(EventBus, EventEmitter);

  EventBus.prototype.publish = function() {
    //var evt = Array.prototype.slice.call(arguments,0,1)[0];
    //var args = Array.prototype.slice.call(arguments,1);
    //EventEmitter.prototype.emit.appy(this, [evt, args]);

    //var newArgs = Array.prototype.unshift.call(arguments, this.event);
    EventEmitter.prototype.emit.apply(this, arguments);
  };

  return EventBus;
}());
