/**
 * Created by toby on 20/08/15.
 */


module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:domain/shareToken");
  var errLog = require("debug")("nqmHub:domain/shareToken:error");
  var Entity = require("./entity");
  var util = require("util");
  var _ = require("lodash");
  var common = require("../../common");

  function ShareToken() {
    this.id = "";
    this.status = "";

    Entity.apply(this, arguments);
  }
  util.inherits(ShareToken, Entity);

  // Static method specifying the unique indices.
  ShareToken.getKey = function() {
    return [ "id" ];
  };

  ShareToken.prototype.create = function(params) {
    log("creating with %j",params);
    this.applyEvent("created",params);
  };

  ShareToken.prototype.delete = function(params) {
    log("deleting with %j",params);
    this.applyEvent("deleted",params);
  };

  ShareToken.prototype._createdEventHandler = function(params) {
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

  ShareToken.prototype._statusSetEventHandler = function(params) {
    this.status = params.status;
  };

  ShareToken.prototype._deletedEventHandler = function(params) {
    this.__deleted = true;
  };

  return ShareToken;
}());