/**
 * Created by toby on 20/06/15.
 */

module.exports.EventBus = (function() {
  // Singleton for in-process comms.
  var EventBusImpl = require("./eventBusImpl").EventBusImpl;
  return new EventBusImpl();
}());