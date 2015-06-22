"use strict";

exports.Command = (function() {
  var log = require("debug")("command");

  function Command(type, cmd, params) {
    log("creating %s command %s with params %j",type,cmd,params);
    this.type = type;
    this.command = cmd;
    this.params = params;
  }

  return Command;
}());
