/**
 * Created by toby on 20/08/15.
 */


module.exports = (function() {
  "use strict";

  var log = require("debug")("nqmHub:ApiTokenCmdHandler");
  var errLog = require("debug")("nqmHub:ApiTokenCmdHandler:error");
  var Promise = require("bluebird");
  var _ = require("lodash");
  var ApiToken = require("../domain/apiToken");
  var Repository = require("../../events/eventRepository").Repository;
  var util = require("util");
  var common = require("../../common");

  function ApiTokenCmdHandler() {
    this._apiTokenRepo = new Repository(ApiToken);
  }

  var createAPIToken = function(params) {
    var self = this;
    params.id = params.id || common.randomTextId(6);
    // Check the if an apiToken already exists with this id.
    return this._apiTokenRepo.get(params.id).then(function(apiToken) {
      if (apiToken && !apiToken.__deleted) {
        throw new Error(util.format("apiToken already exists with key %j", params.id));
      }
      if (!apiToken) {
        apiToken = self._apiTokenRepo.factory();
      }
      apiToken.create(params);

      return self._apiTokenRepo.commit(apiToken);
    });
  };

  var deleteAPIToken = function(params) {
    var self = this;
    // Check that a apiToken already exists with this id.
    return this._apiTokenRepo.get(params.id).then(function(apiToken) {
      if (!apiToken || apiToken.__deleted) {
        throw new Error(util.format("apiToken not found with key %j", params.id));
      }
      apiToken.delete(params);
      return self._apiTokenRepo.commit(apiToken);
    });
  };

  ApiTokenCmdHandler.prototype.execute = function(cmd) {
    var promise;

    switch (cmd.command) {
      case "apiToken/create":
        promise = createAPIToken.call(this, cmd.params);
        break;
      case "apiToken/delete":
        promise = deleteAPIToken.call(this, cmd.params);
        break;
      default:
        errLog("apiToken command handler - unknown command: %s", cmd.command);
        promise = Promise.reject(new Error("apiToken command handler - unknown command: " + cmd.command));
        break;
    }

    return promise;
  };

  return ApiTokenCmdHandler;
}());
