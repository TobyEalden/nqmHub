"use strict";

module.exports = (function() {
  var console = process.console ? process.console : global.console;
  var assert = require("assert");
  var repositoryFactory = require("../repositories/repositoryFactory");
  var Hub = require("../domain/hub");
  var Feed = require("../domain/feed");
  var hubCollection = "hub";
  var feedCollection = "feed";

  function IOTHubCmdHandler(eventBus) {
    this._eventBus = eventBus;
  }

  var nextDatum = function(i, params, cb) {
    var self = this;
    var data = params.payload;
    i++;
    if (i < data.length) {
      process.nextTick(function() { processFeedData.call(self, i, params, cb); });
    } else {
      cb();
    }
  };

  var processFeedData = function(i, params, cb) {
    var self = this;
    var data = params.payload;
    var datum = data[i];
    if (!datum) {
      debugger;
    }
    if (params.hubId && datum.feedId) {
      self._repo.get(feedCollection, Feed, { key: { hubId: params.hubId, id: datum.feedId }}, function(err, agg) {
        if (!err) {
          if (agg === null) {
            cb(new Error("no feed found with id: " + datum.feedId + " at hub: " + params.hubId));
          } else {
            agg.feedData(datum);
            saveToRepo.call(self, feedCollection, agg, agg.version, function(err) {
              if (!err) {
                nextDatum.call(self, i, params, cb);
              } else {
                // Error saving feed data.
                cb(err);
              }
            });
          }
        } else {
          // Bubble error finding target feed.
          cb(err);
        }
      });
    } else {
      console.log("skipping invalid datum: " + JSON.stringify(datum));
      nextDatum.call(self, i, params, cb);
    }
  };

  var saveToRepo = function(collection, ent, version, cb) {
    if (ent) {
      this._repo.save(collection, ent.constructor, ent, version, cb);
    } else {
      cb(new Error("not implemented"));
    }
  };

  var executeCommand = function(cmd, cb) {
    var self = this;

    switch (cmd.command) {
      case "createHub":
        this._repo.count(hubCollection, { key: { id: cmd.params.id }}, function(err, count) {
          if (!err) {
            if (count) {
              cb(new Error("hub already exists with id: " + cmd.params.id));
            } else {
              var hub = new Hub(cmd.params.id, cmd.params.payload.name);
              saveToRepo.call(self, hubCollection, hub, -1, cb);
            }
          } else {
            cb(err);
          }
        });
        break;
      case "renameHub":
        this._repo.get(hubCollection, Hub, { key: { id: cmd.params.id }}, function(err, agg) {
          if (!err) {
            if (agg === null) {
              cb(new Error("no hub found with id: " + cmd.params.id));
            } else {
              console.log("latest snapshot is: " + JSON.stringify(agg));
              agg.rename(cmd.params.payload.name);
              saveToRepo.call(self, hubCollection, agg, cmd.params.version, cb);
            }
          } else {
            cb(err);
          }
        });
        break;
      case "createFeed":
        // Check the hub exists.
        this._repo.get(hubCollection, Hub, { key: { id: cmd.params.hubId }}, function(err, agg) {
          if (!err) {
            if (agg === null) {
              cb(new Error("no hub found with id: " + cmd.params.hubId));
            } else {
              // Check that a feed doesn't already exist with this name.
              self._repo.get(feedCollection, Feed, { key: { hubId: cmd.params.hubId, id: cmd.params.id }}, function(err, agg) {
                if (!err) {
                  if (agg !== null) {
                    cb(new Error("feed already exists with id: " + cmd.params.id));
                  } else {
                    var feed = new Feed(cmd.params.id, cmd.params.hubId, cmd.params.payload.name);
                    saveToRepo.call(self, feedCollection, feed, -1, cb);
                  }
                } else {
                  cb(err);
                }
              });
            }
          } else {
            cb(err);
          }
        });
        break;
      case "renameFeed":
        this._repo.get(feedCollection, Feed, { key: { hubId: cmd.params.hubId, id: cmd.params.id }}, function(err, agg) {
          if (!err) {
            if (agg === null) {
              cb(new Error("no feed found with id: " + cmd.params.id));
            } else {
              console.log("latest snapshot is: " + JSON.stringify(agg));
              agg.rename(cmd.params.payload.name);
              saveToRepo.call(self, feedCollection, agg, cmd.params.version, cb);
            }
          } else {
            cb(err);
          }
        });
        break;
      case "feedData":
        processFeedData.call(self, 0, cmd.params,  cb);
        break;
      default:
        console.log("iot hub command handler - unknown command: " + cmd.command);
        break;
    }
  };

  IOTHubCmdHandler.prototype.execute = function(cmd, cb) {
    assert(cmd);
    var self = this;

    // Lazy-load the api
    if (!self._repo) {
      repositoryFactory.getRepository("hubDb", self._eventBus, function(err, repo) {
        if (!err) {
          self._repo = repo;
          executeCommand.call(self, cmd, cb);
        } else {
          cb(new Error("failed to get hub repo: " + err.message));
        }
      });
    } else {
      executeCommand.call(self, cmd, cb);
    }
  };

  return IOTHubCmdHandler;
}());
