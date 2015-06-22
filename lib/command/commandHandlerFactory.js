"use strict";

exports.Factory = (function() {
  var log = require("debug")("commandFactory");

  function Factory(eventBus) {
    this._eventBus = eventBus;
  }

  Factory.prototype.getHandler = function(commandType) {
    var handler;

    log("creating handler for %s",commandType);
    switch (commandType) {
      case "IOTHub":
        handler = new (require("./commandHandlers/IOTHubCmdHandler"))(this._eventBus);
        break;
      default:
        log("no handler found for command %s", commandType);
        break;
    }

    return handler;
  };

  return Factory;
}());

