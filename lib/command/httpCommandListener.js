/**
 * Created by toby on 23/06/15.
 */

"use strict";

exports.Listener = (function() {
  var log = require("debug")("nqmHub:httpCommandListener");
  var errLog = require("debug")("nqmHub:error");
  var Promise = require("bluebird");
  var restify = require("restify");
  var CommandBus = require("../command/commandBus").CommandBus;
  var CommandHandlerFactory = require("../command/commandHandlerFactory").Factory;
  var Command = require("../command/command").Command;

  function CommandListener(config) {
    this._config = config;
    var commandHandlerFactory = new CommandHandlerFactory();
    this._commandBus = new CommandBus(commandHandlerFactory);
  }

  CommandListener.prototype.start = function() {
    return startServer.call(this);
  };

  var startServer = function() {
    var server = restify.createServer({
      name: 'nqmHub',
      version: '1.0.0'
    });
    Promise.promisifyAll(Object.getPrototypeOf(server));
    server.use(restify.acceptParser(server.acceptable));
    server.use(restify.queryParser());
    server.use(restify.bodyParser());

    var commandHandler = function(req, res, next) {
      var cmdName = req.params[0];
      log("request to execute command %s",cmdName);

      // Create command and send via command bus.
      var cmd = new Command(cmdName, req.body);
      this._commandBus.send(cmd).then(function() {
          log("command execution complete: %s",cmdName);
          res.send(200,{ ok: true });
          return next();
        }, function(err) {
          errLog("failed to execute command: %s [%s]", cmdName, err.message);
          res.send(400,{ error: err.message });
          return next();
        }
      );
    };
    server.post(/command\/(.*)/, commandHandler.bind(this));

    return server.listenAsync(this._config.port);
  };

  return CommandListener;
}());