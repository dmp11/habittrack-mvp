'use strict';

const { z } = require('zod');
const { DAY_CODES, isValidDateString, isValidTimezone } = require('../utils/date');

const email = z.string().trim().toLowerCase().email('Некорректный email').max(254);
const password = z.string().min(8, 'Пароль должен содержать минимум 8 символов').max(72, 'Пароль слишком длинный');
const name = z.string().trim().min(1).max(60);
const timezone = z.string().refine(isValidTimezone, 'Некорректный часовой пояс (IANA)');
const dayCode = z.enum(DAY_CODES);
const date = z.string().refine(isValidDateString, 'Дата должна быть в формате YYYY-MM-DD');

const register = z.object({
  email,
  password,
  name: name.optional().nullable(),
  timezone: timezone.optional().default('UTC'),
});

const login = z.object({
  email,
  password: z.string().min(1, 'Введите пароль').max(72),
});

const forgotPassword = z.object({ email });

const resetPassword = z.object({
  token: z.string().min(20).max(300),
  password,
});

const updateProfile = z.object({
  name: name.optional(),
  timezone: timezone.optional(),
});

const habitCreate = z.object({
  name: z.string().trim().min(1, 'Введите название').max(80, 'Название слишком длинное'),
  type: z.enum(['binary', 'counter']),
  frequency: z.array(dayCode).min(1).max(7).refine((days) => new Set(days).size === days.length, 'Дни недели не должны повторяться'),
  target: z.number().int().min(1).max(9999).optional().nullable(),
  unit: z.string().trim().max(20).optional().nullable(),
  description: z.string().trim().max(300).optional().nullable(),
  status: z.enum(['active', 'archive']).optional().default('active'),
}).superRefine((data, ctx) => {
  if (data.type === 'counter' && (!data.target || data.target < 1)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['target'], message: 'Для счётчика укажите целевое значение' });
  }
  if (data.type === 'binary' && data.target) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['target'], message: 'Для бинарной привычки целевое значение не нужно' });
  }
});

const habitUpdate = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  type: z.enum(['binary', 'counter']).optional(),
  frequency: z.array(dayCode).min(1).max(7).optional(),
  target: z.number().int().min(1).max(9999).optional().nullable(),
  unit: z.string().trim().max(20).optional().nullable(),
  description: z.string().trim().max(300).optional().nullable(),
  status: z.enum(['active', 'archive']).optional(),
}).refine((data) => Object.keys(data).length > 0, 'Нет полей для обновления');

const record = z.object({
  habitId: z.string().uuid('Некорректный идентификатор привычки'),
  date,
  value: z.number().int().min(0, 'Значение должно быть ≥ 0').max(9999, 'Значение должно быть ≤ 9999'),
});

const statsQuery = z.object({
  days: z.coerce.number().int().refine((value) => value === 7 || value === 30, 'Допустимо 7 или 30').optional().default(30),
  period: z.enum(['week', 'month']).optional().default('week'),
});

const recordsQuery = z.object({
  from: date.optional(),
  to: date.optional(),
});

const exportQuery = z.object({
  days: z.coerce.number().int().refine((value) => value === 30, 'Экспорт доступен только за 30 дней').optional().default(30),
});

const pushSubscribe = z.object({
  endpoint: z.string().url().refine((value) => value.startsWith('https://'), 'Endpoint должен использовать HTTPS'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  updateProfile,
  habitCreate,
  habitUpdate,
  record,
  statsQuery,
  recordsQuery,
  exportQuery,
  pushSubscribe,
  date,
};
