"use strict";

(function() {
  var log = require("debug")("mongoConnection");
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
        log('Failed to connect to database %s - %s', connectionString, err.message);
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
