/**
 * Created by toby on 20/06/15.
 */

module.exports.EventBus = (function() {
  "use strict";

  // Singleton for in-process comms.
  var EventBusImpl = require("./eventBusImpl").EventBusImpl;
  var impl = new EventBusImpl();
  var config = require("../../config.json");

  impl.start(config.eventBus);

  return impl;
}());