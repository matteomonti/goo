var server = require('./server/server.js');
var rendezvous = require('./peer/rendezvous.js');

(async function()
{
  if(process.argv.indexOf('server') != -1)
  {
    console.log('Starting server.');
    var my_server = new server();
    await my_server.serve();

    try
    {
      var alpha = new rendezvous('goo.rain.vg', '51.255.160.6');
      alpha.serve();

      var beta = new rendezvous('goo.rain.vg', '217.182.239.24');
      beta.serve();

      var gamma = new rendezvous('goo.rain.vg', '217.182.239.25');
      gamma.serve();

      var delta = new rendezvous('goo.rain.vg', '217.182.239.26');
      delta.serve();

      var epsilon = new rendezvous('goo.rain.vg', '217.182.239.27');
      epsilon.serve();
    }
    catch(error)
    {
      console.log(error);
    }
  }
  else
  {
    var my_rendezvous = new rendezvous();
    my_rendezvous.serve();
  }
})();
