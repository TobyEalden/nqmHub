/**
 * Created by toby on 20/06/15.
 */
"use strict";

exports.Normaliser = (function() {
  var eventBus = require("../eventBus").EventBus;
  var mongo = require('sourced-repo-mongo/mongo');

  function IOTHubNormaliser() {
  }

  IOTHubNormaliser.prototype.start = function() {
    var self = this;

    self.hubs = mongo.db.collection("read.IOTHub");
    self.hubs.createIndex({ id: 1 }, function(err) {
      if (err) {
        console.log("failure creating index on read.IOTHub: %s",err.message);
      }
    });

    eventBus.on("Hub.events", function(evt) {
      self.hubs.insert({id: evt.id, hubId: evt.hubId, datum: evt.datum }, function(err) {
        if (err) {
          console.log("feed write failure is '%s': %j", err.message, evt);
        }
      });
    });

    eventBus.on("Feed.events", function(evt) {

    });
  };

  return IOTHubNormaliser;
}());