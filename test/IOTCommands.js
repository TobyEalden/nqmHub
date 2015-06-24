/**
 * Created by toby on 20/06/15.
 */

"use strict";

var config = {
  MONGO_URL: "mongodb://localhost:27017/nqmHubTests"
};

var eventBus = require("../lib/events/eventBus").EventBus;
var Factory = require("../lib/command/commandHandlerFactory").Factory;
var Command = require("../lib/command/command").Command;
var dbs = require("../lib/mongoConnectionFactory");
var cbCalled = false;
var db;
var cmdHandler;

var initDB = function() {
  db.collection("Hub.events").drop();
  db.collection("Hub.snapshots").drop();
  db.collection("Feed.events").drop();
  db.collection("Feed.snapshots").drop();

  var cmdHandlerFactory = new Factory(eventBus);
  cmdHandler = cmdHandlerFactory.getHandler("iot");
};

exports.setUp = function(cb) {
  if (!db) {
    dbs.commandDb.start(config.MONGO_URL).then(function() {
      if (!cbCalled) {
        cbCalled = true;
        db = dbs.commandDb.db();
        initDB();
        cb();
      }
    });
  } else {
    initDB();
    cb();
  }
};

exports.tearDown = function(cb) {
  cb();
};

exports.createHub = function(test) {
  test.expect(1);

  var cmd = new Command("iot/hub/create", { id: "testHub", name: "my first hub", owner: "xyz" });
  cmdHandler.execute(cmd).then(function() {
    test.ok(true, "command completed");
    test.done();
  });
};

exports.createFeedNoHub = function(test) {
  test.expect(1);

  var cmd = new Command("iot/feed/create", { id: "testFeed", hubId: "testHub", name: "my first feed" });
  cmdHandler.execute(cmd).then(null, function(err) {
    test.ok(err, "failed to create feed with missing hub");
    test.done();
  });
};

exports.createFeed = function(test) {
  test.expect(2);

  var cmd = new Command("iot/hub/create", { id: "testHub", name: "my first hub", owner: "xyz" });
  cmdHandler.execute(cmd).then(function() {
    test.ok(true, "hub command completed");

    cmd = new Command("iot/feed/create", { id: "testFeed", hubId: "testHub", name: "my first feed" });
    cmdHandler.execute(cmd).then(function() {
      test.ok(true, "created feed");
      test.done();
    });
  });
};

exports.renameFeed = function(test) {
  test.expect(3);

  var cmd = new Command("iot/hub/create", { id: "testHub", name: "my first hub", owner: "xyz" });
  cmdHandler.execute(cmd).then(function() {
    test.ok(true, "hub command completed");

    cmd = new Command("iot/feed/create", { id: "testFeed", hubId: "testHub", name: "my first feed" });
    cmdHandler.execute(cmd).then(function() {
      test.ok(true, "created feed");

      cmd = new Command("iot/feed/rename", { id: "testFeed", hubId: "testHub", name: "!!!ARSE!!!" });
      cmdHandler.execute(cmd).then(function() {
        test.ok(true, "renamed feed");
        test.done();
      });
    });
  });
};

exports.feedData = function(test) {
  test.expect(3);

  eventBus.onAny(function() {
    console.log(this.event);
  });

  var cmd = new Command("iot/hub/create", { id: "testHub", name: "my first hub", owner: "xyz" });
  cmdHandler.execute(cmd).then(function(err) {
    test.ok(true, "hub command completed");

    cmd = new Command("iot/feed/create", { id: "testFeed", hubId: "testHub", name: "my first feed" });
    cmdHandler.execute(cmd).then(function(err) {
      test.ok(true, "created feed");

      cmd = new Command("iot/feed/data", { hubId: "testHub", payload: [ { id: "testFeed", timestamp: 1234, temperature: 23.2 }, { id: "testFeed", timestamp: 1234, temperature: 21.2 }, { id: "testFeed", timestamp: 1234, temperature: 20.2 }  ] });
      cmdHandler.execute(cmd).then(function(err) {
        test.ok(true, "feedData");
        test.done();
      });
    });
  });
};

