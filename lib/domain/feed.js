"use strict";

module.exports = (function() {
  var console = process.console ? process.console : global.console;
  var assert = require("assert");
  var Root = require("./root");
  var util = require("util");
  var NQMEvent = require("../event");

  function Feed(id, hubId, name, schema) {
    Root.call(this);

    if (id === undefined) {
      this.name = "";
      this.schema = {};
    } else {
      this.applyChange(new NQMEvent("created", { hubId: hubId, id: id }, { name: name, schema: schema || {} }));
    }
  }

  util.inherits(Feed,Root);

  Feed.prototype.getKey = function() {
    return { hubId: this.hubId, id: this.id };
  };

  Feed.prototype.rename = function(newName) {
    if (newName !== this.name) {
      this.applyChange(new NQMEvent("renamed", this.getKey(), { name: newName }));
    }
  };

  Feed.prototype.feedData = function(datum) {
    this.applyChange(new NQMEvent("feedData", this.getKey(), datum.payload));
  };

  Feed.prototype.createdEventHandler = function(ev) {
    assert(ev.getName() === "created");
    this.id = ev.getKey().id;
    this.hubId = ev.getKey().hubId;
    this.version = 0;
    this.name = ev.getParams().name;
    this.schema = ev.getParams().schema || {};
  };

  Feed.prototype.renamedEventHandler = function(ev) {
    assert(ev.getName() === "renamed");
    console.log("handling event renamed to: " + ev.getParams().name);
    this.name = ev.getParams().name;
  };

  Feed.prototype.feedDataEventHandler = function(ev) {
    assert(ev.getName() === "feedData");
    this.datum = ev.getParams();
  };

  return Feed;
}());

