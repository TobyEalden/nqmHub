/**
 * Created by toby on 20/06/15.
 */
"use strict";

exports.Normaliser = (function() {
  var log = require("debug")("IOTHubNormaliser");
  var Promise = require("bluebird");
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
        deleteFromCache.call(self,evt.id);
        break;
      case "Hub.created":
        addToCache.call(self, evt.id).bind(this).then(saveCache, errorCheck);
        break;
      case "Hub.renamed":
        var hub = getFromCache.call(self, evt.id);
        hub.replay([evt]);
        saveCache.call(self, hub).then(null, errorCheck);
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
    var hub = getFromCache.call(self, evt.hubId);
    if (!hub) {
      log("received Feed event for %s belonging to hub %s that isn't in the cache", evt.id, evt.hubId);
    } else {
      switch (eventName) {
        case "Feed.created":
          hub.feeds.push({ id: evt.id, name: evt.params.name, schema: evt.params.schema });
          break;
        case "Feed.renamed":
          var update = _.find(hub.feeds, function(f) { return f.id == evt.id; });
          if (update) {
            update.name = evt.params.name;
          } else {
            log("received update for unknown feed %s", evt.id);
          }
          break;
        case "Feed.schemaSet":
          var update = _.find(hub.feeds, function(f) { return f.id == evt.id; });
          if (update) {
            update.schema = evt.params.schema;
          } else {
            log("received update for unknown feed %s", evt.id);
          }
          break;
        case "Feed.deleted":
          log("not implemented - %s", eventName);
          break;
        default:
          log("unknown feed event - %s", eventName);
          break;
      }
      saveCache.call(self, hub).then(null, errorCheck);
    }
  };

  var trimForCache = function(ent) {
    var cloned = _.clone(ent, true);
    delete cloned._id;
    delete cloned.__version;
    delete cloned.m_replaying;
    delete cloned.m_changes;
    delete cloned.__snapshotVersion;
    return cloned;
  };

  var saveCache = function(hub) {
    log("saving hub %s to db",hub.id);
    var cleanHub = trimForCache(hub);
    return this.hubs.updateOneAsync({ id: hub.id }, cleanHub, { upsert: true });
  };

  var loadHubFeed = function(hub, f) {
    log("loading feed %s for hub %s", f.id, hub.id);
    return this._feedRepo.get([hub.id,f.id]).then(function(feed) {
      if (!feed.deleted) {
        var cleanFeed = trimForCache(feed.snapshot());
        hub.feeds.push(cleanFeed);
      }
    });
  };

  var loadHubFeeds = function(hub, feeds) {
    var promises = [];
    _.each(feeds, function(f) {
      promises.push(loadHubFeed.call(this, hub, f));
    }, this);
    return Promise.all(promises);
  };

  var addHubFeeds = function(hub) {
    var self = this;
    var feeds = mongo.commandDb.db().collection("Feed.events");
    return feeds.find({ event: "created", "hubId": hub.id }).toArrayAsync().then(function (feeds) {
        if (feeds.length > 0) {
          return loadHubFeeds.call(self, hub, feeds);
        }
      });
  };

  var addToCache = function(id) {
    var self = this;

    return this._hubRepo.get(id).then(function(hub) {
      if (!hub || hub.deleted) {
        var err = new Error("not found");
        log("failed to get hub %s from db [%s]",id, err.message);
        throw err;
      }
      log("adding %s [%s] to cache", hub.id, hub.name);
      // Store in the cache.
      self._hubCache[id] = hub;
      // Initialise hub feed array.
      self._hubCache[id].feeds = [];
      return addHubFeeds.call(self, self._hubCache[id]).then(function() {
        return self._hubCache[id];
      });
    });
  };

  var loadHub = function(h) {
    return addToCache.call(this, h.id).bind(this).then(saveCache);
  };

  var loadHubs = function(hubs) {
    var promises = [];
    _.each(hubs, function(h) {
      promises.push(loadHub.call(this, h));
    }, this);
    return Promise.all(promises).then(function() { log("all hubs loaded"); });
  };

  var primeCache = function() {
    var self = this;
    log("priming hub cache");

    // Get all Hub.created events from command database.
    var hubs = mongo.commandDb.db().collection("Hub.events");
    return hubs.find({ event: "created" }).toArrayAsync().bind(self).then(loadHubs);
  };

  var getFromCache = function(id) {
    if (!this._hubCache.hasOwnProperty(id)) {
      log("hub %s not found in cache", id);
    }
    return this._hubCache[id];
  };

  var deleteFromCache = function(id) {
    var self = this;
    log("deleting %s from cache", id);
    return self.hubs.deleteOneAsync({id: id }).then(function() {
      delete self._hubCache[id];
    }, function(err) {
        log("failed to delete hub %d [%s]",id, err.message);
    });
  };

  IOTHubNormaliser.prototype.getByUser = function(userId) {
    // Get all hubs for the user.
  };

  IOTHubNormaliser.prototype.get = function(hubId) {
    return getFromCache.call(this, hubId);
  };

  return IOTHubNormaliser;
}());