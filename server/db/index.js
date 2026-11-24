'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  target INTEGER,
  unit TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  habit_id TEXT NOT NULL,
  date TEXT NOT NULL,
  value INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_records_user_date ON records(user_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_records_habit_date ON records(habit_id, date);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
CREATE TABLE IF NOT EXISTS reminders (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  channel TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (user_id, date, channel)
);
`;

function normalizeParams(params) {
  return (params || []).map((value) => (value === undefined ? null : value));
}

function createSqliteAdapter(sqlitePath) {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  const database = new DatabaseSync(sqlitePath);
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(SCHEMA);

  return {
    kind: 'sqlite',
    async query(sql, params = []) {
      const values = normalizeParams(params);
      if (/^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql) && !/\bRETURNING\b/i.test(sql)) {
        const result = database.prepare(sql).run(...values);
        return { rows: [], changes: Number(result.changes || 0) };
      }
      return { rows: database.prepare(sql).all(...values), changes: 0 };
    },
    async one(sql, params = []) {
      return database.prepare(sql).get(...normalizeParams(params)) || null;
    },
    async exec(sql) {
      database.exec(sql);
    },
    async close() {
      database.close();
    },
  };
}

function toPostgresPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function createPostgresAdapter(connectionString) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString, max: 10 });

  return {
    kind: 'postgres',
    async query(sql, params = []) {
      const result = await pool.query(toPostgresPlaceholders(sql), normalizeParams(params));
      return { rows: result.rows, changes: result.rowCount || 0 };
    },
    async one(sql, params = []) {
      const result = await pool.query(toPostgresPlaceholders(sql), normalizeParams(params));
      return result.rows[0] || null;
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

function createDatabase(config) {
  return config.database.url
    ? createPostgresAdapter(config.database.url)
    : createSqliteAdapter(config.database.sqlitePath);
}

module.exports = { createDatabase, SCHEMA };
