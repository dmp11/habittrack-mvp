'use strict';

const express = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../services/tokens');
const { errors } = require('../utils/http-error');
const schemas = require('../validation/schemas');

function createConfigRouter({ push }) {
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({
      appName: 'HabitTrack',
      version: '1.0.0',
      pushEnabled: push.enabled,
      vapidPublicKey: push.publicKey,
      reminderTime: '18:00',
    });
  });
  return router;
}

function createPushRouter({ store, push }) {
  const router = express.Router();
  router.use(requireAuth(store));

  router.post('/subscribe', validate(schemas.pushSubscribe), async (req, res, next) => {
    try {
      if (!push.enabled) throw errors.badRequest('Web Push не настроен на сервере');
      await store.upsertSubscription({
        userId: req.user.id,
        endpoint: req.body.endpoint,
        keys: req.body.keys,
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/subscribe', async (req, res, next) => {
    try {
      const endpoint = req.body?.endpoint;
      if (typeof endpoint !== 'string' || !endpoint) throw errors.badRequest('Укажите endpoint подписки');
      await store.deleteSubscription(req.user.id, endpoint);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createConfigRouter, createPushRouter };
