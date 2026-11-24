'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { validate } = require('../middleware/validate');
const { requireAuth, signAccessToken, signRefreshToken, verifyRefreshToken, setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE } = require('../services/tokens');
const { errors } = require('../utils/http-error');
const schemas = require('../validation/schemas');

function authLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Слишком много попыток. Попробуйте позже.' } },
  });
}

const registerLimiter = authLimiter();
const loginLimiter = authLimiter();
const resetLimiter = authLimiter();

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Слишком много запросов. Попробуйте позже.' } },
});

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    timezone: user.timezone || 'UTC',
    createdAt: user.created_at,
  };
}

function createRouter({ store, mailer }) {
  const router = express.Router();

  async function issueTokens(res, user) {
    const sessionId = store.uuid();
    const refreshToken = signRefreshToken(user, sessionId);
    const expiresAt = new Date(Date.now() + config.jwt.refreshTtlDays * 86400000).toISOString();
    await store.createSession({ userId: user.id, tokenHash: store.sha256(refreshToken), expiresAt });
    setRefreshCookie(res, refreshToken);
    return signAccessToken(user);
  }

  router.post('/register', registerLimiter, validate(schemas.register), async (req, res, next) => {
    try {
      const { email, password, name, timezone } = req.body;
      if (await store.findUserByEmail(email)) {
        throw errors.conflict('Пользователь с таким email уже существует');
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await store.createUser({ email, passwordHash, name, timezone });
      const accessToken = await issueTokens(res, user);
      res.status(201).json({ user: publicUser(user), accessToken });
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', loginLimiter, validate(schemas.login), async (req, res, next) => {
    try {
      const user = await store.findUserByEmail(req.body.email);
      const valid = user ? await bcrypt.compare(req.body.password, user.password_hash) : false;
      if (!valid) throw errors.unauthorized('Неверный email или пароль');
      const accessToken = await issueTokens(res, user);
      res.json({ user: publicUser(user), accessToken });
    } catch (error) {
      next(error);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      const token = req.cookies?.[REFRESH_COOKIE];
      if (!token) throw errors.unauthorized('Нет refresh-токена');
      const payload = verifyRefreshToken(token);
      const tokenHash = store.sha256(token);
      const session = await store.findSession(tokenHash);
      if (!session || session.user_id !== payload.sub || session.expires_at < new Date().toISOString()) {
        clearRefreshCookie(res);
        throw errors.unauthorized('Сессия недействительна');
      }
      const user = await store.findUserById(payload.sub);
      if (!user) throw errors.unauthorized();
      await store.deleteSession(session.id);
      const accessToken = await issueTokens(res, user);
      res.json({ user: publicUser(user), accessToken });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const token = req.cookies?.[REFRESH_COOKIE];
      if (token) {
        try {
          const payload = verifyRefreshToken(token);
          const session = await store.findSession(store.sha256(token));
          if (session && session.user_id === payload.sub) await store.deleteSession(session.id);
        } catch {
          // Просроченный токен просто удаляем из браузера.
        }
      }
      clearRefreshCookie(res);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/forgot-password', forgotLimiter, validate(schemas.forgotPassword), async (req, res, next) => {
    try {
      const user = await store.findUserByEmail(req.body.email);
      if (user) {
        const token = crypto.randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await store.createResetToken({ userId: user.id, tokenHash: store.sha256(token), expiresAt });
        await mailer.sendPasswordReset(user.email, token);
        if (!config.isProduction) {
          return res.json({
            ok: true,
            message: 'Письмо отправлено',
            devToken: token,
            devUrl: `${config.appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`,
          });
        }
      }
      res.json({ ok: true, message: 'Если пользователь существует, письмо отправлено' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reset-password', resetLimiter, validate(schemas.resetPassword), async (req, res, next) => {
    try {
      const record = await store.findResetToken(store.sha256(req.body.token));
      if (!record || record.used_at || record.expires_at < new Date().toISOString()) {
        throw errors.badRequest('Ссылка недействительна или истекла');
      }
      const passwordHash = await bcrypt.hash(req.body.password, 12);
      await store.updateUser(record.user_id, { password_hash: passwordHash });
      await store.consumeResetToken(record.id);
      await store.deleteSessionsForUser(record.user_id);
      clearRefreshCookie(res);
      res.json({ ok: true, message: 'Пароль обновлён' });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', requireAuth(store), (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  router.patch('/me', requireAuth(store), validate(schemas.updateProfile), async (req, res, next) => {
    try {
      const user = await store.updateUser(req.user.id, req.body);
      res.json({ user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createRouter, publicUser };
