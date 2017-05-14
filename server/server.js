const ndns = require('native-dns');
const dgram = require('dgram');
const idgen = require('idgen');
const worktoken = require('work-token/sync');
const crypto = require('crypto');
const fifo = require('fifo');
const distributions = require('probability-distributions');
const timer = require('../utils/timer.js');
const escape = require('../utils/escape.js');

module.exports = function(host)
{
  // Self

  var self = this;

  // Wires

  var wires = {host: host || 'goo.rain.vg', ttl: 60, ports: {server: 48607, peer: 48608, dns: 53}, salt: {length: 8}, timestamp: {deadline: 300000, margin: 8}, worktoken: {difficulty: 4}, keepalive: {interval: 30000, margin: 6}};

  // Members

  var dns = ndns.createServer();

  var patterns =
  {
    rendezvous: new RegExp('^s(\\d+)w(\\d+)\.' + escape(wires.host) + '$'),
    window: `window.${wires.host}`
  };

  var socket = dgram.createSocket('udp4');
  var salts =
  {
    old: {},
    recent: {},
    clean: function()
    {
      salts.old = salts.recent;
      salts.recent = {};
    }
  }

  var peers = {};

  var window = -1;
  var slots = [];
  var pool = fifo();

  // Getters

  self.window = function()
  {
    return window;
  }

  // Methods

  self.serve = function()
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

      setInterval(salts.clean, wires.timestamp.deadline * wires.timestamp.margin);
      socket.bind(wires.ports.server);

      dns.on('request', request);
      dns.serve(wires.ports.dns);
    });
  };

  // Private methods

  var request = function(request, response)
  {
    for(var i = 0; i < request.question.length; i++)
    {
      if(request.question[i] == wires.host)
        response.answer.push(dns.A(
          {
            name: request.question[i],
            address: ip.address().address,
            ttl: 0
          }));
      else if(request.question[i] == patterns.window && window >= 0)
        response.answer.push(dns.A(
          {
            name: request.question[i],
            address: ip.fromLong(window),
            ttl: wires.ttl
          }));
    }
  };

  var expand = function()
  {
    if(window == -1)
    {
      if(pool.length > 1)
      {
        var peer = pool.shift();
        slots.push(peer);

        delete peers[peer].pool;
        peers[peer].slot = 0;

        window = 0;
      }
    }
    else if(pool.length > slots.length)
    {
      var new_slots = [];

      for(var i = 0; i < slots.length; i++)
      {
        var alpha = slots[i];
        var beta = pool.shift();

        delete peers[beta].pool;
        peers[alpha].slot = 2 * i;
        peers[beta].slot = 2 * i + 1;

        new_slots.push(alpha);
        new_slots.push(beta);
      }

      slots = new_slots;
      window++;
    }
  };

  var contract = function()
  {
    if(pool.length == 0)
    {
      if(window > 0)
      {
        var new_slots = [];

        for(var i = 0; i < slots.length / 2; i++)
        {
          var alpha = slots[2 * i];
          var beta = slots[2 * i + 1];

          delete peers[beta].slot;
          peers[alpha].slot = i;
          peers[beta].pool = pool.push(beta);

          new_slots.push(alpha);
        }

        slots = new_slots;
        window--;
      }
      else
      {
        var peer = slots[0];

        delete peers[peer].slot;
        peers[peer].pool = pool.push(peer);

        slots = [];
        window = -1;
      }
    }
  };

  var add = function(address)
  {
    var key = address.address + ":" + address.port;

    if(peers[key])
      return;

    peers[key] =
    {
      timestamp: Date.now(),
      address: address,
      keepalive: new timer(),
      expire: new timer()
    };

    peers[key].keepalive.on('ring', function()
    {
      keepalive(key);
    });

    peers[key].expire.on('ring', function()
    {
      remove(key);
    });

    peers[key].expire.set(wires.keepalive.interval * wires.keepalive.margin);

    keepalive(key);
  };

  var activate = function(key)
  {
    if(peers[key].pool || peers[key].slot)
      return;

    console.log('Activating', key);

    var node = pool.push(key);
    peers[key].pool = node;

    expand();
  };

  var remove = function(key)
  {
    peers[key].keepalive.cancel();

    if(peers[key].pool)
      pool.remove(peers[key].pool);
    else
    {
      var peer = pool.shift();
      slots[peers[key].slot] = peer;

      delete peers[peer].pool;
      peers[peer].slot = peers[key].slot;
    }

    delete peers[key];
    contract();
  };

  var keepalive = function(key)
  {
    peers[key].salt = idgen(wires.salt.length);

    var message = {command: 'keepalive', salt: peers[key].salt};
    var buffer = Buffer.from(JSON.stringify(message));

    socket.send(buffer, peers[key].address.port, peers[key].address.address);
    peers[key].keepalive.set(distributions.rexp(1, 1. / wires.keepalive.interval)[0]);
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
    volunteer: function(message, remote)
    {
      if(!(remote.port == wires.ports.peer && typeof message.timestamp == 'number' && typeof message.salt == 'string' && message.salt.length == wires.salt.length && typeof message.token == 'string'))
        return;

      if(Math.abs(Date.now() - message.timestamp) > wires.timestamp.deadline)
        return;

      if(message.salt in salts.recent || message.salt in salts.old)
        return;

      var challenge = message.salt + message.timestamp.toString();
      if(!(worktoken.check(challenge, wires.worktoken.difficulty, message.token)))
        return;

      salts.recent[message.salt] = true;
      add(remote);
    },
    keepalive: function(message, remote)
    {
      if(!(typeof message.token == 'string' && message.token.length == wires.salt.length))
        return;

      var key = remote.address + ":" + remote.port;

      if(!(peers[key]))
        return;

      var hash = crypto.createHash('sha256').update(peers[key].salt).digest('buffer');
      var token = idgen(hash).substring(0, wires.salt.length);

      if(message.token != token)
        return;

      console.log('Received valid keepalive from', key);
      peers[key].expire.reset(wires.keepalive.interval * wires.keepalive.margin);

      if(Date.now() - peers[key].timestamp > wires.keepalive.interval * wires.keepalive.margin)
        activate(key);
    }
  };
}
