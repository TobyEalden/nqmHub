"use strict";

module.exports = (function() {
  var console = process.console ? process.console : global.console;
  var util = require("util");
  var NQMEvent = require("../event");

  function Repo(db, eventBus) {
    this._db = db;
    this._eventBus = eventBus;
  }

  Repo.prototype.count = function(collection, q, cb) {
    this._db.query(collection, q, function(err, cursor) {
      if (!err) {
        cb(cursor.count());
      } else {
        cb(err);
      }
    });
  };

  Repo.prototype.get = function(collection, DomainClass, q, cb) {
    this._db.query(collection, q, function(err, cursor) {
      if (!err) {
        var aggregate = null;
        cursor.sort({ version: 1 });
        cursor.each(function(err, ev) {
          if (ev === null) {
            cb(null, aggregate);
          } else {
            if (aggregate === null) {
              aggregate = new DomainClass();
            }
            var event = new NQMEvent(ev.evtName, ev.key, ev.params);
            aggregate.applyChange(event, false);
            aggregate.version = ev.version;
          }
          return true;
        });
      } else {
        cb(err);
      }
    });
  };

  var saveEvent = function(i, changes, version, collection, cb) {
    var self = this;
    var ev = changes[i];
    var write = {
      evtName: ev.getName(),
      key: ev.getKey(),
      params: ev.getParams()
    };
    if (version !== null) {
      version++;
      write.version = version;
    }
    this._db.insert(collection, write, function(err) {
      if (err) {
        cb(err);
      } else {
        i++;
        if (i < changes.length) {
          process.nextTick(function() { saveEvent.call(self, i, changes, version, cb); });
        } else {
          cb(err);
        }
      }
    });
  };

  var saveEntity = function(collection, ent, version, cb) {
    var self = this;
    var changes = ent.getChanges();
    saveEvent.call(this, 0, changes, version, collection, function(err) {
      if (!err) {
        changes.forEach(function(ev) {
          self._eventBus.publish(ev);
        });
        ent.clearChanges();
        cb(err);
      } else {
        cb(err);
      }
    });
  };

  Repo.prototype.save = function(collection, DomainClass, ent, version, cb) {
    var self = this;
    var changes = ent.getChanges();
    if (changes.length > 0) {
      if (version !== null && version != -1) {
        this.get(collection, DomainClass, { key: ent.getKey() }, function(err,current) {
          if (err || !current) {
            cb(err || new Error("failed to load entity for key: " + JSON.stringify(ent.getKey())));
          } else if (current.version !== version) {
            cb(new Error("entity has been modified since last read, expected version: " + version + ", got version: " + current.version));
          } else {
            saveEntity.call(self, collection, ent, version, cb);
          }
        });
      } else {
        saveEntity.call(self, collection, ent, version, cb);
      }
    } else {
      cb();
    }
  };

  return Repo;
}());
