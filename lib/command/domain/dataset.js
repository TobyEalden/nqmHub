/**
 * Created by toby on 24/06/15.
 */

"use strict";

module.exports = (function() {
  var log = require("debug")("domain/dataset");
  var Entity = require("./entity");
  var util = require("util");

  function Dataset() {
    this.id = "";
    this.name = "";
    this.schema = {};

    Entity.apply(this, arguments);
  }

  util.inherits(Dataset, Entity);

  var randomId = function() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
      text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
  };

  Dataset.prototype.create = function(params) {
    log("creating with %j",params);
    params.store = params.store || ("ds" + randomId());
    this.applyEvent("created",params);
  };

  Dataset.prototype.setSchema = function(params) {
    if (JSON.stringify(params.schema) !== JSON.stringify(this.schema)) {
      log("setting schema to %j",params);
      this.applyEvent("schemaSet",params);
    } else {
      log("setSchema ignored - schema not changed");
    }
  };

  Dataset.prototype.rename = function(params) {
    if (this.name !== params.name) {
      log("rename to %s", params.name);
      this.applyEvent("renamed", params);
    }
  };

  Dataset.prototype._createdEventHandler = function(params) {
    this.id = params.id;
    this.name = params.name;
    this.schema = params.schema;
    this.store = params.store;
  };

  Dataset.prototype._schemaSetEventHandler = function(params) {
    this.schema = params.schema;
  };

  Dataset.prototype._renamedEventHandler = function(params) {
    this.name = params.name;
  };

  return Dataset;
}());