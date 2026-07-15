const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

const roomCache = {
  _data: {},
  set(key, value) { this._data[key] = value; },
  get(key) { return this._data[key]; },
  has(key) { return key in this._data; },
  del(key) { delete this._data[key]; },
  keys() { return Object.keys(this._data); },
};

const gameCache = {
  _data: {},
  set(key, value) { this._data[key] = value; },
  get(key) { return this._data[key]; },
  has(key) { return key in this._data; },
  del(key) { delete this._data[key]; },
  keys() { return Object.keys(this._data); },
};

const socketCache = new NodeCache({ stdTTL: 14400, checkperiod: 600 });

module.exports = { cache, roomCache, gameCache, socketCache };
