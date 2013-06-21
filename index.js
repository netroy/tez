var PGClient = require('pg').Client;
var WebSocketServer = require('ws').Server;
var EventEmitter = require('events').EventEmitter;
var http = require('http');

var connUrl = 'tcp://localhost/wunderapi';
var tables = {
  'lists': 0,
  'tasks': 0,
  'shares': 0,
  'reminders': 0
};
var countQuery = 'SELECT relname as table, n_live_tup as count FROM pg_stat_user_tables';

var emitter = new EventEmitter();
var client = new PGClient(connUrl);
var connection = client.connection;

function sync () {
  client.query(countQuery, function (err, result) {
    if (err) {
      console.error('failed');
      process.exit(-1);
    }

    if (result.rows && result.rows.length) {
      result.rows.forEach(function (row) {
        if (row.table in tables) {
          tables[row.table] = row.count;
        }
      });
    }
  });
}

connection.on('notification', function (message) {
  message = message || {};
  var table_name = message.payload;
  if (message.channel === 'creation' && table_name in tables) {
    var count = ++tables[table_name];
    emitter.emit('creation', table_name, count);
  }
});

connection.once('readyForQuery', function () {
  // console.log('connnected');
  client.query('LISTEN creation');
  sync();
});

client.connect();

var server = http.createServer(function (req, resp) {
  if (req.url === '/') {
    resp.writeHead(200, {
      'Content-Type': 'application/json'
    });
    resp.end(JSON.stringify(tables));
  } else {
    resp.writeHead(302, {
      'Location': '/'
    });
    resp.end();
  }
});

new WebSocketServer({
  'server': server
}).on('connection', function(client) {

  // signup this connection for changes
  function notify (table_name, count) {
    var obj = {};
    obj[table_name] = count;
    client.send(JSON.stringify(obj));
  }
  client.on('close', function () {
    emitter.removeListener('creation', notify);
  });
  emitter.addListener('creation', notify);

  // send all the stats on first connect
  client.send(JSON.stringify(tables));
});

server.listen(process.env.PORT || 1337);