"use strict";

exports.IOTHubListener = (function() {
  var console = process.console ? process.console : global.console;
  var http = require("http");
  var util = require("util");
  var EventEmitter = require("events").EventEmitter;
  var url = require("url");
  var queryString = require("querystring");
  var commands = [
    "/createHub",
    "/createFeed",
    "/feedData"
  ];

  function loadRequestData(req, cb) {
    var self = this;
    var result = { statusCode:200, error: "", body: "" };

    if (req.method === "POST") {
      req.on("data", function(data) {
        result.body += data;
        if (result.body.length > self._config.maxRequestLength) {
          result.statusCode = 413;
          result.error = "request content too long";
          req.connection.destroy();
        }
      });
      req.on("end", function() {
        cb(result);
      });
    } else {
      // Bad request - expected POST.
      result.statusCode = 400;
      result.error = "Bad request, expected POST method";
      process.nextTick(function() { cb(result); });
    }
  }

  function processRequest(req, body, cb) {
    var contentType = req.headers["content-type"];
    var msg = {
      cmd: req.url.substr(1),
    };

    try {
      if (contentType === "application/x-www-form-urlencoded") {
        msg.params = queryString.parse(body);
      } else if (contentType === "application/json") {
        msg.params = JSON.parse(body);
      } else {
        cb(new Error("unsupported content-type: " + contentType));
      }
    } catch (e) {
      delete msg.params;
      cb(new Error("failed to parse content: " + contentType));
    }

    if (msg.params) {
      this.emit("data", msg, cb);
    }
  }

  var listener = function(req, res) {
    var self = this;
    if (true || commands.indexOf(req.url) !== -1) {
      console.log(req.url);
      loadRequestData.call(self, req, function(parseResult) {
        res.statusCode = parseResult.statusCode;
        if (res.statusCode === 200) {
          processRequest.call(self, req, parseResult.body, function(err) {
            if (err) {
              res.statusCode = 400;
              res.write(err.message);
            } else {
              res.write(JSON.stringify({ ok: true }));
            }
            res.end();
          });
        } else {
          res.write(parseResult.error);
          res.end();
        }
      });
    } else {
      res.statusCode = 404;
      res.write("error: unknown endpoint - " + req.url);
      res.end();
    }
  };

  function IOTHubListener(config) {
    EventEmitter.call(this);

    this._config = config;
    this._config.maxRequestLength = this._config.maxRequestLength || 1024;
    this._server = null;
  }

  util.inherits(IOTHubListener, EventEmitter);

  IOTHubListener.prototype.start = function() {
    console.log("starting feed listener on port: " + this._config.port);
    this._server = http.createServer(listener.bind(this));
    this._server.listen(this._config.port);
  };

  IOTHubListener.prototype.close = function() {
    console.log("closing feed listener");
    this._server.close();
  };

  return IOTHubListener;
}());
