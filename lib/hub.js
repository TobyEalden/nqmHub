"use strict";

module.exports = (function() {
  var console = process.console ? process.console : global.console;
  var config = require("../config.json");
  var FeedNormaliser = require("./query/normalisers/feedNormaliser").Normaliser;
  var readFeedListener = new FeedNormaliser();

  var initialiseDatabase = function() {
    var sourcedRepoMongo = require("sourced-repo-mongo/mongo");
    sourcedRepoMongo.on("connected", function() {
      readFeedListener.start();
      initialiseCommandBus();
    });
    sourcedRepoMongo.on("error", function(err) {
      console.log("failed to connect to mongo instance: " + err.message);
    });
    sourcedRepoMongo.connect(config.hubDb.connection);
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
      console.log("received event: " + JSON.stringify(ev));
    });

    initialiseHTTPListener(commandBus);
  };

  var initialiseHTTPListener = function(commandBus) {
    // Create a listener for incoming HTTP commands
    var HTTPListener = require("./httpIOTHubListener").IOTHubListener;
    var iotHubListener = new HTTPListener(config.httpListener);

    // Handler for incoming HTTP data.
    iotHubListener.on("data", function(data, listenerCallback) {
      httpListener(commandBus, data, listenerCallback);
    });

    // Start the HTTP listener.
    iotHubListener.start();
  };

  var httpListener = function(commandBus, data, listenerCallback) {
    var Command = require("./command/command").Command;

    console.log("data from http feed: " + JSON.stringify(data));

    // Extract target command name.
    var cmdName = data.cmd;

    // Create a command.
    var cmd = new Command("IOTHub", cmdName, data.params);

    // Send via command bus.
    commandBus.send(cmd, function(err, result) {
      if (err) {
        console.log("failed to execute command: " + cmdName);
        listenerCallback(new Error("command execution failed - " + err.message));
      } else {
        console.log("execution complete - " + cmdName);
        listenerCallback();
      }
    });
  };

  initialiseDatabase();
}());
