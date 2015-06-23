"use strict";

module.exports = (function() {
  var log = require("debug")("hubMain");
  var Promise = require("bluebird");
  var config = require("../config.json");
  var FeedNormaliser = require("./query/normalisers/feedNormaliser").Normaliser;
  var readFeedNormaliser = new FeedNormaliser();

  var initialiseDatabase = function() {
    return new Promise(function(resolve, reject) {
      var dbs = require("./mongoConnectionFactory");
      dbs.commandDb.start().bind(dbs.queryDb).then(dbs.queryDb.start).then(resolve).then(null,reject);
    });
  };

  var initialiseCommandBus = function() {
    var eventBus = require("./events/eventBus").EventBus;
    var CommandBus = require("./command/commandBus").CommandBus;
    var CommandHandlerFactory = require("./command/commandHandlerFactory").Factory;

    // Create a command factory linked to the event bus.
    var commandHandlerFactory = new CommandHandlerFactory(eventBus);

    // Create a command bus to receive and distribute incoming commands.
    var commandBus = new CommandBus(commandHandlerFactory);

    // Handler for events published on the event bus.
    eventBus.on("event", function(ev) {
      log("received event: %j", ev);
    });

    return commandBus;
  };

  var initialiseHTTPQueryListener = function() {
    var HTTPListener = require("./query/httpQueryListener").Listener;
    var httpQueryListener = new HTTPListener(config.httpQueryListener);

    return httpQueryListener.start();
  };

  var initialiseHTTPCommandListener = function(commandBus) {
    // Create a listener for incoming HTTP commands
    var HTTPListener = require("./command/httpCommandListener").Listener;
    var iotHubCommandListener = new HTTPListener(config.httpCommandListener);

    // Handler for incoming HTTP data.
    iotHubCommandListener.on("data", function(data, listenerCallback) {
      httpListener(commandBus, data, listenerCallback);
    });

    // Start the HTTP listener.
    return iotHubCommandListener.start();
  };

  var httpListener = function(commandBus, data, listenerCallback) {
    var Command = require("./command/command").Command;

    log("data from http feed: %j",data);

    // Extract target command name.
    var cmdName = data.cmd;

    // Create a command.
    var cmd = new Command("IOTHub", cmdName, data.params);

    // Send via command bus.
    commandBus.send(cmd, function(err, result) {
      if (err) {
        log("failed to execute command: %s", cmdName);
        listenerCallback(new Error("command execution failed - " + err.message));
      } else {
        log("command execution complete: %s",cmdName);
        listenerCallback();
      }
    });
  };

  var startReadFeedNormaliser = function() {
    return new Promise(function(resolve,reject) {
      readFeedNormaliser.start(function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(err);
        }
      });
    });
  };

  var fatalError = function(err) {
    log("fatal: %s", err.message);
    process.exit();
  };

  initialiseDatabase().bind(readFeedNormaliser).then(readFeedNormaliser.start)
    .then(initialiseCommandBus)
    .then(initialiseHTTPCommandListener)
    .then(initialiseHTTPQueryListener)
    .then(null, fatalError);
}());
