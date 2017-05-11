var server = require('./dns/server.js');

(async function()
{
  var my_server = new server();
  await my_server.serve(48607);
  console.log('Listening.');
})();
