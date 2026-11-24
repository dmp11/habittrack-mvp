'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createDatabase } = require('../db');
const { createApp } = require('../app');
const { localDate, addDays } = require('../utils/date');

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
const today = localDate(new Date(), 'UTC');

let app;
let store;
let database;
let aliceToken;
let bobToken;

test.before(async () => {
  ({ app, store, database } = await createApp({
    database: createDatabase({ database: { url: '', sqlitePath: ':memory:' } }),
    schedulerEnabled: false,
    mailer: { sendPasswordReset: async () => {}, sendReminder: async () => {} },
  }));
});

test.after(async () => {
  await database.close();
});

async function register(email, password = 'Password123!') {
  const response = await request(app)
    .post('/api/auth/register')
    .set(CSRF)
    .send({ email, password, name: 'Тест', timezone: 'UTC' });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return response.body;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

test('регистрация создаёт пользователя и не возвращает пароль', async () => {
  const body = await register('alice@example.com');
  aliceToken = body.accessToken;
  assert.ok(aliceToken);
  assert.equal(body.user.email, 'alice@example.com');
  assert.equal(body.user.password, undefined);
  assert.equal(body.user.passwordHash, undefined);
});

test('повторная регистрация того же email — 409', async () => {
  const response = await request(app).post('/api/auth/register').set(CSRF)
    .send({ email: 'alice@example.com', password: 'Password123!' });
  assert.equal(response.status, 409);
});

test('короткий пароль отклоняется с деталями валидации', async () => {
  const response = await request(app).post('/api/auth/register').set(CSRF)
    .send({ email: 'short@example.com', password: '123', timezone: 'UTC' });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  assert.ok(response.body.error.details.length > 0);
});

test('авторизация: неверный пароль — 401, верный — 200', async () => {
  const wrong = await request(app).post('/api/auth/login').set(CSRF)
    .send({ email: 'alice@example.com', password: 'WrongPassword1' });
  assert.equal(wrong.status, 401);

  const ok = await request(app).post('/api/auth/login').set(CSRF)
    .send({ email: 'alice@example.com', password: 'Password123!' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.accessToken);
});

test('refresh-токен вращается, старый становится недействительным', async () => {
  const login = await request(app).post('/api/auth/login').set(CSRF)
    .send({ email: 'alice@example.com', password: 'Password123!' });
  const cookie = login.headers['set-cookie'][0];
  const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie).set(CSRF);
  assert.equal(first.status, 200);
  const second = await request(app).post('/api/auth/refresh').set('Cookie', cookie).set(CSRF);
  assert.equal(second.status, 401);
});

test('защищённые эндпоинты требуют Bearer-токен, а мутирующие — CSRF-заголовок', async () => {
  const noAuth = await request(app).get('/api/habits');
  assert.equal(noAuth.status, 401);

  const noCsrf = await request(app).post('/api/habits').send({ name: 'Без заголовка' });
  assert.equal(noCsrf.status, 403);
  assert.equal(noCsrf.body.error.code, 'CSRF_REJECTED');
});

test('создание и валидация привычек', async () => {
  const binary = await request(app).post('/api/habits').set(auth(aliceToken)).set(CSRF)
    .send({ name: 'Читать', type: 'binary', frequency: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] });
  assert.equal(binary.status, 201);
  assert.equal(binary.body.habit.type, 'binary');
  assert.equal(binary.body.habit.status, 'active');

  const badCounter = await request(app).post('/api/habits').set(auth(aliceToken)).set(CSRF)
    .send({ name: 'Пить воду', type: 'counter', frequency: ['mon'], unit: 'мл' });
  assert.equal(badCounter.status, 400);

  const counter = await request(app).post('/api/habits').set(auth(aliceToken)).set(CSRF)
    .send({ name: 'Пить воду', type: 'counter', frequency: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], target: 2000, unit: 'мл' });
  assert.equal(counter.status, 201);
  assert.equal(counter.body.habit.target, 2000);
});

