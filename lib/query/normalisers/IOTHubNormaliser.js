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

  function IOTHubNormaliser() {
    log("constructor");

    this._hubRepo = null;
    this._feedRepo = null;
    this._hubCache = {};
  }

  IOTHubNormaliser.prototype.start = function() {
    var self = this;

    log("starting");

    // Get a repository to access command-side hub data.
    self._hubRepo = new Repository(Hub);
    self._feedRepo = new Repository(Feed);

    // Create query-side hub collection and index.
    self.hubs = mongo.queryDb.db().collection("read.IOTHub");
    self.hubs.createIndex({ id: 1 }, errorCheck);

    self.getAll();

    eventBus.on("Hub.*", function(evt) {
      log("received hub event %s",this.event);

      if (evt.event === "Hub.deleted") {
        self.hubs.deleteOne({id: evt.params.id }, errorCheck);
      } else {
        if (self._hubCache.hasOwnProperty(evt.params.id)) {
          self._hubCache[evt.params.id].replay([evt]);
          saveCache.call(self, self._hubCache[evt.params.id]);
        } else {
          getFromCache.call(self, evt.params.id);
        }
      }
    });

    eventBus.on("Feed.*", function(evt) {
      feedHandler.call(self, this.event, evt);
    });
  };

  var feedHandler = function(eventName, evt) {
    var self = this;
    log("received Feed event %s",eventName);

    // Find the hub that owns this feed.
    getFromCache.call(self, evt.params.hubId, function(err, hub) {
      if (err) {
        log("failed to find hub %s for feed %s",evt.params.hubId, evt.params.id);
      } else {
        switch (eventName) {
          case "Feed.created":
            hub.feeds.push({ id: evt.params.id, name: evt.params.name, schema: evt.params.schema });
            break;
          case "Feed.renamed":
            var update = _.find(hub.feeds, function(f) { return f.id == evt.params.id; });
            if (update) {
              update.name = evt.params.name;
            } else {
              log("received update for unknown feed %s", evt.params.id);
            }
            break;
          case "Feed.deleted":
            log("not implemented - %s", eventName);
            break;
          default:
            log("unknown feed event - %s", eventName);
            break;
        }
        saveCache.call(self, hub);
      }
    });
  };

  var trimForCache = function(ent) {
    var cloned = _.clone(ent, true);
    delete cloned._id;
    delete cloned.version;
    delete cloned.timestamp;
    delete cloned.snapshotVersion;
    return cloned;
  };

  var getHubFeed = function(hub, i, feeds, cb) {
    var self = this;
    var f = feeds[i];
    self._feedRepo.get(f.id, function(err, feed) {
      if (err) {
        log("failure getting feed %s - %s",feed.id,err.message);
      } else if (!feed.deleted) {
        var cleanFeed = trimForCache(feed.snapshot());
        hub.feeds.push(cleanFeed);
      }
      i++;
      if (i < feeds.length) {
        process.nextTick(function() { getHubFeed.call(self, hub, i, feeds, cb); });
      } else {
        cb();
      }
    });

  };

  var addHubFeeds = function(hub, cb) {
    var self = this;
    var feeds = mongo.commandDb.db().collection("Feed.events");
    feeds.find({ event: "created", "params.hubId": hub.id }).toArray(function(err, feeds) {
      if (feeds.length > 0) {
        getHubFeed.call(self, hub, 0, feeds, cb);
      } else {
        cb();
      }
    });
  };

  var getFromCache = function(id, cb) {
    var self = this;
    if (!this._hubCache.hasOwnProperty(id)) {
      this._hubRepo.get(id, function(err, hub) {
        if (err || !hub) {
          err = err || new Error("not found");
          log("failed to get hub %s from db [%s]",id, err.message);
          return cb(err);
        }
        log("adding %s [%s] to cache", hub.id, hub.name);
        self._hubCache[id] = hub.snapshot();
        self._hubCache[id].feeds = [];
        addHubFeeds.call(self, self._hubCache[id], function(err) {
          if (err) {
            return cb(err);
          }
          saveCache.call(self, self._hubCache[id], cb);
        });
      });
    } else {
      process.nextTick(function() { cb(null, self._hubCache[id]); });
    }
  };

  var saveCache = function(hub, cb) {
    var cleanHub = trimForCache(hub);
    this.hubs.updateOne({ id: hub.id }, cleanHub, { upsert: true }, function(err) {
      if (err) {
        log("problem saving cache: %s",err.message);
      }
      if (typeof cb === "function") {
        cb(err);
      }
    });
  };

  IOTHubNormaliser.prototype.getAll = function(cb) {
    var self = this;

    log("getting all hubs");

    var hubs = mongo.commandDb.db().collection("Hub.events");
    hubs.find({ event: "created" }).toArray(function(err, hubs) {
      _.each(hubs, function(h) {
        getFromCache.call(self, h.id, function(err) {
          if (err) {
            log("failed to cache hub %s", h.id);
          } else {
            log("hub %s is cached", h.id);
          }
        });
      });
    });
  };

  IOTHubNormaliser.prototype.getByUser = function(userId) {
    // Get all hubs for the user.
  };

  IOTHubNormaliser.prototype.get = function(hubId, cb) {
    getFromCache.call(this, hubId, cb);
  };

  return IOTHubNormaliser;
}());