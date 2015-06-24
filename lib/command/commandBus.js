"use strict";

exports.CommandBus = (function() {
  var log = require("debug")("commandBus");
  var Promise = require("bluebird");

  function CommandBus(handlerFactory) {
    this._handlerFactory = handlerFactory;
  }

  CommandBus.prototype.send = function(cmd) {
    log("looking for handler for command %s",cmd.command);
    var split = cmd.command.split(".");
    if (split.length > 1) {
      var type = split[0];
      var commandName = cmd.command.substr(type.length+1);
      var handler = this._handlerFactory.getHandler(type);
      if (handler) {
        log("executing command %s", commandName);
        return handler.execute(cmd);
      } else {
        log("unknown command %s", commandName);
        return Promise.reject(new Error("no handler found for command type: " + type));
      }
    } else {
      log("invalid command name %s",cmd.command);
      return Promise.reject(new Error("invalid command"));
    }
  };

  return CommandBus;
}());