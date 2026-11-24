'use strict';

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const errors = {
  badRequest: (message = 'Некорректный запрос', details) => new HttpError(400, 'BAD_REQUEST', message, details),
  unauthorized: (message = 'Требуется авторизация') => new HttpError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Доступ запрещён') => new HttpError(403, 'FORBIDDEN', message),
  notFound: (message = 'Не найдено') => new HttpError(404, 'NOT_FOUND', message),
  conflict: (message = 'Конфликт данных') => new HttpError(409, 'CONFLICT', message),
  tooMany: (message = 'Слишком много запросов') => new HttpError(429, 'RATE_LIMITED', message),
};

module.exports = { HttpError, errors };
