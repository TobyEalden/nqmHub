/**
 * Created by toby on 14/08/15.
 */

module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:domain/zoneConnection");
  var errLog = require("debug")("nqmHub:domain/zoneConnection:error");
  var Entity = require("./entity");
  var util = require("util");
  var _ = require("lodash");
  var common = require("../../common");

  function TrustedUser() {
    this.id = "";
    this.status = "";

    Entity.apply(this, arguments);
  }
  util.inherits(TrustedUser, Entity);

  // Static method specifying the unique indices.
  TrustedUser.getKey = function() {
    return [ "id" ];
  };

  TrustedUser.prototype.create = function(params) {
    log("creating with %j",params);
    this.applyEvent("created",params);
  };

  TrustedUser.prototype.setStatus = function(params) {
    log("setStatus with %j",params);
    this.applyEvent("statusSet",params);
  };

  TrustedUser.prototype.delete = function(params) {
    log("deleting with %j",params);
    this.applyEvent("deleted",params);
  };

  TrustedUser.prototype._createdEventHandler = function(params) {
    this.id = params.id;
    this.userId = params.userId;
    this.owner = params.owner;
    this.serviceProvider = params.serviceProvider;
    this.issued = params.issued;
    this.expires = params.expires;
    this.status = params.status;
    this.__deleted = false;
    this.__created = params.__timestamp;
  };

  TrustedUser.prototype._statusSetEventHandler = function(params) {
    this.status = params.status;
  };

  TrustedUser.prototype._deletedEventHandler = function(params) {
    this.__deleted = true;
  };

  return TrustedUser;
}());