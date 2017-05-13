var server = require('./server/server.js');
var rendezvous = require('./peer/rendezvous.js');

(async function()
{
  var my_server = new server();
  await my_server.serve();

  var my_rendezvous = new rendezvous('localhost');
  my_rendezvous.serve();
})();