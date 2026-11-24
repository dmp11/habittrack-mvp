'use strict';

const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidTimezone(timezone) {
  if (typeof timezone !== 'string' || !timezone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Дата в часовом поясе пользователя, строка YYYY-MM-DD. */
function localDate(now = new Date(), timezone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function localTime(now = new Date(), timezone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { hour: get('hour') % 24, minute: get('minute') };
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toUtcMs(dateString) {
  return Date.parse(`${dateString}T00:00:00.000Z`);
}

function addDays(dateString, amount) {
  return new Date(toUtcMs(dateString) + amount * 86400000).toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86400000);
}

function dayCode(dateString) {
  return DAY_CODES[new Date(`${dateString}T00:00:00.000Z`).getUTCDay()];
}

function isScheduled(habit, dateString) {
  if (!Array.isArray(habit.frequency) || habit.frequency.length === 0) return true;
  return habit.frequency.includes(dayCode(dateString));
}

function withinLastDays(dateString, today, days) {
  const diff = daysBetween(dateString, today);
  return diff >= 0 && diff < days;
}

module.exports = {
  DAY_CODES,
  isValidTimezone,
  localDate,
  localTime,
  isValidDateString,
  toUtcMs,
  addDays,
  daysBetween,
  dayCode,
  isScheduled,
  withinLastDays,
};
