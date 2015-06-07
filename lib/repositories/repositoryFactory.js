"use strict";

module.exports = (function() {
  var cache = {};
  var dbFactory = require("../storage/dbFactory");
  var Repository = require("./repository");

  function getRepo(databaseName, eventBus, cb) {
    var self = this;
    var cacheName = databaseName;
    if (cache.hasOwnProperty(cacheName)) {
      if (cache[cacheName].isConnected === false) {
        cache[cacheName].connectionCallbacks.push(cb);
      } else {
        process.nextTick(function() { cb(null, cache[cacheName].repo); });
      }
    } else {
      cache[cacheName] = { isConnected: false, connectionCallbacks: [ cb ] };
      dbFactory.getDb(databaseName, function(err,db) {
        if (!err) {
          cache[cacheName].isConnected = true;
          cache[cacheName].db = db;
          cache[cacheName].repo = new Repository(db, eventBus);
        }
        cache[cacheName].connectionCallbacks.forEach(function(connCB) {
          connCB(err, cache[cacheName].repo);
        });
        cache[cacheName].connectionCallbacks = [];
        if (err) {
          console.log("failed to load database: " + err.message);
          delete cache[cacheName];
        }
      });
    }
  }

  return {
    getRepository: getRepo
  }
}());
