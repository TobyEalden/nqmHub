"use strict";

module.exports = (function() {
  var console = process.console ? process.console : global.console;
  var config = require("../config.json");
  var EventBus = require("./eventBus").EventBus;
  var CommandBus = require("./commandBus").CommandBus;
  var CommandHandlerFactory = require("./commandHandlerFactory").Factory;
  var HTTPListener = require("./httpIOTHubListener").IOTHubListener;
  var Command = require("./command").Command;

  // Create event bus to publish command events.
  var eventBus = new EventBus();

  // Create a command factory linked to the event bus.
  var commandHandlerFactory = new CommandHandlerFactory(eventBus);

  // Create a command bus to receive and distribute incoming commands.
  var commandBus = new CommandBus(commandHandlerFactory);

  // Create a listener for incoming HTTP commands
  var iotHubListener = new HTTPListener(config.httpListener);

  // Handler for incoming HTTP data.
  iotHubListener.on("data", function(data, listenerCallback) {
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
  });

  // Handler for events published on the event bus.
  eventBus.on("event", function(ev) {
    console.log("received event: " + JSON.stringify(ev));
  });

  // Start the HTTP listener.
  iotHubListener.start();
}());
