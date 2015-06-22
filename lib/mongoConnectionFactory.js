"use strict";

(function() {
  var mongodb = require("mongodb").MongoClient;
  var util = require("util");
  var config = require("../config.json");
  var logger = require("debug")("MongoConnection");

  function MongoConnection(configKey) {
    this._db = null;
    this._key = configKey;
  }

  MongoConnection.prototype.start = function(connectionString, cb) {
    var self = this;
    if (typeof connectionString === "function") {
      cb = connectionString;
      connectionString = config.db[this._key];
    }
    mongodb.connect(connectionString, function (err, db) {
      if (err) {
        logger('Failed to connect to database %s - %s', connectionString, err.message);
        return cb(err);
      }
      self._db = db;
      logger('Connected successfully to %s', connectionString);
      return cb();
    });
  };

  MongoConnection.prototype.db = function() {
    return this._db;
  };

  module.exports = {
    commandDb: new MongoConnection("command"),
    queryDb: new MongoConnection("query")
  };
}());
