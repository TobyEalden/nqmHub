exports.Factory = (function() {
  "use strict";

  var log = require("debug")("nqmHub:commandFactory");
  var errLog = require("debug")("nqmHub:error");

  function Factory() {
  }

  Factory.prototype.getHandler = function(commandType) {
    var handler;

    log("creating handler for %s",commandType);
    switch (commandType) {
      case "iot":
        handler = new (require("./commandHandlers/iotHubCmdHandler"))();
        break;
      case "dataset":
        handler = new (require("./commandHandlers/datasetCmdHandler"))();
        break;
      case "account":
        handler = new (require("./commandHandlers/accountCmdHandler"))();
        break;
      case "trustedUser":
        handler = new (require("./commandHandlers/trustedUserCmdHandler"))();
        break;
      case "accessToken":
        handler = new (require("./commandHandlers/accessTokenCmdHandler"))();
        break;
      default:
        errLog("no handler found for command %s", commandType);
        break;
    }

    return handler;
  };

  return Factory;
}());

