"use strict";

module.exports = (function() {
  var log = require("debug")("hubMain");
  var config = require("../config.json");

  var initialiseDatabase = function() {
    var dbs = require("./mongoConnectionFactory");
    return dbs.commandDb.start().bind(dbs.queryDb).then(dbs.queryDb.start);
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
    var cmd = new Command(cmdName, data.params);

    // Send via command bus.
    commandBus.send(cmd).then(function() {
        log("command execution complete: %s",cmdName);
        listenerCallback();
      }, function(err) {
        log("failed to execute command: %s [%s]", cmdName, err.message);
        listenerCallback(new Error("command execution failed - " + err.message));
      }
    );
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
    .then(initialiseCommandBus)
    .then(initialiseHTTPCommandListener)
    .then(initialiseHTTPQueryListener)
    .then(startReadFeedNormaliser)
    .then(null, fatalError);
}());
