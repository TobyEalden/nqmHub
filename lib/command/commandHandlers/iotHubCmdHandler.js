
module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:iotHubCmdHandler");
  var errLog = require("debug")("nqmHub:error");
  var Promise = require("bluebird");
  var _ = require("lodash");
  var IOTHub = require("../domain/iotHub");
  var IOTFeed = require("../domain/iotFeed");
  var IOTFeedData = require("../domain/iotFeedData");
  var Repository = require("../../events/eventRepository").Repository;
  var util = require("util");
  var common = require("../../common");

  function IOTHubCmdHandler() {
    this._hubRepo = new Repository(IOTHub);
    this._feedRepo = new Repository(IOTFeed);
  }

  var createHub = function(params) {
    var self = this;
    params.id = params.id || util.format("hub-%s",common.randomTextId(6));
    return this._hubRepo.get(params.id).then(function(hub) {
      if (hub && !hub.__deleted) {
        throw new Error("hub already exists with id: " + params.id);
      } else {
        if (!hub) {
          hub = self._hubRepo.factory();
        }
        hub.create(params);
        return self._hubRepo.commit(hub);
      }
    });
  };

  var updateHub = function(params) {
    var self = this;
    return this._hubRepo.get(params.id).then(function(hub) {
      if (!hub || hub.__deleted) {
        throw new Error("hub not found with id: " + params.id);
      } else {
        hub.rename(params);
        hub.setTags(params);
        hub.setDescription(params);
        return self._hubRepo.commit(hub);
      }
    });
  };

  var hubMethod = function(method, params) {
    var self = this;
    return this._hubRepo.get(params.id).then(function(hub) {
      if (!hub || hub.__deleted) {
        throw new Error("hub not found with id: " + params.id);
      } else {
        hub[method](params);
        return self._hubRepo.commit(hub);
      }
    });
  };

  var renameHub = function(params) {
    return hubMethod.call(this, "rename", params);
  };

  var deleteHub = function(params) {
    return hubMethod.call(this, "delete", params);
  };

  var startProcessFeedData = function(params) {
    var self = this;
    return this._hubRepo.get(params.hubId).then(function(hub) {
      if (!hub || hub.__deleted) {
        throw new Error("hub not found with id: " + params.hubId);
      } else {
        var grouped = _.groupBy(params.payload, function(i) { return i.feedId; });
        var promises = [];
        _.forEach(grouped, function(datumList, feedId) {
          promises.push(processFeedData.call(this, params.hubId, feedId, datumList));
        }, self);
        return Promise.all(promises);
      }
    });
  };

  var getDataRepository = function(dataset) {
    // Get indices of dataset schema as array of field names.
    var uniqueKeys = [];
    if (dataset.uniqueIndex) {
      _.forEach(dataset.uniqueIndex, function(i) {
        uniqueKeys.push(i.asc ? i.asc : i.desc);
      });
    }
    return {
      indices: uniqueKeys,
      repo: new Repository(IOTFeedData, { indices: uniqueKeys, collectionBaseName: dataset.store })
    };
  };

  var processFeedData = function(hubId, feedId, datumList) {
    var self = this;

    // Check the feed is valid.
    self._feedRepo.get([hubId,feedId]).then(function(feed) {
      if (!feed) {
        return Promise.reject(new Error("no feed found with id: " + feedId));
      } else {
        var feedDataRepo = getDataRepository(feed).repo;
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
      if (!hub || hub.__deleted) {
        throw new Error("no hub found with id: " + params.hubId);
      } else {
        params.id = params.id || util.format("feed-%s",common.randomTextId(6));
        // Check that a feed doesn't already exist with this name.
        return self._feedRepo.get([params.hubId, params.id]).then(function(feed) {
          if (feed && !feed.__deleted) {
            throw new Error("feed already exists with id: " + params.id);
          } else {
            if (!feed) {
              feed = self._feedRepo.factory();
            }
            feed.create(params);
            return self._feedRepo.commit(feed);
          }
        });
      }
    });
  };

  var updateFeed = function(params) {
    var self = this;
    return this._hubRepo.get(params.hubId).then(function(hub) {
      if (!hub || hub.__deleted) {
        throw new Error("hub not found with id: " + params.id);
      } else {
        // Check that a feed exists with this name.
        return self._feedRepo.get([params.hubId, params.id]).then(function(feed) {
          if (!feed || feed.__deleted) {
            throw new Error("feed doesn't exist with id: " + params.id);
          } else {
            feed.rename(params);
            feed.setTags(params);
            feed.setDescription(params);
            feed.setSchema(params);
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
      if (!hub || hub.__deleted) {
        throw new Error("no hub found with id: " + params.hubId);
      } else {
        // Check that a feed exists with this name.
        return self._feedRepo.get([params.hubId, params.id]).then(function(feed) {
          if (!feed || feed.__deleted) {
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
    return feedMethod.call(this, "rename", params);
  };

  var deleteFeed = function(params) {
    return feedMethod.call(this, "delete", params);
  };

  var setFeedSchema = function(params) {
    return feedMethod.call(this, "setSchema", params);
  };

  var setFeedDescription = function(params) {
    return feedMethod.call(this, "setDescription", params);
  };

  var setFeedTags = function(params) {
    return feedMethod.call(this, "setTags", params);
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
      case "iot/hub/update":
        promise = updateHub.call(this, cmd.params);
        break;
      case "iot/hub/delete":
        promise = deleteHub.call(this, cmd.params);
        break;
      case "iot/feed/create":
        promise = createFeed.call(this, cmd.params);
        break;
      case "iot/feed/update":
        promise = updateFeed.call(this, cmd.params);
        break;
      case "iot/feed/rename":
        promise = renameFeed.call(this, cmd.params);
        break;
      case "iot/feed/setSchema":
        promise = setFeedSchema.call(this, cmd.params);
        break;
      case "iot/feed/setDescription":
        promise = setFeedDescription.call(this, cmd.params);
        break;
      case "iot/feed/setTags":
        promise = setFeedTags.call(this, cmd.params);
        break;
      case "iot/feed/delete":
        promise = deleteFeed.call(this, cmd.params);
        break;
      case "iot/feed/data":
        promise = startProcessFeedData.call(this, cmd.params);
        break;
      default:
        errLog("iot hub command handler - unknown command: %s", cmd.command);
        promise = Promise.reject(new Error("iot hub command handler - unknown command: " + cmd.command));
        break;
    }

    return promise;
  };

  return IOTHubCmdHandler;
}());
