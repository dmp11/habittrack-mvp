'use strict';

const config = require('../config');
const { localDate, localTime, isScheduled } = require('../utils/date');

function createScheduler({ store, mailer, push }) {
  let timer = null;

  async function checkReminders(now = new Date()) {
    const users = await store.listUsers();
    for (const user of users) {
      try {
        const { hour } = localTime(now, user.timezone || 'UTC');
        if (hour !== 18) continue;

        const today = localDate(now, user.timezone || 'UTC');
        const [habits, records] = await Promise.all([
          store.listHabits(user.id),
          store.listRecords(user.id, today, today),
        ]);
        const recorded = new Set(records.map((record) => record.habit_id));
        const pending = habits.filter(
          (habit) => habit.status === 'active' && isScheduled(habit, today) && !recorded.has(habit.id),
        );
        if (!pending.length) continue;

        if (!(await store.hasReminder(user.id, today, 'email'))) {
          await mailer.sendReminder(user.email, user.name);
          await store.addReminder(user.id, today, 'email');
        }

        if (push.enabled && !(await store.hasReminder(user.id, today, 'push'))) {
          const subscriptions = await store.listSubscriptions(user.id);
          let delivered = false;
          for (const subscription of subscriptions) {
            const result = await push.send(subscription, {
              title: 'Осталось совсем немного — отметьте привычки!',
              body: `Сегодня ожидают отметки ${pending.length} привычек. Отслеживай. Закрепляй. Развивайся.`,
              url: config.appUrl,
            });
            if (result.ok) delivered = true;
            if (result.reason === 'expired') await store.deleteSubscription(user.id, subscription.endpoint);
          }
          if (delivered) await store.addReminder(user.id, today, 'push');
        }
      } catch (error) {
        console.error(`[scheduler] ошибка для пользователя ${user.id}:`, error.message);
      }
    }
  }

  return {
    checkReminders,
    start() {
      if (timer) return;
      // Проверка раз в минуту, ограничение по часу и таблица reminders исключают дубли.
      timer = setInterval(() => {
        checkReminders().catch((error) => console.error('[scheduler]', error));
      }, 60000);
      timer.unref?.();
      checkReminders().catch((error) => console.error('[scheduler]', error));
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

module.exports = { createScheduler };
