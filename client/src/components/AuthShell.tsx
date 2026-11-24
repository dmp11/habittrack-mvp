import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center brand-tint px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center p-1">
          <img src="/brand/logo.png" alt="HabitTrack" className="h-24 w-auto p-1" />
        </div>

        <div className="card p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-brand-ink">{title}</h1>
          <p className="mt-1.5 text-base text-brand-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>

        <p className="mt-6 text-center text-sm font-medium text-brand-muted">
          Отслеживай. Закрепляй. Развивайся
        </p>
        <p className="mt-2 text-center text-sm text-brand-muted">
          <Link to="/login" className="link">Войти</Link>
        </p>
      </div>
    </main>
  );
}
