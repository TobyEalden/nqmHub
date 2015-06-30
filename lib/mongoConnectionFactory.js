"use strict";

exports.eventStore = (function() {
  var log = require("debug")("nqmHub:mongoConnection");
  var errLog = require("debug")("nqmHub:error");
  var Promise = require("bluebird");
  var mongodb = Promise.promisifyAll(require("mongodb")).MongoClient;
  var util = require("util");
  var config = require("../config.json");

  function MongoConnection(configKey) {
    this._db = null;
    this._key = configKey;
  }

  MongoConnection.prototype.start = function(connectionString) {
    var self = this;
    if (!connectionString) {
      connectionString = config.db[this._key];
    }
    return mongodb.connectAsync(connectionString)
      .then(function(db) {
        log('Connected successfully to %s', connectionString);
        self._db = db;
      }, function(err) {
        errLog('Failed to connect to database %s - %s', connectionString, err.message);
        throw err;
      });
  };

  MongoConnection.prototype.db = function() {
    return this._db;
  };

  return new MongoConnection("eventStore");
}());
