const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "..", "crm.db");

const db = new Database(dbPath);

console.log("SQLite DB:", dbPath);

module.exports = db;
