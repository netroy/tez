var pg = require('pg');
var mysql = require('mysql');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

function mysqlConnect (options) {
  return mysql.createPool({
    'host'     : options.host,
    'user'     : options.user,
    'password' : options.password,
    'database' : 'INFORMATION_SCHEMA',
    'connectionLimit': 1
  });
}

var mysqlQuery = 'SELECT TABLE_NAME as name, TABLE_ROWS as count FROM TABLES WHERE TABLE_SCHEMA = ?';
function mysqlLookup (database) {
  var self = this;
  self.connection.getConnection(function (err, connection) {
    if (err) {
      return self.error(err);
    }
    connection.query(mysqlQuery, [database], function(err, result) {
      connection.release();
      if (err) {
        self.error(err);
      } else {
        self.success(result);
      }
    });
  });
}

var pgQuery = 'SELECT relname as name, n_live_tup as count FROM pg_stat_user_tables';
function pgLookup (options) {
  var self = this;
  // fire the query
  pg.connect({
    'user': options.user,
    'database': options.database,
    'password': options.password,
    'host': options.host
  }, function (err, client, done) {
    client.query(pgQuery, function (err, result) {
      // release the client back to the pool
      done();
      if (err) {
        self.error(err);
      } else {
        self.success(result.rows);
      }
    });
  });
}

function validate (options) {
  if (!options.host) {
    throw new Error('need a DB host to connect to');
  }

  if (!options.database) {
    throw new Error('need a DB name to query against');
  }

  if (!options.user || !options.password) {
    throw new Error('need DB credentials');
  }
}

function Tracker (options) {

  options = options || {};

  validate (options);

  if (options.tables && Object.keys(options.tables).length > 0) {
    this.tables = options.tables;
  }

  // make the tracker an EventEmitter
  EventEmitter.call(this);

  if (options.type === 'mysql') {
    this.connection = mysqlConnect(options);
    this.lookup = mysqlLookup.bind(this, options.database);
  } else if (options.type === 'postgres') {
    this.lookup = pgLookup.bind(this, options);
  } else {
    throw new Error('type is mandatory & must be either mysql or postgres');
  }
}

// extend Tracker's prototype
util.inherits(Tracker, EventEmitter);

// Handle errors
Tracker.prototype.error = function (err) {
  console.error('tracker', err);
};

// Handle successful queries
Tracker.prototype.success = function (result) {
  var self = this;
  // emit count for every table found
  if (result && result.length) {
    result.forEach(function (row) {
      if (!self.tables || row.name in self.tables) {
        self.emit('count', self.tables[row.name] || row.name, row.count);
      }
    });
  }
};

module.exports = Tracker;