import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Logo } from './Logo';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/alunos', label: 'Alunos' },
  { to: '/matriculas', label: 'Matrículas' },
  { to: '/planos', label: 'Planos' },
  { to: '/pagamentos', label: 'Pagamentos' },
  { to: '/checkin', label: 'Check-in' },
  { to: '/unidades', label: 'Unidades' },
  { to: '/usuarios', label: 'Usuários' },
];

const roleLabel: Record<string, string> = {
  ADMIN: 'Administrador',
  RECEPCAO: 'Recepção',
  INSTRUTOR: 'Instrutor',
  ALUNO: 'Aluno',
};

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-base">
      <aside className="flex w-60 flex-col border-r border-line bg-deep p-4">
        <div className="mb-8 px-2 pt-2">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-brand font-semibold text-black shadow-[0_0_24px_-6px_rgb(249_115_22/0.6)]'
                    : 'text-muted hover:bg-raised hover:text-ink'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line pt-3 text-sm">
          <p className="truncate font-medium text-ink">{user?.email}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-brand">
            {user?.role ? (roleLabel[user.role] ?? user.role) : ''}
          </p>
          <button
            onClick={() => void logout()}
            className="mt-2 text-xs text-red-600 hover:underline"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
