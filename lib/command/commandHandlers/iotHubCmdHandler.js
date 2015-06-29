"use strict";

module.exports = (function() {
  var log = require("debug")("iotHubCmdHandler");
  var Promise = require("bluebird");
  var _ = require("lodash");
  var IOTHub = require("../domain/iotHub");
  var IOTFeed = require("../domain/iotFeed");
  var IOTFeedData = require("../domain/iotFeedData");
  var Repository = require("../../events/eventRepository").Repository;
  var feedSnapshotFrequency = 5;

  function IOTHubCmdHandler() {
    this._hubRepo = new Repository(IOTHub);
    this._feedRepo = new Repository(IOTFeed);
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
        var grouped = _.groupBy(params.payload, function(i) { return i.feedId });
        var promises = [];
        _.forEach(grouped, function(datumList, feedId) {
          promises.push(processFeedData.call(this, params.hubId, feedId, datumList));
        }, self);
        return Promise.all(promises);
      }
    });
  };

  var processFeedData = function(hubId, feedId, datumList) {
    var self = this;

    // Check the feed is valid.
    self._feedRepo.get([hubId,feedId]).then(function(feed) {
      if (!feed) {
        return Promise.reject(new Error("no feed found with id: " + feedId));
      } else {
        var feedDataRepo = new Repository(IOTFeedData, { collectionBaseName: feed.store });
        var feedData = feedDataRepo.factory();
        _.forEach(datumList, function(datum) {
          feedData.create(datum.payload);
        });
        return feedDataRepo.commit(feedData);
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
        return self._feedRepo.get([params.hubId, params.id]).then(function(feed) {
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
        return self._feedRepo.get([params.hubId, params.id]).then(function(feed) {
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