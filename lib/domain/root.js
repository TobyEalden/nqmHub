"use strict";

module.exports = (function() {
  var console = process.console ? process.console : global.console;
  var assert = require("assert");

  function Root(id, version) {
    this._changes = [];
    this.id = id;
    this.version = version;
  }

  Root.prototype.getKey = function() {
    return { id: this.id };
  };

  Root.prototype.applyChange = function(ev, isNew) {
    var eventHandler = ev.getName() + "EventHandler";
    if (typeof this[eventHandler] === "function") {
      this[eventHandler](ev);

      // If missing, isNew defaults to true.
      if (typeof isNew === "undefined" || isNew === true) {
        this._changes.push(ev);
      }

    } else {
      console.log("no handler for event: " + ev.getName());
    }
  };

  Root.prototype.getChanges = function() {
    return this._changes;
  };

  Root.prototype.clearChanges = function() {
    this._changes = [];
  };

  return Root;
}());
