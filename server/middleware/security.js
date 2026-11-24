'use strict';

const config = require('../config');
const { HttpError } = require('../utils/http-error');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Защита от CSRF: cookie с refresh-токеном имеет SameSite=Strict,
 * дополнительно проверяется Origin и пользовательский заголовок.
 * Запросы с Bearer-токеном не могут быть отправлены другим сайтом без CORS.
 */
function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin) {
    let allowed = false;
    try {
      const originUrl = new URL(origin);
      allowed = config.allowedOrigins.some((item) => {
        try {
          return new URL(item).origin === originUrl.origin;
        } catch {
          return false;
        }
      });
    } catch {
      allowed = false;
    }
    if (!allowed) return next(new HttpError(403, 'CSRF_REJECTED', 'Запрос с другого источника запрещён'));
  }

  const hasBearer = /^Bearer\s+/i.test(req.get('authorization') || '');
  const hasCustomHeader = req.get('x-requested-with') === 'XMLHttpRequest';
  if (!hasBearer && !hasCustomHeader) {
    return next(new HttpError(403, 'CSRF_REJECTED', 'Отсутствует защитный заголовок X-Requested-With'));
  }
  next();
}

module.exports = { csrfGuard };
