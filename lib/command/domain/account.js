/**
 * Created by toby on 04/08/15.
 */

module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:domain/account");
  var errLog = require("debug")("nqmHub:domain/account:error");
  var Entity = require("./entity");
  var util = require("util");
  var _ = require("lodash");
  var common = require("../../common");

  function Account() {
    this.id = "";
    this.name = "";

    Entity.apply(this, arguments);
  }
  util.inherits(Account, Entity);

  // Static method specifying the unique indices for Dataset.
  Account.getKey = function() {
    return [ "id" ];
  };

  Account.prototype.create = function(params) {
    log("creating with %j",params);
    this.applyEvent("created",params);
  };

  Account.prototype._createdEventHandler = function(params) {
    this.id = params.id;
    this.authId = params.authId;
    this.__deleted = false;
    this.__created = params.__timestamp;
  };

  return Account;
}());