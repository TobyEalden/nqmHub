"use strict";

exports.Factory = (function() {

  function Factory(eventBus) {
    this._eventBus = eventBus;
  }

  Factory.prototype.getHandler = function(commandType) {
    var handler;

    switch (commandType) {
      case "IOTHub":
        handler = new (require("./commandHandlers/IOTHubCmdHandler"))(this._eventBus);
        break;
      default:
        console.log("no handler found for command: " + commandType);
        break;
    }

    return handler;
  };

  return Factory;
}());

