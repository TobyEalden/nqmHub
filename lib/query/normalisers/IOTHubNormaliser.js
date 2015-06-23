/**
 * Created by toby on 20/06/15.
 */
"use strict";

exports.Normaliser = (function() {
  var log = require("debug")("IOTHubNormaliser");
  var mongo = require('../../mongoConnectionFactory');
  var eventBus = require("../../events/eventBus").EventBus;
  var Repository = require("../../events/eventRepository").Repository;
  var Hub = require("../../command/domain/hub");
  var Feed = require("../../command/domain/feed");
  var _ = require("lodash");
  var hubCollection = "read.IOTHub";

  function IOTHubNormaliser() {
    log("constructor");

    this._hubRepo = null;
    this._feedRepo = null;
    this._hubCache = {};
  }

  IOTHubNormaliser.prototype.start = function() {
    var self = this;

    log("starting");

    // Listen for hub related events.
    eventBus.on("Hub.*", function(evt) {
      hubHandler.call(self, this.event, evt);
    });

    // Listen for feed related events.
    eventBus.on("Feed.*", function(evt) {
      feedHandler.call(self, this.event, evt);
    });

    // Get repositories to access command-side hub data.
    self._hubRepo = new Repository(Hub);
    self._feedRepo = new Repository(Feed);

    // Re-create query-side hub collection and index.
    var db = mongo.queryDb.db();
    self.hubs = db.collection(hubCollection);
    if (self.hubs) {
      self.hubs.drop();
    }
    return self.hubs.createIndexAsync({ id: 1 }).bind(this).then(primeCache);
  };

  var errorCheck = function(err) {
    if (err) {
      log("failure writing to %s [%s]",hubCollection,err.message);
    }
  };

  var hubHandler = function(eventName, evt) {
    var self = this;
    log("received hub event %s",this.event);

    switch (eventName) {
      case "Hub.deleted":
        deleteFromCache.call(self,evt.params.id);
        break;
      case "Hub.created":
        addToCache.call(self, evt.params.id, function(err, hub) {
          if (err) {
            log("failed to get new hub %s", evt.params.id);
          }
          saveCache.call(self, hub, errorCheck);
        });
        break;
      case "Hub.renamed":
        var hub = getFromCache.call(self, evt.params.id);
        hub.replay([evt]);
        saveCache.call(self, hub, errorCheck);
        break;
      default:
        log("ignoring unknown hub event %s",eventName);
        break;
    }
  };

  var feedHandler = function(eventName, evt) {
    var self = this;
    log("received Feed event %s",eventName);

    // Find the hub that owns this feed.
    var hub = getFromCache.call(self, evt.params.hubId);
    if (!hub) {
      log("received Feed event for %s belonging to hub %s that isn't in the cache", evt.params.id, evt.params.hubId);
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
      saveCache.call(self, hub, errorCheck);
    }
  };

  var trimForCache = function(ent) {
    var cloned = _.clone(ent, true);
    delete cloned._id;
    delete cloned.version;
    delete cloned.timestamp;
    delete cloned.snapshotVersion;
    return cloned;
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

  var addToCache = function(id, cb) {
    var self = this;

    this._hubRepo.get(id, function(err, hub) {
      if (err || !hub || hub.deleted) {
        err = err || new Error("not found");
        log("failed to get hub %s from db [%s]",id, err.message);
        return cb(err);
      }
      log("adding %s [%s] to cache", hub.id, hub.name);
      // Store a snapshot in the cache.
      self._hubCache[id] = hub.snapshot();
      // Initialise hub feed array.
      self._hubCache[id].feeds = [];
      addHubFeeds.call(self, self._hubCache[id], function(err) {
        if (err) {
          cb(err);
        } else {
          cb(err, self._hubCache[id]);
        }
      });
    });
  };

  var loadHub = function(i, hubs, cb) {
    var self = this;
    var h = hubs[i];

    var nextHub = function() {
      i++;
      if (i < hubs.length) {
        process.nextTick(function() { loadHub.call(self, i, hubs, cb); })
      } else {
        cb();
      }
    };

    addToCache.call(self, h.id, function(err, cachedHub) {
      if (err) {
        log("failed to cache hub %s", h.id);
        // Continue attempting to load other hubs.
        nextHub();
      } else {
        log("hub %s is cached", h.id);
        saveCache.call(self, cachedHub, function(err) {
          if (err) {
            log("failed to save hub %s to read db [%s]", h.id, err.message);
          }
          nextHub();
        });
      }
    });
  };

  var primeCache = function(cb) {
    var self = this;
    log("priming hub cache");

    // Get all Hub.created events from command database.
    var hubs = mongo.commandDb.db().collection("Hub.events");
    hubs.find({ event: "created" }).toArray(function(err, hubs) {
      if (err) {
        log("failure getting hub data from command db [%s]",err.message);
        return cb(err);
      }
      if (hubs.length > 0) {
        loadHub.call(self, 0, hubs, cb);
      } else {
        cb();
      }
    });
  };

  var getFromCache = function(id) {
    if (!this._hubCache.hasOwnProperty(id)) {
      log("hub %s not found in cache", id);
    }
    return this._hubCache[id];
  };

  var deleteFromCache = function(id, cb) {
    var self = this;
    log("deleting %s from cache", id);
    self.hubs.deleteOne({id: id }, function(err) {
      if (err) {
        log("failed to delete hub %d",id);
      }
      delete self._hubCache[id];
      cb(err);
    });
  };

  IOTHubNormaliser.prototype.getByUser = function(userId) {
    // Get all hubs for the user.
  };

  IOTHubNormaliser.prototype.get = function(hubId, cb) {
    var hub = getFromCache.call(this, hubId);
    cb(null, hub || null);
  };

  return IOTHubNormaliser;
}());