'use strict';

const crypto = require('node:crypto');

const nowIso = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function parseHabit(row) {
  if (!row) return null;
  let frequency = [];
  try {
    frequency = JSON.parse(row.frequency || '[]');
  } catch {
    frequency = [];
  }
  return { ...row, frequency };
}

function parseSubscription(row) {
  if (!row) return null;
  let keys = {};
  try {
    keys = JSON.parse(row.keys || '{}');
  } catch {
    keys = {};
  }
  return { ...row, keys };
}

function updateStatement(table, patch, allowed, where, whereParams = []) {
  const keys = allowed.filter((key) => Object.prototype.hasOwnProperty.call(patch, key));
  if (keys.length === 0) return null;
  const sql = `UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE ${where} RETURNING *`;
  return { sql, params: [...keys.map((key) => patch[key]), ...whereParams] };
}

function createStore(database) {
  return {
    nowIso,
    uuid,
    sha256,

    async cleanup() {
      const now = nowIso();
      await database.query('DELETE FROM sessions WHERE expires_at < ?', [now]);
      await database.query('DELETE FROM reset_tokens WHERE expires_at < ?', [now]);
    },

    // Пользователи
    async createUser({ email, passwordHash, name = null, timezone = 'UTC' }) {
      const row = {
        id: uuid(),
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        name: name || null,
        timezone,
        created_at: nowIso(),
      };
      await database.query(
        `INSERT INTO users (id, email, password_hash, name, timezone, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.email, row.password_hash, row.name, row.timezone, row.created_at],
      );
      return row;
    },

    findUserByEmail(email) {
      return database.one('SELECT * FROM users WHERE email = ?', [String(email).toLowerCase().trim()]);
    },

    findUserById(id) {
      return database.one('SELECT * FROM users WHERE id = ?', [id]);
    },

    async listUsers() {
      const { rows } = await database.query('SELECT * FROM users ORDER BY created_at ASC');
      return rows;
    },

    async updateUser(id, patch) {
      const statement = updateStatement('users', patch, ['name', 'timezone', 'password_hash'], 'id = ?', [id]);
      if (!statement) return this.findUserById(id);
      const { rows } = await database.query(statement.sql, statement.params);
      return rows[0] || this.findUserById(id);
    },

    // Сессии refresh-токенов
    async createSession({ userId, tokenHash, expiresAt }) {
      const id = uuid();
      await database.query(
        'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
        [id, userId, tokenHash, expiresAt, nowIso()],
      );
      return id;
    },

    findSession(tokenHash) {
      return database.one('SELECT * FROM sessions WHERE token_hash = ?', [tokenHash]);
    },

    async deleteSession(id) {
      await database.query('DELETE FROM sessions WHERE id = ?', [id]);
    },

    async deleteSessionsForUser(userId) {
      await database.query('DELETE FROM sessions WHERE user_id = ?', [userId]);
    },

    // Восстановление пароля
    async createResetToken({ userId, tokenHash, expiresAt }) {
      const id = uuid();
      await database.query(
        `INSERT INTO reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
         VALUES (?, ?, ?, ?, NULL, ?)`,
        [id, userId, tokenHash, expiresAt, nowIso()],
      );
      return id;
    },

    findResetToken(tokenHash) {
      return database.one('SELECT * FROM reset_tokens WHERE token_hash = ?', [tokenHash]);
    },

    async consumeResetToken(id) {
      await database.query('UPDATE reset_tokens SET used_at = ? WHERE id = ?', [nowIso(), id]);
    },

    // Привычки
    async listHabits(userId) {
      const { rows } = await database.query(
        'SELECT * FROM habits WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
      );
      return rows.map(parseHabit);
    },

    getHabit(userId, id) {
      return database
        .one('SELECT * FROM habits WHERE id = ? AND user_id = ?', [id, userId])
        .then(parseHabit);
    },

    async createHabit({ userId, name, type, frequency, target, unit, description, status }) {
      const timestamp = nowIso();
      const row = {
        id: uuid(),
        user_id: userId,
        name,
        type,
        frequency: JSON.stringify(frequency),
        target: target ?? null,
        unit: unit || null,
        description: description || null,
        status: status || 'active',
        created_at: timestamp,
        updated_at: timestamp,
      };
      await database.query(
        `INSERT INTO habits
          (id, user_id, name, type, frequency, target, unit, description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.user_id, row.name, row.type, row.frequency, row.target, row.unit,
          row.description, row.status, row.created_at, row.updated_at],
      );
      return this.getHabit(userId, row.id);
    },

    async updateHabit(userId, id, patch) {
      const data = { ...patch, updated_at: nowIso() };
      if (Object.prototype.hasOwnProperty.call(data, 'frequency')) {
        data.frequency = JSON.stringify(data.frequency);
      }
      const statement = updateStatement(
        'habits',
        data,
        ['name', 'type', 'frequency', 'target', 'unit', 'description', 'status', 'updated_at'],
        'id = ? AND user_id = ?',
        [id, userId],
      );
      if (!statement) return this.getHabit(userId, id);
      const { rows } = await database.query(statement.sql, statement.params);
      return rows.length ? parseHabit(rows[0]) : this.getHabit(userId, id);
    },

    async deleteHabit(userId, id) {
      await database.query('DELETE FROM records WHERE habit_id = ? AND user_id = ?', [id, userId]);
      await database.query('DELETE FROM habits WHERE id = ? AND user_id = ?', [id, userId]);
    },

    // Отметки
    async listRecords(userId, from, to) {
      const { rows } = await database.query(
        'SELECT * FROM records WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC',
        [userId, from, to],
      );
      return rows;
    },

    async listRecordsWithHabit(userId, from, to) {
      const { rows } = await database.query(
        `SELECT r.date, h.name AS habit_name, h.type, r.value
           FROM records r JOIN habits h ON h.id = r.habit_id
          WHERE r.user_id = ? AND r.date >= ? AND r.date <= ?
          ORDER BY r.date ASC, h.name ASC`,
        [userId, from, to],
      );
      return rows;
    },

    getRecord(habitId, date) {
      return database.one('SELECT * FROM records WHERE habit_id = ? AND date = ?', [habitId, date]);
    },

    async upsertRecord({ userId, habitId, date, value }) {
      const timestamp = nowIso();
      const id = uuid();
      const { rows } = await database.query(
        `INSERT INTO records (id, user_id, habit_id, date, value, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(habit_id, date) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
         RETURNING *`,
        [id, userId, habitId, date, value, timestamp, timestamp],
      );
      // Ограничение уникальности по (habit_id, date) делает строку однозначной.
      return rows[0] || this.getRecord(habitId, date);
    },

    // Web Push
    async upsertSubscription({ userId, endpoint, keys }) {
      const id = uuid();
      await database.query(
        `INSERT INTO push_subscriptions (id, user_id, endpoint, keys, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, keys = excluded.keys`,
        [id, userId, endpoint, JSON.stringify(keys), nowIso()],
      );
      return true;
    },

    async listSubscriptions(userId) {
      const { rows } = await database.query(
        'SELECT * FROM push_subscriptions WHERE user_id = ?',
        [userId],
      );
      return rows.map(parseSubscription);
    },

    async deleteSubscription(userId, endpoint) {
      await database.query(
        'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
        [userId, endpoint],
      );
    },

    // Напоминания
    async hasReminder(userId, date, channel) {
      const row = await database.one(
        'SELECT 1 AS found FROM reminders WHERE user_id = ? AND date = ? AND channel = ?',
        [userId, date, channel],
      );
      return Boolean(row);
    },

    async addReminder(userId, date, channel) {
      await database.query(
        `INSERT INTO reminders (user_id, date, channel, sent_at) VALUES (?, ?, ?, ?)
         ON CONFLICT DO NOTHING`,
        [userId, date, channel, nowIso()],
      );
    },
  };
}

module.exports = { createStore, parseHabit, sha256, uuid, nowIso };
