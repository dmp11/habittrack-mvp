'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createDatabase } = require('../db');
const { createApp } = require('../app');
const { createScheduler } = require('../services/scheduler');
const { localDate } = require('../utils/date');

const today = localDate(new Date(), 'UTC');

test('напоминание отправляется один раз в 18:00 по часовому поясу пользователя', async () => {
  const database = createDatabase({ database: { url: '', sqlitePath: ':memory:' } });
  const sent = [];
  const mailer = {
    sendPasswordReset: async () => {},
    sendReminder: async (email, name) => sent.push({ email, name }),
  };
  const { store } = await createApp({
    database,
    schedulerEnabled: false,
    mailer,
  });
  const scheduler = createScheduler({ store, mailer, push: { enabled: false, publicKey: null, send: async () => ({ ok: false }) } });

  const user = await store.createUser({
    email: 'reminder@example.com',
    passwordHash: 'hash',
    name: 'Напоминалка',
    timezone: 'UTC',
  });
  await store.createHabit({
    userId: user.id,
    name: 'Читать',
    type: 'binary',
    frequency: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    target: null,
    unit: null,
    description: null,
    status: 'active',
  });

  await scheduler.checkReminders(new Date(`${today}T17:30:00.000Z`));
  assert.equal(sent.length, 0);

  await scheduler.checkReminders(new Date(`${today}T18:05:00.000Z`));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].email, 'reminder@example.com');

  // Повторная проверка в том же часе не дублирует письмо.
  await scheduler.checkReminders(new Date(`${today}T18:40:00.000Z`));
  assert.equal(sent.length, 1);

  await database.close();
});
