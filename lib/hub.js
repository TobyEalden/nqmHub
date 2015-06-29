"use strict";

module.exports = (function() {
  var log = require("debug")("hubMain");
  var config = require("../config.json");

  // ToDo - fix this startup.
  var eventBus = require("./events/eventBus");

  var initialiseDatabase = function() {
    var dbs = require("./mongoConnectionFactory");
    return dbs.eventStore.start();
  };

  var initialiseHTTPCommandListener = function() {
    var HTTPListener = require("./command/httpCommandListener").Listener;
    var httpCommandListener = new HTTPListener(config.httpCommandListener);
    return httpCommandListener.start();
  };

  var fatalError = function(err) {
    log("fatal: %s", err.message);
    log(err.stack);
    process.exit();
  };

  initialiseDatabase()
    .then(initialiseHTTPCommandListener)
    .then(null, fatalError);
}());
