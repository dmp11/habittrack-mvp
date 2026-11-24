'use strict';

const express = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../services/tokens');
const { errors } = require('../utils/http-error');
const schemas = require('../validation/schemas');

function createRouter({ store }) {
  const router = express.Router();
  router.use(requireAuth(store));

  router.get('/', async (req, res, next) => {
    try {
      res.json({ habits: await store.listHabits(req.user.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', validate(schemas.habitCreate), async (req, res, next) => {
    try {
      const habit = await store.createHabit({ ...req.body, userId: req.user.id });
      res.status(201).json({ habit });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id', validate(schemas.habitUpdate), async (req, res, next) => {
    try {
      const current = await store.getHabit(req.user.id, req.params.id);
      if (!current) throw errors.notFound('Привычка не найдена');
      const merged = { ...current, ...req.body };
      if (merged.type === 'counter' && (!merged.target || merged.target < 1)) {
        throw errors.badRequest('Для счётчика укажите целевое значение');
      }
      if (merged.type === 'binary') req.body.target = null;
      const habit = await store.updateHabit(req.user.id, req.params.id, req.body);
      res.json({ habit });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const current = await store.getHabit(req.user.id, req.params.id);
      if (!current) throw errors.notFound('Привычка не найдена');
      await store.deleteHabit(req.user.id, req.params.id);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createRouter };
