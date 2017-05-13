const events = require('events');
const util = require('util');
const idgen = require('idgen');

module.exports = function()
{
  // Self

  var self = this;

  // Members

  var timeout;

  // Methods

  self.set = function(milliseconds)
  {
    timeout = setTimeout(function()
    {
      self.emit('ring');
    }, milliseconds);
  };

  self.cancel = function()
  {
    clearTimeout(timeout);
  };

  self.reset = function(milliseconds)
  {
    clearTimeout(timeout);
    self.set(milliseconds);
  };
};

util.inherits(module.exports, events.EventEmitter);
