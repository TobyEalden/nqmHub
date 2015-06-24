"use strict";

module.exports = (function() {
  var log = require("debug")("hubMain");
  var config = require("../config.json");

  var initialiseDatabase = function() {
    var dbs = require("./mongoConnectionFactory");
    return dbs.commandDb.start().bind(dbs.queryDb).then(dbs.queryDb.start);
  };

  var initialiseHTTPQueryListener = function() {
    var HTTPListener = require("./query/httpQueryListener").Listener;
    var httpQueryListener = new HTTPListener(config.httpQueryListener);
    return httpQueryListener.start();
  };

  var startReadFeedNormaliser = function() {
    var FeedNormaliser = require("./query/normalisers/feedNormaliser").Normaliser;
    var readFeedNormaliser = new FeedNormaliser();
    return readFeedNormaliser.start();
  };

  var fatalError = function(err) {
    log("fatal: %s", err.message);
    log(err.stack);
    process.exit();
  };

  initialiseDatabase()
    .then(initialiseHTTPQueryListener)
    .then(startReadFeedNormaliser)
    .then(null, fatalError);
}());
