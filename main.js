var dgram = require('dgram');
var public = require('./peer/public.js');

(async function()
{
  var socket = dgram.createSocket('udp4');
  socket.bind(function()
  {
    var my_public = new public(socket);

    my_public.on('change', function()
    {
      console.log('Public status changed:', my_public.status());
    });
    my_public.serve();
  });
})();
