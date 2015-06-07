"use strict";

module.exports = (function() {
  var console = process.console ? process.console : global.console;
  var assert = require("assert");
  var Root = require("./root");
  var util = require("util");
  var NQMEvent = require("../event");

  function Hub(id, name) {
    Root.call(this);

    if (id === undefined) {
      this.name = "";
    } else {
      this.applyChange(new NQMEvent("created", { id: id }, { name: name }));
    }
  }

  util.inherits(Hub,Root);

  Hub.prototype.rename = function(newName) {
    if (newName !== this.name) {
      this.applyChange(new NQMEvent("renamed", this.getKey(), { name: newName }));
    }
  };

  Hub.prototype.createdEventHandler = function(ev) {
    assert(ev.getName() === "created");
    this.id = ev.getKey().id;
    this.version = 0;
    this.name = ev.getParams().name;
  };

  Hub.prototype.renamedEventHandler = function(ev) {
    assert(ev.getName() === "renamed");
    console.log("handling event renamed to: " + ev.getParams().name);
    this.name = ev.getParams().name;
  };

  return Hub;
}());
