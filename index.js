var PGClient = require('pg').Client;

var connUrl = 'tcp://localhost/wunderapi';
var tables = {
  'lists': 0,
  'tasks': 0,
  'shares': 0,
  'reminders': 0
};
var countQuery = 'SELECT relname as table, n_live_tup as count FROM pg_stat_user_tables';

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
  if (message.channel === 'creation' && message.payload in tables) {
    tables[message.payload]++;
  }
});

connection.once('readyForQuery', function () {
  // console.log('connnected');
  client.query('LISTEN creation');
  sync();
});

client.connect();