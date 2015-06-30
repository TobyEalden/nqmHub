"use strict";

exports.Command = (function() {
  var log = require("debug")("nqmHub:command");
  var errLog = require("debug")("nqmHub:error");

  function Command(cmd, params) {
    log("creating command %s with params %j",cmd,params);
    this.command = cmd;
    this.params = params;
  }

  return Command;
}());
