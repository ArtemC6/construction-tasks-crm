import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ROLE_LABELS } from '../lib/status';
import { Button, ErrorMessage, Loading } from './ui';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`;

// Обёртка для страниц, доступных после входа.
export function RequireAuth() {
  const { session, profile, isLoading, profileError, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="p-8">
        <Loading />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8">
        <ErrorMessage error={profileError ?? 'Профиль пользователя не найден. Обратитесь к администратору.'} />
        <Button variant="secondary" onClick={signOut}>
          Выйти
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-4 font-semibold text-slate-900">Объекты и задачи</span>
          <nav className="flex gap-1">
            {profile.role === 'executor' && (
              <NavLink to="/my-tasks" className={navLinkClass}>
                Мои задачи
              </NavLink>
            )}
            <NavLink to="/sites" className={navLinkClass}>
              Объекты
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-slate-600">
              {profile.full_name} · {ROLE_LABELS[profile.role]}
            </span>
            <Button variant="secondary" onClick={signOut}>
              Выйти
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
