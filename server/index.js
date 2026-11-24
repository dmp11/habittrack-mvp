'use strict';

const config = require('./config');
const { createApp } = require('./app');

createApp()
  .then(({ app, scheduler, database }) => {
    const server = app.listen(config.port, () => {
      console.log(`[HabitTrack] API: http://localhost:${config.port}/api`);
      console.log(`[HabitTrack] Swagger: http://localhost:${config.port}/api/docs`);
    });

    scheduler.start();

    let closing = false;
    async function shutdown(signal) {
      if (closing) return;
      closing = true;
      console.log(`[HabitTrack] ${signal}: завершение работы...`);
      scheduler.stop();
      server.close(async () => {
        await database.close();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 5000).unref();
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  })
  .catch((error) => {
    console.error('[HabitTrack] не удалось запуститься:', error);
    process.exit(1);
  });
