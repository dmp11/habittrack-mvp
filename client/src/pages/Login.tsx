import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const successMessage = (location.state as { message?: string } | null)?.message;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from || '/';
      navigate(from, { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="С возвращением!" subtitle="Войдите, чтобы продолжить отслеживать привычки">
      {successMessage && <p className="alert-success mb-4" role="status">{successMessage}</p>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="label" htmlFor="password">Пароль</label>
            <Link to="/forgot-password" className="link mb-1.5 text-xs">Забыли пароль?</Link>
          </div>
          <input id="password" type="password" autoComplete="current-password" required minLength={8} className="input" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Не менее 8 символов" />
        </div>
        {error && <p className="alert-error" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Входим…' : 'Войти'}</button>
      </form>
      <p className="mt-5 text-center text-sm text-brand-muted">
        Нет аккаунта? <Link to="/register" className="link">Зарегистрироваться</Link>
      </p>
    </AuthShell>
  );
}
