"use strict";

exports.Factory = (function() {
  var log = require("debug")("commandFactory");

  function Factory() {
  }

  Factory.prototype.getHandler = function(commandType) {
    var handler;

    log("creating handler for %s",commandType);
    switch (commandType) {
      case "iot":
        handler = new (require("./commandHandlers/IOTHubCmdHandler"))();
        break;
      case "dataset":
        handler = new (require("./commandHandlers/datasetCmdHandler"))();
        break;
      default:
        log("no handler found for command %s", commandType);
        break;
    }

    return handler;
  };

  return Factory;
}());

