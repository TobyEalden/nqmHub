"use strict";

module.exports = (function() {

  function Event(name, key, params) {
    this._name = name;
    this._key = key;
    this._params = params;
  }

  Event.prototype.getKey = function() {
    return this._key;
  };

  Event.prototype.getName = function() {
    return this._name;
  };

  Event.prototype.getParams = function() {
    return this._params;
  };

  return Event;
}());