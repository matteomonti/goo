const worktoken = require('work-token/async');
const idgen = require('idgen');
const crypto = require('crypto');

module.exports = function(socket, host)
{
  // Self

  var self = this;

  // Wires

  var wires = {server: {host: host || 'goo.rain.vg', port: 48607}, salt: {length: 8}, worktoken: {difficulty: 4}};

  // Methods

  self.volunteer = function()
  {
    return new Promise(function(resolve, reject)
    {
      var message = {command: 'volunteer'};
      message.timestamp = Date.now();
      message.salt = idgen(wires.salt.length);

      var challenge = message.salt + message.timestamp.toString();
      worktoken.generate(challenge, wires.worktoken.difficulty, function(error, token)
      {
        if(error)
          return reject();

        message.token = token;

        var buffer = Buffer.from(JSON.stringify(message));
        socket.send(buffer, wires.server.port, wires.server.host, function(error, bytes)
        {
          if(error)
            return reject(error);

          resolve();
        });
      });
    });
  };

  self.keepalive = function(salt)
  {
    var hash = crypto.createHash('sha256').update(salt).digest('buffer');
    var token = idgen(hash).substring(0, wires.salt.length);

    var message = {command: 'keepalive'};
    message.token = token;

    var buffer = Buffer.from(JSON.stringify(message));
    socket.send(buffer, wires.server.port, wires.server.host);
  };
};
