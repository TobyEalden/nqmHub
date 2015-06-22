/**
 * Created by toby on 20/06/15.
 */
"use strict";

exports.Normaliser = (function() {
  var log = require("debug")("IOTHubNormaliser");
  var eventBus = require("../../events/eventBus").EventBus;
  var mongo = require('sourced-repo-mongo/mongo');
  var Repository = require("sourced-repo-mongo").Repository;
  var Hub = require("../../command/domain/hub");
  var Feed = require("../../command/domain/feed");
  var hubRepo = new Repository(Hub);

  var errorCheck = function(err) {
    if (err) {
      log("i/o failure %s", err.message);
    }
  };

  var buildHubView = function(id, cb) {
    hubRepo.get(id, function(err, hub) {
      if (err) {
        cb(err);
      } else {

      }
    });
  };

  function IOTHubNormaliser() {
    log("constructor");
  }

  IOTHubNormaliser.prototype.start = function() {
    var self = this;

    self.hubs = mongo.db.collection("read.IOTHub");
    self.hubs.createIndex({ id: 1 }, errorCheck);

    eventBus.on("Hub.events", function(evt) {
      log("received hub event %s",this.event);

      if (this.event === "deleteHub") {
        self.hubs.deleteOne({id: evt.id }, errorCheck);
      } else {
        self.hubs.updateOne({id: evt.id, name: evt.payload.name }, { upsert: true}, errorCheck);
      }
    });

    eventBus.on("Feed.events", function(evt) {
      log("received Feed event %s",this.event);
      if (this.event === "createFeed") {

      } else if (this.event === "deleteFeed") {

      }
    });
  };

  IOTHubNormaliser.prototype.getByUser = function(userId) {
    // Get all hubs for the user.
  };

  IOTHubNormaliser.prototype.get = function(hubId) {

  };

  return IOTHubNormaliser;
}());