'use strict';

const { ZodError } = require('zod');
const { JsonWebTokenError, TokenExpiredError } = require('jsonwebtoken');
const { HttpError } = require('../utils/http-error');

function notFoundHandler(req, res, next) {
  next(new HttpError(404, 'NOT_FOUND', `Маршрут ${req.method} ${req.path} не найден`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Внутренняя ошибка сервера';
  let details;

  if (err instanceof HttpError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Ошибка валидации данных';
    details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (err instanceof TokenExpiredError) {
    status = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Срок действия токена истёк';
  } else if (err instanceof JsonWebTokenError) {
    status = 401;
    code = 'INVALID_TOKEN';
    message = 'Некорректный токен';
  } else if (err && (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT_UNIQUE')) {
    status = 409;
    code = 'CONFLICT';
    message = 'Такая запись уже существует';
  } else if (err && err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Запрос слишком большой';
  }

  if (status >= 500 && process.env.NODE_ENV !== 'test') {
    console.error('[error]', err);
  }

  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

module.exports = { notFoundHandler, errorHandler };
