const dgram = require('dgram');
const worktoken = require('work-token/sync');

module.exports = function()
{
  // Self

  var self = this;

  // Wires

  var wires = {ports: {server: 48607, peer: 48608}, salt: {length: 8}, timestamp: {deadline: 300000, margin: 8}, worktoken: {difficulty: 4}};

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

  // Private members

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

      console.log('Received valid volunteer request:', message);
    }
  };
}
