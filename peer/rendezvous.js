const dgram = require('dgram');
const dns = require('dns');
const idgen = require('idgen');
const ed = require('ed25519-supercop');
const sstub = require('./stub.js');
const ppublic = require('./public.js');
const uupnp = require('./upnp.js');
const timer = require('../utils/timer.js');

module.exports = function(host, ip)
{
  // Self

  var self = this;

  // Wires

  var wires = {server: {host: host || 'goo.rain.vg', port: 48607}, port: 48608, salt: {length: 8}, token: {length: 8, lifetime: 300000}, keepalive: {timeout: 300000}};
  dns.lookup(wires.server.host, function(error, address, family)
  {
    wires.server.address = address;
  });

  // Members

  var socket = dgram.createSocket('udp4');
  var stub;
  var public;
  var upnp;

  var tokens =
  {
    old: {},
    recent: {},
    clean: function()
    {
      tokens.old = tokens.recent;
      tokens.recent = {};
    }
  };

  var subscribers = {};

  // Methods

  self.serve = async function()
  {
    console.log('Serving on', ip);

    setInterval(tokens.clean, wires.token.lifetime);

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
      console.log(`[${ip}] Received keepalive request.`);
      if(!(remote.address == wires.server.address && remote.port == wires.server.port && typeof(message.salt) == 'string' && message.salt.length == wires.salt.length))
        return;

      stub.keepalive(message.salt);
    },
    token: function(message, remote)
    {
      var response = {command: 'token', token: idgen(wires.token.length)};
      tokens.recent[response.token] = true;

      var buffer = Buffer.from(JSON.stringify(response));
      socket.send(buffer, remote.port, remote.address);
    },
    subscribe: function(message, remote)
    {
      if(!(typeof message.key == 'string' && typeof message.token == 'string' && typeof message.salt == 'string' && typeof message.signature == 'string'))
        return;

      if(!(tokens.recent[message.token] || tokens.old[message.token]))
        return;

      delete tokens.recent[message.token];
      delete tokens.old[message.token];

      if(!(ed.verify(message.signature, message.token + message.salt, message.key)))
        return;

      console.log('Received valid subscribe request.');
    }
  };
};
