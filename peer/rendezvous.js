const dgram = require('dgram');
const dns = require('dns');
const idgen = require('idgen');
const sstub = require('./stub.js');

module.exports = function(host)
{
  // Self

  var self = this;

  // Wires

  var wires = {server: {host: host || 'goo.rain.vg', port: 48607}, port: 48608, salt: {length: 8}};
  dns.lookup(wires.server.host, function(error, address, family)
  {
    wires.server.address = address;
  });

  // Members

  var socket = dgram.createSocket('udp4');
  var stub = new sstub(socket, wires.server.host);

  // Methods

  self.serve = async function()
  {
    try
    {
      await bind(wires.port);
    }
    catch(error)
    {
      socket = dgram.createSocket('udp4');
      await bind();
    }
  };

  // Private methods

  var bind = function(port)
  {
    return new Promise(function(resolve, reject)
    {
      socket.on('message', message);

      var clean = function()
      {
        socket.removeAllListeners('listening');
        socket.removeAllListeners('error');
      };

      socket.on('listening', function()
      {
        clean();
        resolve();
      });

      socket.on('error', function()
      {
        clean();
        reject();
      });

      socket.bind(port);
    });
  };

  var message = function(message, remote)
  {
    try
    {
      message = JSON.parse(message.toString('utf8'));

      if(!(message.command && message.command in handlers))
        return;

      handlers[message.command](message, remote);
    }
    catch(error)
    {
    }
  };

  var handlers =
  {
    keepalive: function(message, remote)
    {
      if(!(remote.address == wires.server.address && remote.port == wires.server.port && typeof(message.salt) == 'string' && message.salt.length == wires.salt.length))
        return;

      stub.keepalive(message.salt);
    }
  };
};
