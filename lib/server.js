var parent = module.parent;
var emitter = parent.emitter;

// headers for JSON response
var jsonHeaders = {
  'Content-Type': 'application/json'
};

// headers for CORS response
var corsHeaders = {
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Headers': 'accept, origin',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Max-Age': 1728000
};

function respondCors (req, resp) {
  // TODO: add origin check for CORS using req.headers.origin
  resp.writeHead(200, corsHeaders);
  resp.end();
}

// Create a HTTP server
var http = require('http');
var server = http.createServer(function (req, resp) {

  var method = req.method.toUpperCase();
  if (method === 'OPTIONS') {
    respondCors(req, resp);
  } else if (method === 'GET' && req.url === '/') {
    // Return all counts as JSON on /
    resp.writeHead(200, jsonHeaders);
    resp.end(JSON.stringify(parent.counts));
  } else {
    // Otherwise 404
    resp.writeHead(404);
    resp.end();
  }
});

// keep the count map updated
emitter.on('count', function (table_name, count) {
  parent.counts[table_name] = count;
});

// Create a WebSocket Server
var WebSocketServer = require('ws').Server;
new WebSocketServer({
  'server': server
}).on('connection', function (client) {

  // signup this connection for changes
  function notify (table_name, count) {
    try {
      // avoid creating new objects, they trigger GC
      client.send('{"' + table_name + '": "' + count + '"}');
    } catch (e) {
      console.error('notify', e);
      cleanup();
    }
  }

  function cleanup () {
    emitter.removeListener('count', notify);
  }

  // on client disconnect, clean up handler
  client.on('close', cleanup);

  // send count changes as they happen
  emitter.on('count', notify);

  // send all the stats on first connect
  client.send(JSON.stringify(parent.counts));
});

module.exports = server;