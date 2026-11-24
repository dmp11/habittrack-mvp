import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { AuthShell } from '../components/AuthShell';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [devUrl, setDevUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await api.forgotPassword(email);
      setMessage(response.message || 'Письмо отправлено');
      if (response.devUrl) setDevUrl(response.devUrl);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Восстановление пароля" subtitle="Отправим ссылку для сброса на ваш email">
      {message ? (
        <div className="space-y-4">
          <p className="alert-success" role="status">{message}. Если письмо не придёт, проверьте папку «Спам».</p>
          {devUrl && (
            <div className="rounded-lg border border-[#f5d7a1] bg-brand-warning-soft p-3 text-sm text-brand-warning">
              <p className="font-semibold">Режим разработки</p>
              <p className="mt-1 break-all">SMTP не настроен — ссылка выведена здесь и в логах сервера:</p>
              <a href={devUrl} className="mt-2 inline-block break-all font-semibold text-brand-warning underline">{devUrl}</a>
            </div>
          )}
          <Link to="/login" className="btn-secondary w-full">Вернуться ко входу</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </div>
          {error && <p className="alert-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Отправляем…' : 'Отправить ссылку'}</button>
          <Link to="/login" className="link mt-3 block text-center">Назад</Link>
        </form>
      )}
    </AuthShell>
  );
}
