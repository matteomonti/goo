const dgram = require('dgram');
const idgen = require('idgen');
const worktoken = require('work-token/sync');
const distributions = require('probability-distributions');
const timer = require('../utils/timer.js');

module.exports = function()
{
  // Self

  var self = this;

  // Wires

  var wires = {ports: {server: 48607, peer: 48608}, salt: {length: 8}, timestamp: {deadline: 300000, margin: 8}, worktoken: {difficulty: 4}, keepalive: {interval: 30000, margin: 6}};

  // Members

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
    });
  };

  // Private methods

  var add = function(address)
  {
    var key = address.address + ":" + address.port;

    console.log('Adding', key);

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

  var remove = function(key)
  {
    peers[key].keepalive.cancel();
    delete peers[key];
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
    }
  };
}
