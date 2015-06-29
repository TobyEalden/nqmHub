/**
 * Created by toby on 20/06/15.
 */

"use strict";

var config = {
  MONGO_URL: "mongodb://localhost:27017/nqmHubTests"
};

var Repository = require("../lib/events/eventRepository").Repository;
var Feed = require("../lib/command/domain/feed");
var eventBus = require("../lib/events/eventBus").EventBus;
var dbs = require("../lib/mongoConnectionFactory");
var cbCalled = false;
var db;

exports.setUp = function(cb) {
  if (!db) {
    dbs.eventStore.start(config.MONGO_URL).then(function() {
      if (!cbCalled) {
        cbCalled = true;
        db = dbs.eventStore.db();
        cb();
      }
    });
  } else {
    cb();
  }
};

exports.tearDown = function(cb) {
  cb();
};

exports.createFeed = function(test) {
  test.expect(1);

  db.collection("Feed.events").drop();
  var repo = new Repository(Feed);
  var feed = repo.factory();

  feed.create({ hubId: "hub123", id: "feed123", name: "feedName", schema: [ {name: "timestamp", units: "time" }, { name: "temperature", units: "celsius" } ]});

  repo.commit(feed).then(function() {
    test.ok(true,"feed committed without errors");
    test.done();
  });
};

exports.snapshot = function(test) {
  test.expect(5);

  db.collection("Feed.events").drop();
  db.collection("Feed.snapshots").drop();

  var repo = new Repository(Feed);
  var feed = repo.factory();

  eventBus.on("Feed.created",function(ev,ent) {
    test.ok(this.event === "Feed.created");
    test.ok(ev.id === "feed123");
  });

  feed.create({ hubId: "hub123", id: "feed123", name: "feedName", schema: [ {name: "timestamp", units: "time" }, { name: "temperature", units: "celsius" } ]});
  feed.rename({ name: "hello1" });
  feed.rename({ name: "hello2" });
  feed.rename({ name: "hello3" });
  feed.rename({ name: "hello4" });
  feed.rename({ name: "hello5" });
  feed.rename({ name: "hello6" });
  feed.rename({ name: "hello7" });
  feed.rename({ name: "hello8" });

  repo.commit(feed).then(function() {
    test.ok(true,"feed committed without errors");

    feed.rename({ name: "hello9" });
    feed.rename({ name: "hello10" });
    feed.rename({ name: "hello11" });

    repo.commit(feed).then(function() {
      test.ok(true, "feed committed without errors");

      repo.get(["hub123","feed123"]).then(function(feed) {
        test.ok(feed.__version == 12, "feed version is correct");
        test.done();
      });
    });
  });
};

exports.eventBus = function(test) {
  test.expect(3);

  db.collection("Feed.events").drop();
  db.collection("Feed.snapshots").drop();

  eventBus.onAny(function(event) {
    test.ok(this.event === "Feed.created", "created event received");
    test.ok(event, "have an event");
  });

  var repo = new Repository(Feed);
  var feed = repo.factory();
  feed.create({ hubId: "hub123", id: "feed123", name: "feedName", schema: [ {name: "timestamp", units: "time" }, { name: "temperature", units: "celsius" } ]});

  repo.commit(feed).then(function() {
    test.ok(true,"feed committed without errors");
    test.done();
  });
};