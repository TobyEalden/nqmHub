"use strict";

exports.CommandBus = (function() {

  function CommandBus(handlerFactory) {
    this._handlerFactory = handlerFactory;
  }

  CommandBus.prototype.send = function(cmd, cb) {
    var handler = this._handlerFactory.getHandler(cmd.type);
    if (handler) {
      handler.execute(cmd, cb);
    } 
  };

  return CommandBus;
}());