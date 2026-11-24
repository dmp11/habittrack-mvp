import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import type { PublicConfig } from '../types';

const IntlWithZones = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) output[i] = rawData.charCodeAt(i);
  return output as BufferSource;
}

export function Settings() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pushBusy, setPushBusy] = useState(false);

  const timezones = IntlWithZones.supportedValuesOf
    ? IntlWithZones.supportedValuesOf('timeZone')
    : ['UTC', 'Europe/Moscow', 'Europe/Kiev', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'America/New_York'];

  useEffect(() => {
    api.getConfig().then(setConfig).catch((caught) => setError(errorMessage(caught)));
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setSubscribed(Boolean(subscription)))
        .catch(() => setSubscribed(false));
    }
  }, []);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await updateUser({ name: name.trim(), timezone });
      setMessage('Профиль сохранён');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const togglePush = async () => {
    if (!config?.vapidPublicKey) return;
    setPushBusy(true);
    setError('');
    setMessage('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Этот браузер не поддерживает Web Push');
      }
      const registration = await navigator.serviceWorker.ready;
      if (subscribed) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await api.unsubscribePush(subscription.endpoint).catch(() => undefined);
          await subscription.unsubscribe();
        }
        setSubscribed(false);
        setMessage('Push-уведомления отключены');
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Разрешите уведомления в настройках браузера');
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
        });
        await api.subscribePush(subscription.toJSON());
        setSubscribed(true);
        setMessage('Push-уведомления включены');
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink sm:text-3xl">Настройки</h1>
        <p className="mt-1 text-sm text-brand-muted">Профиль, часовой пояс и уведомления</p>
      </div>

      {message && <p className="alert-success" role="status">{message}</p>}
      {error && <p className="alert-error" role="alert">{error}</p>}

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-brand-ink">Профиль</h2>
        <p className="mt-1 text-sm text-brand-muted">Email: {user?.email}</p>
        <form onSubmit={saveProfile} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="settings-name">Имя</label>
            <input id="settings-name" className="input" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="settings-timezone">Часовой пояс</label>
            <select id="settings-timezone" className="input" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
              {!timezones.includes(timezone) && <option value={timezone}>{timezone}</option>}
              {timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-brand-muted">Даты, отметки и напоминания рассчитываются в этом часовом поясе.</p>
          </div>
          <button type="submit" className="btn-primary">Сохранить</button>
        </form>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-brand-ink">Напоминания</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Письмо приходит каждый день в 18:00 по вашему часовому поясу, если есть неотмеченные привычки.
        </p>
        <div className="mt-4 rounded-xl bg-brand-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-brand-ink">Push-уведомления</p>
              <p className="text-xs text-brand-muted">
                {config?.vapidPublicKey ? 'Доступны в этом браузере' : 'Не настроены на сервере'}
              </p>
            </div>
            <button type="button" onClick={togglePush} disabled={!config?.vapidPublicKey || pushBusy} className={subscribed ? 'btn-danger' : 'btn-primary'}>
              {pushBusy ? 'Подождите…' : subscribed ? 'Отключить' : 'Включить'}
            </button>
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-brand-ink">Выйти из аккаунта</h2>
        <p className="mt-1 text-sm text-brand-muted">Текущая сессия будет остановлена.</p>
        <button
          type="button"
          className="btn-danger mt-4"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          Выйти
        </button>
      </section>
    </div>
  );
}
