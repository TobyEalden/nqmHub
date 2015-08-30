/**
 * Created by toby on 20/08/15.
 */


module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:ShareTokenCmdHandler");
  var errLog = require("debug")("nqmHub:ShareTokenCmdHandler:error");
  var Promise = require("bluebird");
  var _ = require("lodash");
  var ShareToken = require("../domain/shareToken");
  var Repository = require("../../events/eventRepository").Repository;
  var util = require("util");
  var common = require("../../common");

  function ShareTokenCmdHandler() {
    this._shareTokenRepo = new Repository(ShareToken);
  }

  var createShareToken = function(params) {
    var self = this;
    params.id = params.id || common.randomTextId(6);
    // Check the if an shareToken already exists with this id.
    return this._shareTokenRepo.get(params.id).then(function(shareToken) {
      if (shareToken && !shareToken.__deleted) {
        throw new Error(util.format("shareToken already exists with key %j", params.id));
      }
      if (!shareToken) {
        shareToken = self._shareTokenRepo.factory();
      }
      shareToken.create(params);

      return self._shareTokenRepo.commit(shareToken);
    });
  };

  var deleteShareToken = function(params) {
    var self = this;
    // Check that a shareToken already exists with this id.
    return this._shareTokenRepo.get(params.id).then(function(shareToken) {
      if (!shareToken || shareToken.__deleted) {
        throw new Error(util.format("shareToken not found with key %j", params.id));
      }
      shareToken.delete(params);
      return self._shareTokenRepo.commit(shareToken);
    });
  };

  ShareTokenCmdHandler.prototype.execute = function(cmd) {
    var promise;

    switch (cmd.command) {
      case "shareToken/create":
        promise = createShareToken.call(this, cmd.params);
        break;
      case "shareToken/delete":
        promise = deleteShareToken.call(this, cmd.params);
        break;
      default:
        errLog("shareToken command handler - unknown command: %s", cmd.command);
        promise = Promise.reject(new Error("shareToken command handler - unknown command: " + cmd.command));
        break;
    }

    return promise;
  };

  return ShareTokenCmdHandler;
}());
