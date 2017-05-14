const util = require('util');
const events = require('events');
const upnp = require('nat-upnp');
const ip = require('ip');
const sleep = require('../utils/sleep.js');

module.exports = function(socket, identifier)
{
  // Self

  var self = this;

  // Wires

  var wires = {port: 48608, interval: 300000, ttl: 10};

  // Members

  var client = upnp.createClient();
  var description = identifier ? `Goo (${identifier})` : 'Goo';
  var status = false;

  // Getters

  self.status = function()
  {
    return status;
  };

  // Methods

  self.serve = async function()
  {
    while(true)
    {
      try
      {
        await run();
        if(!status)
        {
          status = true;
          self.emit('change');
        }
      }
      catch(error)
      {
        if(status)
        {
          status = false;
          self.emit('change');
        }
      }

      await sleep(wires.interval);
    }
  };

  // Private methods

  var run = async function()
  {
    var mappings = await get();

    var collision = false;
    for(var i = 0; i < mappings.length; i++)
      if(mappings[i].public.port == wires.port && mappings[i].protocol == 'udp' && mappings[i].description != description)
        collision = true;

    if(!collision)
      await map();
  };

  var get = function()
  {
    return new Promise(function(resolve, reject)
    {
      client.getMappings(function(error, results)
      {
        if(error)
          return reject(error);

        resolve(results);
      });
    });
  };

  var map = function()
  {
    return new Promise(function(resolve, reject)
    {
      client.portMapping({public: wires.port, private: socket.address().port, ttl: wires.ttl, description: description, protocol: 'udp'}, function(error)
      {
        if(error)
          return reject(error);

        resolve();
      });
    });
  };
};

util.inherits(module.exports, events.EventEmitter);
