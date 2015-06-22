"use strict";

module.exports = (function() {
  var console = process.console ? process.console : global.console;
  var assert = require("assert");
  var _ = require("lodash");
  var Hub = require("../domain/hub");
  var Feed = require("../domain/feed");
  var FeedData = require("../domain/feedData");
  var Repository = require("../../events/eventRepository").Repository;
  var feedSnapshotFrequency = 500;

  function IOTHubCmdHandler(eventBus) {
    this._eventBus = eventBus;
    this._hubRepo = new Repository(Hub, {}, this._eventBus);
    this._feedRepo = new Repository(Feed, {}, this._eventBus);
    this._feedDataRepo = null;
    this._cachedFeedData = null;
  }

  var nextDatum = function(i, params, cb) {
    var self = this;
    var data = params.payload;
    i++;
    if (i < data.length) {
      process.nextTick(function() { processFeedData.call(self, i, params, cb); });
    } else {
      // Finished processing - commit outstanding data.
      if (self._feedDataRepo && self._cachedFeedData) {
        self._feedDataRepo.commit(self._cachedFeedData, cb);
      } else {
        cb();
      }
    }
  };

  var startProcessFeedData = function(params, cb) {
    var self = this;
    this._hubRepo.get(params.hubId, function(err, hub) {
      if (err) {
        return cb(err);
      } else if (!hub) {
        return cb(new Error("hub not found with id: " + params.id));
      } else {
        params.payload = _.sortBy(params.payload, "id");
        self._cachedFeedData = self._feedDataRepo = null;
        processFeedData.call(self, 0, params,  cb);
      }
    });
  };

  var processFeedData = function(i, params, cb) {
    var self = this;
    var data = params.payload;
    var datum = data[i];

    var processDatum = function(dt) {
      var dtStore = {
        id: dt.id,
        hubId: params.hubId,
        datum: dt.payload
      };
      self._cachedFeedData.feedData(dtStore);
      nextDatum.call(self, i, params, cb);
    };

    if (datum.id) {
      if (!self._cachedFeedData || datum.id !== self._cachedFeedData.id) {
        // Need to access different feed repo.
        var nextFeed = function() {
          // Clear cached feed.
          self._feedDataRepo = self._cachedFeedData = null;
          // Check the feed is valid.
          self._feedRepo.get(datum.id, function(err, feed) {
            if (err) {
              return cb(err);
            } else if (!feed) {
              return cb(new Error("no feed found with id: " + datum.id));
            } else {
              // Get the latest snapshot of the feed data.
              self._feedDataRepo = new Repository(FeedData, { snapshotFrequency: feedSnapshotFrequency, collectionBaseName: feed.hubId + "." + feed.id }, self._eventBus);
              self._feedDataRepo.get(feed.id, function(err, feedData) {
                if (err) {
                  return cb(err);
                } else if (feedData) {
                  self._cachedFeedData = feedData;
                } else {
                  // First update -> create feed.
                  self._cachedFeedData = self._feedDataRepo.factory();
                }
                processDatum(datum);
              });
            }
          });
        };

        if (self._feedDataRepo && self._cachedFeedData) {
          // Commit outstanding data on previous feed.
          self._feedDataRepo.commit(self._cachedFeedData, function(err) {
            if (err) {
              return cb(err);
            } else {
              // Data committed, now continue.
              nextFeed();
            }
          });
        } else {
          // This is the first feed - continue.
          nextFeed();
        }
      } else {
        processDatum(datum);
      }
    } else {
      console.log("skipping invalid datum: " + JSON.stringify(datum));
      nextDatum.call(self, i, params, cb);
    }
  };

  var createHub = function(params, cb) {
    var self = this;
    this._hubRepo.get(params.id, function(err, hub) {
      if (err) {
        return cb(err);
      } else if (hub) {
        return cb(new Error("hub already exists with id: " + params.id));
      } else {
        hub = self._hubRepo.factory();
        hub.create(params);
        self._hubRepo.commit(hub, cb);
      }
    });
  };

  var renameHub = function(params, cb) {
    var self = this;
    this._hubRepo.get(params.id, function(err, hub) {
      if (err) {
        return cb(err);
      } else if (!hub) {
        return cb(new Error("hub not found with id: " + params.id));
      } else {
        hub.rename(params.name);
        self._hubRepo.commit(hub, cb);
      }
    });
  };

  var createFeed = function(params, cb) {
    var self = this;
    // Check the hub exists.
    this._hubRepo.get(params.hubId, function(err, hub) {
      if (err) {
        return cb(err);
      } else if (!hub) {
        return cb(new Error("no hub found with id: " + params.hubId));
      } else {
        // Check that a feed doesn't already exist with this name.
        self._feedRepo.get(params.id, function(err, feed) {
          if (err) {
            return cb(err);
          } else if (feed) {
            return cb(new Error("feed already exists with id: " + params.id));
          } else {
            feed = self._feedRepo.factory();
            feed.create(params);
            self._feedRepo.commit(feed,cb);
          }
        });
      }
    });
  };

  var renameFeed = function(params, cb) {
    var self = this;
    // Check the hub exists.
    this._hubRepo.get(params.hubId, function(err, hub) {
      if (err) {
        return cb(err);
      } else if (!hub) {
        return cb(new Error("no hub found with id: " + params.hubId));
      } else {
        // Check that a feed exists with this name.
        self._feedRepo.get(params.id, function(err, feed) {
          if (err) {
            return cb(err);
          } else if (!feed) {
            return cb(new Error("feed doesn't exist with id: " + params.id));
          } else {
            feed.rename(params);
            self._feedRepo.commit(feed,cb);
          }
        });
      }
    });
  };

  var createDataset = function(params, cb) {
    var self = this;
    // Check the hub exists.
    this._hubRepo.get(params.hubId, function(err, hub) {
      if (err) {
        return cb(err);
      } else if (!hub) {
        return cb(new Error("no hub found with id: " + params.hubId));
      } else {
        // Check that a feed doesn't already exist with this name.
        self._feedRepo.get(params.id, function(err, feed) {
          if (err) {
            return cb(err);
          } else if (feed) {
            return cb(new Error("feed already exists with id: " + params.id));
          } else {
            feed = self._feedRepo.factory();
            feed.create(params);
            self._feedRepo.commit(feed,cb);
          }
        });
      }
    });
  };

  var executeCommand = function(cmd, cb) {
    var self = this;

    switch (cmd.command) {
      case "createHub":
        createHub.call(this, cmd.params, cb);
        break;
      case "renameHub":
        renameHub.call(this, cmd.params, cb);
        break;
      case "createFeed":
        createFeed.call(this, cmd.params, cb);
        break;
      case "createDataset":
        createDataset.call(this, cmd.params, cb);
        break;
      case "renameFeed":
        renameFeed.call(this, cmd.params, cb);
        break;
      case "feedData":
        startProcessFeedData.call(self, cmd.params, cb);
        break;
      default:
        console.log("iot hub command handler - unknown command: " + cmd.command);
        break;
    }
  };

  IOTHubCmdHandler.prototype.execute = function(cmd, cb) {
    assert(cmd);
    executeCommand.call(this, cmd, cb);
  };

  return IOTHubCmdHandler;
}());
