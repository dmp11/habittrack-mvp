'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { HttpError, errors } = require('../utils/http-error');

const ISSUER = 'habittrack';
const AUDIENCE = 'habittrack-api';
const REFRESH_COOKIE = 'ht_refresh';

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl, issuer: ISSUER, audience: AUDIENCE },
  );
}

function signRefreshToken(user, sessionId) {
  return jwt.sign(
    { sub: user.id, sessionId, type: 'refresh' },
    config.jwt.refreshSecret,
    { expiresIn: `${config.jwt.refreshTtlDays}d`, issuer: ISSUER, audience: AUDIENCE },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret, { issuer: ISSUER, audience: AUDIENCE });
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, config.jwt.refreshSecret, { issuer: ISSUER, audience: AUDIENCE });
  if (payload.type !== 'refresh' || !payload.sessionId) {
    throw errors.unauthorized('Некорректный refresh-токен');
  }
  return payload;
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: config.jwt.refreshTtlDays * 86400000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/api/auth',
  });
}

function requireAuth( store) {
  return async (req, res, next) => {
    try {
      const header = req.get('authorization') || '';
      const match = /^Bearer\s+(.+)$/i.exec(header);
      if (!match) throw errors.unauthorized();
      const payload = verifyAccessToken(match[1]);
      const user = await store.findUserById(payload.sub);
      if (!user) throw errors.unauthorized();
      req.user = user;
      req.accessToken = match[1];
      next();
    } catch (error) {
      if (error instanceof HttpError) return next(error);
      next(error);
    }
  };
}

module.exports = {
  REFRESH_COOKIE,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  requireAuth,
};
