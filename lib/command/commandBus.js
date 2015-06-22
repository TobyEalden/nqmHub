"use strict";

exports.CommandBus = (function() {
  var log = require("debug")("commandBus");

  function CommandBus(handlerFactory) {
    this._handlerFactory = handlerFactory;
  }

  CommandBus.prototype.send = function(cmd, cb) {
    log("looking for handler for %s commands",cmd.type);
    var handler = this._handlerFactory.getHandler(cmd.type);
    if (handler) {
      log("executing command %s/%s",cmd.type, cmd.command);
      handler.execute(cmd, cb);
    } else {
      log("unknown command %s",cmd);
      cb(new Error("no handler found for command type: " + cmd.type));
    }
  };

  return CommandBus;
}());