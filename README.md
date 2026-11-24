# HabitTrack MVP

Трекер привычек со статистикой: SPA на React + TypeScript и REST API на Node.js/Express. Интерфейс на русском, mobile-first, данные и напоминания привязаны к часовому поясу пользователя.

## Что реализовано

| Требование ТЗ | Статус |
| --- | --- |
| Регистрация/авторизация, JWT access + refresh, восстановление пароля | ✅ |
| CRUD привычек: бинарная/счётчик, дни недели, цель, единица, архив | ✅ |
| Отметки за сегодня и прошедшие 30 дней, валидация 0…9999 | ✅ |
| Тепловая карта 30 дней, линейный график счётчиков (недели/месяцы) | ✅ |
| Метрики: выполненные дни, streak, процент за 7/30 дней | ✅ |
| Экспорт CSV за 30 дней | ✅ |
| Напоминание в 18:00: email + Web Push (PWA) | ✅ |
| Безопасность: bcrypt, JWT, httpOnly-refresh, CSRF, rate limit, CSP, CORS | ✅ |
| Mobile-first, доступность (Lighthouse accessibility 100) | ✅ |
| Фирменный стиль по брендбуку: палитра, Montserrat, логотип, слоган | ✅ |
| Swagger-документация, Docker, CI, тесты, чек-лист | ✅ |
| Figma-прототип | Заменён текстовыми wireframes: [`docs/wireframes.md`](docs/wireframes.md) |
| Redis-кэш, тёмная тема | Не включены в MVP (приоритет Could/рекомендация) |
| Офлайн-режим, геймификация, соцсети | Не реализованы по пункту «Won't» ТЗ |

## Быстрый старт

Требуется Node.js **22.5+** (тестировалось на Node 24).

```bash
npm install
npm run dev
```

- Фронтенд: <http://localhost:5173>
- API: <http://localhost:4000/api>
- Swagger UI: <http://localhost:4000/api/docs>

По умолчанию используется локальная SQLite-база `data/habittrack.db` — устанавливать PostgreSQL не нужно. `.env` можно не создавать: секреты для разработки генерируются автоматически (токены сбросятся при перезапуске сервера). Для постоянных секретов скопируйте `.env.example` в `.env` и заполните значения.

### Production-сборка

```bash
npm run build
npm start
```

Сервер раздаёт собранный SPA из `client/dist`, API и Swagger доступны на том же порту. В production обязательны переменные `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET` (минимум 16 символов), а также HTTPS на reverse proxy.

## Переменные окружения

См. [`.env.example`](.env.example). Основные:

- `PORT` — порт API (по умолчанию 4000).
- `APP_URL` — адрес фронтенда, `API_URL` — адрес API (если разнесены).
- `APP_ORIGINS` — список разрешённых Origin через запятую.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS`.
- `DATABASE_URL` — строка подключения PostgreSQL. Если не задана, используется SQLite (`SQLITE_PATH`).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — отправка писем. Без SMTP письма и ссылка на сброс выводятся в консоль сервера и `data/emails.log` (только в dev).
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — Web Push. Ключи генерируются командой `npm run keys`.

## Брендинг

Интерфейс, письма и PWA-уведомления оформлены по `brandbook.txt`:

- **Палитра:** градиент `#2ECC71 → #3498DB` на акцентных элементах, графитовый текст `#2C3E50`, белый фон, светло-голубой акцент `#85C1E9`. Значения зафиксированы как CSS-токены в `client/src/index.css`; производные тёмные оттенки используются только для текста, чтобы сохранить контраст ≥ 4.5:1.
- **Типографика:** Montserrat (заголовки 700/800, интерфейс 400–600), межстрочный интервал 1.2 у заголовков и 1.5 у текста. Шрифт поставляется локально через `@fontsource/montserrat` — внешние запросы не нужны.
- **Логотип:** фирменные файлы из папки `Logo/` конвертированы в прозрачные PNG и лежат в `client/public/brand/`. Цветная версия используется на экранах входа, иконка — в шапке, для favicon, манифеста PWA и уведомлений, монохромная доступна для печатных носителей. Охранное поле и пропорции соблюдены, градиент не изменён.
- **Тон голоса:** поддерживающие лаконичные фразы («Отличная работа!», «Ты на верном пути», «Осталось совсем немного») и слоган «Отслеживай. Закрепляй. Развивайся».

## API

