/**
 * Created by toby on 20/08/15.
 */


module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:AccessTokenCmdHandler");
  var errLog = require("debug")("nqmHub:AccessTokenCmdHandler:error");
  var Promise = require("bluebird");
  var _ = require("lodash");
  var AccessToken = require("../domain/accessToken");
  var Repository = require("../../events/eventRepository").Repository;
  var util = require("util");
  var common = require("../../common");

  function AccessTokenCmdHandler() {
    this._accessTokenRepo = new Repository(AccessToken);
  }

  var createAccessToken = function(params) {
    var self = this;
    params.id = params.id || common.randomTextId(6);
    // Check the if an accessToken already exists with this id.
    return this._accessTokenRepo.get(params.id).then(function(accessToken) {
      if (accessToken && !accessToken.__deleted) {
        throw new Error(util.format("accessToken already exists with key %j", params.id));
      }
      if (!accessToken) {
        accessToken = self._accessTokenRepo.factory();
      }
      accessToken.create(params);

      return self._accessTokenRepo.commit(accessToken);
    });
  };

  var setTrustedUserStatus = function(params) {
    var self = this;
    // Check that a trustedUser already exists with this id.
    return this._accessTokenRepo.get(params.id).then(function(trustedUser) {
      if (!trustedUser || trustedUser.__deleted) {
        throw new Error(util.format("trustedUser not found with key %j", params.id));
      }
      trustedUser.setStatus(params);
      return self._accessTokenRepo.commit(trustedUser);
    });
  };

  var deleteTrustedUser = function(params) {
    var self = this;
    // Check that a trustedUser already exists with this id.
    return this._accessTokenRepo.get(params.id).then(function(trustedUser) {
      if (!trustedUser || trustedUser.__deleted) {
        throw new Error(util.format("trustedUser not found with key %j", params.id));
      }
      trustedUser.delete(params);
      return self._accessTokenRepo.commit(trustedUser);
    });
  };

  AccessTokenCmdHandler.prototype.execute = function(cmd) {
    var promise;

    switch (cmd.command) {
      case "accessToken/create":
        promise = createAccessToken.call(this, cmd.params);
        break;
      case "accessToken/delete":
        promise = deleteTrustedUser.call(this, cmd.params);
        break;
      default:
        errLog("accessToken command handler - unknown command: %s", cmd.command);
        promise = Promise.reject(new Error("accessToken command handler - unknown command: " + cmd.command));
        break;
    }

    return promise;
  };

  return AccessTokenCmdHandler;
}());
