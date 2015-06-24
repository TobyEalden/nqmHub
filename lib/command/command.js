"use strict";

exports.Command = (function() {
  var log = require("debug")("command");

  function Command(cmd, params) {
    log("creating command %s with params %j",cmd,params);
    this.command = cmd;
    this.params = params;
  }

  return Command;
}());
