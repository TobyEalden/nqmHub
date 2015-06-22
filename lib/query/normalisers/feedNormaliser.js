/**
 * Created by toby on 20/06/15.
 */
"use strict";

exports.Normaliser = (function() {
  var log = require("debug")("feedNormaliser");
  var eventBus = require("../../events/eventBus").EventBus;
  var mongo = require('../../mongoConnectionFactory');

  var errorCheck = function(err) {
    if (err) {
      console.log("i/o failure %s", err.message);
    }
  };

  function FeedNormaliser() {
    log("constructor");
  }

  FeedNormaliser.prototype.start = function() {
    log("starting");

    var self = this;
    self.feeds = mongo.queryDb.db().collection("read.feed");
    self.feeds.createIndex({ id: 1, hubId: 1 }, errorCheck);
    eventBus.on("*.*.feedData",function(evt) {
      log("feedData event %s - adding to feed", this.event);
      var lookup = this.event.split(".");
      if (lookup.length > 1) {
        self.feeds.insertOne({id: lookup[1], hubId: lookup[0], datum: evt.params }, errorCheck);
      } else {
        log("bad event name %s - expected <hubId>.<feedId>.events", this.event);
      }
    });
  };

  return FeedNormaliser;
}());