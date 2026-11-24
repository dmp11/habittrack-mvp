'use strict';

const express = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../services/tokens');
const { localDate, addDays } = require('../utils/date');
const { buildStats } = require('../services/stats');
const schemas = require('../validation/schemas');

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function createRouter({ store }) {
  const router = express.Router();
  router.use(requireAuth(store));

  router.get('/', validate(schemas.statsQuery, 'query'), async (req, res, next) => {
    try {
      const today = localDate(new Date(), req.user.timezone);
      const [habits, records] = await Promise.all([
        store.listHabits(req.user.id),
        store.listRecords(req.user.id, '0000-01-01', today),
      ]);
      const stats = buildStats({
        habits,
        records,
        today,
        timezone: req.user.timezone,
        days: req.query.days,
        chartPeriod: req.query.period,
      });
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  router.get('/export', validate(schemas.exportQuery, 'query'), async (req, res, next) => {
    try {
      const today = localDate(new Date(), req.user.timezone);
      const from = addDays(today, -29);
      const rows = await store.listRecordsWithHabit(req.user.id, from, today);
      const lines = ['date,habit_name,type,value'];
      for (const row of rows) {
        lines.push([row.date, row.habit_name, row.type, row.value].map(csvCell).join(','));
      }
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="habittrack-stats-${today}.csv"`,
        'Cache-Control': 'no-store',
      });
      res.send(`\uFEFF${lines.join('\r\n')}\r\n`);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createRouter };
