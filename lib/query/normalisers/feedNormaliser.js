/**
 * Created by toby on 20/06/15.
 */
"use strict";

exports.Normaliser = (function() {
  var eventBus = require("../eventBus").EventBus;
  var mongo = require('sourced-repo-mongo/mongo');

  function FeedNormaliser() {
  }

  FeedNormaliser.prototype.start = function() {
    var self = this;

    self.feeds = mongo.db.collection("read.feed");
    self.feeds.createIndex({ id: 1, hubId: 1 }, function(err) {
      if (err) {
        console.log("failure creating index on read.feed: %s",err.message);
      }
    });

    eventBus.on("*.*.feedData",function(evt) {
      self.feeds.insert({id: evt.id, hubId: evt.hubId, datum: evt.datum }, function(err) {
        if (err) {
          console.log("feed write failure is '%s': %j", err.message, evt);
        }
      });
    });
  };

  return FeedNormaliser;
}());