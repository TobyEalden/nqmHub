"use strict";

module.exports = (function() {
  var log = require("debug")("IOTHubCmdHandler");
  var Promise = require("bluebird");
  var _ = require("lodash");
  var Hub = require("../domain/hub");
  var Feed = require("../domain/feed");
  var FeedData = require("../domain/feedData");
  var Repository = require("../../events/eventRepository").Repository;
  var feedSnapshotFrequency = 5;

  function IOTHubCmdHandler(eventBus) {
    this._eventBus = eventBus;
    this._hubRepo = new Repository(Hub, {}, this._eventBus);
    this._feedRepo = new Repository(Feed, {}, this._eventBus);
    this._feedDataRepo = null;
    this._cachedFeedData = null;
  }

  var startProcessFeedData = function(params) {
    var self = this;
    return this._hubRepo.get(params.hubId).then(function(hub) {
      if (!hub) {
        throw new Error("hub not found with id: " + params.id);
      } else {
        params.payload = _.sortBy(params.payload, "id");
        self._cachedFeedData = self._feedDataRepo = null;
        var promises = [];
        _.each(params.payload, function(datum) {
          promises.push(processFeedData.call(this, datum));
        }, self);
        return Promise.all(promises).then(function() {
          if (self._feedDataRepo && self._cachedFeedData) {
            // Commit outstanding data on previous feed.
            return self._feedDataRepo.commit(self._cachedFeedData);
          }
        })
      }
    });
  };

  var processFeedData = function(datum) {
    var self = this;

    if (datum.id) {
      if (!self._cachedFeedData || datum.id !== self._cachedFeedData.id) {
        // Need to access different feed repo.
        var nextFeed = function() {
          // Clear cached feed.
          self._feedDataRepo = self._cachedFeedData = null;
          // Check the feed is valid.
          return self._feedRepo.get(datum.id).then(function(feed) {
            if (!feed) {
              throw new Error("no feed found with id: " + datum.id);
            } else {
              // Get the latest snapshot of the feed data.
              self._feedDataRepo = new Repository(FeedData, { snapshotFrequency: feedSnapshotFrequency, collectionBaseName: feed.hubId + "." + feed.id }, self._eventBus);
              return self._feedDataRepo.get(feed.id).then(function(feedData) {
                if (feedData) {
                  self._cachedFeedData = feedData;
                } else {
                  // First update -> create feed.
                  self._cachedFeedData = self._feedDataRepo.factory();
                  self._cachedFeedData.id = feed.id;
                }
                self._cachedFeedData.feedData(datum.payload);
              });
            }
          });
        };

        if (self._feedDataRepo && self._cachedFeedData) {
          // Commit outstanding data on previous feed.
          return self._feedDataRepo.commit(self._cachedFeedData).then(nextFeed);
        } else {
          // This is the first feed - continue.
          return nextFeed();
        }
      } else {
        self._cachedFeedData.feedData(datum.payload);
      }
    } else {
      log("skipping invalid datum: %j", datum);
    }
  };

  var createHub = function(params) {
    var self = this;
    return this._hubRepo.get(params.id).then(function(hub) {
      if (hub) {
        throw new Error("hub already exists with id: " + params.id);
      } else {
        hub = self._hubRepo.factory();
        hub.create(params);
        return self._hubRepo.commit(hub);
      }
    });
  };

  var renameHub = function(params) {
    var self = this;
    return this._hubRepo.get(params.id).then(function(hub) {
      if (!hub) {
        throw new Error("hub not found with id: " + params.id);
      } else {
        hub.rename(params);
        return self._hubRepo.commit(hub);
      }
    });
  };

  var createFeed = function(params) {
    var self = this;
    // Check the hub exists.
    return this._hubRepo.get(params.hubId).then(function(hub) {
      if (!hub) {
        throw new Error("no hub found with id: " + params.hubId);
      } else {
        // Check that a feed doesn't already exist with this name.
        return self._feedRepo.get(params.id).then(function(feed) {
          if (feed) {
            throw new Error("feed already exists with id: " + params.id);
          } else {
            feed = self._feedRepo.factory();
            feed.create(params);
            return self._feedRepo.commit(feed);
          }
        });
      }
    });
  };

  var renameFeed = function(params) {
    var self = this;
    // Check the hub exists.
    return this._hubRepo.get(params.hubId).then(function(hub) {
      if (!hub) {
        throw new Error("no hub found with id: " + params.hubId);
      } else {
        // Check that a feed exists with this name.
        return self._feedRepo.get(params.id).then(function(feed) {
          if (!feed) {
            throw new Error("feed doesn't exist with id: " + params.id);
          } else {
            feed.rename(params);
            return self._feedRepo.commit(feed);
          }
        });
      }
    });
  };

  var createDataset = function(params) {
    var self = this;
    // Check the hub exists.
    return this._hubRepo.get(params.hubId).then(function(hub) {
      if (!hub) {
        throw new Error("no hub found with id: " + params.hubId);
      } else {
        // Check that a feed doesn't already exist with this name.
        return self._feedRepo.get(params.id).then(function(feed) {
          if (feed) {
            throw new Error("feed already exists with id: " + params.id);
          } else {
            feed = self._feedRepo.factory();
            feed.create(params);
            return self._feedRepo.commit(feed);
          }
        });
      }
    });
  };

  var executeCommand = function(cmd) {
    var self = this;
    var promise;

    switch (cmd.command) {
      case "createHub":
        promise = createHub.call(this, cmd.params);
        break;
      case "renameHub":
        promise = renameHub.call(this, cmd.params);
        break;
      case "createFeed":
        promise = createFeed.call(this, cmd.params);
        break;
      case "createDataset":
        promise = createDataset.call(this, cmd.params);
        break;
      case "renameFeed":
        promise = renameFeed.call(this, cmd.params);
        break;
      case "feedData":
        promise = startProcessFeedData.call(self, cmd.params);
        break;
      default:
        log("iot hub command handler - unknown command: %s", cmd.command);
        break;
    }

    return promise;
  };

  IOTHubCmdHandler.prototype.execute = function(cmd) {
    return executeCommand.call(this, cmd);
  };

  return IOTHubCmdHandler;
}());
