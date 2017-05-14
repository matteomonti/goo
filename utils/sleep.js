module.exports = function(milliseconds)
{
  return new Promise(function(resolve)
  {
    setTimeout(resolve, milliseconds);
  });
}
