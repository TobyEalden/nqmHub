/**
 * Created by toby on 20/06/15.
 */

"use strict";

var config = {
  MONGO_URL: "mongodb://localhost:27017/nqmHubTests"
};

var Repository = require("sourced-repo-mongo").Repository;
var Feed = require("../lib/command/domain/feed");
var eventBus = require("../lib/eventBus").EventBus;
var sourcedRepoMongo;
var cbCalled = false;
var db;

exports.setUp = function(cb) {
  if (!sourcedRepoMongo) {
    sourcedRepoMongo = require("sourced-repo-mongo/mongo");
    sourcedRepoMongo.on("connected", function(connectedDb) {
      if (!cbCalled) {
        cbCalled = true;
        db = connectedDb;
        cb();
      }
    });
    sourcedRepoMongo.connect(config.MONGO_URL);
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
  var repo = new Repository(Feed, {}, eventBus);
  var feed = repo.factory();

  feed.create({ hubId: "hub123", id: "feed123", name: "feedName", schema: [ {name: "timestamp", units: "time" }, { name: "temperature", units: "celsius" } ]});

  repo.commit(feed, function(err) {
    test.ok(!err,"feed committed without errors");
    test.done();
  });
};

exports.snapshot = function(test) {
  test.expect(6);

  db.collection("Feed.events").drop();
  db.collection("Feed.snapshots").drop();

  var repo = new Repository(Feed, {}, eventBus);
  var feed = repo.factory();

  eventBus.on("Feed.created",function(ev,ent) {
    test.ok(this.event === "Feed.created");
    test.ok(ent.id === "feed123");
    test.ok(ent.constructor.name === "Feed");
  });

  feed.create({ hubId: "hub123", id: "feed123", name: "feedName", schema: [ {name: "timestamp", units: "time" }, { name: "temperature", units: "celsius" } ]});
  feed.rename("hello1");
  feed.rename("hello2");
  feed.rename("hello3");
  feed.rename("hello4");
  feed.rename("hello5");
  feed.rename("hello6");
  feed.rename("hello7");
  feed.rename("hello8");

  repo.commit(feed, function(err) {
    test.ok(!err,"feed committed without errors");

    feed.rename("hello9");
    feed.rename("hello10");
    feed.rename("hello11");

    repo.commit(feed, function(err) {
      test.ok(!err, "feed committed without errors");

      repo.get("feed123", function(err, feed) {
        test.ok(feed.version == 12, "feed version is correct");
        test.done();
      });
    });
  });
};

exports.eventBus = function(test) {
  test.expect(4);

  db.collection("Feed.events").drop();
  db.collection("Feed.snapshots").drop();

  eventBus.onAny(function(event, ent) {
    test.ok(this.event === "Feed.created", "created event received");
    test.ok(event, "have an event");
    test.ok(ent, "have an entity");
  });

  var repo = new Repository(Feed, {}, eventBus);
  var feed = repo.factory();
  feed.create({ hubId: "hub123", id: "feed123", name: "feedName", schema: [ {name: "timestamp", units: "time" }, { name: "temperature", units: "celsius" } ]});

  repo.commit(feed, function(err) {
    test.ok(!err,"feed committed without errors");
    test.done();
  });
};