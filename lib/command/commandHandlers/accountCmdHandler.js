/**
 * Created by toby on 04/08/15.
 */

module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:AccountCmdHandler");
  var errLog = require("debug")("nqmHub:AccountCmdHandler:error");
  var Promise = require("bluebird");
  var _ = require("lodash");
  var Account = require("../domain/account");
  var Repository = require("../../events/eventRepository").Repository;
  var util = require("util");
  var common = require("../../common");

  function AccountCmdHandler() {
    this._accountRepo = new Repository(Account);
  }

  var createAccount = function(params) {
    var self = this;
    // Check the if an account already exists with this id.
    return this._accountRepo.get(params.id).then(function(account) {
      if (account && !account.__deleted && account.authId !== params.authId) {
        throw new Error(util.format("account already exists with key %j", params.id));
      }
      if (!account) {
        account = self._accountRepo.factory();
        account.create(params);
      }
      return self._accountRepo.commit(account);
    });
  };

  AccountCmdHandler.prototype.execute = function(cmd) {
    var promise;

    switch (cmd.command) {
      case "account/create":
        promise = createAccount.call(this, cmd.params);
        break;
      default:
        errLog("account command handler - unknown command: %s", cmd.command);
        promise = Promise.reject(new Error("account command handler - unknown command: " + cmd.command));
        break;
    }

    return promise;
  };

  return AccountCmdHandler;
}());