test('редактирование, архивация и удаление привычки', async () => {
  const list = await request(app).get('/api/habits').set(auth(aliceToken));
  const habit = list.body.habits.find((item) => item.name === 'Читать');
  const updated = await request(app).patch(`/api/habits/${habit.id}`).set(auth(aliceToken)).set(CSRF)
    .send({ name: 'Читать 20 минут', status: 'archive' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.habit.name, 'Читать 20 минут');
  assert.equal(updated.body.habit.status, 'archive');

  const restored = await request(app).patch(`/api/habits/${habit.id}`).set(auth(aliceToken)).set(CSRF)
    .send({ status: 'active' });
  assert.equal(restored.body.habit.status, 'active');

  const removed = await request(app).post('/api/habits').set(auth(aliceToken)).set(CSRF)
    .send({ name: 'Удалить меня', type: 'binary', frequency: ['mon'] });
  assert.equal(removed.status, 201);
  const deleted = await request(app).delete(`/api/habits/${removed.body.habit.id}`).set(auth(aliceToken)).set(CSRF);
  assert.equal(deleted.status, 200);
  const after = await request(app).get('/api/habits').set(auth(aliceToken));
  assert.ok(!after.body.habits.some((item) => item.id === removed.body.habit.id));
});

test('отметки: валидация значений и дат', async () => {
  const { habits } = (await request(app).get('/api/habits').set(auth(aliceToken))).body;
  const binary = habits.find((item) => item.name === 'Читать 20 минут');
  const counter = habits.find((item) => item.name === 'Пить воду');

  const badBinary = await request(app).post('/api/records').set(auth(aliceToken)).set(CSRF)
    .send({ habitId: binary.id, date: today, value: 2 });
  assert.equal(badBinary.status, 400);

  const badCounter = await request(app).post('/api/records').set(auth(aliceToken)).set(CSRF)
    .send({ habitId: counter.id, date: today, value: 10000 });
  assert.equal(badCounter.status, 400);

  const future = await request(app).post('/api/records').set(auth(aliceToken)).set(CSRF)
    .send({ habitId: binary.id, date: addDays(today, 1), value: 1 });
  assert.equal(future.status, 400);

  const old = await request(app).post('/api/records').set(auth(aliceToken)).set(CSRF)
    .send({ habitId: binary.id, date: addDays(today, -31), value: 1 });
  assert.equal(old.status, 400);
});

test('отметки сохраняются и редактируются за прошедшие дни', async () => {
  const { habits } = (await request(app).get('/api/habits').set(auth(aliceToken))).body;
  const binary = habits.find((item) => item.name === 'Читать 20 минут');
  const counter = habits.find((item) => item.name === 'Пить воду');

  const done = await request(app).post('/api/records').set(auth(aliceToken)).set(CSRF)
    .send({ habitId: binary.id, date: today, value: 1 });
  assert.equal(done.status, 200);
  assert.equal(done.body.record.value, 1);

  const water = await request(app).post('/api/records').set(auth(aliceToken)).set(CSRF)
    .send({ habitId: counter.id, date: today, value: 2100 });
  assert.equal(water.status, 200);

  const edited = await request(app).post('/api/records').set(auth(aliceToken)).set(CSRF)
    .send({ habitId: binary.id, date: addDays(today, -2), value: 1 });
  assert.equal(edited.status, 200);

  const records = await request(app).get('/api/records').set(auth(aliceToken));
  assert.ok(records.body.records.some((item) => item.habit_id === binary.id && item.value === 1));
});

test('статистика пересчитывается после отметок', async () => {
  const response = await request(app).get('/api/stats?days=30&period=week').set(auth(aliceToken));
  assert.equal(response.status, 200);
  const stats = response.body;
  assert.equal(stats.today, today);
  assert.ok(stats.summary.totalCompletedDays >= 1);
  assert.ok(stats.summary.currentStreak >= 1);
  assert.equal(stats.heatmap.length, 30);
  assert.equal(stats.habits.length, 2);
  const reading = stats.habits.find((item) => item.name === 'Читать 20 минут');
  assert.equal(reading.completion7d.percent, 100);
  assert.equal(reading.heatmap[29].state, 'done');
  assert.equal(stats.chart.datasets.length, 1);
  assert.equal(stats.chart.datasets[0].data.at(-1), 2100);
});

test('CSV-экспорт содержит только записи за 30 дней', async () => {
  const response = await request(app).get('/api/stats/export').set(auth(aliceToken));
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /text\/csv/);
  const lines = response.text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  assert.equal(lines[0], 'date,habit_name,type,value');
  assert.ok(lines.length > 1);
  assert.ok(lines.slice(1).every((line) => line.split(',')[0] >= addDays(today, -29)));
  assert.ok(lines.some((line) => line.includes('Читать 20 минут,binary,1')));
});

test('восстановление пароля: новый пароль работает, старый — нет', async () => {
  const forgot = await request(app).post('/api/auth/forgot-password').set(CSRF)
    .send({ email: 'alice@example.com' });
  assert.equal(forgot.status, 200);
  assert.ok(forgot.body.devToken);

  const reset = await request(app).post('/api/auth/reset-password').set(CSRF)
    .send({ token: forgot.body.devToken, password: 'NewPassword123!' });
  assert.equal(reset.status, 200);

  const oldLogin = await request(app).post('/api/auth/login').set(CSRF)
    .send({ email: 'alice@example.com', password: 'Password123!' });
  assert.equal(oldLogin.status, 401);

  const newLogin = await request(app).post('/api/auth/login').set(CSRF)
    .send({ email: 'alice@example.com', password: 'NewPassword123!' });
  assert.equal(newLogin.status, 200);
});

test('данные разных пользователей изолированы', async () => {
  const bob = await register('bob@example.com');
  bobToken = bob.accessToken;
  const aliceHabits = (await request(app).get('/api/habits').set(auth(aliceToken))).body.habits;
  const target = aliceHabits[0].id;

  const getHabit = await request(app).get('/api/habits').set(auth(bobToken));
  assert.equal(getHabit.body.habits.length, 0);

  const attempt = await request(app).post('/api/records').set(auth(bobToken)).set(CSRF)
    .send({ habitId: target, date: today, value: 1 });
  assert.equal(attempt.status, 404);

  const patch = await request(app).patch(`/api/habits/${target}`).set(auth(bobToken)).set(CSRF)
    .send({ name: 'Чужое' });
  assert.equal(patch.status, 404);
});

test('профиль обновляет имя и часовой пояс', async () => {
  const response = await request(app).patch('/api/auth/me').set(auth(bobToken)).set(CSRF)
    .send({ name: 'Борис', timezone: 'Europe/Moscow' });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.name, 'Борис');
  assert.equal(response.body.user.timezone, 'Europe/Moscow');

  const bad = await request(app).patch('/api/auth/me').set(auth(bobToken)).set(CSRF)
    .send({ timezone: 'Mars/Olympus' });
  assert.equal(bad.status, 400);
});

test('логин не зависит от регистра email', async () => {
  const response = await request(app).post('/api/auth/login').set(CSRF)
    .send({ email: 'BOB@EXAMPLE.COM', password: 'Password123!' });
  assert.equal(response.status, 200);
});

test('store хранит хеш пароля, а не открытый пароль', async () => {
  const user = await store.findUserByEmail('bob@example.com');
  assert.notEqual(user.password_hash, 'Password123!');
  assert.match(user.password_hash, /^\$2[aby]\$/);
});
