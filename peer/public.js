const events = require('events');
const util = require('util');
const request = require('request');
const ip = require('ip');
const sleep = require('../utils/sleep.js');

module.exports = function(socket)
{
  // Self

  var self = this;

  // Wires

  var wires = {interval: 30000};
  var status = false;

  // Getters

  self.status = function()
  {
    return status;
  };

  // Methods

  self.serve = async function()
  {
    var last = '';

    while(true)
    {
      if(address() != last)
      {
        try
        {
          var response = await check();
          last = address();
          
          if(response != status)
          {
            status = response;
            self.emit('change');
          }
        }
        catch(error)
        {
        }
      }

      sleep(wires.interval);
    };
  };

  // Private methods

  var address = function()
  {
    return (socket.address().address == '0.0.0.0' ? ip.address() : socket.address().address);
  };

  var check = function()
  {
    return new Promise(function(resolve, reject)
    {
      request.get('http://api.ipify.org', {localAddress: address()}, function(error, response, body)
      {
        if(error)
          return reject(error);

        resolve(body == address());
      });
    });
  };
};

util.inherits(module.exports, events.EventEmitter);
