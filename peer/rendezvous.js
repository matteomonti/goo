const dgram = require('dgram');
const dns = require('dns');
const idgen = require('idgen');
const sstub = require('./stub.js');
const ppublic = require('./public.js');
const uupnp = require('./upnp.js');

module.exports = function(host, ip)
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
  var stub;
  var public;
  var upnp;

  // Methods

  self.serve = async function()
  {
    console.log('Serving on', ip);
    try
    {
      await bind(wires.port, ip);
    }
    catch(error)
    {
      socket = dgram.createSocket('udp4');
      await bind(0, ip);
    }

    stub = new sstub(socket, wires.server.host);
    public = new ppublic(socket);
    upnp = new uupnp(socket, 'test'); // TODO: implement identifier

    public.on('change', toggle);
    upnp.on('change', toggle);

    public.serve();
    upnp.serve();
  };

  // Private methods

  var toggle = function()
  {
    if(upnp.status() || (socket.address().port == wires.port && public.status()))
    {
      console.log('Volunteering.');
      stub.volunteer();
    }
    else
    {
      // TODO: Should we disable keepalives, maybe?
    }
  }

  var bind = function(port, address)
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

      socket.on('error', function(error)
      {
        clean();
        reject(error);
      });

      socket.bind(port, address);
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
