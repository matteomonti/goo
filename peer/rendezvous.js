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

  self.serve = function()
  {
    socket.on('message', message);
    socket.bind(wires.port); // TODO: port should be determined with UPnP & public ip diagnostics
    stub.volunteer();
  };

  // Private methods

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
