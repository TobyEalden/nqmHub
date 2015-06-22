/**
 * Created by toby on 20/06/15.
 */
"use strict";

exports.Normaliser = (function() {
  var log = require("debug")("IOTHubNormaliser");
  var eventBus = require("../../events/eventBus").EventBus;
  var mongo = require('../../mongoConnectionFactory');
  var Repository = require("../../events/eventRepository").Repository;
  var Hub = require("../../command/domain/hub");
  var Feed = require("../../command/domain/feed");
  var _ = require("lodash");

  var errorCheck = function(err) {
    if (err) {
      log("i/o failure %s", err.message);
    }
  };

  var buildHubView = function(id, cb) {
    this._hubRepo.get(id, function(err, hub) {
      if (err) {
        cb(err);
      } else {

      }
    });
  };

  function IOTHubNormaliser() {
    log("constructor");

    this._hubRepo = null;
    this._hubCache = {};
  }

  IOTHubNormaliser.prototype.start = function() {
    var self = this;

    log("starting");

    self._hubRepo = new Repository(Hub);
    self.hubs = mongo.queryDb.db().collection("read.IOTHub");
    self.hubs.createIndex({ id: 1 }, errorCheck);

    self.getAll();

    eventBus.on("Hub.*", function(evt) {
      log("received hub event %s",this.event);

      if (evt.method === "deleteHub") {
        self.hubs.deleteOne({id: evt.data.id }, errorCheck);
      } else {
        if (self._hubCache.hasOwnProperty(evt.data.id)) {
          self._hubCache[evt.data.id].replay([evt]);
        }
      }
    });

    eventBus.on("Feed.*", function(evt) {
      log("received Feed event %s",this.event);
      if (this.event === "createFeed") {

      } else if (this.event === "deleteFeed") {

      }
    });
  };

  var addToCache = function(id, cb) {
    var self = this;
    this._hubRepo.get(id, function(err, hub) {
      if (err) {
        log("failed to get hub %s from db [%s]",id, err.message);
        return cb(err);
      }
      log("adding %s [%s] to cache", hub.id, hub.name);
      self._hubCache[id] = hub;
      cb(null, hub);
    });
  };

  IOTHubNormaliser.prototype.getAll = function(cb) {
    var self = this;

    log("getting all hubs");

    var hubs = mongo.commandDb.db().collection("Hub.events");
    hubs.find({ method: "create" }).toArray(function(err, hubs) {
      _.each(hubs, function(h) {
        addToCache.call(self, h.id, function() {

        });
      });
    });
  };

  IOTHubNormaliser.prototype.getByUser = function(userId) {
    // Get all hubs for the user.
  };

  IOTHubNormaliser.prototype.get = function(hubId, cb) {
    var self = this;
    if (!this._hubCache.hasOwnProperty(hubId)) {
      addToCache(hubId, cb);
    } else {
      process.nextTick(function() { cb(null, self._hubCache[hubId]); });
    }
  };

  return IOTHubNormaliser;
}());