'use strict';

const errorResponse = {
  description: 'Ошибка',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Ошибка валидации данных' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
  },
};

const json = (schema, description = 'Успешный ответ') => ({
  description,
  content: { 'application/json': { schema } },
});

const habit = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', example: 'Пить воду' },
    type: { type: 'string', enum: ['binary', 'counter'] },
    frequency: { type: 'array', items: { type: 'string', enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] } },
    target: { type: 'integer', nullable: true, example: 2000 },
    unit: { type: 'string', nullable: true, example: 'мл' },
    description: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['active', 'archive'] },
  },
};

const authBody = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8, maxLength: 72 },
    name: { type: 'string' },
    timezone: { type: 'string', example: 'Europe/Moscow' },
  },
};

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'HabitTrack MVP API',
    version: '1.0.0',
    description: 'REST API трекера привычек. Все защищённые методы требуют заголовок `Authorization: Bearer <accessToken>`. Refresh-токен хранится в httpOnly cookie. Для методов изменения данных нужен заголовок `X-Requested-With: XMLHttpRequest` (если не передан Bearer-токен).',
  },
  servers: [{ url: 'http://localhost:4000/api', description: 'Локальный сервер' }],
  tags: [
    { name: 'auth', description: 'Регистрация, авторизация и восстановление пароля' },
    { name: 'habits', description: 'Привычки' },
    { name: 'records', description: 'Отметки о выполнении' },
    { name: 'stats', description: 'Статистика и экспорт' },
    { name: 'misc', description: 'Конфигурация и Web Push' },
  ],
  paths: {
    '/auth/register': {
      post: {
        tags: ['auth'], summary: 'Регистрация',
        requestBody: { required: true, content: { 'application/json': { schema: authBody } } },
        responses: { 201: json({ type: 'object', properties: { accessToken: { type: 'string' } } }), 400: errorResponse, 409: errorResponse },
      },
    },
    '/auth/login': {
      post: {
        tags: ['auth'], summary: 'Авторизация по email и паролю',
        requestBody: { required: true, content: { 'application/json': { schema: authBody } } },
        responses: { 200: json({ type: 'object', properties: { accessToken: { type: 'string' } } }), 401: errorResponse },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['auth'], summary: 'Обновление access-токена (ротация refresh-токена)',
        responses: { 200: json({ type: 'object', properties: { accessToken: { type: 'string' } } }), 401: errorResponse },
      },
    },
    '/auth/logout': {
      post: { tags: ['auth'], summary: 'Выход и отзыв refresh-токена', responses: { 200: json({ type: 'object' }) } },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['auth'], summary: 'Запрос на восстановление пароля',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } } },
        responses: { 200: json({ type: 'object', properties: { ok: { type: 'boolean' } } }) },
      },
    },
    '/auth/reset-password': {
      post: {
        tags: ['auth'], summary: 'Установка нового пароля по токену из письма',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string', minLength: 8 } } } } } },
        responses: { 200: json({ type: 'object' }), 400: errorResponse },
      },
    },
    '/auth/me': {
      get: { tags: ['auth'], summary: 'Текущий пользователь', security: [{ bearerAuth: [] }], responses: { 200: json({ type: 'object' }) } },
      patch: { tags: ['auth'], summary: 'Обновление имени и часового пояса', security: [{ bearerAuth: [] }], responses: { 200: json({ type: 'object' }) } },
    },
    '/habits': {
      get: { tags: ['habits'], summary: 'Список привычек', security: [{ bearerAuth: [] }], responses: { 200: json({ type: 'object', properties: { habits: { type: 'array', items: habit } } }) } },
      post: { tags: ['habits'], summary: 'Создать привычку', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: habit } } }, responses: { 201: json({ type: 'object', properties: { habit } }), 400: errorResponse } },
    },
    '/habits/{id}': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
      patch: { tags: ['habits'], summary: 'Редактировать привычку', security: [{ bearerAuth: [] }], responses: { 200: json({ type: 'object', properties: { habit } }), 404: errorResponse } },
      delete: { tags: ['habits'], summary: 'Удалить привычку вместе с отметками', security: [{ bearerAuth: [] }], responses: { 200: json({ type: 'object' }) } },
    },
    '/records': {
      get: { tags: ['records'], summary: 'Отметки за период', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'from', schema: { type: 'string', format: 'date' } }, { in: 'query', name: 'to', schema: { type: 'string', format: 'date' } }], responses: { 200: json({ type: 'object' }) } },
      post: {
        tags: ['records'], summary: 'Создать или обновить отметку (30 дней)', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['habitId', 'date', 'value'], properties: { habitId: { type: 'string', format: 'uuid' }, date: { type: 'string', format: 'date' }, value: { type: 'integer', minimum: 0, maximum: 9999 } } } } } },
        responses: { 200: json({ type: 'object' }), 400: errorResponse, 404: errorResponse },
      },
    },
    '/stats': {
      get: {
        tags: ['stats'], summary: 'Статистика: метрики, тепловая карта, график', security: [{ bearerAuth: [] }],
        parameters: [{ in: 'query', name: 'days', schema: { type: 'integer', enum: [7, 30], default: 30 } }, { in: 'query', name: 'period', schema: { type: 'string', enum: ['week', 'month'], default: 'week' } }],
        responses: { 200: json({ type: 'object' }) },
      },
    },
    '/stats/export': {
      get: {
        tags: ['stats'], summary: 'Экспорт CSV за последние 30 дней', security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'CSV-файл', content: { 'text/csv': { schema: { type: 'string', example: 'date,habit_name,type,value\n2024-06-01,Пить воду,counter,2100' } } } } } },
    },
    '/config': {
      get: { tags: ['misc'], summary: 'Публичная конфигурация (VAPID-ключ)', responses: { 200: json({ type: 'object' }) } },
    },
    '/push/subscribe': {
      post: { tags: ['misc'], summary: 'Подписка на Web Push', security: [{ bearerAuth: [] }], responses: { 200: json({ type: 'object' }) } },
      delete: { tags: ['misc'], summary: 'Отмена подписки', security: [{ bearerAuth: [] }], responses: { 200: json({ type: 'object' }) } },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
  },
};

module.exports = openapi;
