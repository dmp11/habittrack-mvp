'use strict';

const path = require('node:path');
const crypto = require('node:crypto');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';

function secret(name) {
  const value = process.env[name];
  if (value && value.length >= 16) return value;
  if (isProduction) {
    throw new Error(`Не задан или слишком короткий ${name} (минимум 16 символов)`);
  }
  const generated = crypto.randomBytes(32).toString('hex');
  console.warn(`[config] ${name} не задан — использован временный ключ (токены сбросятся при перезапуске)`);
  return generated;
}

function splitOrigins(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT || 4000),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || '',
  allowedOrigins: splitOrigins(
    process.env.APP_ORIGINS
    || (() => {
      const origins = [process.env.APP_URL, process.env.API_URL];
      if (!isProduction) origins.push('http://localhost:5173', 'http://localhost:4000');
      return origins.filter(Boolean).join(',');
    })(),
  ),
  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET'),
    refreshSecret: secret('JWT_REFRESH_SECRET'),
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS || 30),
  },
  database: {
    url: process.env.DATABASE_URL || '',
    sqlitePath: path.resolve(__dirname, '..', process.env.SQLITE_PATH || 'data/habittrack.db'),
  },
  mail: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'HabitTrack <noreply@habittrack.local>',
    devLogPath: path.resolve(__dirname, '..', 'data', 'emails.log'),
  },
  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@habittrack.local',
  },
  trustProxy: process.env.RATE_LIMIT_TRUST_PROXY === 'true',
};

module.exports = config;
