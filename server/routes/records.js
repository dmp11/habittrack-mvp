'use strict';

const express = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../services/tokens');
const { errors } = require('../utils/http-error');
const { localDate, addDays, daysBetween } = require('../utils/date');
const schemas = require('../validation/schemas');

function createRouter({ store }) {
  const router = express.Router();
  router.use(requireAuth(store));

  router.get('/', validate(schemas.recordsQuery, 'query'), async (req, res, next) => {
    try {
      const today = localDate(new Date(), req.user.timezone);
      const from = req.query.from || addDays(today, -29);
      const to = req.query.to || today;
      if (from > to) throw errors.badRequest('Дата «от» должна быть раньше даты «до»');
      res.json({ records: await store.listRecords(req.user.id, from, to), today });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', validate(schemas.record), async (req, res, next) => {
    try {
      const { habitId, date, value } = req.body;
      const habit = await store.getHabit(req.user.id, habitId);
      if (!habit) throw errors.notFound('Привычка не найдена');

      const today = localDate(new Date(), req.user.timezone);
      if (daysBetween(date, today) < 0) throw errors.badRequest('Нельзя отмечать будущие даты');
      if (daysBetween(date, today) >= 30) throw errors.badRequest('Можно редактировать отметки не старше 30 дней');
      if (habit.status === 'archive' && date === today) {
        throw errors.badRequest('Архивную привычку нельзя отмечать сегодня');
      }
      if (habit.type === 'binary' && value !== 0 && value !== 1) {
        throw errors.badRequest('Для бинарной привычки допустимы значения 0 или 1');
      }

      const record = await store.upsertRecord({ userId: req.user.id, habitId, date, value });
      res.json({ record });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createRouter };
