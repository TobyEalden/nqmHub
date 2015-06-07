"use strict";

exports.Command = (function() {
  function Command(type, cmd, params) {
    this.type = type;
    this.command = cmd;
    //this.targetId = params.id;
    //this.targetVersion = parseInt(params.version);
    this.params = params;

    //delete this.params.id;
    //delete this.params.version;
  }

  return Command;
}());
