"use strict";

module.exports = (function() {
  var console = process.console ? process.console : global.console;
  var mongoClient = require('mongodb').MongoClient;

  function mdbClient(config) {
    this._config = config;
    this._db = null;
  }

  mdbClient.prototype.connect = function(cb) {
    var self = this;

    mongoClient.connect(this._config.connection, function(err, db) {
      if (err) {
        console.log("failed to connect to mongodb: " + self._config.connection + " error is: " + err.message);
      } else {
        console.log("connected to " + self._config.connection);
        self._db = db;
      }
      cb(err);
    })
  };

  mdbClient.prototype.query = function(collection, query, cb) {
    if (this._db) {
      var coll = this._db.collection(collection);
      coll.find(query, cb);
    } else {
      console.log("query failed - not connected");
      process.nextTick(function() { cb(new Error("not connected")); });
    }
  };

  mdbClient.prototype.insert = function(collection, doc, cb) {
    if (this._db) {
      var coll = this._db.collection(collection);
      coll.insertOne(doc, cb);
    } else {
      console.log("insert failed - not connected");
      process.nextTick(function() { cb(new Error("not connected")); });
    }
  };

  mdbClient.prototype.update = function(collection, query, doc, cb) {
    if (this._db) {
      var coll = this._db.collection(collection);
      coll.updateOne(query, doc, cb);
    } else {
      console.log("update failed - not connected");
      process.nextTick(function() { cb(new Error("not connected")); });
    }
  };

  mdbClient.prototype.remove = function(collection, doc, cb) {
    if (this._db) {
      var coll = this._db.collection(collection);
      coll.removeOne(doc, cb);
    } else {
      console.log("delete failed - not connected");
      process.nextTick(function() { cb(new Error("not connected")); });
    }
  };

  mdbClient.prototype.close = function() {
    if (this._db) {
      console.log("closing db " + this._config.connection);
      this._db.close();
      this._db = null;
    }
  };

  return mdbClient;
}());
