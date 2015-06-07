"use strict";

exports.API = (function() {
  var console = process.console ? process.console : global.console;

  function HubAPI(db) {
    this._db = db;
  }

  var getHub = function(q, cb) {
    this._db.query("hubs", q, function(err, result) {
      if (!err) {
        result.toArray(cb);
      } else {
        cb(err,result);
      }
    });
  };

  var getFeed = function(q, cb) {
    this._db.query("feeds", q, function(err, result) {
      if (!err) {
        result.toArray(cb);
      } else {
        cb(err,result);
      }
    });
  };

  HubAPI.prototype.initialise = function(cb) {

  };

  HubAPI.prototype.createHub = function(hub, cb) {
    var self = this;

    // Check there isn't already a hub with the given id.
    getHub.call(this, { hubId: hub.hubId }, function(err,hubDocs) {
      if (!err) {
        if (hubDocs.length !== 0) {
          cb(new Error("hub already exists with id: " + hub.hubId));
        } else {
          self._db.insert("hubs", hub, cb);
        }
      } else {
        cb(err);
      }
    });
  };

  HubAPI.prototype.renameHub = function(params, cb) {
    var self = this;

    // Verify the hubID.
    getHub.call(this, { hubId: params.hubId}, function(err,hubDocs) {
      if (!err) {
        if (hubDocs.length === 0) {
          cb(new Error("no hub found with id: " + params.hubId));
        } else {
          self._db.update("hubs", { hubId: params.hubId }, { $set: { name: params.name }} , cb);
        }
      } else {
        cb(err);
      }
    });
  };

  HubAPI.prototype.createFeed = function(feed, cb) {
    var self = this;

    // Verify the hubID.
    getHub.call(this, { hubId: feed.hubId}, function(err,hubDocs) {
      if (!err) {
        if (hubDocs.length === 0) {
          cb(new Error("no hub found with id: " + feed.hubId));
        } else {
          // Found hub - check that feed doesn't already exist.
          getFeed.call(self, { hubId: feed.hubId, feedId: feed.feedId }, function(err,feedDocs) {
            if (!err) {
              if (feedDocs.length !== 0) {
                cb(new Error("feed already exists with id: " + feed.feedId));
              } else {
                self._db.insert("feeds", feed, cb);
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
  };

  HubAPI.prototype.feedData = function(datum, cb) {
    var self = this;

    getFeed.call(self, { hubId: datum.hubId, feedId: datum.feedId }, function(err,feedDocs) {
      if (!err) {
        if (feedDocs.length === 0) {
          cb(new Error("feed not found with id: " + datum.feedId));
        } else {
          self._db.insert("feedData", datum, cb);
        }
      } else {
        cb(err);
      }
    });
  };

  return HubAPI;
}());
