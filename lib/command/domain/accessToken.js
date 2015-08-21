/**
 * Created by toby on 20/08/15.
 */


module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:domain/accessToken");
  var errLog = require("debug")("nqmHub:domain/accessToken:error");
  var Entity = require("./entity");
  var util = require("util");
  var _ = require("lodash");
  var common = require("../../common");

  function AccessToken() {
    this.id = "";
    this.status = "";

    Entity.apply(this, arguments);
  }
  util.inherits(AccessToken, Entity);

  // Static method specifying the unique indices.
  AccessToken.getKey = function() {
    return [ "id" ];
  };

  AccessToken.prototype.create = function(params) {
    log("creating with %j",params);
    this.applyEvent("created",params);
  };

  AccessToken.prototype.delete = function(params) {
    log("deleting with %j",params);
    this.applyEvent("deleted",params);
  };

  AccessToken.prototype._createdEventHandler = function(params) {
    this.id = params.id;
    this.userId = params.userId;
    this.owner = params.owner;
    this.scope = params.scope;
    this.resources = params.resources;
    this.issued = params.issued;
    this.expires = params.expires;
    this.__deleted = false;
    this.__created = params.__timestamp;
  };

  AccessToken.prototype._statusSetEventHandler = function(params) {
    this.status = params.status;
  };

  AccessToken.prototype._deletedEventHandler = function(params) {
    this.__deleted = true;
  };

  return AccessToken;
}());