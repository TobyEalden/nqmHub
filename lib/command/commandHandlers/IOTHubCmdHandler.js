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

  function IOTHubCmdHandler() {
    this._hubRepo = new Repository(Hub);
    this._feedRepo = new Repository(Feed);
  }

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

  var startProcessFeedData = function(params) {
    var self = this;
    return this._hubRepo.get(params.hubId).then(function(hub) {
      if (!hub) {
        throw new Error("hub not found with id: " + params.id);
      } else {
        var grouped = _.groupBy(params.payload, function(i) { return i.id });
        var promises = [];
        _.forEach(grouped, function(datumList, feedId) {
          promises.push(processFeedData.call(this, feedId, datumList));
        }, self);
        return Promise.all(promises);
      }
    });
  };

  var processFeedData = function(feedId, datumList) {
    var self = this;

    // Check the feed is valid.
    self._feedRepo.get(feedId).then(function(feed) {
      if (!feed) {
        throw new Error("no feed found with id: " + feedId);
      } else {
        // Get the latest snapshot of the feed data.
        var feedDataRepo = new Repository(FeedData, { snapshotFrequency: feedSnapshotFrequency, singleSnapshot: true, collectionBaseName: feed.hubId + "." + feed.id });
        return feedDataRepo.get(feed.id).then(function(feedData) {
          if (!feedData) {
            // First update -> create feed.
            feedData = feedDataRepo.factory();
            feedData.id = feed.id;
          }
          _.forEach(datumList, function(datum) {
            feedData.feedData(datum.payload);
          });
          return feedDataRepo.commit(feedData);
        });
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

  var feedMethod = function(method, params) {
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
            feed[method](params);
            return self._feedRepo.commit(feed);
          }
        });
      }
    });
  };

  var renameFeed = function(params) {
    return feedMethod.call(this, "rename",params);
  };

  var setFeedSchema = function(params) {
    return feedMethod.call(this, "setSchema", params);
  };

  IOTHubCmdHandler.prototype.execute = function(cmd) {
    var promise;

    switch (cmd.command) {
      case "iot/hub/create":
        promise = createHub.call(this, cmd.params);
        break;
      case "iot/hub/rename":
        promise = renameHub.call(this, cmd.params);
        break;
      case "iot/feed/create":
        promise = createFeed.call(this, cmd.params);
        break;
      case "iot/feed/rename":
        promise = renameFeed.call(this, cmd.params);
        break;
      case "iot/feed/setSchema":
        promise = setFeedSchema.call(this, cmd.params);
        break;
      case "iot/feed/data":
        promise = startProcessFeedData.call(this, cmd.params);
        break;
      default:
        log("iot hub command handler - unknown command: %s", cmd.command);
        promise = Promise.reject(new Error("iot hub command handler - unknown command: " + cmd.command));
        break;
    }

    return promise;
  };

  return IOTHubCmdHandler;
}());
