import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Привычки', end: true },
  { to: '/stats', label: 'Статистика' },
  { to: '/settings', label: 'Настройки' },
];

function Logo() {
  // Иконка бренда сохраняет охранное поле исходного изображения (15% по периметру).
  return <img src="/brand/icon.png" alt="" aria-hidden="true" className="h-9 w-9 shrink-0" />;
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-brand-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-brand-ink" aria-label="HabitTrack — на главную">
            <Logo />
            <span className="text-lg font-extrabold tracking-tight">HabitTrack</span>
          </NavLink>

          <nav className="hidden gap-1 sm:flex" aria-label="Основная навигация">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-brand-mint text-brand-blue-strong' : 'text-brand-muted hover:bg-brand-soft'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-brand-muted lg:inline">{user?.name || user?.email}</span>
            <button type="button" onClick={handleLogout} className="btn-secondary min-h-9 px-3 py-1.5 text-xs sm:text-sm">
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:py-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-brand-line bg-white pb-[env(safe-area-inset-bottom)] sm:hidden" aria-label="Мобильная навигация">
        <div className="mx-auto grid max-w-md grid-cols-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${
                  isActive ? 'text-brand-blue-strong' : 'text-brand-muted'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
