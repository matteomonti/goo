var dgram = require('dgram');
var upnp = require('./peer/upnp.js');

(async function()
{
  var socket = dgram.createSocket('udp4');

  socket.bind(async function()
  {
    var my_upnp = new upnp(socket, 'test');
    my_upnp.on('change', function()
    {
      console.log('Change on upnp status:', my_upnp.status());
    });

    my_upnp.serve();
  });
})();
