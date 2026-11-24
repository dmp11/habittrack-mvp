'use strict';

const { addDays, daysBetween, isScheduled } = require('../utils/date');

function isCompleted(habit, value) {
  if (value === undefined || value === null) return false;
  if (habit.type === 'binary') return Number(value) === 1;
  return habit.target ? Number(value) >= Number(habit.target) : Number(value) > 0;
}

function stateFor(habit, date, record, today) {
  const habitStart = String(habit.created_at || '').slice(0, 10);
  if ((habitStart && date < habitStart) || !isScheduled(habit, date)) return 'unscheduled';
  if (!record) return 'unmarked';
  if (isCompleted(habit, record.value)) return 'done';
  if (habit.type === 'counter' && Number(record.value) > 0) return 'partial';
  return 'skipped';
}

function scheduledDates(habit, from, to) {
  const habitStart = String(habit.created_at || '').slice(0, 10);
  const start = habitStart && habitStart > from ? habitStart : from;
  const result = [];
  for (let date = start; date <= to; date = addDays(date, 1)) {
    if (isScheduled(habit, date)) result.push(date);
  }
  return result;
}

function completionRate(habit, recordsByDate, today, days) {
  const dates = scheduledDates(habit, addDays(today, -(days - 1)), today);
  const completed = dates.filter((date) => isCompleted(habit, recordsByDate.get(date)?.value)).length;
  return {
    completed,
    scheduled: dates.length,
    percent: dates.length ? Math.round((completed / dates.length) * 100) : 0,
  };
}

function currentStreak(habit, recordsByDate, today) {
  const habitStart = String(habit.created_at || '').slice(0, 10);
  let streak = 0;
  let date = today;
  for (let i = 0; i < 366; i += 1, date = addDays(date, -1)) {
    if (habitStart && date < habitStart) break;
    if (!isScheduled(habit, date)) continue;
    const record = recordsByDate.get(date);
    if (isCompleted(habit, record?.value)) {
      streak += 1;
      continue;
    }
    // Текущий день ещё не закончился — серия сохраняется.
    if (!record && date === today) continue;
    break;
  }
  return streak;
}

function buildChart(habits, records, today, period = 'week') {
  const bucketSize = period === 'month' ? 30 : 7;
  const bucketCount = period === 'month' ? 6 : 8;
  const counters = habits.filter((habit) => habit.type === 'counter');
  const buckets = [];

  for (let index = bucketCount - 1; index >= 0; index -= 1) {
    const end = addDays(today, -index * bucketSize);
    buckets.push({ end, start: addDays(end, -(bucketSize - 1)) });
  }

  const labels = buckets.map((bucket) => bucket.end.slice(5).split('-').reverse().join('.'));
  const datasets = counters.map((habit) => ({
    habitId: habit.id,
    name: habit.name,
    unit: habit.unit || '',
    data: buckets.map((bucket) => {
      const values = records.filter(
        (record) => record.habit_id === habit.id && record.date >= bucket.start && record.date <= bucket.end,
      );
      if (!values.length) return null;
      const sum = values.reduce((total, record) => total + Number(record.value), 0);
      return Math.round((sum / values.length) * 10) / 10;
    }),
  }));

  return { period, labels, datasets };
}

function buildAggregateHeatmap(habits, recordsByDate, today) {
  const activeHabits = habits.filter((habit) => habit.status === 'active');
  const days = [];
  for (let index = 29; index >= 0; index -= 1) {
    const date = addDays(today, -index);
    let scheduled = 0;
    let done = 0;
    let skipped = 0;
    for (const habit of activeHabits) {
      const state = stateFor(habit, date, recordsByDate.get(`${habit.id}:${date}`), today);
      if (state === 'unscheduled') continue;
      scheduled += 1;
      if (state === 'done') done += 1;
      else if (state === 'skipped' || state === 'partial') skipped += 1;
    }
    const state = done > 0 ? 'done' : skipped > 0 ? 'skipped' : scheduled > 0 ? 'unmarked' : 'unscheduled';
    days.push({ date, state, done, scheduled });
  }
  return days;
}

function buildStats({ habits, records, today, timezone, days = 30, chartPeriod = 'week' }) {
  const recordsByDate = new Map();
  for (const record of records) {
    recordsByDate.set(record.date, record);
    recordsByDate.set(`${record.habit_id}:${record.date}`, record);
  }

  const habitStats = habits.map((habit) => {
    const habitRecords = new Map();
    for (const record of records) {
      if (record.habit_id === habit.id) habitRecords.set(record.date, record);
    }
    const heatmap = [];
    for (let index = 29; index >= 0; index -= 1) {
      const date = addDays(today, -index);
      const record = habitRecords.get(date);
      heatmap.push({ date, state: stateFor(habit, date, record, today), value: record ? record.value : null });
    }
    return {
      id: habit.id,
      name: habit.name,
      type: habit.type,
      target: habit.target,
      unit: habit.unit,
      status: habit.status,
      streak: currentStreak(habit, habitRecords, today),
      completion7d: completionRate(habit, habitRecords, today, 7),
      completion30d: completionRate(habit, habitRecords, today, 30),
      heatmap,
    };
  });

  const completedDates = new Set();
  for (const record of records) {
    const habit = habits.find((item) => item.id === record.habit_id);
    if (habit && isCompleted(habit, record.value)) completedDates.add(record.date);
  }

  const activeHabits = habits.filter((habit) => habit.status === 'active');
  const allCompletion = (windowDays) => {
    let completed = 0;
    let scheduled = 0;
    for (const habit of activeHabits) {
      const rate = completionRate(habit, new Map(records.filter((r) => r.habit_id === habit.id).map((r) => [r.date, r])), today, windowDays);
      completed += rate.completed;
      scheduled += rate.scheduled;
    }
    return {
      completed,
      scheduled,
      percent: scheduled ? Math.round((completed / scheduled) * 100) : 0,
    };
  };

  return {
    today,
    timezone,
    summary: {
      totalCompletedDays: completedDates.size,
      currentStreak: habitStats
        .filter((item) => item.status === 'active')
        .reduce((best, item) => Math.max(best, item.streak), 0),
      completion7d: allCompletion(7),
      completion30d: allCompletion(30),
    },
    heatmap: buildAggregateHeatmap(habits, recordsByDate, today),
    habits: habitStats,
    chart: buildChart(habits, records, today, chartPeriod),
  };
}

module.exports = { buildStats, isCompleted, stateFor, daysBetween };
