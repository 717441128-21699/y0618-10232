const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require('util');

const dbPath = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbPath);

const originalRun = db.run.bind(db);

db.get = promisify(db.get.bind(db));
db.all = promisify(db.all.bind(db));
db.exec = promisify(db.exec.bind(db));

db.run = promisify(originalRun);

db.prepare = function(sql) {
  const stmt = {
    sql,
    run: async function(...params) {
      return new Promise((resolve, reject) => {
        originalRun(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
        });
      });
    },
    get: async function(...params) {
      return db.get(sql, params);
    },
    all: async function(...params) {
      return db.all(sql, params);
    }
  };
  return stmt;
};

db.pragma = function(pragma) {
  return db.run(`PRAGMA ${pragma}`);
};

(async () => {
  await db.pragma('journal_mode = WAL');
  await db.pragma('foreign_keys = ON');
})();

module.exports = db;
