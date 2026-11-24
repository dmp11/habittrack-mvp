import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { AuthShell } from '../components/AuthShell';

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== confirm) return setError('Пароли не совпадают');
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      navigate('/login', { replace: true, state: { message: 'Пароль обновлён. Войдите с новым паролем.' } });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Ссылка недействительна" subtitle="В ссылке отсутствует токен восстановления">
        <Link to="/forgot-password" className="btn-primary w-full">Запросить новую ссылку</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Новый пароль" subtitle="Придумайте надёжный пароль длиной от 8 символов">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="password">Новый пароль</label>
          <input id="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className="input" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Повторите пароль</label>
          <input id="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className="input" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </div>
        {error && <p className="alert-error" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Сохраняем…' : 'Сохранить пароль'}</button>
      </form>
    </AuthShell>
  );
}
