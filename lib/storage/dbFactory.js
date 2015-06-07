"use strict";

module.exports = (function() {
  var console = process.console ? process.console : global.console;
  var cache = {};
  var config = require("../../config.json");

  var getDb = function(name, cb) {
    if (cache.hasOwnProperty(name)) {
      if (!cache[name].connected) {
        console.log("waiting for cached db connection to connect: " + name);
        cache[name].connectionCallbacks.push(cb);
      } else {
        console.log("using cached db connection for: " + name);
        process.nextTick(function() { cb(null,cache[name].db); });
      }
    } else {
      var dbLibrary;

      if (config.hasOwnProperty(name)) {
        switch (config[name].type) {
          case "mongodb":
            dbLibrary = require("./nqmMongoRepo");
            break;
          case "postgres":
            console.log("postgres db not implemented");
            break;
          default:
            console.log("unknown db: " + name);
            break;
        }

        if (dbLibrary) {
          var db = new dbLibrary(config[name]);
          cache[name] = {
            db: db,
            connected: false,
            connectionCallbacks: []
          };
          cache[name].connectionCallbacks.push(cb);
          cache[name].db.connect(function(err) {
            if (!err) {
              console.log("db connection for: " + name);
              cache[name].connected = true;
              cache[name].connectionCallbacks.forEach(function(connectionCB) {
                connectionCB(err, cache[name].db);
              });
            } else {
              console.log("failed db connection for: " + name);
              delete cache[name];
              cb(err);
            }
          });
        }
      } else {
        cb(new Error("no configuration found for db: " + name));
      }
    }
  };

  var clearCache = function() {
    for (var c in cache) {
      if (cache.hasOwnProperty(c)) {
        if (cache[c].connected) {
          cache[c].db.close();
        }
      }
    }
    cache = {};
  };

  return {
    getDb: getDb,
    closeFactory: clearCache
  }
}());

