/**
 * Created by toby on 14/08/15.
 */

module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:TrustedUserCmdHandler");
  var errLog = require("debug")("nqmHub:TrustedUserCmdHandler:error");
  var Promise = require("bluebird");
  var _ = require("lodash");
  var TrustedUser = require("../domain/trustedUser");
  var Repository = require("../../events/eventRepository").Repository;
  var util = require("util");
  var common = require("../../common");

  function TrustedUserCmdHandler() {
    this._trustedUserRepo = new Repository(TrustedUser);
  }

  var createTrustedUser = function(params) {
    var self = this;
    // Check the if an trustedUser already exists with this id.
    return this._trustedUserRepo.get(params.id).then(function(trustedUser) {
      if (trustedUser && !trustedUser.__deleted) {
        throw new Error(util.format("trustedUser already exists with key %j", params.id));
      }
      if (!trustedUser) {
        trustedUser = self._trustedUserRepo.factory();
      }
      trustedUser.create(params);
      return self._trustedUserRepo.commit(trustedUser);
    });
  };

  var setTrustedUserStatus = function(params) {
    var self = this;
    // Check that a trustedUser already exists with this id.
    return this._trustedUserRepo.get(params.id).then(function(trustedUser) {
      if (!trustedUser || trustedUser.__deleted) {
        throw new Error(util.format("trustedUser not found with key %j", params.id));
      }
      trustedUser.setStatus(params);
      return self._trustedUserRepo.commit(trustedUser);
    });
  };

  var deleteTrustedUser = function(params) {
    var self = this;
    // Check that a trustedUser already exists with this id.
    return this._trustedUserRepo.get(params.id).then(function(trustedUser) {
      if (!trustedUser || trustedUser.__deleted) {
        throw new Error(util.format("trustedUser not found with key %j", params.id));
      }
      trustedUser.delete(params);
      return self._trustedUserRepo.commit(trustedUser);
    });
  };

  TrustedUserCmdHandler.prototype.execute = function(cmd) {
    var promise;

    switch (cmd.command) {
      case "trustedUser/create":
        promise = createTrustedUser.call(this, cmd.params);
        break;
      case "trustedUser/setStatus":
        promise = setTrustedUserStatus.call(this, cmd.params);
        break;
      case "trustedUser/delete":
        promise = deleteTrustedUser.call(this, cmd.params);
        break;
      default:
        errLog("trustedUser command handler - unknown command: %s", cmd.command);
        promise = Promise.reject(new Error("trustedUser command handler - unknown command: " + cmd.command));
        break;
    }

    return promise;
  };

  return TrustedUserCmdHandler;
}());
