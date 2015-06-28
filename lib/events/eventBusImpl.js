"use strict";

exports.EventBusImpl = (function() {
  var log = require("debug")("eventBus");
  var Promise = require("bluebird");
  var util = require("util");
  var net = Promise.promisifyAll(require("net"));
  var EventEmitter = require("eventemitter2").EventEmitter2;
  var _ = require("lodash");

  function EventBus() {
    EventEmitter.call(this, { wildcard: true, delimiter: "." });
    this._clients = [];
  }
  util.inherits(EventBus, EventEmitter);

  var findClient = function(socket) {
    return _.find(this._clients, function(s) { return s.socket === socket; });
  };

  var cleanUpSocket = function(socket) {
    var self = this;
    var client = findClient.call(this, socket);
    var idx = _.indexOf(this._clients, client);
    log("removing client %d",idx);

    this._clients.splice(idx, 1);

    _.forEach(client.handlers, function(h) {
      self.removeListener(h.event, h.handler);
    });
  };

  var connectionHandler = function(socket) {
    var self = this;

    // Identify this client
    socket.name = socket.remoteAddress + ":" + socket.remotePort

    // Put this new client in the list
    self._clients.push({
      socket: socket,
      handlers: []
    });

    // Handle incoming messages from clients.
    socket.on("data", function (data) {
      handleSocketData.call(self,socket, data);
    });

    socket.on("end", function () {
      log("socket ended");
      cleanUpSocket.call(self, socket);
    });

    socket.on("error", function(err) {
      log("error on socket: %s", err.message);
      cleanUpSocket.call(self, socket);
    });
  };

  var createListener = function(socket) {
    return function(data) {
      var packet = {
        method: "consume",
        key: this.event,
        data: data
      };
      socket.write(JSON.stringify(packet));
    };
  };

  var subscribeSocket = function(socket, msg) {
    var client = findClient.call(this, socket);
    var listener = createListener(socket);
    client.handlers.push({
      event: msg.key,
      handler: listener
    });
    this.subscribe(msg.key, listener);

    if (msg.hasOwnProperty("replyId")) {
      var replyPacket = { method: "ack", replyId: msg.replyId };
      socket.write(JSON.stringify(replyPacket));
    }
  };

  var catchupSocket = function(socket, msg) {

  };

  var handleSocketData = function(socket, data) {
    var self = this;
    log("got data %s",data.toString());
    try {
      var msg = JSON.parse(data.toString());
      switch (msg.method) {
        case "subscribe":
          subscribeSocket.call(self, socket, msg);
          break;
        case "catchup":
          catchupSocket.call(self, socket, msg);
          break;
        default:
          log("unrecognised method %s", msg.method);
          break;
      }
    } catch (e) {
      log("failed to parse message: %s", data.toString());
    }
  };

  EventBus.prototype.start = function(config) {
    var self = this;
    this._clients = [];

    log("creating socket server");
    this._server = net.createServer({}, connectionHandler.bind(this));

    log("created server");

    this._ready = this._server.listenAsync(config.port).then(function() {
      log("event bus running at port %d", config.port);
    });

    return this._ready;
  };

  EventBus.prototype.publish = function(evt, data) {
    var self = this;
    this._ready.then(function() {
      log("publishing %s", evt);
      self.emit(evt, data);
    });
  };

  EventBus.prototype.subscribe = EventBus.prototype.on;

  return EventBus;
}());
