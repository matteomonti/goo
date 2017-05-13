var dgram = require('dgram');

var server = require('./server/server.js');
var stub = require('./peer/stub.js');

(async function()
{
  var my_server = new server();
  await my_server.serve(48607);
  console.log('Listening.');

  var socket = dgram.createSocket('udp4');
  socket.bind(48608);

  var my_stub = new stub(socket, '127.0.0.1');
  await my_stub.volunteer();

  console.log('Volunteer completed');

  socket.on('message', function(message, remote)
  {
    console.log('Received', JSON.parse(message.toString()), 'from', remote);
  });
})();
