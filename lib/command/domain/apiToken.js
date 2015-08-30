/**
 * Created by toby on 20/08/15.
 */


module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:domain/apiToken");
  var errLog = require("debug")("nqmHub:domain/apiToken:error");
  var Entity = require("./entity");
  var util = require("util");
  var _ = require("lodash");
  var common = require("../../common");

  function ApiToken() {
    this.id = "";
    this.status = "";

    Entity.apply(this, arguments);
  }
  util.inherits(ApiToken, Entity);

  // Static method specifying the unique indices.
  ApiToken.getKey = function() {
    return [ "id" ];
  };

  ApiToken.prototype.create = function(params) {
    log("creating with %j",params);
    this.applyEvent("created",params);
  };

  ApiToken.prototype.delete = function(params) {
    log("deleting with %j",params);
    this.applyEvent("deleted",params);
  };

  ApiToken.prototype._createdEventHandler = function(params) {
    this.id = params.id;
    this.userId = params.userId;
    this.issued = params.issued;
    this.expires = params.expires;
    this.__deleted = false;
    this.__created = params.__timestamp;
  };

  ApiToken.prototype._statusSetEventHandler = function(params) {
    this.status = params.status;
  };

  ApiToken.prototype._deletedEventHandler = function(params) {
    this.__deleted = true;
  };

  return ApiToken;
}());