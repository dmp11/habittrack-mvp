import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../context/AuthContext';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({
        email,
        password,
        name: name.trim() || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      navigate('/', { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Начать бесплатно" subtitle="Создайте аккаунт и добавьте первую привычку">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Имя (необязательно)</label>
          <input id="name" className="input" autoComplete="name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Как к вам обращаться?" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <label className="label" htmlFor="password">Пароль</label>
          <input id="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className="input" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Не менее 8 символов" />
        </div>
        {error && <p className="alert-error" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Создаём аккаунт…' : 'Зарегистрироваться'}</button>
      </form>
      <p className="mt-5 text-center text-sm text-brand-muted">
        Уже есть аккаунт? <Link to="/login" className="link">Войти</Link>
      </p>
    </AuthShell>
  );
}