Все защищённые методы ожидают `Authorization: Bearer <accessToken>`. Refresh-токен хранится в cookie `ht_refresh` с флагами `HttpOnly`, `SameSite=Strict`, `Secure` (в production) и обновляется ротацией через `POST /api/auth/refresh`.

Для мутирующих запросов без Bearer-токена (логин, регистрация, refresh) required заголовок `X-Requested-With: XMLHttpRequest` — это защита от CSRF. Фронтенд добавляет его автоматически.

| Метод | Путь | Назначение |
| --- | --- | --- |
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Авторизация |
| POST | `/api/auth/refresh` | Обновление токенов |
| POST | `/api/auth/logout` | Выход |
| POST | `/api/auth/forgot-password` | Запрос сброса пароля |
| POST | `/api/auth/reset-password` | Новый пароль по токену |
| GET/PATCH | `/api/auth/me` | Профиль |
| GET/POST | `/api/habits` | Список/создание привычки |
| PATCH/DELETE | `/api/habits/{id}` | Редактирование/удаление |
| GET/POST | `/api/records` | Отметки |
| GET | `/api/stats?days=30&period=week` | Статистика |
| GET | `/api/stats/export` | CSV за 30 дней |
| GET | `/api/config` | Публичная конфигурация (VAPID-ключ) |
| POST/DELETE | `/api/push/subscribe` | Подписка/отписка Web Push |

Полная OpenAPI-спецификация: [`/api/openapi.json`](http://localhost:4000/api/openapi.json), интерактивная документация: [`/api/docs`](http://localhost:4000/api/docs).

Пример создания привычки:

```json
{
  "name": "Пить воду",
  "type": "counter",
  "frequency": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  "target": 2000,
  "unit": "мл"
}
```

## База данных

SQLite используется по умолчанию и подходит для локального запуска/MVP. Для PostgreSQL задайте `DATABASE_URL` — схема и запросы совместимы с обоими диалектами (плейсхолдеры `?` автоматически преобразуются в `$1…$n`). Миграции выполняются при старте (`CREATE TABLE IF NOT EXISTS`).

## Уведомления

- **Email.** Каждую минуту планировщик проверяет пользователей, у которых локальное время 18:00, и отправляет письмо, если есть активные привычки без отметки на сегодня. Повторные отправки в тот же день блокируются таблицей `reminders`.
- **Push.** В «Настройках» включите Web Push: браузер запросит разрешение и создаст подписку. Для работы нужны VAPID-ключи и HTTPS. Service worker (`client/public/sw.js`) только показывает уведомления — офлайн-режим не реализован намеренно.

## Тесты

```bash
npm test          # интеграционные тесты API + тест планировщика (node:test + supertest)
npm run typecheck # проверка TypeScript
npm run build     # production-сборка
```

Ручной чек-лист из 21 кейса: [`docs/testing-checklist.md`](docs/testing-checklist.md).

## Docker и CI

```bash
docker compose up --build
```

Композ поднимает приложение и PostgreSQL. Приложение слушает порт 4000 и раздаёт SPA. Переменные окружения берутся из `.env` (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL` и т.д.).

GitHub Actions (`.github/workflows/ci.yml`) при каждом push запускает `npm ci`, проверку типов, тесты и сборку.

## Структура

```text
server/
  app.js, index.js        Express-приложение и точка входа
  config.js, openapi.js   Конфигурация и OpenAPI
  db/                     SQLite/PostgreSQL-адаптер и запросы
  middleware/             Валидация, ошибки, CSRF
  routes/                 auth, habits, records, stats, misc
  services/               JWT, статистика, почта, push, планировщик
  test/                   Интеграционные тесты
client/
  src/pages/              Экраны входа, привычек, статистики, настроек
  src/components/         Карточки, календарь, график, формы
  public/brand/           Логотип и иконки бренда (из папки Logo)
  public/                 PWA-манифест, service worker, robots.txt
docs/                     Wireframes и чек-лист тестирования
```

## Особенности реализации статистики

- Привычка считается выполненной: бинарная — значение `1`; счётчик — значение ≥ цели (или > 0, если цель не задана).
- Серия не ломается из-за ещё не отмеченного текущего дня, но прерывается на пропущенном дне.
- Процент выполнения рассчитывается только по запланированным дням (включая дату создания привычки).
- График показывает среднее значение по дням **с отметками** за 7- или 30-дневные корзины.
- «Выполненных дней» — количество уникальных дат, где выполнена хотя бы одна привычка.
