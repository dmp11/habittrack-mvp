'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');
const config = require('../config');

function createMailer() {
  const { host, port, user, pass, from } = config.mail;
  const transport = host
    ? nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
      })
    : nodemailer.createTransport({ jsonTransport: true });

  async function deliver(to, subject, text, html) {
    const info = await transport.sendMail({ from, to, subject, text, html });
    if (!host && process.env.NODE_ENV !== 'test') {
      const line = `[${new Date().toISOString()}] ${subject} -> ${to}\n${text}\n---\n`;
      try {
        fs.mkdirSync(path.dirname(config.mail.devLogPath), { recursive: true });
        fs.appendFileSync(config.mail.devLogPath, line, 'utf8');
      } catch (error) {
        console.warn('[mailer] не удалось записать письмо в файл:', error.message);
      }
      console.log(`[mailer] ${subject} -> ${to}: ${info.message}`);
    }
    return info;
  }

  return {
    async sendPasswordReset(email, token) {
      const url = `${config.appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
      const text = `Восстановление пароля HabitTrack.\n\nПерейдите по ссылке: ${url}\nСсылка действует 1 час.\nЕсли вы не запрашивали восстановление, проигнорируйте это письмо.`;
      return deliver(
        email,
        'Восстановление пароля — HabitTrack',
        text,
        `<div style="font-family:Montserrat,Roboto,Arial,sans-serif;color:#2C3E50;line-height:1.5">
  <p style="font-size:20px;font-weight:700;margin:0 0 16px">HabitTrack</p>
  <p>Восстановление пароля.</p>
  <p><a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:12px;text-decoration:none;font-weight:700;color:#2C3E50;background:linear-gradient(135deg,#2ECC71,#3498DB)">Установить новый пароль</a></p>
  <p style="color:#5D6D7E;font-size:13px">Ссылка действует 1 час. Отслеживай. Закрепляй. Развивайся.</p>
</div>`,
      );
    },

    async sendReminder(email, name) {
      const greeting = name ? `${name}, осталось совсем немного` : 'Осталось совсем немного';
      const text = `${greeting} — отметьте сегодняшние привычки!\n\nОткройте HabitTrack: ${config.appUrl}\n\nОтслеживай. Закрепляй. Развивайся.`;
      return deliver(
        email,
        'Осталось совсем немного — отметьте привычки! — HabitTrack',
        text,
        `<div style="font-family:Montserrat,Roboto,Arial,sans-serif;color:#2C3E50;line-height:1.5">
  <p style="font-size:20px;font-weight:700;margin:0 0 16px">HabitTrack</p>
  <p>${greeting} — отметьте сегодняшние привычки!</p>
  <p><a href="${config.appUrl}" style="display:inline-block;padding:10px 18px;border-radius:12px;text-decoration:none;font-weight:700;color:#2C3E50;background:linear-gradient(135deg,#2ECC71,#3498DB)">Открыть HabitTrack</a></p>
  <p style="color:#5D6D7E;font-size:13px">Отслеживай. Закрепляй. Развивайся.</p>
</div>`,
      );
    },
  };
}

module.exports = { createMailer };
