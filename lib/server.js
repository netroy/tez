var emitter = module.parent.emitter;
var counts = module.parent.count;

// Create a HTTP server
var http = require('http');
var jsonHeaders = { 'Content-Type': 'application/json' };
var redirectHeaders = { 'Location': '/' };

var server = http.createServer(function (req, resp) {
  // Return all counts as JSON on /
  if (req.url === '/') {
    resp.writeHead(200, jsonHeaders);
    resp.end(JSON.stringify(counts));
  }
  // Otherwise redirect to /
  else {
    resp.writeHead(302, redirectHeaders);
    resp.end();
  }
});

// Create a WebSocket Server
var WebSocketServer = require('ws').Server;
new WebSocketServer({
  'server': server
}).on('connection', function (client) {

  // signup this connection for changes
  function notify (table_name, count) {
    var obj = {};
    obj[table_name] = count;
    try {
      client.send(JSON.stringify(obj));
    } catch (e) {
      console.error(e);
      try {
        client.close();
      } catch(e) {}
    }
  }

  // on client disconnect, clean up handler
  client.on('close', function () {
    emitter.removeListener('count', notify);
  });

  // send count changes as they happen
  emitter.on('count', notify);

  // send all the stats on first connect
  client.send(JSON.stringify(counts));
});

module.exports = server;